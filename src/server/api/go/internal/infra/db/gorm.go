package db

import (
	"regexp"
	"strings"
	"time"

	"github.com/memodb-io/Acontext/internal/config"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"gorm.io/plugin/opentelemetry/tracing"
)

func New(cfg *config.Config) (*gorm.DB, error) {
	gcfg := &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	}

	// Adjust DSN sslmode based on EnableTLS configuration
	dsn := cfg.Database.DSN
	if cfg.Database.EnableTLS {
		// Replace sslmode=disable with sslmode=require when TLS is enabled
		// Use regex to handle various formats (sslmode=disable, sslmode=disable, etc.)
		sslmodeRegex := regexp.MustCompile(`(?i)\bsslmode\s*=\s*\w+`)
		if sslmodeRegex.MatchString(dsn) {
			// Replace existing sslmode
			dsn = sslmodeRegex.ReplaceAllString(dsn, "sslmode=require")
		} else {
			// Append sslmode if not present
			if !strings.HasSuffix(dsn, " ") {
				dsn += " "
			}
			dsn += "sslmode=require"
		}
	}

	db, err := gorm.Open(postgres.Open(dsn), gcfg)
	if err != nil {
		return nil, err
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}
	sqlDB.SetMaxOpenConns(cfg.Database.MaxOpen)
	sqlDB.SetMaxIdleConns(cfg.Database.MaxIdle)
	sqlDB.SetConnMaxLifetime(1 * time.Hour)
	return db, nil
}

// RegisterOpenTelemetryPlugin registers the OpenTelemetry plugin for GORM
// This should be called after telemetry.SetupTracing() to ensure tracer provider is set
// The plugin will automatically use the global tracer provider set by telemetry.SetupTracing()
func RegisterOpenTelemetryPlugin(db *gorm.DB) error {
	// NewPlugin() automatically uses the global tracer provider
	return db.Use(tracing.NewPlugin())
}
