package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"

	"github.com/memodb-io/Acontext/internal/infra/blob"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/repo"
	"github.com/memodb-io/Acontext/internal/modules/serializer"
	"gorm.io/gorm"
)

type ProjectHandler struct {
	db           *gorm.DB
	rdb          *redis.Client
	s3           *blob.S3Deps
	assetRefRepo repo.AssetReferenceRepo
}

func NewProjectHandler(db *gorm.DB, rdb *redis.Client, s3 *blob.S3Deps, assetRefRepo repo.AssetReferenceRepo) *ProjectHandler {
	return &ProjectHandler{db: db, rdb: rdb, s3: s3, assetRefRepo: assetRefRepo}
}

// GetConfigs godoc
//
//	@Summary		Get project configs
//	@Description	Returns the project-level configuration (stored under the "project_config" key).
//	@Tags			Project
//	@Produce		json
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=map[string]interface{}}
//	@Router			/project/configs [get]
func (h *ProjectHandler) GetConfigs(c *gin.Context) {
	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusInternalServerError, serializer.Err(http.StatusInternalServerError, "failed to load project", nil))
		return
	}

	configs := map[string]interface{}{}
	if project.Configs != nil {
		if pc, exists := project.Configs["project_config"]; exists {
			if pcMap, ok := pc.(map[string]interface{}); ok {
				configs = pcMap
			}
		}
	}
	configs["encryption_enabled"] = project.EncryptionEnabled

	c.JSON(http.StatusOK, serializer.Response{
		Code: 0,
		Data: configs,
		Msg:  "ok",
	})
}

// PatchConfigs godoc
//
//	@Summary		Patch project configs
//	@Description	Merges the provided keys into the project-level configuration. Keys with null values are deleted (reset to default).
//	@Tags			Project
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			body	body		map[string]interface{}	true	"Config keys to merge"
//	@Success		200		{object}	serializer.Response{data=map[string]interface{}}
//	@Failure		400		{object}	serializer.Response
//	@Router			/project/configs [patch]
func (h *ProjectHandler) PatchConfigs(c *gin.Context) {
	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusInternalServerError, serializer.Err(http.StatusInternalServerError, "failed to load project", nil))
		return
	}

	const maxBodySize = 64 * 1024
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBodySize)

	var patch map[string]interface{}
	if err := c.ShouldBindJSON(&patch); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid or too-large JSON body (max 64KB)", err))
		return
	}

	if len(patch) == 0 {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("empty body", nil))
		return
	}

	const maxStringFieldLen = 2000
	stringFields := map[string]bool{"task_success_criteria": true, "task_failure_criteria": true}
	for key, value := range patch {
		if value == nil {
			continue
		}
		if stringFields[key] {
			str, ok := value.(string)
			if !ok {
				c.JSON(http.StatusBadRequest, serializer.ParamErr(key+" must be a string", nil))
				return
			}
			if len(str) > maxStringFieldLen {
				c.JSON(http.StatusBadRequest, serializer.ParamErr(key+" exceeds max length (2000 chars)", nil))
				return
			}
		}
	}

	// Reload project from DB to avoid stale reads
	var freshProject model.Project
	if err := h.db.First(&freshProject, "id = ?", project.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	if freshProject.Configs == nil {
		freshProject.Configs = map[string]interface{}{}
	}

	// Get or create project_config sub-object
	var projectConfig map[string]interface{}
	if pc, exists := freshProject.Configs["project_config"]; exists {
		if pcMap, ok := pc.(map[string]interface{}); ok {
			projectConfig = pcMap
		} else {
			projectConfig = map[string]interface{}{}
		}
	} else {
		projectConfig = map[string]interface{}{}
	}

	// Merge: keys with null value are deleted, others are set
	for key, value := range patch {
		if value == nil {
			delete(projectConfig, key)
		} else {
			projectConfig[key] = value
		}
	}

	freshProject.Configs["project_config"] = projectConfig

	if err := h.db.Model(&freshProject).Update("configs", freshProject.Configs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{
		Code: 0,
		Data: projectConfig,
		Msg:  "ok",
	})
}

// EncryptProject encrypts all existing S3 data for a project and enables encryption.
// Requires project API key as Bearer auth (uses ProjectAuth middleware).
//
//	@Summary		Enable project encryption
//	@Description	Encrypts all existing S3 data for the project and enables encryption for future writes.
//	@Tags			Project
//	@Produce		json
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response
//	@Failure		400	{object}	serializer.Response
//	@Failure		500	{object}	serializer.Response
//	@Router			/project/encrypt [post]
func (h *ProjectHandler) EncryptProject(c *gin.Context) {
	encryptProject(c, h.db, h.rdb, h.s3, h.assetRefRepo)
}

// DecryptProject decrypts all existing S3 data for a project and disables encryption.
// Requires project API key as Bearer auth (uses ProjectAuth middleware).
//
//	@Summary		Disable project encryption
//	@Description	Decrypts all existing S3 data for the project and disables encryption for future writes.
//	@Tags			Project
//	@Produce		json
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response
//	@Failure		400	{object}	serializer.Response
//	@Failure		500	{object}	serializer.Response
//	@Router			/project/decrypt [post]
func (h *ProjectHandler) DecryptProject(c *gin.Context) {
	decryptProject(c, h.db, h.rdb, h.s3, h.assetRefRepo)
}
