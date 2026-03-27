package handler

import (
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"

	"github.com/memodb-io/Acontext/internal/config"
	"github.com/memodb-io/Acontext/internal/infra/blob"
	"github.com/memodb-io/Acontext/internal/middleware"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/repo"
	"github.com/memodb-io/Acontext/internal/modules/serializer"
	"github.com/memodb-io/Acontext/internal/modules/service"
	"gorm.io/gorm"
)

type AdminHandler struct {
	projectSvc   service.ProjectService
	projectRepo  repo.ProjectRepo
	s3           *blob.S3Deps
	assetRefRepo repo.AssetReferenceRepo
	db           *gorm.DB
	rdb          *redis.Client
	cfg          *config.Config
}

func NewAdminHandler(projectSvc service.ProjectService, projectRepo repo.ProjectRepo, s3 *blob.S3Deps, assetRefRepo repo.AssetReferenceRepo, db *gorm.DB, rdb *redis.Client, cfg *config.Config) *AdminHandler {
	return &AdminHandler{
		projectSvc:   projectSvc,
		projectRepo:  projectRepo,
		s3:           s3,
		assetRefRepo: assetRefRepo,
		db:           db,
		rdb:          rdb,
		cfg:          cfg,
	}
}


type CreateProjectReq struct {
	Configs map[string]interface{} `json:"configs,omitempty"`
}

// CreateProject godoc
//
//	@Summary		Create a new project
//	@Description	Create a new project with a randomly generated secret key
//	@Tags			admin
//	@Accept			json
//	@Produce		json
//	@Param			body	body		CreateProjectReq	false	"Project configuration"
//	@Success		200		{object}	serializer.Response{data=service.CreateProjectOutput}
//	@Failure		400		{object}	serializer.Response
//	@Failure		500		{object}	serializer.Response
//	@Router			/admin/v1/project [post]
func (h *AdminHandler) CreateProject(c *gin.Context) {
	var req CreateProjectReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	// Set default value to empty map if configs is nil
	if req.Configs == nil {
		req.Configs = make(map[string]interface{})
	}

	output, err := h.projectSvc.Create(c.Request.Context(), req.Configs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: output})
}

// DeleteProject godoc
//
//	@Summary		Delete a project
//	@Description	Delete a project by ID
//	@Tags			admin
//	@Accept			json
//	@Produce		json
//	@Param			project_id	path		string	true	"Project ID"	format(uuid)
//	@Success		200			{object}	serializer.Response
//	@Failure		400			{object}	serializer.Response
//	@Failure		500			{object}	serializer.Response
//	@Router			/admin/v1/project/{project_id} [delete]
func (h *AdminHandler) DeleteProject(c *gin.Context) {
	projectIDStr := c.Param("project_id")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid project id", err))
		return
	}

	if err := h.projectSvc.Delete(c.Request.Context(), projectID); err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Msg: "project deleted"})
}

// AnalyzeProjectUsages godoc
//
//	@Summary		Analyze project usages
//	@Description	Get usage analytics for a project
//	@Tags			admin
//	@Accept			json
//	@Produce		json
//	@Param			project_id		path		string	true	"Project ID"								format(uuid)
//	@Param			interval_days	query		int		false	"Number of days to analyze (default: 30)"	default(30)
//	@Param			fields			query		string	false	"Comma-separated list of fields to fetch (empty = all)"
//	@Success		200				{object}	serializer.Response
//	@Router			/admin/v1/project/{project_id}/usages [get]
func (h *AdminHandler) AnalyzeProjectUsages(c *gin.Context) {
	projectIDStr := c.Param("project_id")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid project id", err))
		return
	}

	// Get interval_days from query parameter, default to 30
	intervalDaysStr := c.DefaultQuery("interval_days", "30")
	intervalDays, err := strconv.Atoi(intervalDaysStr)
	if err != nil || intervalDays <= 0 {
		intervalDays = 30
	}

	// Parse fields query parameter
	var fields []string
	if fieldsStr := c.Query("fields"); fieldsStr != "" {
		for _, f := range strings.Split(fieldsStr, ",") {
			if trimmed := strings.TrimSpace(f); trimmed != "" {
				fields = append(fields, trimmed)
			}
		}
	}

	output, err := h.projectSvc.AnalyzeUsages(c.Request.Context(), projectID, intervalDays, fields)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: output})
}

// AnalyzeProjectStatistics godoc
//
//	@Summary		Analyze project statistics
//	@Description	Get statistics for a project
//	@Tags			admin
//	@Accept			json
//	@Produce		json
//	@Param			project_id	path		string	true	"Project ID"	format(uuid)
//	@Success		200			{object}	serializer.Response
//	@Router			/admin/v1/project/{project_id}/statistics [get]
func (h *AdminHandler) AnalyzeProjectStatistics(c *gin.Context) {
	projectIDStr := c.Param("project_id")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid project id", err))
		return
	}

	output, err := h.projectSvc.AnalyzeStatistics(c.Request.Context(), projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: output})
}

// AnalyzeProjectMetrics godoc
//
//	@Summary		Analyze project metrics
//	@Description	Get metrics for a project by querying Jaeger API with project_id filter
//	@Tags			admin
//	@Accept			json
//	@Produce		json
//	@Param			project_id	path		string	true	"Project ID"	format(uuid)
//	@Success		200			{object}	serializer.Response
//	@Router			/admin/v1/project/{project_id}/metrics [get]
func (h *AdminHandler) AnalyzeProjectMetrics(c *gin.Context) {
	projectIDStr := c.Param("project_id")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid project id", err))
		return
	}

	resp, err := h.projectSvc.AnalyzeMetrics(
		c.Request.Context(),
		projectID,
		c.Request.URL.String(),
		c.Request.Method,
		c.Request.Header,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("failed to query Jaeger", err))
		return
	}
	defer resp.Body.Close()

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("failed to read response", err))
		return
	}

	// Only forward safe response headers from Jaeger
	safeHeaders := map[string]bool{
		"Content-Type":     true,
		"Content-Encoding": true,
	}
	for key, values := range resp.Header {
		if safeHeaders[http.CanonicalHeaderKey(key)] {
			for _, value := range values {
				c.Header(key, value)
			}
		}
	}

	// Return the response from Jaeger
	c.Data(resp.StatusCode, resp.Header.Get("Content-Type"), body)
}

// EncryptProject encrypts all existing S3 data for a project and enables encryption.
// Requires project API key as Bearer auth (uses ProjectAuth middleware).
func (h *AdminHandler) EncryptProject(c *gin.Context) {
	encryptProject(c, h.db, h.rdb, h.s3, h.assetRefRepo)
}

// DecryptProject decrypts all existing S3 data for a project and disables encryption.
// Requires project API key as Bearer auth (uses ProjectAuth middleware).
func (h *AdminHandler) DecryptProject(c *gin.Context) {
	decryptProject(c, h.db, h.rdb, h.s3, h.assetRefRepo)
}

// RotateProjectSecretKeyAdmin rotates the project API key (admin JWT auth).
// Admin does not have the project API key, so master_key cannot be preserved.
// A new master_key is generated. Only allowed for non-encrypted projects.
//
//	@Summary		Rotate project secret key (admin)
//	@Description	Generate a new secret key for a non-encrypted project. Blocked for encrypted projects.
//	@Tags			admin
//	@Produce		json
//	@Param			project_id	path		string	true	"Project ID"	format(uuid)
//	@Success		200			{object}	serializer.Response{data=service.UpdateSecretKeyOutput}
//	@Failure		400			{object}	serializer.Response
//	@Failure		500			{object}	serializer.Response
//	@Router			/admin/v1/project/{project_id}/secret_key [put]
func (h *AdminHandler) RotateProjectSecretKeyAdmin(c *gin.Context) {
	projectIDStr := c.Param("project_id")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid project id", err))
		return
	}

	project, dbErr := h.projectRepo.GetByID(c.Request.Context(), projectID)
	if dbErr != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", dbErr))
		return
	}
	if project.EncryptionEnabled {
		c.JSON(http.StatusBadRequest, serializer.ParamErr(
			"cannot rotate key for encrypted projects via admin API — use the project Bearer token endpoint to preserve the master key", nil))
		return
	}

	// Capture old HMAC before rotation so we can invalidate the cache
	oldHMAC := project.SecretKeyHMAC

	// masterKey=nil → RotateSecretKey generates a new one
	output, err := h.projectSvc.RotateSecretKey(c.Request.Context(), projectID, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	// Invalidate old HMAC cache so the old key can no longer authenticate
	middleware.InvalidateProjectAuthCache(h.rdb, oldHMAC)

	c.JSON(http.StatusOK, serializer.Response{Data: output})
}

// RotateProjectSecretKey rotates the project API key.
// Requires the project API key as Bearer auth (uses ProjectAuth middleware).
// Generates a new auth_secret and re-wraps the existing master_key.
// S3 objects are NOT touched — the same master_key (KEK) is preserved.
// For legacy keys without master_key, a new master_key is generated.
func (h *AdminHandler) RotateProjectSecretKey(c *gin.Context) {
	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", fmt.Errorf("project not found")))
		return
	}

	// Get the current KEK (master_key) from context — nil for legacy keys.
	masterKey := middleware.GetUserKEK(c)

	// Guard: if the project has encryption enabled, we MUST have the current
	// master_key to re-wrap it.  Legacy (v1) tokens don't carry a master_key,
	// so rotating them would generate a brand-new key and orphan all existing
	// S3 DEKs — irreversible data loss.
	if project.EncryptionEnabled && masterKey == nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr(
			"cannot rotate: project has encryption enabled but current API key has no embedded master key; re-issue a v2 key first", nil))
		return
	}

	// Capture old HMAC before rotation so we can invalidate the cache
	oldHMAC := project.SecretKeyHMAC

	// Generates new auth_secret, re-wraps the same master_key.
	output, err := h.projectSvc.RotateSecretKey(c.Request.Context(), project.ID, masterKey)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("failed to rotate key", err))
		return
	}

	// Invalidate old HMAC cache so the old key can no longer authenticate
	middleware.InvalidateProjectAuthCache(h.rdb, oldHMAC)

	c.JSON(http.StatusOK, serializer.Response{Data: output})
}

