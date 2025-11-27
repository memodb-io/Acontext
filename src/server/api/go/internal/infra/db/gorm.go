package db

import (
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
	db, err := gorm.Open(postgres.Open(cfg.Database.DSN), gcfg)
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
