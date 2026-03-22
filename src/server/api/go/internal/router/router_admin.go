package router

import (
	"github.com/gin-gonic/gin"

	"github.com/memodb-io/Acontext/internal/middleware"
	"github.com/memodb-io/Acontext/internal/modules/handler"
)

// AdminRouterDeps extends RouterDeps with admin-specific handlers.
type AdminRouterDeps struct {
	RouterDeps
	AdminHandler   *handler.AdminHandler
	MetricsHandler *handler.MetricsHandler
}

// NewAdminRouter creates a Gin engine that includes all base routes
// plus admin-specific route groups (/admin/v1 and /metrics/v1).
func NewAdminRouter(d AdminRouterDeps) *gin.Engine {
	// Override /api/v1 auth with admin's token format (base64 JSON with project_id + signature)
	d.RouterDeps.ProjectAuthOverride = middleware.AdminProjectAuth(d.Config, d.DB)

	// Start with the base router (includes /api/v1, /health, /swagger)
	r := NewRouter(d.RouterDeps)

	// Admin routes - protected by Supabase JWT auth
	admin := r.Group("/admin/v1")
	{
		admin.Use(middleware.SupabaseAuth(d.Config))

		admin.POST("/project", d.AdminHandler.CreateProject)
		admin.DELETE("/project/:project_id", d.AdminHandler.DeleteProject)
		admin.PUT("/project/:project_id/secret_key", d.AdminHandler.UpdateProjectSecretKey)

		admin.GET("/project/:project_id/usages", d.AdminHandler.AnalyzeProjectUsages)
		admin.GET("/project/:project_id/statistics", d.AdminHandler.AnalyzeProjectStatistics)
		admin.GET("/project/:project_id/metrics", d.AdminHandler.AnalyzeProjectMetrics)
	}

	// Metrics routes - protected by API bearer token
	metrics := r.Group("/metrics/v1")
	{
		metrics.Use(middleware.MetricsAuth(d.Config))

		metrics.POST("", d.MetricsHandler.PushMetrics)

		metrics.GET("/:project_id/quota", d.MetricsHandler.GetProjectQuota)
	}

	return r
}
