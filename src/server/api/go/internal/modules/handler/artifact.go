package handler

import (
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/bytedance/sonic"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/config"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/serializer"
	"github.com/memodb-io/Acontext/internal/modules/service"
	"github.com/memodb-io/Acontext/internal/pkg/utils/fileparser"
	"github.com/memodb-io/Acontext/internal/pkg/utils/path"
)

type ArtifactHandler struct {
	svc    service.ArtifactService
	config *config.Config
}

func NewArtifactHandler(s service.ArtifactService, cfg *config.Config) *ArtifactHandler {
	return &ArtifactHandler{svc: s, config: cfg}
}

type CreateArtifactReq struct {
	FilePath string `form:"file_path" json:"file_path"` // Optional, defaults to "/"
	Meta     string `form:"meta" json:"meta"`
}

type GrepArtifactsReq struct {
	Query string `form:"query" json:"query" binding:"required" example:"TODO.*"`
	Limit *int   `form:"limit" json:"limit" binding:"omitempty,min=1,max=1000" example:"100"`
}

type GlobArtifactsReq struct {
	Query string `form:"query" json:"query" binding:"required" example:"*.py"`
	Limit *int   `form:"limit" json:"limit" binding:"omitempty,min=1,max=1000" example:"100"`
}

// UpsertArtifact godoc
//
//	@Summary		Upsert artifact
//	@Description	Upload a file and create or update an artifact record under a disk. File size must not exceed the configured maximum upload size limit (default: 16MB).
//	@Tags			artifact
//	@Accept			multipart/form-data
//	@Produce		json
//	@Param			disk_id		path		string	true	"Disk ID"	Format(uuid)	Example(123e4567-e89b-12d3-a456-426614174000)
//	@Param			file_path	formData	string	false	"File path in the disk storage (optional, defaults to '/')"
//	@Param			file		formData	file	true	"File to upload (size must not exceed configured limit)"
//	@Param			meta		formData	string	false	"Custom metadata as JSON string (optional, system metadata will be stored under '__artifact_info__' key)"
//	@Security		BearerAuth
//	@Success		201	{object}	serializer.Response{data=model.Artifact}
//	@Failure		413	{object}	serializer.Response	"File size exceeds maximum allowed size"
//	@Router			/disk/{disk_id}/artifact [post]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Upload a file to disk\nwith open('report.pdf', 'rb') as f:\n    artifact = client.disks.upload_artifact(\n        disk_id='disk-uuid',\n        file=f,\n        file_path='/documents/',\n        meta={'category': 'reports', 'year': 2024}\n    )\nprint(f\"Uploaded artifact: {artifact.id}\")\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\nimport fs from 'fs';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Upload a file to disk\nconst fileBuffer = fs.readFileSync('report.pdf');\nconst artifact = await client.disks.uploadArtifact('disk-uuid', {\n  file: fileBuffer,\n  filePath: '/documents/',\n  meta: { category: 'reports', year: 2024 }\n});\nconsole.log(`Uploaded artifact: ${artifact.id}`);\n","label":"JavaScript"}]
func (h *ArtifactHandler) UpsertArtifact(c *gin.Context) {
	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("project not found")))
		return
	}

	req := CreateArtifactReq{}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	diskID, err := uuid.Parse(c.Param("disk_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("file is required", err))
		return
	}

	// Validate file size
	maxSize := h.config.Artifact.MaxUploadSizeBytes
	if file.Size > maxSize {
		maxSizeMB := float64(maxSize) / (1024 * 1024)
		c.JSON(http.StatusRequestEntityTooLarge, serializer.ParamErr("", fmt.Errorf("file size exceeds maximum allowed size of %.2fMB", maxSizeMB)))
		return
	}

	// Parse FilePath to extract path and filename
	filePath, _ := path.SplitFilePath(req.FilePath)

	// Use the filename from the uploaded file, not from the path
	actualFilename := file.Filename

	// Validate the path parameter
	if err := path.ValidatePath(filePath); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid path", err))
		return
	}

	// Parse user meta from JSON string
	var userMeta map[string]interface{}
	if req.Meta != "" {
		if err := sonic.Unmarshal([]byte(req.Meta), &userMeta); err != nil {
			c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid meta JSON format", err))
			return
		}

		// Validate that user meta doesn't contain system reserved keys
		reservedKeys := model.Artifact{}.GetReservedKeys()
		for _, reservedKey := range reservedKeys {
			if _, exists := userMeta[reservedKey]; exists {
				c.JSON(http.StatusBadRequest, serializer.ParamErr("", fmt.Errorf("reserved key '%s' is not allowed in user meta", reservedKey)))
				return
			}
		}
	}

	artifactRecord, err := h.svc.Create(c.Request.Context(), service.CreateArtifactInput{
		ProjectID:  project.ID,
		DiskID:     diskID,
		Path:       filePath,
		Filename:   actualFilename,
		FileHeader: file,
		UserMeta:   userMeta,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusCreated, serializer.Response{Data: artifactRecord})
}

type DeleteArtifactReq struct {
	FilePath string `form:"file_path" json:"file_path" binding:"required"` // File path including filename
}

// DeleteArtifact godoc
//
//	@Summary		Delete artifact
//	@Description	Delete an artifact by path and filename
//	@Tags			artifact
//	@Accept			json
//	@Produce		json
//	@Param			disk_id		path	string	true	"Disk ID"						Format(uuid)	Example(123e4567-e89b-12d3-a456-426614174000)
//	@Param			file_path	query	string	true	"File path including filename"	example(/documents/report.pdf)
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{}
//	@Router			/disk/{disk_id}/artifact [delete]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Delete an artifact\nclient.disks.delete_artifact(\n    disk_id='disk-uuid',\n    file_path='/documents/report.pdf'\n)\nprint('Artifact deleted successfully')\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Delete an artifact\nawait client.disks.deleteArtifact('disk-uuid', {\n  filePath: '/documents/report.pdf'\n});\nconsole.log('Artifact deleted successfully');\n","label":"JavaScript"}]
func (h *ArtifactHandler) DeleteArtifact(c *gin.Context) {
	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("project not found")))
		return
	}

	req := DeleteArtifactReq{}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	diskID, err := uuid.Parse(c.Param("disk_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	// Parse FilePath to extract path and filename
	filePath, filename := path.SplitFilePath(req.FilePath)

	// Validate the path parameter
	if err := path.ValidatePath(filePath); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid path", err))
		return
	}

	if err := h.svc.DeleteByPath(c.Request.Context(), project.ID, diskID, filePath, filename); err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{})
}

type GetArtifactReq struct {
	FilePath      string `form:"file_path" json:"file_path" binding:"required"` // File path including filename
	WithPublicURL bool   `form:"with_public_url,default=true" json:"with_public_url" example:"true"`
	WithContent   bool   `form:"with_content,default=true" json:"with_content" example:"true"`
	Expire        int    `form:"expire,default=3600" json:"expire" example:"3600"` // Expire time in seconds for presigned URL
}

type GetArtifactResp struct {
	Artifact  *model.Artifact         `json:"artifact"`
	PublicURL *string                 `json:"public_url,omitempty"`
	Content   *fileparser.FileContent `json:"content,omitempty"`
}

// GetArtifact godoc
//
//	@Summary		Get artifact
//	@Description	Get artifact information by path and filename. Optionally include a presigned URL for downloading and parsed file content.
//	@Tags			artifact
//	@Accept			json
//	@Produce		json
//	@Param			disk_id			path	string	true	"Disk ID"													Format(uuid)	Example(123e4567-e89b-12d3-a456-426614174000)
//	@Param			file_path		query	string	true	"File path including filename"								example(/documents/report.pdf)
//	@Param			with_public_url	query	boolean	false	"Whether to return public URL, default is true"				example(true)
//	@Param			with_content	query	boolean	false	"Whether to return parsed file content, default is true"	example(true)
//	@Param			expire			query	int		false	"Expire time in seconds for presigned URL (default: 3600)"	example(3600)
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=handler.GetArtifactResp}
//	@Router			/disk/{disk_id}/artifact [get]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Get artifact information\nartifact_info = client.disks.get_artifact(\n    disk_id='disk-uuid',\n    file_path='/documents/report.pdf',\n    with_public_url=True,\n    with_content=True,\n    expire=3600\n)\nprint(f\"Artifact: {artifact_info.artifact.filename}\")\nif artifact_info.public_url:\n    print(f\"Download URL: {artifact_info.public_url}\")\nif artifact_info.content:\n    print(f\"Content: {artifact_info.content.text[:100]}...\")\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Get artifact information\nconst artifactInfo = await client.disks.getArtifact('disk-uuid', {\n  filePath: '/documents/report.pdf',\n  withPublicUrl: true,\n  withContent: true,\n  expire: 3600\n});\nconsole.log(`Artifact: ${artifactInfo.artifact.filename}`);\nif (artifactInfo.publicUrl) {\n  console.log(`Download URL: ${artifactInfo.publicUrl}`);\n}\nif (artifactInfo.content) {\n  console.log(`Content: ${artifactInfo.content.text.substring(0, 100)}...`);\n}\n","label":"JavaScript"}]
func (h *ArtifactHandler) GetArtifact(c *gin.Context) {
	req := GetArtifactReq{}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	diskID, err := uuid.Parse(c.Param("disk_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	// Parse FilePath to extract path and filename
	filePath, filename := path.SplitFilePath(req.FilePath)

	// Validate the path parameter
	if err := path.ValidatePath(filePath); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid path", err))
		return
	}

	artifact, err := h.svc.GetByPath(c.Request.Context(), diskID, filePath, filename)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	resp := GetArtifactResp{Artifact: artifact}

	// Generate presigned URL if requested
	if req.WithPublicURL {
		url, err := h.svc.GetPresignedURL(c.Request.Context(), artifact, time.Duration(req.Expire)*time.Second)
		if err != nil {
			c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
			return
		}
		resp.PublicURL = &url
	}

	// Parse file content if requested
	if req.WithContent {
		content, err := h.svc.GetFileContent(c.Request.Context(), artifact)
		// Only set content if parsing succeeded
		// Unsupported file types (images, binaries, etc.) will not have content
		if err == nil && content != nil {
			resp.Content = content
		}
		// Don't return error for unsupported file types - just don't include content
	}

	c.JSON(http.StatusOK, serializer.Response{Data: resp})
}

type UpdateArtifactReq struct {
	FilePath string `form:"file_path" json:"file_path" binding:"required"` // File path including filename
	Meta     string `form:"meta" json:"meta" binding:"required"`           // Custom metadata as JSON string
}

type UpdateArtifactResp struct {
	Artifact *model.Artifact `json:"artifact"`
}

// UpdateArtifact godoc
//
//	@Summary		Update artifact meta
//	@Description	Update an artifact's metadata (user-defined metadata only)
//	@Tags			artifact
//	@Accept			json
//	@Produce		json
//	@Param			disk_id	path	string						true	"Disk ID"	Format(uuid)	Example(123e4567-e89b-12d3-a456-426614174000)
//	@Param			request	body	handler.UpdateArtifactReq	true	"Update artifact request"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=handler.UpdateArtifactResp}
//	@Router			/disk/{disk_id}/artifact [put]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Update artifact metadata\nartifact = client.disks.update_artifact(\n    disk_id='disk-uuid',\n    file_path='/documents/report.pdf',\n    meta={'category': 'updated', 'reviewed': True, 'version': 2}\n)\nprint(f\"Updated artifact: {artifact.artifact.id}\")\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Update artifact metadata\nconst artifact = await client.disks.updateArtifact('disk-uuid', {\n  filePath: '/documents/report.pdf',\n  meta: { category: 'updated', reviewed: true, version: 2 }\n});\nconsole.log(`Updated artifact: ${artifact.artifact.id}`);\n","label":"JavaScript"}]
func (h *ArtifactHandler) UpdateArtifact(c *gin.Context) {
	req := UpdateArtifactReq{}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	diskID, err := uuid.Parse(c.Param("disk_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	// Parse FilePath to extract path and filename
	filePath, filename := path.SplitFilePath(req.FilePath)

	// Validate the path parameter
	if err := path.ValidatePath(filePath); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid path", err))
		return
	}

	// Parse user meta from JSON string
	var userMeta map[string]interface{}
	if err := sonic.Unmarshal([]byte(req.Meta), &userMeta); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid meta JSON format", err))
		return
	}

	// Validate that user meta doesn't contain system reserved keys
	reservedKeys := model.Artifact{}.GetReservedKeys()
	for _, reservedKey := range reservedKeys {
		if _, exists := userMeta[reservedKey]; exists {
			c.JSON(http.StatusBadRequest, serializer.ParamErr("", fmt.Errorf("reserved key '%s' is not allowed in user meta", reservedKey)))
			return
		}
	}

	// Update artifact meta
	artifactRecord, err := h.svc.UpdateArtifactMetaByPath(c.Request.Context(), diskID, filePath, filename, userMeta)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{
		Data: UpdateArtifactResp{Artifact: artifactRecord},
	})
}

type ListArtifactsReq struct {
	Path string `form:"path" json:"path"` // Optional path filter
}

type ListArtifactsResp struct {
	Artifacts   []*model.Artifact `json:"artifacts"`
	Directories []string          `json:"directories"`
}

// ListArtifacts godoc
//
//	@Summary		List artifacts
//	@Description	List artifacts in a specific path or all artifacts in a disk
//	@Tags			artifact
//	@Accept			json
//	@Produce		json
//	@Param			disk_id	path	string	true	"Disk ID"	Format(uuid)	Example(123e4567-e89b-12d3-a456-426614174000)
//	@Param			path	query	string	false	"Path filter (optional, defaults to root '/')"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=handler.ListArtifactsResp}
//	@Router			/disk/{disk_id}/artifact/ls [get]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# List artifacts in a path\nresult = client.disks.list_artifacts(\n    disk_id='disk-uuid',\n    path='/documents/'\n)\nprint(f\"Found {len(result.artifacts)} artifacts\")\nfor artifact in result.artifacts:\n    print(f\"  - {artifact.path}{artifact.filename}\")\nprint(f\"Subdirectories: {', '.join(result.directories)}\")\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// List artifacts in a path\nconst result = await client.disks.listArtifacts('disk-uuid', {\n  path: '/documents/'\n});\nconsole.log(`Found ${result.artifacts.length} artifacts`);\nfor (const artifact of result.artifacts) {\n  console.log(`  - ${artifact.path}${artifact.filename}`);\n}\nconsole.log(`Subdirectories: ${result.directories.join(', ')}`);\n","label":"JavaScript"}]
func (h *ArtifactHandler) ListArtifacts(c *gin.Context) {
	diskID, err := uuid.Parse(c.Param("disk_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	pathQuery := c.Query("path")

	// Set default path to root directory if not provided
	if pathQuery == "" {
		pathQuery = "/"
	} else {
		// Validate that path does not contain filename
		if path, _ := path.SplitFilePath(pathQuery); path != pathQuery {
			c.JSON(http.StatusBadRequest, serializer.ParamErr("both ends of the path must be '/'", errors.New("both ends of the path must be '/'")))
			return
		}
	}

	// Validate the path parameter
	if err := path.ValidatePath(pathQuery); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid path", err))
		return
	}

	artifacts, err := h.svc.ListByPath(c.Request.Context(), diskID, pathQuery)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	// Get all paths to extract directory names
	allPaths, err := h.svc.GetAllPaths(c.Request.Context(), diskID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	// Extract direct subdirectories
	directories := path.GetDirectoriesFromPaths(pathQuery, allPaths)

	c.JSON(http.StatusOK, serializer.Response{
		Data: ListArtifactsResp{
			Artifacts:   artifacts,
			Directories: directories,
		},
	})
}

// GrepArtifacts godoc
//
//	@Summary		Search artifact content with regex
//	@Description	Search through text-based artifact content using regex patterns
//	@Tags			artifact
//	@Accept			json
//	@Produce		json
//	@Param			disk_id	path		string				true	"Disk ID"	Format(uuid)
//	@Param			query	query		string				true	"Regex pattern to search for"
//	@Param			limit	query		int					false	"Maximum number of results (default 100, max 1000)"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=[]model.Artifact}
//	@Router			/disk/{disk_id}/artifact/grep [get]
func (h *ArtifactHandler) GrepArtifacts(c *gin.Context) {
	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("project not found")))
		return
	}

	diskID, err := uuid.Parse(c.Param("disk_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid disk_id", err))
		return
	}

	req := GrepArtifactsReq{}
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	limit := 100
	if req.Limit != nil {
		limit = *req.Limit
	}

	artifacts, err := h.svc.GrepArtifacts(c.Request.Context(), project.ID, diskID, req.Query, req.Limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: artifacts})
}

// GlobArtifacts godoc
//
//	@Summary		Search artifact paths with glob patterns
//	@Description	Search through artifact file paths using glob patterns (*, ?, etc.)
//	@Tags			artifact
//	@Accept			json
//	@Produce		json
//	@Param			disk_id	path		string				true	"Disk ID"	Format(uuid)
//	@Param			query	query		string				true	"Glob pattern (e.g., '**/*.py', '*.txt')"*/
//	@Param			limit	query		int					false	"Maximum number of results (default 100, max 1000)"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=[]model.Artifact}
//	@Router			/disk/{disk_id}/artifact/glob [get]
func (h *ArtifactHandler) GlobArtifacts(c *gin.Context) {
	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("project not found")))
		return
	}

	diskID, err := uuid.Parse(c.Param("disk_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid disk_id", err))
		return
	}

	req := GlobArtifactsReq{}
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	limit := 100
	if req.Limit != nil {
		limit = *req.Limit
	}

	artifacts, err := h.svc.GlobArtifacts(c.Request.Context(), project.ID, diskID, req.Query, req.Limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: artifacts})
}
