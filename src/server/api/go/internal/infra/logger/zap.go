package logger

import (
	"os"
	"strings"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

func New(level string) (*zap.Logger, error) {
	cfg := zap.NewProductionConfig()
	switch strings.ToLower(level) {
	case "debug":
		cfg.Level = zap.NewAtomicLevelAt(zap.DebugLevel)
	case "info":
		cfg.Level = zap.NewAtomicLevelAt(zap.InfoLevel)
	case "warn":
		cfg.Level = zap.NewAtomicLevelAt(zap.WarnLevel)
	case "error":
		cfg.Level = zap.NewAtomicLevelAt(zap.ErrorLevel)
	}
	cfg.EncoderConfig.TimeKey = "timestamp"
	cfg.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder

	// Embed environment context into every log line.
	// These fields are captured once at startup and included automatically,
	// enabling deployment-correlated debugging (wide event best practice).
	cfg.InitialFields = envFields()

	return cfg.Build()
}

// envFields reads deployment/environment metadata from well-known env vars.
// Only non-empty values are included.
func envFields() map[string]interface{} {
	fields := make(map[string]interface{})
	pairs := [][2]string{
		{"service_version", "APP_SERVICE_VERSION"},
		{"commit_hash", "APP_COMMIT_SHA"},
	}
	for _, p := range pairs {
		if v := os.Getenv(p[1]); v != "" {
			fields[p[0]] = v
		}
	}
	return fields
}
