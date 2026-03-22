package middleware

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	supabaseauth "github.com/supabase-community/auth-go"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"gorm.io/gorm"

	"github.com/memodb-io/Acontext/internal/config"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/serializer"
	"github.com/memodb-io/Acontext/internal/pkg/utils/tokens"
)

// SupabaseAuth returns a middleware that authenticates requests using Supabase JWT tokens.
// It validates the token with Supabase Auth API, retrieves the user information,
// and sets the user in the context. It also sets the user_id attribute on the current span for telemetry filtering.
// The token should be provided in the X-Access-Token header.
func SupabaseAuth(cfg *config.Config) gin.HandlerFunc {
	// Initialize Supabase auth client once (reused across requests)
	client := supabaseauth.New(cfg.Supabase.ProjectReference, cfg.Supabase.APIKey)
	if cfg.Supabase.AuthURL != "" {
		client = client.WithCustomAuthURL(cfg.Supabase.AuthURL)
	}

	return func(c *gin.Context) {
		// Get token from X-Access-Token header
		token := c.GetHeader("X-Access-Token")
		if token == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, serializer.AuthErr("Missing X-Access-Token header"))
			return
		}

		// Check if Supabase is configured
		if cfg.Supabase.ProjectReference == "" || cfg.Supabase.APIKey == "" {
			c.AbortWithStatusJSON(http.StatusInternalServerError, serializer.Err(http.StatusInternalServerError, "Supabase not configured", nil))
			return
		}

		// Create authenticated client with token (per-request)
		authedClient := client.WithToken(token)

		// Verify token and get user information
		user, err := authedClient.GetUser()
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, serializer.AuthErr("Invalid token"))
			return
		}

		// Set user_id attribute on the current span for telemetry filtering
		span := trace.SpanFromContext(c.Request.Context())
		if span.SpanContext().IsValid() {
			span.SetAttributes(attribute.String("user_id", user.ID.String()))
		}

		// Set user in context for use in handlers
		c.Set("user", user)
		c.Next()
	}
}

// AdminProjectAuth returns a middleware that authenticates requests using the Dashboard's
// base64 JSON project token format (project_id + signature verified against ApiBearerToken).
// This is used by the admin router to override the default ProjectAuth (which uses HMAC secret key lookup).
func AdminProjectAuth(cfg *config.Config, db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		_, authSpan := otel.Tracer("middleware").Start(
			c.Request.Context(),
			"admin_project_auth",
			trace.WithAttributes(attribute.String("middleware", "admin_project_auth")),
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

		// Parse and verify project token (base64 JSON with signature)
		tokenData, err := tokens.ParseAndVerifyProjectToken(secret, cfg.Root.ApiBearerToken)
		if err != nil {
			authSpan.End()
			c.AbortWithStatusJSON(http.StatusUnauthorized, serializer.AuthErr("Invalid token format"))
			return
		}
		if !tokenData.Valid {
			authSpan.End()
			c.AbortWithStatusJSON(http.StatusUnauthorized, serializer.AuthErr("Invalid token signature"))
			return
		}

		// Look up project by ID
		var project model.Project
		if err := db.WithContext(c.Request.Context()).Where(&model.Project{ID: tokenData.ProjectID}).First(&project).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				authSpan.End()
				c.AbortWithStatusJSON(http.StatusUnauthorized, serializer.AuthErr("Project not found"))
				return
			}
			authSpan.RecordError(err)
			authSpan.End()
			c.AbortWithStatusJSON(http.StatusInternalServerError, serializer.DBErr("", err))
			return
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
		c.Next()
	}
}

// MetricsAuth returns a middleware that authenticates requests using metrics bearer tokens.
func MetricsAuth(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		auth := c.GetHeader("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, serializer.AuthErr("Unauthorized"))
			return
		}
		raw := strings.TrimPrefix(auth, "Bearer ")

		if raw == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, serializer.AuthErr("Unauthorized"))
			return
		}

		if raw != cfg.Root.ApiBearerToken {
			c.AbortWithStatusJSON(http.StatusUnauthorized, serializer.AuthErr("Unauthorized"))
			return
		}

		c.Next()
	}
}
