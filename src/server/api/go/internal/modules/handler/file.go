package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/serializer"
	"github.com/memodb-io/Acontext/internal/modules/service"
	"github.com/memodb-io/Acontext/internal/pkg/utils/path"
)

type FileHandler struct {
	svc service.FileService
}

func NewFileHandler(s service.FileService) *FileHandler {
	return &FileHandler{svc: s}
}

type CreateFileReq struct {
	FilePath string `form:"file_path" json:"file_path"` // Optional, defaults to "/"
	Meta     string `form:"meta" json:"meta"`
}

// CreateFile godoc
//
//	@Summary		Create file
//	@Description	Upload a file and create a file record under an artifact
//	@Tags			file
//	@Accept			multipart/form-data
//	@Produce		json
//	@Param			artifact_id	path		string	true	"Artifact ID"	Format(uuid)	Example(123e4567-e89b-12d3-a456-426614174000)
//	@Param			file_path	formData	string	false	"File path in the artifact storage (optional, defaults to '/')"
//	@Param			file		formData	file	true	"File to upload"
//	@Param			meta		formData	string	false	"Custom metadata as JSON string (optional, system metadata will be stored under '__file_info__' key)"
//	@Security		BearerAuth
//	@Success		201	{object}	serializer.Response{data=model.File}
//	@Router			/artifact/{artifact_id}/file [post]
func (h *FileHandler) CreateFile(c *gin.Context) {
	req := CreateFileReq{}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	artifactID, err := uuid.Parse(c.Param("artifact_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("file is required", err))
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
		if err := json.Unmarshal([]byte(req.Meta), &userMeta); err != nil {
			c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid meta JSON format", err))
			return
		}

		// Validate that user meta doesn't contain system reserved keys
		reservedKeys := model.GetReservedKeys()
		for _, reservedKey := range reservedKeys {
			if _, exists := userMeta[reservedKey]; exists {
				c.JSON(http.StatusBadRequest, serializer.ParamErr("", fmt.Errorf("reserved key '%s' is not allowed in user meta", reservedKey)))
				return
			}
		}
	}

	fileRecord, err := h.svc.Create(c.Request.Context(), artifactID, filePath, actualFilename, file, userMeta)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusCreated, serializer.Response{Data: fileRecord})
}

type DeleteFileReq struct {
	FilePath string `form:"file_path" json:"file_path" binding:"required"` // File path including filename
}

// DeleteFile godoc
//
//	@Summary		Delete file
//	@Description	Delete a file by path and filename
//	@Tags			file
//	@Accept			json
//	@Produce		json
//	@Param			artifact_id	path	string	true	"Artifact ID"					Format(uuid)	Example(123e4567-e89b-12d3-a456-426614174000)
//	@Param			file_path	query	string	true	"File path including filename"	example:"/documents/report.pdf"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{}
//	@Router			/artifact/{artifact_id}/file [delete]
func (h *FileHandler) DeleteFile(c *gin.Context) {
	req := DeleteFileReq{}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	artifactID, err := uuid.Parse(c.Param("artifact_id"))
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

	if err := h.svc.DeleteByPath(c.Request.Context(), artifactID, filePath, filename); err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{})
}

type GetFileReq struct {
	FilePath      string `form:"file_path" json:"file_path" binding:"required"` // File path including filename
	WithPublicURL bool   `form:"with_public_url,default=false" json:"with_public_url" example:"false"`
	Expire        int    `form:"expire,default=3600" json:"expire" example:"3600"` // Expire time in seconds for presigned URL
}

type GetFileResp struct {
	File      *model.File `json:"file"`
	PublicURL *string     `json:"public_url,omitempty"`
}

// GetFile godoc
//
//	@Summary		Get file
//	@Description	Get file information by path and filename. Optionally include a presigned URL for downloading.
//	@Tags			file
//	@Accept			json
//	@Produce		json
//	@Param			artifact_id		path	string	true	"Artifact ID"												Format(uuid)	Example(123e4567-e89b-12d3-a456-426614174000)
//	@Param			file_path		query	string	true	"File path including filename"								example:"/documents/report.pdf"
//	@Param			with_public_url	query	boolean	false	"Whether to return public URL, default is false"			example:"false"
//	@Param			expire			query	int		false	"Expire time in seconds for presigned URL (default: 3600)"	example:"3600"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=handler.GetFileResp}
//	@Router			/artifact/{artifact_id}/file [get]
func (h *FileHandler) GetFile(c *gin.Context) {
	req := GetFileReq{}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	artifactID, err := uuid.Parse(c.Param("artifact_id"))
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

	file, err := h.svc.GetByPath(c.Request.Context(), artifactID, filePath, filename)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	resp := GetFileResp{File: file}

	// Generate presigned URL if requested
	if req.WithPublicURL {
		url, err := h.svc.GetPresignedURLByPath(c.Request.Context(), artifactID, filePath, filename, time.Duration(req.Expire)*time.Second)
		if err != nil {
			c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
			return
		}
		resp.PublicURL = &url
	}

	c.JSON(http.StatusOK, serializer.Response{Data: resp})
}

type UpdateFileReq struct {
	FilePath string `form:"file_path" json:"file_path" binding:"required"` // File path including filename
}

type UpdateFileResp struct {
	File *model.File `json:"file"`
}

// UpdateFile godoc
//
//	@Summary		Update file
//	@Description	Update a file by uploading a new file (path cannot be changed)
//	@Tags			file
//	@Accept			multipart/form-data
//	@Produce		json
//	@Param			artifact_id	path		string	true	"Artifact ID"					Format(uuid)	Example(123e4567-e89b-12d3-a456-426614174000)
//	@Param			file_path	formData	string	true	"File path including filename"	example:"/documents/report.pdf"
//	@Param			file		formData	file	true	"New file to upload"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=handler.UpdateFileResp}
//	@Router			/artifact/{artifact_id}/file [put]
func (h *FileHandler) UpdateFile(c *gin.Context) {
	req := UpdateFileReq{}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	artifactID, err := uuid.Parse(c.Param("artifact_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	// Parse FilePath to extract path and filename
	filePath, originalFilename := path.SplitFilePath(req.FilePath)

	// Validate the path parameter
	if err := path.ValidatePath(filePath); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid path", err))
		return
	}

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("file is required", err))
		return
	}

	// Check if the uploaded file has a different name than the original
	uploadedFilename := file.Filename
	var newFilename *string
	if uploadedFilename != originalFilename {
		// File name has changed, we need to check if the new name conflicts
		newFilename = &uploadedFilename
	}

	// Update file content, with potential filename change
	fileRecord, err := h.svc.UpdateFileByPath(c.Request.Context(), artifactID, filePath, originalFilename, file, nil, newFilename)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{
		Data: UpdateFileResp{File: fileRecord},
	})
}

type ListFilesReq struct {
	Path string `form:"path" json:"path"` // Optional path filter
}

type ListFilesResp struct {
	Files       []*model.File `json:"files"`
	Directories []string      `json:"directories"`
}

// ListFiles godoc
//
//	@Summary		List files
//	@Description	List files in a specific path or all files in an artifact
//	@Tags			file
//	@Accept			json
//	@Produce		json
//	@Param			artifact_id	path	string	true	"Artifact ID"	Format(uuid)	Example(123e4567-e89b-12d3-a456-426614174000)
//	@Param			path		query	string	false	"Path filter (optional, defaults to root '/')"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=handler.ListFilesResp}
//	@Router			/artifact/{artifact_id}/file/ls [get]
func (h *FileHandler) ListFiles(c *gin.Context) {
	artifactID, err := uuid.Parse(c.Param("artifact_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	pathQuery := c.Query("path")

	// Set default path to root directory if not provided
	if pathQuery == "" {
		pathQuery = "/"
	}

	// Validate the path parameter
	if err := path.ValidatePath(pathQuery); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid path", err))
		return
	}

	files, err := h.svc.ListByPath(c.Request.Context(), artifactID, pathQuery)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	// Get all paths to extract directory names
	allPaths, err := h.svc.GetAllPaths(c.Request.Context(), artifactID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	// Extract direct subdirectories
	directories := path.GetDirectoriesFromPaths(pathQuery, allPaths)

	c.JSON(http.StatusOK, serializer.Response{
		Data: ListFilesResp{
			Files:       files,
			Directories: directories,
		},
	})
}
