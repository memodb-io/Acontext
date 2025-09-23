package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/serializer"
	"github.com/memodb-io/Acontext/internal/modules/service"
)

type ArtifactHandler struct {
	svc service.ArtifactService
}

func NewArtifactHandler(s service.ArtifactService) *ArtifactHandler {
	return &ArtifactHandler{svc: s}
}

// CreateArtifact godoc
//
//	@Summary		Create artifact
//	@Description	Create an artifact group under a project
//	@Tags			artifact
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Success		201	{object}	serializer.Response{data=model.Artifact}
//	@Router			/artifact [post]
func (h *ArtifactHandler) CreateArtifact(c *gin.Context) {
	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("project not found")))
		return
	}

	artifact, err := h.svc.Create(c.Request.Context(), project.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusCreated, serializer.Response{Data: artifact})
}

// DeleteArtifact godoc
//
//	@Summary		Delete artifact
//	@Description	Delete an artifact by its UUID
//	@Tags			artifact
//	@Accept			json
//	@Produce		json
//	@Param			artifact_id	path	string	true	"Artifact ID"	Format(uuid)	Example(123e4567-e89b-12d3-a456-426614174000)
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{}
//	@Router			/artifact/{artifact_id} [delete]
func (h *ArtifactHandler) DeleteArtifact(c *gin.Context) {
	artifactID, err := uuid.Parse(c.Param("artifact_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("project not found")))
		return
	}

	if err := h.svc.Delete(c.Request.Context(), project.ID, artifactID); err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{})
}
