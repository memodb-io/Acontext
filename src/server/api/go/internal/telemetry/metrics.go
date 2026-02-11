package telemetry

import (
	"context"
	"fmt"
	"time"

	"github.com/memodb-io/Acontext/internal/config"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	semconv "go.opentelemetry.io/otel/semconv/v1.24.0"
)

var (
	meterProvider *sdkmetric.MeterProvider
)

// SetupMetrics initializes OpenTelemetry metrics
func SetupMetrics(cfg *config.Config) (*sdkmetric.MeterProvider, error) {
	// Check if metrics are enabled
	if !cfg.Telemetry.Enabled || cfg.Telemetry.OtlpEndpoint == "" {
		// Metrics disabled, return nil
		return nil, nil
	}

	// Create resource with service name and version
	res, err := resource.New(
		context.Background(),
		resource.WithAttributes(
			semconv.ServiceName(cfg.App.Name),
			semconv.ServiceVersion("0.0.1"),
			semconv.DeploymentEnvironment(cfg.App.Env),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create resource: %w", err)
	}

	// Create OTLP exporter for metrics
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	metricExporter, err := otlpmetricgrpc.New(
		ctx,
		otlpmetricgrpc.WithEndpoint(cfg.Telemetry.OtlpEndpoint),
		otlpmetricgrpc.WithInsecure(), // Set to false for TLS in production
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create OTLP metric exporter: %w", err)
	}

	// Create meter provider with periodic reader
	meterProvider = sdkmetric.NewMeterProvider(
		sdkmetric.WithResource(res),
		sdkmetric.WithReader(
			sdkmetric.NewPeriodicReader(
				metricExporter,
				sdkmetric.WithInterval(10*time.Second), // Export metrics every 10 seconds
			),
		),
	)

	// Set global meter provider
	otel.SetMeterProvider(meterProvider)

	return meterProvider, nil
}

// ShutdownMetrics gracefully shuts down the meter provider
func ShutdownMetrics(ctx context.Context) error {
	if meterProvider != nil {
		return meterProvider.Shutdown(ctx)
	}
	return nil
}
