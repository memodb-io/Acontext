package cache

import (
	"context"
	"crypto/tls"

	"github.com/memodb-io/Acontext/internal/config"
	"github.com/redis/go-redis/extra/redisotel/v9"
	"github.com/redis/go-redis/v9"
)

func New(cfg *config.Config) (*redis.Client, error) {
	opts := &redis.Options{
		Addr:     cfg.Redis.Addr,
		Password: cfg.Redis.Password,
		DB:       cfg.Redis.DB,
		PoolSize: cfg.Redis.PoolSize,
	}

	// Enable TLS if configured
	if cfg.Redis.EnableTLS {
		opts.TLSConfig = &tls.Config{
			MinVersion: tls.VersionTLS12,
		}
	}

	rdb := redis.NewClient(opts)

	if err := rdb.Ping(context.Background()).Err(); err != nil {
		return nil, err
	}

	return rdb, nil
}

// RegisterOpenTelemetryPlugin registers the OpenTelemetry plugin for Redis
// This should be called after telemetry.SetupTracing() to ensure tracer provider is set
// The plugin will automatically use the global tracer provider set by telemetry.SetupTracing()
func RegisterOpenTelemetryPlugin(rdb *redis.Client) error {
	// InstrumentTracing automatically uses the global tracer provider
	return redisotel.InstrumentTracing(rdb)
}

func Close(rdb *redis.Client) error {
	return rdb.Close()
}
