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
		if err := db.Where(&model.Project{SecretKeyHMAC: lookup}).First(&project).Error; err != nil {
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
	ArtifactHandler *handler.ArtifactHandler
	FileHandler     *handler.FileHandler
}

func NewRouter(d RouterDeps) *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery(), zapLoggerMiddleware(d.Log))

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

		space := v1.Group("/space")
		{
			space.GET("/status")

			space.GET("", d.SpaceHandler.GetSpaces)
			space.POST("", d.SpaceHandler.CreateSpace)
			space.DELETE("/:space_id", d.SpaceHandler.DeleteSpace)

			space.PUT("/:space_id/configs", d.SpaceHandler.UpdateConfigs)
			space.GET("/:space_id/configs", d.SpaceHandler.GetConfigs)

			space.GET("/:space_id/semantic_answer", d.SpaceHandler.GetSemanticAnswer)
			space.GET("/:space_id/semantic_global", d.SpaceHandler.GetSemanticGlobal)
			space.GET("/:space_id/semantic_grep", d.SpaceHandler.GetSemanticGrep)

			page := space.Group("/:space_id/page")
			{
				page.GET("", d.BlockHandler.ListPages)
				page.POST("", d.BlockHandler.CreatePage)
				page.DELETE("/:page_id", d.BlockHandler.DeletePage)

				page.GET("/:page_id/properties", d.BlockHandler.GetPageProperties)
				page.PUT("/:page_id/properties", d.BlockHandler.UpdatePageProperties)

				page.PUT("/:page_id/move", d.BlockHandler.MovePage)
				page.PUT("/:page_id/sort", d.BlockHandler.UpdatePageSort)
			}

			folder := space.Group("/:space_id/folder")
			{
				folder.GET("", d.BlockHandler.ListFolders)
				folder.POST("", d.BlockHandler.CreateFolder)
				folder.DELETE("/:folder_id", d.BlockHandler.DeleteFolder)

				folder.GET("/:folder_id/properties", d.BlockHandler.GetFolderProperties)
				folder.PUT("/:folder_id/properties", d.BlockHandler.UpdateFolderProperties)

				folder.PUT("/:folder_id/move", d.BlockHandler.MoveFolder)
				folder.PUT("/:folder_id/sort", d.BlockHandler.UpdateFolderSort)
			}

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
		}

		artifact := v1.Group("/artifact")
		{
			artifact.GET("", d.ArtifactHandler.ListArtifacts)
			artifact.POST("", d.ArtifactHandler.CreateArtifact)
			artifact.DELETE("/:artifact_id", d.ArtifactHandler.DeleteArtifact)

			file := artifact.Group("/:artifact_id/file")
			{
				file.POST("", d.FileHandler.CreateFile)
				file.GET("", d.FileHandler.GetFile)
				file.PUT("", d.FileHandler.UpdateFile)
				file.DELETE("", d.FileHandler.DeleteFile)
				file.GET("/ls", d.FileHandler.ListFiles)
			}
		}
	}
	return r
}
