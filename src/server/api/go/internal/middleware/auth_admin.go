package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	supabaseauth "github.com/supabase-community/auth-go"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/memodb-io/Acontext/internal/config"
	"github.com/memodb-io/Acontext/internal/modules/serializer"
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
