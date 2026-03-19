package middleware

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
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
// Returns nil if encryption is disabled or KEK is not set.
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

// ProjectAuth returns a middleware that authenticates requests using project bearer tokens.
// When encryption is enabled, it derives a user KEK from the raw API key and stores it in context.
func ProjectAuth(cfg *config.Config, db *gorm.DB, encSvc *encryptionpkg.EncryptionService) gin.HandlerFunc {
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

		var project model.Project
		if err := db.WithContext(authCtx).Where(&model.Project{SecretKeyHMAC: lookup}).First(&project).Error; err != nil {
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

		c.Set("project", &project)
		SetWideEventField(c, "project_id", project.ID.String())

		// Derive user KEK when encryption is enabled
		if encSvc != nil && encSvc.Enabled() {
			userKEK, kerr := encryptionpkg.DeriveUserKEK(secret, cfg.Root.SecretPepper)
			if kerr != nil {
				authSpan.RecordError(kerr)
				authSpan.End()
				c.AbortWithStatusJSON(http.StatusInternalServerError, serializer.DBErr("derive user KEK", kerr))
				return
			}
			c.Set("user_kek", userKEK)
		}

		c.Next()
	}
}
