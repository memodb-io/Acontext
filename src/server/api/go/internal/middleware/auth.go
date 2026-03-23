package middleware

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"gorm.io/gorm"

	"github.com/memodb-io/Acontext/internal/config"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/serializer"
	"github.com/memodb-io/Acontext/internal/pkg/utils/secrets"
	"github.com/memodb-io/Acontext/internal/pkg/utils/tokens"
)

const (
	projectAuthCachePrefix = "project:auth:"
	projectAuthCacheTTL    = 5 * time.Minute
)

// ProjectAuth returns a middleware that authenticates requests using project bearer tokens.
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

		secret, ok := tokens.ParseToken(raw, cfg.Root.ProjectBearerTokenPrefix)
		if !ok {
			authSpan.SetAttributes(attribute.Bool("authenticated", false))
			authSpan.End()
			c.AbortWithStatusJSON(http.StatusUnauthorized, serializer.AuthErr("Unauthorized"))
			return
		}

		lookup := tokens.HMAC256Hex(cfg.Root.SecretPepper, secret)

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

		if cfg.Root.EnableArgon2Verification {
			_, verifySpan := otel.Tracer("middleware").Start(authCtx, "project_auth.verify_secret")
			pass, err := secrets.VerifySecret(secret, cfg.Root.SecretPepper, project.SecretKeyHashPHC)
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
		c.Next()
	}
}

// lookupProject tries Redis cache first, falls back to DB on miss or Redis error.
func lookupProject(ctx context.Context, db *gorm.DB, rdb *redis.Client, hmac string) (*model.Project, error) {
	cacheKey := projectAuthCachePrefix + hmac

	// Try Redis first
	if rdb != nil {
		data, err := rdb.Get(ctx, cacheKey).Bytes()
		if err == nil {
			var project model.Project
			if json.Unmarshal(data, &project) == nil {
				return &project, nil
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
		if data, err := json.Marshal(&project); err == nil {
			_ = rdb.Set(ctx, cacheKey, data, projectAuthCacheTTL).Err()
		}
	}

	return &project, nil
}
