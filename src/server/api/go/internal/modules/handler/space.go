package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/serializer"
	"github.com/memodb-io/Acontext/internal/modules/service"
	"gorm.io/datatypes"
)

type SpaceHandler struct {
	svc service.SpaceService
}

func NewSpaceHandler(s service.SpaceService) *SpaceHandler {
	return &SpaceHandler{svc: s}
}

type CreateSpaceReq struct {
	Configs map[string]interface{} `form:"configs" json:"configs"`
}

// CreateSpace godoc
//
//	@Summary		Create space
//	@Description	Create a new space under a project
//	@Tags			space
//	@Accept			json
//	@Produce		json
//	@Param			payload	body	handler.CreateSpaceReq	true	"CreateSpace payload"
//	@Security		BearerAuth
//	@Success		201	{object}	serializer.Response{data=model.Space}
//	@Router			/space [post]
func (h *SpaceHandler) CreateSpace(c *gin.Context) {
	req := CreateSpaceReq{}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	project := c.MustGet("project").(*model.Project)
	space := model.Space{
		ProjectID: project.ID,
		Configs:   datatypes.JSONMap(req.Configs),
	}
	if err := h.svc.Create(c.Request.Context(), &space); err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusCreated, serializer.Response{Data: space})
}

// DeleteSpace godoc
//
//	@Summary		Delete space
//	@Description	Delete a space by its ID
//	@Tags			space
//	@Accept			json
//	@Produce		json
//	@Param			space_id	path	string	true	"Space ID"	Format(uuid)	Example(123e4567-e89b-12d3-a456-426614174000)
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response
//	@Router			/space/{space_id} [delete]
func (h *SpaceHandler) DeleteSpace(c *gin.Context) {
	spaceID, err := uuid.Parse(c.Param("space_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}
	project := c.MustGet("project").(*model.Project)
	if err := h.svc.Delete(c.Request.Context(), project.ID, spaceID); err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{})
}

type UpdateSpaceConfigsReq struct {
	Configs map[string]interface{} `form:"configs" json:"configs" binding:"required"`
}

// UpdateConfigs godoc
//
//	@Summary		Update space configs
//	@Description	Update the configurations of a space by its ID
//	@Tags			space
//	@Accept			json
//	@Produce		json
//	@Param			space_id	path	string							true	"Space ID"	Format(uuid)	Example(123e4567-e89b-12d3-a456-426614174000)
//	@Param			payload		body	handler.UpdateSpaceConfigsReq	true	"UpdateConfigs payload"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response
//	@Router			/space/{space_id}/configs [put]
func (h *SpaceHandler) UpdateConfigs(c *gin.Context) {
	req := UpdateSpaceConfigsReq{}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	spaceID, err := uuid.Parse(c.Param("space_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}
	if err := h.svc.UpdateByID(c.Request.Context(), &model.Space{
		ID:      spaceID,
		Configs: datatypes.JSONMap(req.Configs),
	}); err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{})
}

// GetConfigs godoc
//
//	@Summary		Get space configs
//	@Description	Retrieve the configurations of a space by its ID
//	@Tags			space
//	@Accept			json
//	@Produce		json
//	@Param			space_id	path	string	true	"Space ID"	Format(uuid)	Example(123e4567-e89b-12d3-a456-426614174000)
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=model.Space}
//	@Router			/space/{space_id}/configs [get]
func (h *SpaceHandler) GetConfigs(c *gin.Context) {
	spaceID, err := uuid.Parse(c.Param("space_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}
	space, err := h.svc.GetByID(c.Request.Context(), &model.Space{ID: spaceID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: space})
}

type GetSemanticAnswerReq struct {
	Query string `form:"query" json:"query" binding:"required"`
}

// GetSemanticAnswer godoc
//
//	@Summary		Get semantic answer
//	@Description	Retrieve the semantic answer for a given query within a space by its ID
//	@Tags			space
//	@Accept			json
//	@Produce		json
//	@Param			space_id	path	string							true	"Space ID"	Format(uuid)	Example(123e4567-e89b-12d3-a456-426614174000)
//	@Param			payload		body	handler.GetSemanticAnswerReq	true	"GetSemanticAnswer payload"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{}
//	@Router			/space/{space_id}/semantic_answer [get]
func (h *SpaceHandler) GetSemanticAnswer(c *gin.Context) {
	// TODO: implement
	spaceID, err := uuid.Parse(c.Param("space_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}
	req := GetSemanticAnswerReq{}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: spaceID})
}

type GetSemanticGlobalReq struct {
	Query string `form:"query" json:"query" binding:"required"`
}

// GetSemanticGlobal godoc
//
//	@Summary		Get semantic global
//	@Description	Retrieve the semantic global information for a given query within a space by its ID
//	@Tags			space
//	@Accept			json
//	@Produce		json
//	@Param			space_id	path	string							true	"Space ID"	Format(uuid)	Example(123e4567-e89b-12d3-a456-426614174000)
//	@Param			payload		body	handler.GetSemanticGlobalReq	true	"GetSemanticGlobal payload"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{}
//	@Router			/space/{space_id}/semantic_global [get]
func (h *SpaceHandler) GetSemanticGlobal(c *gin.Context) {
	// TODO: implement
	spaceID, err := uuid.Parse(c.Param("space_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}
	req := GetSemanticGlobalReq{}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: spaceID})
}

type GetSemanticGrepReq struct {
	Query string `form:"query" json:"query" binding:"required"`
}

// GetSemanticGrep godoc
//
//	@Summary		Get semantic grep
//	@Description	Retrieve the semantic grep results for a given query within a space by its ID
//	@Tags			space
//	@Accept			json
//	@Produce		json
//	@Param			space_id	path	string						true	"Space ID"	Format(uuid)	Example(123e4567-e89b-12d3-a456-426614174000)
//	@Param			payload		body	handler.GetSemanticGrepReq	true	"GetSemanticGrep payload"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{}
//	@Router			/space/{space_id}/semantic_grep [get]
func (h *SpaceHandler) GetSemanticGrep(c *gin.Context) {
	// TODO: implement
	spaceID, err := uuid.Parse(c.Param("space_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}
	req := GetSemanticGrepReq{}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: spaceID})
}
