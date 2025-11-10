package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/serializer"
	"github.com/memodb-io/Acontext/internal/modules/service"
	"github.com/memodb-io/Acontext/internal/pkg/utils/path"
	"gorm.io/datatypes"
)

type BlockHandler struct {
	svc service.BlockService
}

func NewBlockHandler(s service.BlockService) *BlockHandler {
	return &BlockHandler{svc: s}
}

type CreateBlockReq struct {
	ParentID *uuid.UUID     `from:"parent_id" json:"parent_id"`
	Type     string         `from:"type" json:"type" binding:"required" example:"text"`
	Title    string         `from:"title" json:"title"`
	Props    map[string]any `from:"props" json:"props"`
}

// CreateBlock godoc
//
//	@Summary		Create block
//	@Description	Create a new block (supports all types: page, folder, text, sop, etc.). For page and folder types, parent_id is optional. For other types, parent_id is required.
//	@Tags			block
//	@Accept			json
//	@Produce		json
//	@Param			space_id	path	string					true	"Space ID"	Format(uuid)
//	@Param			payload		body	handler.CreateBlockReq	true	"CreateBlock payload"
//	@Security		BearerAuth
//	@Success		201	{object}	serializer.Response{data=model.Block}
//	@Router			/space/{space_id}/block [post]
func (h *BlockHandler) CreateBlock(c *gin.Context) {
	spaceID, err := uuid.Parse(c.Param("space_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	req := CreateBlockReq{}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	if !model.IsValidBlockType(req.Type) {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("type", errors.New("invalid block type")))
		return
	}

	if _, filename := path.SplitFilePath(req.Title); filename != req.Title {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("title", errors.New("title cannot contain path")))
		return
	}

	b := model.Block{
		SpaceID:  spaceID,
		Type:     req.Type,
		ParentID: req.ParentID,
		Title:    req.Title,
		Props:    datatypes.NewJSONType(req.Props),
	}

	// Use unified Create method - it handles special logic for folder path
	if err := h.svc.Create(c.Request.Context(), &b); err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusCreated, serializer.Response{Data: b})
}

// DeleteBlock godoc
//
//	@Summary		Delete block
//	@Description	Delete a block by its ID (works for all block types: page, folder, text, sop, etc.)
//	@Tags			block
//	@Accept			json
//	@Produce		json
//	@Param			space_id	path	string	true	"Space ID"	Format(uuid)
//	@Param			block_id	path	string	true	"Block ID"	Format(uuid)
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response
//	@Router			/space/{space_id}/block/{block_id} [delete]
func (h *BlockHandler) DeleteBlock(c *gin.Context) {
	spaceID, err := uuid.Parse(c.Param("space_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	blockID, err := uuid.Parse(c.Param("block_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	if err := h.svc.Delete(c.Request.Context(), spaceID, blockID); err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{})
}

// GetBlockProperties godoc
//
//	@Summary		Get block properties
//	@Description	Get a block's properties by its ID (works for all block types: page, folder, text, sop, etc.)
//	@Tags			block
//	@Accept			json
//	@Produce		json
//	@Param			space_id	path	string	true	"Space ID"	Format(uuid)
//	@Param			block_id	path	string	true	"Block ID"	Format(uuid)
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=model.Block}
//	@Router			/space/{space_id}/block/{block_id}/properties [get]
func (h *BlockHandler) GetBlockProperties(c *gin.Context) {
	blockID, err := uuid.Parse(c.Param("block_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	b, err := h.svc.GetBlockProperties(c.Request.Context(), blockID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: b})
}

type UpdateBlockPropertiesReq struct {
	Title string         `form:"title" json:"title"`
	Props map[string]any `form:"props" json:"props"`
}

// UpdateBlockProperties godoc
//
//	@Summary		Update block properties
//	@Description	Update a block's title and properties by its ID (works for all block types: page, folder, text, sop, etc.)
//	@Tags			block
//	@Accept			json
//	@Produce		json
//	@Param			space_id	path	string								true	"Space ID"	Format(uuid)
//	@Param			block_id	path	string								true	"Block ID"	Format(uuid)
//	@Param			payload		body	handler.UpdateBlockPropertiesReq	true	"UpdateBlockProperties payload"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response
//	@Router			/space/{space_id}/block/{block_id}/properties [put]
func (h *BlockHandler) UpdateBlockProperties(c *gin.Context) {
	blockID, err := uuid.Parse(c.Param("block_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	req := UpdateBlockPropertiesReq{}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	if _, filename := path.SplitFilePath(req.Title); filename != req.Title {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("title", errors.New("title cannot contain path")))
		return
	}

	b := model.Block{
		ID:    blockID,
		Title: req.Title,
		Props: datatypes.NewJSONType(req.Props),
	}
	if err := h.svc.UpdateBlockProperties(c.Request.Context(), &b); err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{})
}

type ListBlocksReq struct {
	Type     string `form:"type" json:"type"`
	ParentID string `form:"parent_id" json:"parent_id"`
}

// ListBlocks godoc
//
//	@Summary		List blocks
//	@Description	List blocks in a space. Use type query parameter to filter by block type (page, folder, text, sop, etc.). Use parent_id query parameter to filter by parent. If both type and parent_id are empty, returns top-level pages and folders.
//	@Tags			block
//	@Accept			json
//	@Produce		json
//	@Param			space_id	path	string	true	"Space ID"		Format(uuid)
//	@Param			type		query	string	false	"Block type"	Enums(page, folder, text, sop)
//	@Param			parent_id	query	string	false	"Parent ID"		Format(uuid)
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=[]model.Block}
//	@Router			/space/{space_id}/block [get]
func (h *BlockHandler) ListBlocks(c *gin.Context) {
	spaceID, err := uuid.Parse(c.Param("space_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	req := ListBlocksReq{}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	// Parse parent_id if provided
	var parentID *uuid.UUID
	if req.ParentID != "" {
		pid, err := uuid.Parse(req.ParentID)
		if err != nil {
			c.JSON(http.StatusBadRequest, serializer.ParamErr("parent_id", err))
			return
		}
		parentID = &pid
	}

	// Use unified List method - it handles type and parent_id filtering
	list, err := h.svc.List(c.Request.Context(), spaceID, req.Type, parentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: list})
}

type MoveBlockReq struct {
	ParentID *uuid.UUID `form:"parent_id" json:"parent_id"`
	Sort     *int64     `form:"sort" json:"sort"`
}

// MoveBlock godoc
//
//	@Summary		Move block
//	@Description	Move block by updating its parent_id. Works for all block types (page, folder, text, sop, etc.). For page and folder types, parent_id can be null (root level).
//	@Tags			block
//	@Accept			json
//	@Produce		json
//	@Param			space_id	path	string					true	"Space ID"	Format(uuid)
//	@Param			block_id	path	string					true	"Block ID"	Format(uuid)
//	@Param			payload		body	handler.MoveBlockReq	true	"MoveBlock payload"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response
//	@Router			/space/{space_id}/block/{block_id}/move [put]
func (h *BlockHandler) MoveBlock(c *gin.Context) {
	blockID, err := uuid.Parse(c.Param("block_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	req := MoveBlockReq{}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	// Validate: parent_id cannot be the block itself
	if req.ParentID != nil && *req.ParentID == blockID {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("parent_id", errors.New("parent_id cannot be self")))
		return
	}

	// Use unified Move method - it handles special logic for folder path
	if err := h.svc.Move(c.Request.Context(), blockID, req.ParentID, req.Sort); err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{})
}

type UpdateBlockSortReq struct {
	Sort int64 `form:"sort" json:"sort"`
}

// UpdateBlockSort godoc
//
//	@Summary		Update block sort
//	@Description	Update block sort value (works for all block types: page, folder, text, sop, etc.)
//	@Tags			block
//	@Accept			json
//	@Produce		json
//	@Param			space_id	path	string						true	"Space ID"	Format(uuid)
//	@Param			block_id	path	string						true	"Block ID"	Format(uuid)
//	@Param			payload		body	handler.UpdateBlockSortReq	true	"UpdateBlockSort payload"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response
//	@Router			/space/{space_id}/block/{block_id}/sort [put]
func (h *BlockHandler) UpdateBlockSort(c *gin.Context) {
	blockID, err := uuid.Parse(c.Param("block_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	req := UpdateBlockSortReq{}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	if err := h.svc.UpdateSort(c.Request.Context(), blockID, req.Sort); err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{})
}
