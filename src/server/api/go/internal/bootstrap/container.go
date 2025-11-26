package bootstrap

import (
	"context"
	"time"

	"github.com/memodb-io/Acontext/internal/config"
	"github.com/memodb-io/Acontext/internal/infra/blob"
	"github.com/memodb-io/Acontext/internal/infra/cache"
	"github.com/memodb-io/Acontext/internal/infra/db"
	"github.com/memodb-io/Acontext/internal/infra/httpclient"
	"github.com/memodb-io/Acontext/internal/infra/logger"
	mq "github.com/memodb-io/Acontext/internal/infra/queue"
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
		log := do.MustInvoke[*zap.Logger](i)
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
				&model.Task{},
				&model.Message{},
				&model.Block{},
				&model.Disk{},
				&model.Artifact{},
				&model.AssetReference{},
				&model.ToolReference{},
				&model.ToolSOP{},
				&model.ExperienceConfirmation{},
			)
		}

		// ensure default project exists
		if err := EnsureDefaultProjectExists(context.Background(), d, cfg, log); err != nil {
			return nil, err
		}

		return d, nil
	})

	// Redis
	do.Provide(inj, func(i *do.Injector) (*redis.Client, error) {
		cfg := do.MustInvoke[*config.Config](i)
		return cache.New(cfg)
	})

	// RabbitMQ Connection
	do.Provide(inj, func(i *do.Injector) (*amqp.Connection, error) {
		cfg := do.MustInvoke[*config.Config](i)
		return amqp.Dial(cfg.RabbitMQ.URL)
	})

	// RabbitMQ Publisher
	do.Provide(inj, func(i *do.Injector) (*mq.Publisher, error) {
		conn := do.MustInvoke[*amqp.Connection](i)
		log := do.MustInvoke[*zap.Logger](i)
		return mq.NewPublisher(conn, log)
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

	// Core HTTP Client
	do.Provide(inj, func(i *do.Injector) (*httpclient.CoreClient, error) {
		cfg := do.MustInvoke[*config.Config](i)
		log := do.MustInvoke[*zap.Logger](i)
		return httpclient.NewCoreClient(cfg, log), nil
	})

	// Repo
	do.Provide(inj, func(i *do.Injector) (repo.AssetReferenceRepo, error) {
		return repo.NewAssetReferenceRepo(
			do.MustInvoke[*gorm.DB](i),
			do.MustInvoke[*blob.S3Deps](i),
		), nil
	})
	do.Provide(inj, func(i *do.Injector) (repo.SpaceRepo, error) {
		return repo.NewSpaceRepo(do.MustInvoke[*gorm.DB](i)), nil
	})
	do.Provide(inj, func(i *do.Injector) (repo.SessionRepo, error) {
		return repo.NewSessionRepo(
			do.MustInvoke[*gorm.DB](i),
			do.MustInvoke[repo.AssetReferenceRepo](i),
			do.MustInvoke[*blob.S3Deps](i),
			do.MustInvoke[*zap.Logger](i),
		), nil
	})
	do.Provide(inj, func(i *do.Injector) (repo.BlockRepo, error) {
		return repo.NewBlockRepo(do.MustInvoke[*gorm.DB](i)), nil
	})
	do.Provide(inj, func(i *do.Injector) (repo.DiskRepo, error) {
		return repo.NewDiskRepo(
			do.MustInvoke[*gorm.DB](i),
			do.MustInvoke[repo.AssetReferenceRepo](i),
		), nil
	})
	do.Provide(inj, func(i *do.Injector) (repo.ArtifactRepo, error) {
		return repo.NewArtifactRepo(
			do.MustInvoke[*gorm.DB](i),
			do.MustInvoke[repo.AssetReferenceRepo](i),
		), nil
	})
	do.Provide(inj, func(i *do.Injector) (repo.TaskRepo, error) {
		return repo.NewTaskRepo(do.MustInvoke[*gorm.DB](i)), nil
	})

	// Service
	do.Provide(inj, func(i *do.Injector) (service.SpaceService, error) {
		return service.NewSpaceService(do.MustInvoke[repo.SpaceRepo](i)), nil
	})
	do.Provide(inj, func(i *do.Injector) (service.SessionService, error) {
		return service.NewSessionService(
			do.MustInvoke[repo.SessionRepo](i),
			do.MustInvoke[repo.AssetReferenceRepo](i),
			do.MustInvoke[*zap.Logger](i),
			do.MustInvoke[*blob.S3Deps](i),
			do.MustInvoke[*mq.Publisher](i),
			do.MustInvoke[*config.Config](i),
			do.MustInvoke[*redis.Client](i),
		), nil
	})
	do.Provide(inj, func(i *do.Injector) (service.BlockService, error) {
		return service.NewBlockService(do.MustInvoke[repo.BlockRepo](i)), nil
	})
	do.Provide(inj, func(i *do.Injector) (service.DiskService, error) {
		return service.NewDiskService(do.MustInvoke[repo.DiskRepo](i)), nil
	})
	do.Provide(inj, func(i *do.Injector) (service.ArtifactService, error) {
		return service.NewArtifactService(
			do.MustInvoke[repo.ArtifactRepo](i),
			do.MustInvoke[*blob.S3Deps](i),
		), nil
	})
	do.Provide(inj, func(i *do.Injector) (service.TaskService, error) {
		return service.NewTaskService(
			do.MustInvoke[repo.TaskRepo](i),
			do.MustInvoke[*zap.Logger](i),
		), nil
	})

	// Handler
	do.Provide(inj, func(i *do.Injector) (*handler.SpaceHandler, error) {
		return handler.NewSpaceHandler(
			do.MustInvoke[service.SpaceService](i),
			do.MustInvoke[*httpclient.CoreClient](i),
		), nil
	})
	do.Provide(inj, func(i *do.Injector) (*handler.SessionHandler, error) {
		return handler.NewSessionHandler(
			do.MustInvoke[service.SessionService](i),
			do.MustInvoke[*httpclient.CoreClient](i),
		), nil
	})
	do.Provide(inj, func(i *do.Injector) (*handler.BlockHandler, error) {
		return handler.NewBlockHandler(
			do.MustInvoke[service.BlockService](i),
			do.MustInvoke[*httpclient.CoreClient](i),
		), nil
	})
	do.Provide(inj, func(i *do.Injector) (*handler.DiskHandler, error) {
		return handler.NewDiskHandler(do.MustInvoke[service.DiskService](i)), nil
	})
	do.Provide(inj, func(i *do.Injector) (*handler.ArtifactHandler, error) {
		return handler.NewArtifactHandler(do.MustInvoke[service.ArtifactService](i)), nil
	})
	do.Provide(inj, func(i *do.Injector) (*handler.TaskHandler, error) {
		return handler.NewTaskHandler(do.MustInvoke[service.TaskService](i)), nil
	})
	do.Provide(inj, func(i *do.Injector) (*handler.ToolHandler, error) {
		return handler.NewToolHandler(do.MustInvoke[*httpclient.CoreClient](i)), nil
	})

	return inj
}
