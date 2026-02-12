package main

//	@title			Acontext API
//	@version		1.0
//	@description	API for Acontext.
//	@schemes		http https
//	@BasePath		/api/v1

//  Bearer at Project level
//	@securityDefinitions.apikey	BearerAuth
//	@in							header
//	@name						Authorization
//	@description				Project Bearer token (e.g., "Bearer sk-ac-xxxx")

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/memodb-io/Acontext/internal/bootstrap"
	"github.com/memodb-io/Acontext/internal/config"
	"github.com/memodb-io/Acontext/internal/infra/cache"
	dbpkg "github.com/memodb-io/Acontext/internal/infra/db"
	"github.com/memodb-io/Acontext/internal/modules/handler"
	"github.com/memodb-io/Acontext/internal/pkg/tokenizer"
	"github.com/memodb-io/Acontext/internal/router"
	"github.com/memodb-io/Acontext/internal/telemetry"
	"github.com/redis/go-redis/v9"
	"github.com/samber/do"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

func main() {
	// build dependency injection container
	inj := bootstrap.BuildContainer()

	cfg := do.MustInvoke[*config.Config](inj)
	log := do.MustInvoke[*zap.Logger](inj)
	db := do.MustInvoke[*gorm.DB](inj)
	rdb := do.MustInvoke[*redis.Client](inj)

	// Initialize tokenizer (vocabulary is already embedded in the package)
	if err := tokenizer.Init(log); err != nil {
		log.Sugar().Fatalw("failed to initialize tokenizer", "err", err)
	}

	// Setup OpenTelemetry tracing (using configuration system)
	tp, err := telemetry.SetupTracing(cfg)
	if err != nil {
		log.Sugar().Warnw("failed to setup tracing, continuing without tracing", "err", err)
	} else if tp != nil {
		log.Sugar().Info("OpenTelemetry tracing enabled", "endpoint", cfg.Telemetry.OtlpEndpoint)
		defer func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			if err := telemetry.Shutdown(ctx); err != nil {
				log.Sugar().Errorw("failed to shutdown tracer", "err", err)
			}
		}()

		// Register GORM OpenTelemetry plugin after tracer provider is set
		if err := dbpkg.RegisterOpenTelemetryPlugin(db); err != nil {
			log.Sugar().Warnw("failed to register GORM OpenTelemetry plugin, continuing without database tracing", "err", err)
		} else {
			log.Sugar().Info("GORM OpenTelemetry plugin registered")
		}

		// Register Redis OpenTelemetry plugin after tracer provider is set
		if err := cache.RegisterOpenTelemetryPlugin(rdb); err != nil {
			log.Sugar().Warnw("failed to register Redis OpenTelemetry plugin, continuing without Redis tracing", "err", err)
		} else {
			log.Sugar().Info("Redis OpenTelemetry plugin registered")
		}
	}

	// init gin
	gin.SetMode(cfg.App.Env)

	// build handlers
	sessionHandler := do.MustInvoke[*handler.SessionHandler](inj)
	diskHandler := do.MustInvoke[*handler.DiskHandler](inj)
	artifactHandler := do.MustInvoke[*handler.ArtifactHandler](inj)
	taskHandler := do.MustInvoke[*handler.TaskHandler](inj)
	agentSkillsHandler := do.MustInvoke[*handler.AgentSkillsHandler](inj)
	userHandler := do.MustInvoke[*handler.UserHandler](inj)
	sandboxHandler := do.MustInvoke[*handler.SandboxHandler](inj)
	learningSpaceHandler := do.MustInvoke[*handler.LearningSpaceHandler](inj)

	engine := router.NewRouter(router.RouterDeps{
		Config:             cfg,
		DB:                 db,
		Log:                log,
		SessionHandler:     sessionHandler,
		DiskHandler:        diskHandler,
		ArtifactHandler:    artifactHandler,
		TaskHandler:        taskHandler,
		AgentSkillsHandler:   agentSkillsHandler,
		UserHandler:          userHandler,
		SandboxHandler:       sandboxHandler,
		LearningSpaceHandler: learningSpaceHandler,
	})

	addr := fmt.Sprintf("%s:%d", cfg.App.Host, cfg.App.Port)
	srv := &http.Server{
		Addr:              addr,
		Handler:           engine,
		ReadHeaderTimeout: 30 * time.Second,
		WriteTimeout:      15 * time.Minute,
		IdleTimeout:       120 * time.Second,
	}

	go func() {
		log.Sugar().Infow("starting http server", "addr", addr)
		log.Sugar().Infow("swagger url", "url", addr+"/swagger/index.html")
		log.Sugar().Infow("default project bearer token", "token", "Bearer "+cfg.Root.ProjectBearerTokenPrefix+cfg.Root.ApiBearerToken)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Sugar().Fatalw("listen error", "err", err)
		}
	}()

	// graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Sugar().Errorw("server shutdown", "err", err)
	}
	log.Sugar().Info("server exited")
}
