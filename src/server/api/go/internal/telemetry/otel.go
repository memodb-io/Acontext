package telemetry

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/memodb-io/Acontext/internal/config"
	"go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.24.0"
	"go.opentelemetry.io/otel/trace"
)

var (
	tracerProvider *sdktrace.TracerProvider
)

// SetupTracing initializes OpenTelemetry tracing
func SetupTracing(cfg *config.Config) (*sdktrace.TracerProvider, error) {
	// Check if tracing is enabled
	if !cfg.Telemetry.Enabled || cfg.Telemetry.OtlpEndpoint == "" {
		// Tracing disabled, return nil
		return nil, nil
	}

	// Create resource with service name and version
	res, err := resource.New(
		context.Background(),
		resource.WithAttributes(
			semconv.ServiceNameKey.String(cfg.App.Name), // Use service name from config
			semconv.ServiceVersionKey.String("0.0.1"),
			attribute.String("environment", cfg.App.Env),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create resource: %w", err)
	}

	// Create OTLP exporter
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Strip http:// or https:// prefix from endpoint if present
	// otlptracegrpc.WithEndpoint expects host:port format, not a full URL
	endpoint := cfg.Telemetry.OtlpEndpoint
	endpoint = strings.TrimPrefix(endpoint, "http://")
	endpoint = strings.TrimPrefix(endpoint, "https://")

	exporter, err := otlptracegrpc.New(
		ctx,
		otlptracegrpc.WithEndpoint(endpoint),
		otlptracegrpc.WithInsecure(), // Set to false for TLS in production
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create OTLP exporter: %w", err)
	}

	// Create tracer provider with batch span processor
	// Configure sampling ratio (from config, default 1.0 = 100%)
	sampleRatio := cfg.Telemetry.SampleRatio
	if sampleRatio <= 0 {
		sampleRatio = 1.0 // Ensure at least 1.0
	}
	if sampleRatio > 1.0 {
		sampleRatio = 1.0 // Ensure not exceeding 1.0
	}

	var sampler sdktrace.Sampler
	if sampleRatio >= 1.0 {
		sampler = sdktrace.AlwaysSample() // 100% sampling
	} else {
		sampler = sdktrace.TraceIDRatioBased(sampleRatio) // Ratio-based sampling
	}

	tracerProvider = sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
		sdktrace.WithSampler(sampler),
	)

	// Set global tracer provider
	otel.SetTracerProvider(tracerProvider)

	// Set global propagator (important: for cross-service tracing)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))

	return tracerProvider, nil
}

// Shutdown gracefully shuts down the tracer provider
func Shutdown(ctx context.Context) error {
	if tracerProvider != nil {
		return tracerProvider.Shutdown(ctx)
	}
	return nil
}

// GinMiddleware returns Gin middleware for OpenTelemetry instrumentation
// Only traces requests that match /api/ paths
func GinMiddleware(serviceName string) gin.HandlerFunc {
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

// TraceIDMiddleware returns a Gin middleware that adds trace ID to response headers
func TraceIDMiddleware() gin.HandlerFunc {
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
