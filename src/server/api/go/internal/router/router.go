package router

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"gorm.io/gorm"

	_ "github.com/memodb-io/Acontext/docs"
	"github.com/memodb-io/Acontext/internal/config"
	"github.com/memodb-io/Acontext/internal/middleware"
	"github.com/memodb-io/Acontext/internal/modules/handler"
	"github.com/memodb-io/Acontext/internal/modules/serializer"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

type RouterDeps struct {
	Config             *config.Config
	DB                 *gorm.DB
	Log                *zap.Logger
	SessionHandler     *handler.SessionHandler
	DiskHandler        *handler.DiskHandler
	ArtifactHandler    *handler.ArtifactHandler
	TaskHandler        *handler.TaskHandler
	AgentSkillsHandler *handler.AgentSkillsHandler
	UserHandler        *handler.UserHandler
	SandboxHandler     *handler.SandboxHandler
	ToolHandler        *handler.ToolHandler
}

func NewRouter(d RouterDeps) *gin.Engine {
	// Initialize logger for serializer package
	serializer.SetLogger(d.Log)

	r := gin.New()
	r.Use(gin.Recovery())

	// Add OpenTelemetry middleware if enabled (using configuration system)
	if d.Config.Telemetry.Enabled && d.Config.Telemetry.OtlpEndpoint != "" {
		r.Use(middleware.OtelTracing(d.Config.App.Name))
		// Add trace ID to response header
		r.Use(middleware.TraceID())
	}

	r.Use(middleware.ZapLogger(d.Log))

	// health
	r.GET("/health", func(c *gin.Context) { c.JSON(http.StatusOK, serializer.Response{Msg: "ok"}) })

	// swagger
	r.GET("/swagger", func(c *gin.Context) {
		c.Redirect(http.StatusMovedPermanently, "/swagger/index.html")
	})
	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	v1 := r.Group("/api/v1")
	{
		v1.Use(middleware.ProjectAuth(d.Config, d.DB))

		// ping endpoint
		v1.GET("/ping", func(c *gin.Context) { c.JSON(http.StatusOK, serializer.Response{Msg: "pong"}) })

		session := v1.Group("/session")
		{
			session.GET("", d.SessionHandler.GetSessions)
			session.POST("", d.SessionHandler.CreateSession)
			session.DELETE("/:session_id", d.SessionHandler.DeleteSession)

			session.PUT("/:session_id/configs", d.SessionHandler.UpdateConfigs)
			session.PATCH("/:session_id/configs", d.SessionHandler.PatchConfigs)
			session.GET("/:session_id/configs", d.SessionHandler.GetConfigs)

			session.POST("/:session_id/messages", d.SessionHandler.StoreMessage)
			session.GET("/:session_id/messages", d.SessionHandler.GetMessages)
			session.PATCH("/:session_id/messages/:message_id/meta", d.SessionHandler.PatchMessageMeta)

			session.POST("/:session_id/flush", d.SessionHandler.SessionFlush)

			session.GET("/:session_id/token_counts", d.SessionHandler.GetTokenCounts)

			session.GET("/:session_id/observing_status", d.SessionHandler.GetSessionObservingStatus)

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

				artifact.GET("/grep", d.ArtifactHandler.GrepArtifacts)
				artifact.GET("/glob", d.ArtifactHandler.GlobArtifacts)
				artifact.POST("/download_to_sandbox", d.ArtifactHandler.DownloadToSandbox)
				artifact.POST("/upload_from_sandbox", d.ArtifactHandler.UploadFromSandbox)
			}
		}

		agentSkills := v1.Group("/agent_skills")
		{
			agentSkills.GET("", d.AgentSkillsHandler.ListAgentSkills)
			agentSkills.POST("", d.AgentSkillsHandler.CreateAgentSkill)
			agentSkills.GET("/:id", d.AgentSkillsHandler.GetAgentSkill)
			agentSkills.DELETE("/:id", d.AgentSkillsHandler.DeleteAgentSkill)
			agentSkills.GET("/:id/file", d.AgentSkillsHandler.GetAgentSkillFile)
			agentSkills.POST("/:id/download_to_sandbox", d.AgentSkillsHandler.DownloadToSandbox)
		}

		user := v1.Group("/user")
		{
			user.GET("/ls", d.UserHandler.ListUsers)
			user.DELETE("/:identifier", d.UserHandler.DeleteUser)
			user.GET("/:identifier/resources", d.UserHandler.GetUserResources)
		}

		sandbox := v1.Group("/sandbox")
		{
			sandbox.GET("/logs", d.SandboxHandler.GetSandboxLogs)
			sandbox.POST("", d.SandboxHandler.CreateSandbox)
			sandbox.POST("/:sandbox_id/exec", d.SandboxHandler.ExecCommand)
			sandbox.DELETE("/:sandbox_id", d.SandboxHandler.KillSandbox)
		}

		tools := v1.Group("/tools")
		{
			tools.POST("", d.ToolHandler.UpsertTool)
			tools.GET("", d.ToolHandler.ListTools)
			tools.GET("/search", d.ToolHandler.SearchTools)
			tools.DELETE("/:name", d.ToolHandler.DeleteTool)
		}
	}
	return r
}
