package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/serializer"
	"github.com/memodb-io/Acontext/internal/modules/service"
	"gorm.io/datatypes"
)

type BlockHandler struct {
	svc service.BlockService
}

func NewBlockHandler(s service.BlockService) *BlockHandler {
	return &BlockHandler{svc: s}
}

type CreatePageReq struct {
	ParentID *uuid.UUID     `from:"parent_id" json:"parent_id"`
	Title    string         `form:"title" json:"title"`
	Props    map[string]any `form:"props" json:"props"`
}

// CreatePage godoc
//
//	@Summary		Create page
//	@Description	Create a new page in the space
//	@Tags			page
//	@Accept			json
//	@Produce		json
//	@Param			space_id	path	string					true	"Space ID"	Format(uuid)
//	@Param			payload		body	handler.CreatePageReq	true	"CreatePage payload"
//	@Security		BearerAuth
//	@Success		201	{object}	serializer.Response{data=model.Block}
//	@Router			/space/{space_id}/page [post]
func (h *BlockHandler) CreatePage(c *gin.Context) {
	spaceID, err := uuid.Parse(c.Param("space_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	req := CreatePageReq{}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	page := model.Block{
		SpaceID:  spaceID,
		Type:     model.BlockTypePage,
		ParentID: req.ParentID,
		Title:    req.Title,
		Props:    datatypes.NewJSONType(req.Props),
	}
	if err := h.svc.CreatePage(c.Request.Context(), &page); err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusCreated, serializer.Response{Data: page})
}

// DeletePage godoc
//
//	@Summary		Delete page
//	@Description	Delete a page by its ID in the space
//	@Tags			page
//	@Accept			json
//	@Produce		json
//	@Param			space_id	path	string	true	"Space ID"	Format(uuid)
//	@Param			page_id		path	string	true	"Page ID"	Format(uuid)
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response
//	@Router			/space/{space_id}/page/{page_id} [delete]
func (h *BlockHandler) DeletePage(c *gin.Context) {
	spaceID, err := uuid.Parse(c.Param("space_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	pageID, err := uuid.Parse(c.Param("page_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	if err := h.svc.DeletePage(c.Request.Context(), spaceID, pageID); err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{})
}

// GetPageProperties godoc
//
//	@Summary		Get page properties
//	@Description	Get page properties by page ID
//	@Tags			page
//	@Accept			json
//	@Produce		json
//	@Param			space_id	path	string	true	"Space ID"	Format(uuid)
//	@Param			page_id		path	string	true	"Page ID"	Format(uuid)
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=model.Block}
//	@Router			/space/{space_id}/page/{page_id}/properties [get]
func (h *BlockHandler) GetPageProperties(c *gin.Context) {
	pageID, err := uuid.Parse(c.Param("page_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	b, err := h.svc.GetPageProperties(c.Request.Context(), pageID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: b})
}

type UpdatePagePropertiesReq struct {
	Title string         `form:"title" json:"title"`
	Props map[string]any `form:"props" json:"props"`
}

// UpdatePageProperties godoc
//
//	@Summary		Update page properties
//	@Description	Update page title and properties
//	@Tags			page
//	@Accept			json
//	@Produce		json
//	@Param			space_id	path	string							true	"Space ID"	Format(uuid)
//	@Param			page_id		path	string							true	"Page ID"	Format(uuid)
//	@Param			payload		body	handler.UpdatePagePropertiesReq	true	"UpdatePageProperties payload"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response
//	@Router			/space/{space_id}/page/{page_id}/properties [put]
func (h *BlockHandler) UpdatePageProperties(c *gin.Context) {
	pageID, err := uuid.Parse(c.Param("page_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	req := UpdatePagePropertiesReq{}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	b := model.Block{
		ID:    pageID,
		Title: req.Title,
		Props: datatypes.NewJSONType(req.Props),
	}
	if err := h.svc.UpdatePageProperties(c.Request.Context(), &b); err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{})
}

// ListPages godoc
//
//	@Summary		List pages
//	@Description	List pages in a space, optionally filtered by parent_id (use parent_id query parameter to get children of a specific page, or omit it to get top-level pages where parent_id is null)
//	@Tags			page
//	@Accept			json
//	@Produce		json
//	@Param			space_id	path	string	true	"Space ID"	Format(uuid)
//	@Param			parent_id	query	string	false	"Parent ID"	Format(uuid)
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=[]model.Block}
//	@Router			/space/{space_id}/page [get]
func (h *BlockHandler) ListPages(c *gin.Context) {
	spaceID, err := uuid.Parse(c.Param("space_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	var parentID *uuid.UUID
	if parentIDStr := c.Query("parent_id"); parentIDStr != "" {
		pid, err := uuid.Parse(parentIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, serializer.ParamErr("parent_id", err))
			return
		}
		parentID = &pid
	}

	list, err := h.svc.ListPages(c.Request.Context(), spaceID, parentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: list})
}

type CreateBlockReq struct {
	ParentID uuid.UUID      `from:"parent_id" json:"parent_id" binding:"required"`
	Type     string         `from:"type" json:"type" binding:"required" example:"text"`
	Title    string         `from:"title" json:"title"`
	Props    map[string]any `from:"props" json:"props"`
}

// CreateBlock godoc
//
//	@Summary		Create block
//	@Description	Create a new block under a parent
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

	parentID := req.ParentID
	b := model.Block{
		SpaceID:  spaceID,
		Type:     req.Type,
		ParentID: &parentID,
		Title:    req.Title,
		Props:    datatypes.NewJSONType(req.Props),
	}
	if err := h.svc.CreateBlock(c.Request.Context(), &b); err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusCreated, serializer.Response{Data: b})
}

// DeleteBlock godoc
//
//	@Summary		Delete block
//	@Description	Delete a block by its ID
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

	if err := h.svc.DeleteBlock(c.Request.Context(), spaceID, blockID); err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{})
}

// GetBlockProperties godoc
//
//	@Summary		Get block properties
//	@Description	Get a block's properties by its ID
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
//	@Description	Update a block's title and properties by its ID
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

// ListBlocks godoc
//
//	@Summary		List blocks
//	@Description	List blocks under a parent (page or block), excludes page type blocks (type != page), parent_id is required
//	@Tags			block
//	@Accept			json
//	@Produce		json
//	@Param			space_id	path	string	true	"Space ID"	Format(uuid)
//	@Param			parent_id	query	string	true	"Parent ID"	Format(uuid)
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=[]model.Block}
//	@Router			/space/{space_id}/block [get]
func (h *BlockHandler) ListBlocks(c *gin.Context) {
	spaceID, err := uuid.Parse(c.Param("space_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	parentIDStr := c.Query("parent_id")
	if parentIDStr == "" {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("parent_id", errors.New("parent_id is required")))
		return
	}

	parentID, err := uuid.Parse(parentIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("parent_id", err))
		return
	}

	list, err := h.svc.ListBlocks(c.Request.Context(), spaceID, parentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}
	c.JSON(http.StatusOK, serializer.Response{Data: list})
}

type MovePageReq struct {
	ParentID *uuid.UUID `form:"parent_id" json:"parent_id"`
	Sort     *int64     `form:"sort" json:"sort"`
}

// MovePage godoc
//
//	@Summary		Move page (change parent_id)
//	@Description	Move page by updating its parent_id
//	@Tags			page
//	@Accept			json
//	@Produce		json
//	@Param			space_id	path	string				true	"Space ID"	Format(uuid)
//	@Param			page_id		path	string				true	"Page ID"	Format(uuid)
//	@Param			payload		body	handler.MovePageReq	true	"MovePage payload"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response
//	@Router			/space/{space_id}/page/{page_id}/move [put]
func (h *BlockHandler) MovePage(c *gin.Context) {
	pageID, err := uuid.Parse(c.Param("page_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}
	req := MovePageReq{}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	// Validate: parent_id cannot be the page itself
	if req.ParentID != nil && *req.ParentID == pageID {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("parent_id", errors.New("parent_id cannot be self")))
		return
	}

	if err := h.svc.MovePage(c.Request.Context(), pageID, req.ParentID, req.Sort); err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{})
}

type UpdatePageSortReq struct {
	Sort int64 `form:"sort" json:"sort"`
}

// UpdatePageSort godoc
//
//	@Summary		Update page sort
//	@Description	Update page sort value
//	@Tags			page
//	@Accept			json
//	@Produce		json
//	@Param			space_id	path	string						true	"Space ID"	Format(uuid)
//	@Param			page_id		path	string						true	"Page ID"	Format(uuid)
//	@Param			payload		body	handler.UpdatePageSortReq	true	"UpdatePageSort payload"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response
//	@Router			/space/{space_id}/page/{page_id}/sort [put]
func (h *BlockHandler) UpdatePageSort(c *gin.Context) {
	pageID, err := uuid.Parse(c.Param("page_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	req := UpdatePageSortReq{}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	if err := h.svc.UpdatePageSort(c.Request.Context(), pageID, req.Sort); err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{})
}

type MoveBlockReq struct {
	ParentID uuid.UUID `form:"parent_id" json:"parent_id" binding:"required"`
	Sort     *int64    `form:"sort" json:"sort"`
}

// MoveBlock godoc
//
//	@Summary		Move block (to page or block)
//	@Description	Move block by updating its parent_id to page or block
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
	if req.ParentID == blockID {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("parent_id", errors.New("parent_id cannot be self")))
		return
	}

	if err := h.svc.MoveBlock(c.Request.Context(), blockID, req.ParentID, req.Sort); err != nil {
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
//	@Description	Update block sort value
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

	if err := h.svc.UpdateBlockSort(c.Request.Context(), blockID, req.Sort); err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{})
}
