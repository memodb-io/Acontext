package middleware

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"gorm.io/gorm"

	"github.com/memodb-io/Acontext/internal/config"
	encryptionpkg "github.com/memodb-io/Acontext/internal/infra/crypto"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/serializer"
	"github.com/memodb-io/Acontext/internal/pkg/utils/secrets"
	"github.com/memodb-io/Acontext/internal/pkg/utils/tokens"
)

// GetUserKEK extracts the user KEK from gin context.
// Returns the KEK regardless of project encryption status.
// Use this for admin endpoints that need KEK even when encryption is not yet enabled.
func GetUserKEK(c *gin.Context) []byte {
	v, exists := c.Get("user_kek")
	if !exists {
		return nil
	}
	kek, ok := v.([]byte)
	if !ok {
		return nil
	}
	return kek
}

// GetUserKEKIfEncrypted returns the user KEK only if the project has encryption enabled.
// Returns nil for non-encrypted projects (data operations should not encrypt).
// Use this for regular API handlers (upload/download/store message).
func GetUserKEKIfEncrypted(c *gin.Context) []byte {
	p, exists := c.Get("project")
	if !exists {
		return nil
	}
	project, ok := p.(*model.Project)
	if !ok || project == nil || !project.EncryptionEnabled {
		return nil
	}
	return GetUserKEK(c)
}

// GetUserKEKBase64IfEncrypted returns the user KEK as a base64-encoded string
// if the project has encryption enabled. Returns empty string otherwise.
// Use this for material URL creation where the KEK needs to be serialized to Redis.
func GetUserKEKBase64IfEncrypted(c *gin.Context) string {
	kek := GetUserKEKIfEncrypted(c)
	if kek == nil {
		return ""
	}
	return base64.StdEncoding.EncodeToString(kek)
}

const (
	projectAuthCachePrefix = "project:auth:"
	projectAuthCacheTTL    = 5 * time.Minute
)

// ProjectAuth returns a middleware that authenticates requests using project bearer tokens.
// Token formats: compact (sk-ac-{base64url, 76 chars}) or legacy (sk-ac-{plain_secret}).
// For compact tokens, derives a KEK and stores it in context for downstream encryption.
// It caches project lookups in Redis to avoid hitting the database on every request.
func ProjectAuth(cfg *config.Config, db *gorm.DB, rdb *redis.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Create auth span without propagating context to avoid nested span hierarchy
		authCtx, authSpan := otel.Tracer("middleware").Start(
			c.Request.Context(),
			"project_auth",
			trace.WithAttributes(attribute.String("middleware", "project_auth")),
		)

		auth := c.GetHeader("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {
			authSpan.SetAttributes(attribute.Bool("authenticated", false))
			authSpan.End()
			c.AbortWithStatusJSON(http.StatusUnauthorized, serializer.AuthErr("Unauthorized"))
			return
		}
		raw := strings.TrimPrefix(auth, "Bearer ")

		parsed, ok := tokens.ParseProjectToken(raw, cfg.Root.ProjectBearerTokenPrefix)
		if !ok {
			authSpan.SetAttributes(attribute.Bool("authenticated", false))
			authSpan.End()
			c.AbortWithStatusJSON(http.StatusUnauthorized, serializer.AuthErr("Unauthorized"))
			return
		}

		// HMAC lookup uses auth_secret (both formats)
		lookup := tokens.HMAC256Hex(cfg.Root.SecretPepper, parsed.AuthSecret)

		project, err := lookupProject(authCtx, db, rdb, lookup)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				authSpan.SetAttributes(attribute.Bool("authenticated", false))
				authSpan.End()
				c.AbortWithStatusJSON(http.StatusUnauthorized, serializer.AuthErr("Unauthorized"))
				return
			}
			authSpan.RecordError(err)
			authSpan.End()
			c.AbortWithStatusJSON(http.StatusInternalServerError, serializer.DBErr("", err))
			return
		}

		// Argon2 verification uses auth_secret (both formats)
		if cfg.Root.EnableArgon2Verification {
			_, verifySpan := otel.Tracer("middleware").Start(authCtx, "project_auth.verify_secret")
			pass, err := secrets.VerifySecret(parsed.AuthSecret, cfg.Root.SecretPepper, project.SecretKeyHashPHC)
			verifySpan.End()
			if err != nil || !pass {
				authSpan.SetAttributes(
					attribute.String("project_id", project.ID.String()),
					attribute.Bool("authenticated", false),
				)
				authSpan.End()
				c.AbortWithStatusJSON(http.StatusUnauthorized, serializer.AuthErr("Unauthorized"))
				return
			}
		}

		// Set project_id on HTTP span for telemetry filtering
		httpSpan := trace.SpanFromContext(c.Request.Context())
		if httpSpan.SpanContext().IsValid() {
			httpSpan.SetAttributes(attribute.String("project_id", project.ID.String()))
		}

		authSpan.SetAttributes(
			attribute.String("project_id", project.ID.String()),
			attribute.Bool("authenticated", true),
		)
		authSpan.End()

		c.Set("project", project)
		SetWideEventField(c, "project_id", project.ID.String())

		// Derive KEK from compact token if present.
		// Legacy keys without CompactRaw have no encryption support.
		if parsed.CompactRaw != "" {
			_, userKEK, kerr := encryptionpkg.UnpackCompactToken(parsed.CompactRaw, cfg.Root.SecretPepper)
			if kerr != nil {
				c.AbortWithStatusJSON(http.StatusUnauthorized, serializer.AuthErr("invalid API key: failed to unwrap compact token"))
				return
			}
			c.Set("user_kek", userKEK)
		}

		c.Next()
	}
}

// InvalidateProjectAuthCache removes a project's auth cache entry from Redis.
// Call this after any operation that changes project state cached here
// (e.g., encryption_enabled flag, key rotation).
func InvalidateProjectAuthCache(rdb *redis.Client, hmac string) {
	if rdb == nil || hmac == "" {
		return
	}
	_ = rdb.Del(context.Background(), projectAuthCachePrefix+hmac).Err()
}

// projectAuthCache is a Redis-serializable subset of model.Project.
// model.Project uses json:"-" on secret fields to prevent API leakage,
// but we need those fields for auth validation in the cache.
type projectAuthCache struct {
	ID                string `json:"id"`
	SecretKeyHMAC     string `json:"secret_key_hmac"`
	SecretKeyHashPHC  string `json:"secret_key_hash_phc"`
	EncryptionEnabled bool   `json:"encryption_enabled"`
}

// lookupProject tries Redis cache first, falls back to DB on miss or Redis error.
func lookupProject(ctx context.Context, db *gorm.DB, rdb *redis.Client, hmac string) (*model.Project, error) {
	cacheKey := projectAuthCachePrefix + hmac

	// Try Redis first
	if rdb != nil {
		data, err := rdb.Get(ctx, cacheKey).Bytes()
		if err == nil {
			var cached projectAuthCache
			if json.Unmarshal(data, &cached) == nil && cached.SecretKeyHMAC != "" {
				project := &model.Project{
					SecretKeyHMAC:     cached.SecretKeyHMAC,
					SecretKeyHashPHC:  cached.SecretKeyHashPHC,
					EncryptionEnabled: cached.EncryptionEnabled,
				}
				if id, err := uuid.Parse(cached.ID); err == nil {
					project.ID = id
				}
				return project, nil
			}
		}
		// On redis.Nil or any other error, fall through to DB
	}

	// DB lookup
	var project model.Project
	if err := db.WithContext(ctx).Where(&model.Project{SecretKeyHMAC: hmac}).First(&project).Error; err != nil {
		return nil, err
	}

	// Write-back to Redis (best-effort, don't block on failure)
	if rdb != nil {
		cached := projectAuthCache{
			ID:                project.ID.String(),
			SecretKeyHMAC:     project.SecretKeyHMAC,
			SecretKeyHashPHC:  project.SecretKeyHashPHC,
			EncryptionEnabled: project.EncryptionEnabled,
		}
		if data, err := json.Marshal(&cached); err == nil {
			_ = rdb.Set(ctx, cacheKey, data, projectAuthCacheTTL).Err()
		}
	}

	return &project, nil
}
