package telemetry

import (
	"context"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
)

var (
	// Session fork metrics
	sessionForkCounter  metric.Int64Counter
	sessionForkDuration metric.Float64Histogram
	sessionForkSize     metric.Int64Histogram

	// Session fork error metrics
	sessionForkErrorCounter metric.Int64Counter
)

// InitSessionMetrics initializes session-related metrics
func InitSessionMetrics() error {
	meter := otel.Meter("acontext.session")

	var err error

	// Fork operation counter
	sessionForkCounter, err = meter.Int64Counter(
		"session.fork.count",
		metric.WithDescription("Number of session fork operations"),
		metric.WithUnit("{operation}"),
	)
	if err != nil {
		return err
	}

	// Fork operation duration
	sessionForkDuration, err = meter.Float64Histogram(
		"session.fork.duration",
		metric.WithDescription("Duration of session fork operations"),
		metric.WithUnit("ms"),
	)
	if err != nil {
		return err
	}

	// Fork operation size (messages + tasks copied)
	sessionForkSize, err = meter.Int64Histogram(
		"session.fork.size",
		metric.WithDescription("Size of session fork operations (messages + tasks)"),
		metric.WithUnit("{items}"),
	)
	if err != nil {
		return err
	}

	// Fork error counter
	sessionForkErrorCounter, err = meter.Int64Counter(
		"session.fork.errors",
		metric.WithDescription("Number of session fork errors"),
		metric.WithUnit("{error}"),
	)
	if err != nil {
		return err
	}

	return nil
}

// RecordForkSuccess records a successful fork operation
func RecordForkSuccess(ctx context.Context, durationMs float64, messageCount, taskCount int64) {
	if sessionForkCounter != nil {
		sessionForkCounter.Add(ctx, 1,
			metric.WithAttributes(attribute.String("status", "success")),
		)
	}

	if sessionForkDuration != nil {
		sessionForkDuration.Record(ctx, durationMs,
			metric.WithAttributes(attribute.String("status", "success")),
		)
	}

	if sessionForkSize != nil {
		sessionForkSize.Record(ctx, messageCount+taskCount,
			metric.WithAttributes(
				attribute.Int64("messages", messageCount),
				attribute.Int64("tasks", taskCount),
			),
		)
	}
}

// RecordForkError records a fork operation error
func RecordForkError(ctx context.Context, errorType string, durationMs float64) {
	if sessionForkErrorCounter != nil {
		sessionForkErrorCounter.Add(ctx, 1,
			metric.WithAttributes(attribute.String("error_type", errorType)),
		)
	}

	if sessionForkDuration != nil {
		sessionForkDuration.Record(ctx, durationMs,
			metric.WithAttributes(
				attribute.String("status", "error"),
				attribute.String("error_type", errorType),
			),
		)
	}
}
