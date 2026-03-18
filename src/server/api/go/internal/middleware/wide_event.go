package middleware

import (
	"time"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel/trace"
	"go.uber.org/zap"
)

const wideEventKey = "wide_event"

// WideEvent returns a middleware that emits a single structured "wide event"
// (canonical log line) per request at completion. Other middleware and handlers
// can enrich the event via SetWideEventField.
//
// This replaces scattered per-request log lines with one context-rich event,
// following the canonical log lines pattern (https://stripe.com/blog/canonical-log-lines).
func WideEvent(log *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		// Initialize wide event on context
		event := make(map[string]interface{}, 16)
		event["method"] = c.Request.Method
		event["path"] = c.Request.URL.Path
		if q := c.Request.URL.RawQuery; q != "" {
			event["query"] = q
		}
		event["client_ip"] = c.ClientIP()

		// Attach trace/span ID from OpenTelemetry if available
		span := trace.SpanFromContext(c.Request.Context())
		if span.SpanContext().IsValid() {
			event["trace_id"] = span.SpanContext().TraceID().String()
			event["span_id"] = span.SpanContext().SpanID().String()
		}

		c.Set(wideEventKey, event)

		// Process request
		c.Next()

		// Finalize event
		latency := time.Since(start)
		event["status"] = c.Writer.Status()
		event["latency_ms"] = latency.Milliseconds()
		event["response_size"] = c.Writer.Size()

		// Collect any errors written to gin context
		if len(c.Errors) > 0 {
			event["gin_errors"] = c.Errors.String()
		}

		// Emit as structured fields
		fields := make([]zap.Field, 0, len(event))
		for k, v := range event {
			fields = append(fields, zap.Any(k, v))
		}

		status := c.Writer.Status()
		if status >= 500 {
			log.Error("request", fields...)
		} else {
			log.Info("request", fields...)
		}
	}
}

// GetWideEvent retrieves the wide event map from the gin context.
// Returns nil if the middleware is not active.
func GetWideEvent(c *gin.Context) map[string]interface{} {
	v, exists := c.Get(wideEventKey)
	if !exists {
		return nil
	}
	event, _ := v.(map[string]interface{})
	return event
}

// SetWideEventField sets a single field on the wide event.
// Safe to call even if the middleware is not active (no-op).
func SetWideEventField(c *gin.Context, key string, value interface{}) {
	if event := GetWideEvent(c); event != nil {
		event[key] = value
	}
}
