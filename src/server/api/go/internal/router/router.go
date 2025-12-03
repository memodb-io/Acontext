package router

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"gorm.io/gorm"

	_ "github.com/memodb-io/Acontext/docs"
	"github.com/memodb-io/Acontext/internal/config"
	"github.com/memodb-io/Acontext/internal/modules/handler"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/serializer"
	"github.com/memodb-io/Acontext/internal/pkg/utils/secrets"
	"github.com/memodb-io/Acontext/internal/pkg/utils/tokens"
	"github.com/memodb-io/Acontext/internal/telemetry"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

// zapLoggerMiddleware
func zapLoggerMiddleware(log *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		dur := time.Since(start)
		log.Sugar().Infow("HTTP",
			"method", c.Request.Method,
			"path", c.Request.URL.Path,
			"status", c.Writer.Status(),
			"latency", dur.String(),
			"clientIP", c.ClientIP(),
		)
	}
}

// projectAuthMiddleware
func projectAuthMiddleware(cfg *config.Config, db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		auth := c.GetHeader("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, serializer.AuthErr("Unauthorized"))
			return
		}
		raw := strings.TrimPrefix(auth, "Bearer ")

		secret, ok := tokens.ParseToken(raw, cfg.Root.ProjectBearerTokenPrefix)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, serializer.AuthErr("Unauthorized"))
			return
		}

		lookup := tokens.HMAC256Hex(cfg.Root.SecretPepper, secret)

		var project model.Project
		if err := db.WithContext(c.Request.Context()).Where(&model.Project{SecretKeyHMAC: lookup}).First(&project).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				c.AbortWithStatusJSON(http.StatusUnauthorized, serializer.AuthErr("Unauthorized"))
				return
			}
			c.AbortWithStatusJSON(http.StatusInternalServerError, serializer.DBErr("", err))
			return
		}

		pass, err := secrets.VerifySecret(secret, cfg.Root.SecretPepper, project.SecretKeyHashPHC)
		if err != nil || !pass {
			c.AbortWithStatusJSON(http.StatusUnauthorized, serializer.AuthErr("Unauthorized"))
			return
		}

		c.Set("project", &project)
		c.Next()
	}
}

type RouterDeps struct {
	Config          *config.Config
	DB              *gorm.DB
	Log             *zap.Logger
	SpaceHandler    *handler.SpaceHandler
	BlockHandler    *handler.BlockHandler
	SessionHandler  *handler.SessionHandler
	DiskHandler     *handler.DiskHandler
	ArtifactHandler *handler.ArtifactHandler
	TaskHandler     *handler.TaskHandler
	ToolHandler     *handler.ToolHandler
}

func NewRouter(d RouterDeps) *gin.Engine {
	// Initialize logger for serializer package
	serializer.SetLogger(d.Log)

	r := gin.New()
	r.Use(gin.Recovery())

	// Add OpenTelemetry middleware if enabled (using configuration system)
	if d.Config.Telemetry.Enabled && d.Config.Telemetry.OtlpEndpoint != "" {
		r.Use(telemetry.GinMiddleware(d.Config.App.Name))
		// Add trace ID to response header
		r.Use(telemetry.TraceIDMiddleware())
	}

	r.Use(zapLoggerMiddleware(d.Log))

	// health
	r.GET("/health", func(c *gin.Context) { c.JSON(http.StatusOK, serializer.Response{Msg: "ok"}) })

	// swagger
	r.GET("/swagger", func(c *gin.Context) {
		c.Redirect(http.StatusMovedPermanently, "/swagger/index.html")
	})
	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	v1 := r.Group("/api/v1")
	{
		v1.Use(projectAuthMiddleware(d.Config, d.DB))

		// ping endpoint
		v1.GET("/ping", func(c *gin.Context) { c.JSON(http.StatusOK, serializer.Response{Msg: "pong"}) })

		space := v1.Group("/space")
		{
			space.GET("/status")

			space.GET("", d.SpaceHandler.GetSpaces)
			space.POST("", d.SpaceHandler.CreateSpace)
			space.DELETE("/:space_id", d.SpaceHandler.DeleteSpace)

			space.PUT("/:space_id/configs", d.SpaceHandler.UpdateConfigs)
			space.GET("/:space_id/configs", d.SpaceHandler.GetConfigs)

			space.GET("/:space_id/experience_search", d.SpaceHandler.GetExperienceSearch)

			space.GET("/:space_id/experience_confirmations", d.SpaceHandler.ListExperienceConfirmations)
			space.PATCH("/:space_id/experience_confirmations/:experience_id", d.SpaceHandler.ConfirmExperience)

			block := space.Group("/:space_id/block")
			{
				block.GET("", d.BlockHandler.ListBlocks)
				block.POST("", d.BlockHandler.CreateBlock)
				block.DELETE("/:block_id", d.BlockHandler.DeleteBlock)

				block.GET("/:block_id/properties", d.BlockHandler.GetBlockProperties)
				block.PUT("/:block_id/properties", d.BlockHandler.UpdateBlockProperties)

				block.PUT("/:block_id/move", d.BlockHandler.MoveBlock)
				block.PUT("/:block_id/sort", d.BlockHandler.UpdateBlockSort)
			}
		}

		session := v1.Group("/session")
		{
			session.GET("", d.SessionHandler.GetSessions)
			session.POST("", d.SessionHandler.CreateSession)
			session.DELETE("/:session_id", d.SessionHandler.DeleteSession)

			session.PUT("/:session_id/configs", d.SessionHandler.UpdateConfigs)
			session.GET("/:session_id/configs", d.SessionHandler.GetConfigs)

			session.POST("/:session_id/connect_to_space", d.SessionHandler.ConnectToSpace)

			session.POST("/:session_id/messages", d.SessionHandler.SendMessage)
			session.GET("/:session_id/messages", d.SessionHandler.GetMessages)

			session.POST("/:session_id/flush", d.SessionHandler.SessionFlush)
			session.GET("/:session_id/get_learning_status", d.SessionHandler.GetLearningStatus)

			session.GET("/:session_id/token_counts", d.SessionHandler.GetTokenCounts)

			task := session.Group("/:session_id/task")
			{
				task.GET("", d.TaskHandler.GetTasks)
			}
		}

		disk := v1.Group("/disk")
		{
			disk.GET("", d.DiskHandler.ListDisks)
			disk.POST("", d.DiskHandler.CreateDisk)
			disk.DELETE("/:disk_id", d.DiskHandler.DeleteDisk)

			artifact := disk.Group("/:disk_id/artifact")
			{
				artifact.POST("", d.ArtifactHandler.UpsertArtifact)
				artifact.GET("", d.ArtifactHandler.GetArtifact)
				artifact.PUT("", d.ArtifactHandler.UpdateArtifact)
				artifact.DELETE("", d.ArtifactHandler.DeleteArtifact)
				artifact.GET("/ls", d.ArtifactHandler.ListArtifacts)
			}
		}

		tool := v1.Group("/tool")
		{
			tool.PUT("/name", d.ToolHandler.RenameToolName)
			tool.GET("/name", d.ToolHandler.GetToolName)
		}
	}
	return r
}
