package handler

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/memodb-io/Acontext/internal/modules/serializer"
	"github.com/memodb-io/Acontext/internal/modules/service"
)

type MaterialHandler struct {
	materialSvc service.MaterialService
}

func NewMaterialHandler(materialSvc service.MaterialService) *MaterialHandler {
	return &MaterialHandler{materialSvc: materialSvc}
}

// Serve godoc
//
//	@Summary		Serve material content
//	@Description	Download file content via a material token. No authentication required. Returns the file content with appropriate Content-Type header.
//	@Tags			material
//	@Produce		octet-stream
//	@Param			token	path	string	true	"Material token (64-char hex)"
//	@Success		200		"File content"
//	@Failure		404		{object}	serializer.Response	"Token not found or expired"
//	@Router			/material/{token} [get]
func (h *MaterialHandler) Serve(c *gin.Context) {
	token := c.Param("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("token is required", nil))
		return
	}

	content, mimeType, fileName, err := h.materialSvc.ServeMaterial(c.Request.Context(), token)
	if err != nil {
		if errors.Is(err, service.ErrMaterialNotFound) {
			c.JSON(http.StatusNotFound, serializer.Err(http.StatusNotFound, "material not found", nil))
			return
		}
		c.JSON(http.StatusInternalServerError, serializer.Err(http.StatusInternalServerError, "failed to serve material", err))
		return
	}

	if mimeType == "" {
		mimeType = "application/octet-stream"
	}

	if fileName != "" {
		c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, fileName))
	}

	c.Data(http.StatusOK, mimeType, content)
}
