package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/infra/httpclient"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/serializer"
	"github.com/memodb-io/Acontext/internal/modules/service"
	"github.com/memodb-io/Acontext/internal/pkg/utils/path"
	"gorm.io/datatypes"
)

type BlockHandler struct {
	svc        service.BlockService
	coreClient *httpclient.CoreClient
}

func NewBlockHandler(s service.BlockService, coreClient *httpclient.CoreClient) *BlockHandler {
	return &BlockHandler{
		svc:        s,
		coreClient: coreClient,
	}
}

type CreateBlockReq struct {
	ParentID *uuid.UUID     `from:"parent_id" json:"parent_id"`
	Type     string         `from:"type" json:"type" binding:"required" example:"page"`
	Title    string         `from:"title" json:"title"`
	Props    map[string]any `from:"props" json:"props"`
}

// CreateBlock godoc
//
//	@Summary		Create block
//	@Description	Create a new block (supports types: page, folder, sop). For page and folder types, parent_id is optional. For sop type, parent_id is required.
//	@Tags			block
//	@Accept			json
//	@Produce		json
//	@Param			space_id	path	string					true	"Space ID"	Format(uuid)
//	@Param			payload		body	handler.CreateBlockReq	true	"CreateBlock payload"
//	@Security		BearerAuth
//	@Success		201	{object}	serializer.Response{data=httpclient.InsertBlockResponse}
//	@Router			/space/{space_id}/block [post]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Create a folder\nfolder = client.blocks.create(\n    space_id='space-uuid',\n    block_type='folder',\n    title='My Folder'\n)\n\n# Create a page under the folder\npage = client.blocks.create(\n    space_id='space-uuid',\n    parent_id=folder['id'],\n    block_type='page',\n    title='My Page',\n    props={\"description\": \"Page content here\"}\n)\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Create a folder\nconst folder = await client.blocks.create('space-uuid', {\n  blockType: 'folder',\n  title: 'My Folder'\n});\n\n// Create a page under the folder\nconst page = await client.blocks.create('space-uuid', {\n  parentId: folder.id,\n  blockType: 'page',\n  title: 'My Page',\n  props: { description: 'Page content here' }\n});\n","label":"JavaScript"}]
func (h *BlockHandler) CreateBlock(c *gin.Context) {
	// Get project from context
	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("project not found")))
		return
	}

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

	// Pre-validation before calling Core service
	// 1. Create a temporary block for validation
	tempBlock := &model.Block{
		SpaceID:  spaceID,
		Type:     req.Type,
		Title:    req.Title,
		ParentID: req.ParentID,
	}

	// 2. Validate basic block constraints
	if err := tempBlock.Validate(); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	// 3. If parent_id is provided, validate parent-child relationship
	if req.ParentID != nil {
		parent, err := h.svc.GetBlockProperties(c.Request.Context(), *req.ParentID)
		if err != nil {
			c.JSON(http.StatusBadRequest, serializer.ParamErr("parent_id", errors.New("parent block not found")))
			return
		}

		// Check if parent can have children
		if !parent.CanHaveChildren() {
			c.JSON(http.StatusBadRequest, serializer.ParamErr("parent_id", errors.New("parent cannot have children")))
			return
		}

		// Validate parent type compatibility
		if err := tempBlock.ValidateParentType(parent); err != nil {
			c.JSON(http.StatusBadRequest, serializer.ParamErr("parent_id", err))
			return
		}
	}

	// Prepare request for Core service
	coreReq := httpclient.InsertBlockRequest{
		ParentID: req.ParentID,
		Props:    req.Props,
		Title:    req.Title,
		Type:     req.Type,
	}

	// Call Core service to insert block
	result, err := h.coreClient.InsertBlock(c.Request.Context(), project.ID, spaceID, coreReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.Err(http.StatusInternalServerError, "failed to insert block", err))
		return
	}

	c.JSON(http.StatusCreated, serializer.Response{Data: result})
}

// DeleteBlock godoc
//
//	@Summary		Delete block
//	@Description	Delete a block by its ID (works for block types: page, folder, sop)
//	@Tags			block
//	@Accept			json
//	@Produce		json
//	@Param			space_id	path	string	true	"Space ID"	Format(uuid)
//	@Param			block_id	path	string	true	"Block ID"	Format(uuid)
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response
//	@Router			/space/{space_id}/block/{block_id} [delete]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Delete a block\nclient.blocks.delete(space_id='space-uuid', block_id='block-uuid')\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Delete a block\nawait client.blocks.delete('space-uuid', 'block-uuid');\n","label":"JavaScript"}]
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
//	@Description	Get a block's properties by its ID (works for block types: page, folder, sop)
//	@Tags			block
//	@Accept			json
//	@Produce		json
//	@Param			space_id	path	string	true	"Space ID"	Format(uuid)
//	@Param			block_id	path	string	true	"Block ID"	Format(uuid)
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=model.Block}
//	@Router			/space/{space_id}/block/{block_id}/properties [get]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Get block properties\nblock = client.blocks.get_properties(\n    space_id='space-uuid',\n    block_id='block-uuid'\n)\nprint(f\"{block.title}: {block.props}\")\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Get block properties\nconst block = await client.blocks.getProperties('space-uuid', 'block-uuid');\nconsole.log(`${block.title}: ${JSON.stringify(block.props)}`);\n","label":"JavaScript"}]
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
//	@Description	Update a block's title and properties by its ID (works for block types: page, folder, sop)
//	@Tags			block
//	@Accept			json
//	@Produce		json
//	@Param			space_id	path	string								true	"Space ID"	Format(uuid)
//	@Param			block_id	path	string								true	"Block ID"	Format(uuid)
//	@Param			payload		body	handler.UpdateBlockPropertiesReq	true	"UpdateBlockProperties payload"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response
//	@Router			/space/{space_id}/block/{block_id}/properties [put]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Update block properties\nclient.blocks.update_properties(\n    space_id='space-uuid',\n    block_id='block-uuid',\n    title='Updated Title',\n    props={\"text\": \"Updated content\"}\n)\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Update block properties\nawait client.blocks.updateProperties('space-uuid', 'block-uuid', {\n  title: 'Updated Title',\n  props: { text: 'Updated content' }\n});\n","label":"JavaScript"}]
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
//	@Description	List blocks in a space. Use type query parameter to filter by block type (page, folder, sop). Use parent_id query parameter to filter by parent. If both type and parent_id are empty, returns top-level pages and folders.
//	@Tags			block
//	@Accept			json
//	@Produce		json
//	@Param			space_id	path	string	true	"Space ID"		Format(uuid)
//	@Param			type		query	string	false	"Block type"	Enums(page, folder, sop)
//	@Param			parent_id	query	string	false	"Parent ID"		Format(uuid)
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=[]model.Block}
//	@Router			/space/{space_id}/block [get]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# List blocks\nblocks = client.blocks.list(\n    space_id='space-uuid',\n    parent_id='parent-uuid',\n    block_type='page'\n)\nfor block in blocks:\n    print(f\"{block.id}: {block.title}\")\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// List blocks\nconst blocks = await client.blocks.list('space-uuid', {\n  parentId: 'parent-uuid',\n  type: 'page'\n});\nfor (const block of blocks) {\n  console.log(`${block.id}: ${block.title}`);\n}\n","label":"JavaScript"}]
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
//	@Description	Move block by updating its parent_id. Works for block types: page, folder, sop. For page and folder types, parent_id can be null (root level).
//	@Tags			block
//	@Accept			json
//	@Produce		json
//	@Param			space_id	path	string					true	"Space ID"	Format(uuid)
//	@Param			block_id	path	string					true	"Block ID"	Format(uuid)
//	@Param			payload		body	handler.MoveBlockReq	true	"MoveBlock payload"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response
//	@Router			/space/{space_id}/block/{block_id}/move [put]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Move block to a different parent\nclient.blocks.move(\n    space_id='space-uuid',\n    block_id='block-uuid',\n    parent_id='new-parent-uuid'\n)\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Move block to a different parent\nawait client.blocks.move('space-uuid', 'block-uuid', {\n  parentId: 'new-parent-uuid'\n});\n","label":"JavaScript"}]
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
//	@Description	Update block sort value (works for block types: page, folder, sop)
//	@Tags			block
//	@Accept			json
//	@Produce		json
//	@Param			space_id	path	string						true	"Space ID"	Format(uuid)
//	@Param			block_id	path	string						true	"Block ID"	Format(uuid)
//	@Param			payload		body	handler.UpdateBlockSortReq	true	"UpdateBlockSort payload"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response
//	@Router			/space/{space_id}/block/{block_id}/sort [put]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Update block sort order\nclient.blocks.update_sort(\n    space_id='space-uuid',\n    block_id='block-uuid',\n    sort=5\n)\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Update block sort order\nawait client.blocks.updateSort('space-uuid', 'block-uuid', {\n  sort: 5\n});\n","label":"JavaScript"}]
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
