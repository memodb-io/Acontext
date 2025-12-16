package middleware

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
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
		auth := c.GetHeader("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, serializer.AuthErr("Unauthorized"))
			return
		}
		raw := strings.TrimPrefix(auth, "Bearer ")

		secret, ok := tokens.ParseToken(raw, cfg.Root.ProjectBearerTokenPrefix)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, serializer.AuthErr("Unauthorized"))
			return
		}

		lookup := tokens.HMAC256Hex(cfg.Root.SecretPepper, secret)

		var project model.Project
		if err := db.WithContext(c.Request.Context()).Where(&model.Project{SecretKeyHMAC: lookup}).First(&project).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				c.AbortWithStatusJSON(http.StatusUnauthorized, serializer.AuthErr("Unauthorized"))
				return
			}
			c.AbortWithStatusJSON(http.StatusInternalServerError, serializer.DBErr("", err))
			return
		}

		pass, err := secrets.VerifySecret(secret, cfg.Root.SecretPepper, project.SecretKeyHashPHC)
		if err != nil || !pass {
			c.AbortWithStatusJSON(http.StatusUnauthorized, serializer.AuthErr("Unauthorized"))
			return
		}

		// Set project_id attribute on the current span for telemetry filtering
		span := trace.SpanFromContext(c.Request.Context())
		if span.SpanContext().IsValid() {
			span.SetAttributes(attribute.String("project_id", project.ID.String()))
		}

		c.Set("project", &project)
		c.Next()
	}
}
