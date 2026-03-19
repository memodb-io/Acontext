package bootstrap

import (
	"github.com/memodb-io/Acontext/internal/config"
	"github.com/memodb-io/Acontext/internal/modules/handler"
	"github.com/memodb-io/Acontext/internal/modules/repo"
	"github.com/memodb-io/Acontext/internal/modules/service"
	"github.com/redis/go-redis/v9"
	"github.com/samber/do"
	"gorm.io/gorm"
)

// BuildAdminContainer extends the base container with admin-specific dependencies.
// It calls BuildContainer() first, then registers additional providers for
// ProjectRepo, MetricRepo, ProjectService, MetricService, AdminHandler, and MetricsHandler.
func BuildAdminContainer() *do.Injector {
	inj := BuildContainer()

	// Admin-specific repos
	do.Provide(inj, func(i *do.Injector) (repo.ProjectRepo, error) {
		return repo.NewProjectRepo(do.MustInvoke[*gorm.DB](i)), nil
	})
	do.Provide(inj, func(i *do.Injector) (repo.MetricRepo, error) {
		return repo.NewMetricRepo(do.MustInvoke[*gorm.DB](i)), nil
	})

	// Admin-specific services
	do.Provide(inj, func(i *do.Injector) (service.ProjectService, error) {
		return service.NewProjectService(
			do.MustInvoke[repo.ProjectRepo](i),
			do.MustInvoke[*config.Config](i),
		), nil
	})
	do.Provide(inj, func(i *do.Injector) (service.MetricService, error) {
		return service.NewMetricService(
			do.MustInvoke[repo.MetricRepo](i),
			do.MustInvoke[*redis.Client](i),
		), nil
	})

	// Admin-specific handlers
	do.Provide(inj, func(i *do.Injector) (*handler.AdminHandler, error) {
		return handler.NewAdminHandler(do.MustInvoke[service.ProjectService](i)), nil
	})
	do.Provide(inj, func(i *do.Injector) (*handler.MetricsHandler, error) {
		return handler.NewMetricsHandler(
			do.MustInvoke[service.MetricService](i),
			do.MustInvoke[*redis.Client](i),
			do.MustInvoke[*config.Config](i),
		), nil
	})

	return inj
}
