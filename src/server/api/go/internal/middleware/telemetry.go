package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin"
	"go.opentelemetry.io/otel/trace"
)

// OtelTracing returns a middleware for OpenTelemetry instrumentation.
// It only traces requests that match /api/ paths to reduce overhead.
func OtelTracing(serviceName string) gin.HandlerFunc {
	otelMiddleware := otelgin.Middleware(serviceName)

	return func(c *gin.Context) {
		// Only instrument requests that start with /api/
		path := c.Request.URL.Path
		if strings.HasPrefix(path, "/api/") {
			otelMiddleware(c)
		} else {
			// Skip OpenTelemetry instrumentation for non-API paths
			c.Next()
		}
	}
}

// TraceID returns a middleware that adds trace ID to response headers.
// This is useful for correlating logs and traces in distributed systems.
func TraceID() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get current span from context
		span := trace.SpanFromContext(c.Request.Context())
		if span.SpanContext().IsValid() {
			// Add trace ID to response header
			traceID := span.SpanContext().TraceID().String()
			c.Header("X-Trace-Id", traceID)
		}
		c.Next()
	}
}
