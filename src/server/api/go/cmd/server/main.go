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
	"github.com/memodb-io/Acontext/internal/modules/handler"
	"github.com/memodb-io/Acontext/internal/router"
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

	// init gin
	gin.SetMode(cfg.App.Env)

	// build handlers
	spaceHandler := do.MustInvoke[*handler.SpaceHandler](inj)
	blockHandler := do.MustInvoke[*handler.BlockHandler](inj)
	sessionHandler := do.MustInvoke[*handler.SessionHandler](inj)
	artifactHandler := do.MustInvoke[*handler.ArtifactHandler](inj)
	fileHandler := do.MustInvoke[*handler.FileHandler](inj)

	engine := router.NewRouter(router.RouterDeps{
		Config:          cfg,
		DB:              db,
		Log:             log,
		SpaceHandler:    spaceHandler,
		BlockHandler:    blockHandler,
		SessionHandler:  sessionHandler,
		ArtifactHandler: artifactHandler,
		FileHandler:     fileHandler,
	})

	addr := fmt.Sprintf("%s:%d", cfg.App.Host, cfg.App.Port)
	srv := &http.Server{Addr: addr, Handler: engine}

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
