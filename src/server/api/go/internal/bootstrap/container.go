package bootstrap

import (
	"context"
	"crypto/tls"
	"strings"
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
		// NOTE: agent_skills.asset_meta and agent_skills.file_index columns are
		// deprecated as of the Disk migration. They are no longer used by the
		// application. Safe to drop manually:
		//   ALTER TABLE agent_skills DROP COLUMN IF EXISTS asset_meta;
		//   ALTER TABLE agent_skills DROP COLUMN IF EXISTS file_index;
		if cfg.Database.AutoMigrate {
			// Ensure pgvector extension exists
			_ = d.Exec("CREATE EXTENSION IF NOT EXISTS vector")

			_ = d.AutoMigrate(
				&model.Project{},
				&model.User{},
				&model.Session{},
				&model.Task{},
				&model.Message{},
				&model.Disk{},
				&model.Artifact{},
				&model.AssetReference{},
				&model.Metric{},
				&model.AgentSkills{},
				&model.SandboxLog{},
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

	// RabbitMQ DialFunc for connection and reconnection
	do.Provide(inj, func(i *do.Injector) (mq.DialFunc, error) {
		cfg := do.MustInvoke[*config.Config](i)

		dialFn := func() (*amqp.Connection, error) {
			// Check if TLS is enabled via config or URL protocol
			useTLS := cfg.RabbitMQ.EnableTLS || strings.HasPrefix(cfg.RabbitMQ.URL, "amqps://")

			if useTLS {
				// Use TLS configuration with minimum TLS 1.2
				tlsConfig := &tls.Config{
					MinVersion: tls.VersionTLS12,
				}
				// Convert amqp:// to amqps:// if needed
				url := cfg.RabbitMQ.URL
				if strings.HasPrefix(url, "amqp://") {
					url = strings.Replace(url, "amqp://", "amqps://", 1)
				}
				return amqp.DialTLS(url, tlsConfig)
			}

			return amqp.Dial(cfg.RabbitMQ.URL)
		}

		return dialFn, nil
	})

	// RabbitMQ Connection
	do.Provide(inj, func(i *do.Injector) (*amqp.Connection, error) {
		dialFn := do.MustInvoke[mq.DialFunc](i)
		return dialFn()
	})

	// RabbitMQ Publisher
	do.Provide(inj, func(i *do.Injector) (*mq.Publisher, error) {
		cfg := do.MustInvoke[*config.Config](i)
		conn := do.MustInvoke[*amqp.Connection](i)
		log := do.MustInvoke[*zap.Logger](i)
		dialFn := do.MustInvoke[mq.DialFunc](i)
		return mq.NewPublisher(conn, log, cfg, dialFn)
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
	do.Provide(inj, func(i *do.Injector) (repo.SessionRepo, error) {
		return repo.NewSessionRepo(
			do.MustInvoke[*gorm.DB](i),
			do.MustInvoke[repo.AssetReferenceRepo](i),
			do.MustInvoke[*blob.S3Deps](i),
			do.MustInvoke[*zap.Logger](i),
		), nil
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
	do.Provide(inj, func(i *do.Injector) (repo.AgentSkillsRepo, error) {
		return repo.NewAgentSkillsRepo(
			do.MustInvoke[*gorm.DB](i),
		), nil
	})
	do.Provide(inj, func(i *do.Injector) (repo.UserRepo, error) {
		return repo.NewUserRepo(do.MustInvoke[*gorm.DB](i)), nil
	})
	do.Provide(inj, func(i *do.Injector) (repo.SandboxLogRepo, error) {
		return repo.NewSandboxLogRepo(do.MustInvoke[*gorm.DB](i)), nil
	})

	// Service
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
	do.Provide(inj, func(i *do.Injector) (service.AgentSkillsService, error) {
		return service.NewAgentSkillsService(
			do.MustInvoke[repo.AgentSkillsRepo](i),
			do.MustInvoke[service.DiskService](i),
			do.MustInvoke[service.ArtifactService](i),
		), nil
	})
	do.Provide(inj, func(i *do.Injector) (service.UserService, error) {
		return service.NewUserService(do.MustInvoke[repo.UserRepo](i)), nil
	})
	do.Provide(inj, func(i *do.Injector) (service.SandboxLogService, error) {
		return service.NewSandboxLogService(do.MustInvoke[repo.SandboxLogRepo](i)), nil
	})

	// Handler
	do.Provide(inj, func(i *do.Injector) (*handler.SessionHandler, error) {
		return handler.NewSessionHandler(
			do.MustInvoke[service.SessionService](i),
			do.MustInvoke[service.UserService](i),
			do.MustInvoke[*httpclient.CoreClient](i),
		), nil
	})
	do.Provide(inj, func(i *do.Injector) (*handler.DiskHandler, error) {
		return handler.NewDiskHandler(
			do.MustInvoke[service.DiskService](i),
			do.MustInvoke[service.UserService](i),
		), nil
	})
	do.Provide(inj, func(i *do.Injector) (*handler.ArtifactHandler, error) {
		return handler.NewArtifactHandler(
			do.MustInvoke[service.ArtifactService](i),
			do.MustInvoke[*config.Config](i),
			do.MustInvoke[*httpclient.CoreClient](i),
			do.MustInvoke[*blob.S3Deps](i),
		), nil
	})
	do.Provide(inj, func(i *do.Injector) (*handler.TaskHandler, error) {
		return handler.NewTaskHandler(do.MustInvoke[service.TaskService](i)), nil
	})
	do.Provide(inj, func(i *do.Injector) (*handler.AgentSkillsHandler, error) {
		return handler.NewAgentSkillsHandler(
			do.MustInvoke[service.AgentSkillsService](i),
			do.MustInvoke[service.UserService](i),
			do.MustInvoke[*httpclient.CoreClient](i),
		), nil
	})
	do.Provide(inj, func(i *do.Injector) (*handler.UserHandler, error) {
		return handler.NewUserHandler(do.MustInvoke[service.UserService](i)), nil
	})
	do.Provide(inj, func(i *do.Injector) (*handler.SandboxHandler, error) {
		return handler.NewSandboxHandler(
			do.MustInvoke[*httpclient.CoreClient](i),
			do.MustInvoke[service.SandboxLogService](i),
		), nil
	})
	return inj
}
