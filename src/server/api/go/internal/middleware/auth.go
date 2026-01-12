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
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/serializer"
	"github.com/memodb-io/Acontext/internal/pkg/utils/secrets"
	"github.com/memodb-io/Acontext/internal/pkg/utils/tokens"
)

// ProjectAuth returns a middleware that authenticates requests using project bearer tokens.
// It validates the token, looks up the project in the database, and sets the project in the context.
// It also sets the project_id attribute on the current span for telemetry filtering.
func ProjectAuth(cfg *config.Config, db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx := c.Request.Context()
		ctx, authSpan := otel.Tracer("middleware").Start(ctx, "project_auth",
			trace.WithAttributes(attribute.String("middleware", "project_auth")))

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
		if err := db.WithContext(ctx).Where(&model.Project{SecretKeyHMAC: lookup}).First(&project).Error; err != nil {
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
			_, verifySpan := otel.Tracer("middleware").Start(ctx, "project_auth.verify_secret")
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

		// Set project_id attribute on the current span for telemetry filtering
		rootSpan := trace.SpanFromContext(c.Request.Context())
		if rootSpan.SpanContext().IsValid() {
			rootSpan.SetAttributes(attribute.String("project_id", project.ID.String()))
		}

		authSpan.SetAttributes(
			attribute.String("project_id", project.ID.String()),
			attribute.Bool("authenticated", true),
		)
		authSpan.End()

		c.Set("project", &project)
		c.Next()
	}
}
