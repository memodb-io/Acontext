package bootstrap

import (
	"context"
	"time"

	"github.com/memodb-io/Acontext/internal/config"
	"github.com/memodb-io/Acontext/internal/infra/blob"
	"github.com/memodb-io/Acontext/internal/infra/cache"
	"github.com/memodb-io/Acontext/internal/infra/db"
	"github.com/memodb-io/Acontext/internal/infra/logger"
	"github.com/memodb-io/Acontext/internal/modules/handler"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/repo"
	"github.com/memodb-io/Acontext/internal/modules/service"
	amqp "github.com/rabbitmq/amqp091-go"
	"github.com/redis/go-redis/v9"
	"github.com/samber/do"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

func BuildContainer() *do.Injector {
	inj := do.New()

	// config
	do.Provide(inj, func(i *do.Injector) (*config.Config, error) {
		return config.Load()
	})

	// logger
	do.Provide(inj, func(i *do.Injector) (*zap.Logger, error) {
		cfg := do.MustInvoke[*config.Config](i)
		return logger.New(cfg.Log.Level)
	})

	// DB
	do.Provide(inj, func(i *do.Injector) (*gorm.DB, error) {
		cfg := do.MustInvoke[*config.Config](i)
		d, err := db.New(cfg)
		if err != nil {
			return nil, err
		}
		// [optional] auto migrate
		if cfg.Database.AutoMigrate {
			_ = d.AutoMigrate(
				&model.Project{},
				&model.Space{},
				&model.Session{},
				&model.Message{},
				&model.Asset{},
				&model.MessageAsset{},
			)
		}

		// ensure default project exists
		if err := EnsureDefaultProjectExists(context.Background(), d, cfg); err != nil {
			return nil, err
		}

		return d, nil
	})

	// Redis
	do.Provide(inj, func(i *do.Injector) (*redis.Client, error) {
		cfg := do.MustInvoke[*config.Config](i)
		rdb := cache.New(cfg)
		return rdb, nil
	})

	// RabbitMQ Connection
	do.Provide(inj, func(i *do.Injector) (*amqp.Connection, error) {
		cfg := do.MustInvoke[*config.Config](i)
		return amqp.Dial(cfg.RabbitMQ.URL)
	})

	// S3
	do.Provide(inj, func(i *do.Injector) (*blob.S3Deps, error) {
		cfg := do.MustInvoke[*config.Config](i)
		return blob.NewS3(context.Background(), cfg)
	})
	// get presign expire duration
	do.Provide(inj, func(i *do.Injector) (func() time.Duration, error) {
		cfg := do.MustInvoke[*config.Config](i)
		return func() time.Duration {
			if cfg.S3.PresignExpireSec <= 0 {
				return 15 * time.Minute
			}
			return time.Duration(cfg.S3.PresignExpireSec) * time.Second
		}, nil
	})

	// Repo
	do.Provide(inj, func(i *do.Injector) (repo.SpaceRepo, error) {
		return repo.NewSpaceRepo(do.MustInvoke[*gorm.DB](i)), nil
	})
	do.Provide(inj, func(i *do.Injector) (repo.SessionRepo, error) {
		return repo.NewSessionRepo(do.MustInvoke[*gorm.DB](i)), nil
	})

	// Service
	do.Provide(inj, func(i *do.Injector) (service.SpaceService, error) {
		return service.NewSpaceService(do.MustInvoke[repo.SpaceRepo](i)), nil
	})
	do.Provide(inj, func(i *do.Injector) (service.SessionService, error) {
		return service.NewSessionService(
			do.MustInvoke[repo.SessionRepo](i),
			do.MustInvoke[*zap.Logger](i),
			do.MustInvoke[*blob.S3Deps](i),
			do.MustInvoke[*amqp.Connection](i),
			do.MustInvoke[*config.Config](i),
		), nil
	})

	// Handler
	do.Provide(inj, func(i *do.Injector) (*handler.SpaceHandler, error) {
		return handler.NewSpaceHandler(do.MustInvoke[service.SpaceService](i)), nil
	})
	do.Provide(inj, func(i *do.Injector) (*handler.SessionHandler, error) {
		return handler.NewSessionHandler(do.MustInvoke[service.SessionService](i)), nil
	})

	return inj
}
