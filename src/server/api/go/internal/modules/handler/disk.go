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

type DiskHandler struct {
	svc     service.DiskService
	userSvc service.UserService
}

func NewDiskHandler(s service.DiskService, userSvc service.UserService) *DiskHandler {
	return &DiskHandler{svc: s, userSvc: userSvc}
}

type CreateDiskReq struct {
	User string `form:"user" json:"user" example:"alice@acontext.io"`
}

// CreateDisk godoc
//
//	@Summary		Create disk
//	@Description	Create a disk group under a project. Optionally associate with a user identifier.
//	@Tags			disk
//	@Accept			json
//	@Produce		json
//	@Param			payload	body	handler.CreateDiskReq	true	"CreateDisk payload"
//	@Security		BearerAuth
//	@Success		201	{object}	serializer.Response{data=model.Disk}
//	@Router			/disk [post]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Create a disk\ndisk = client.disks.create()\nprint(f\"Created disk: {disk.id}\")\n\n# Create a disk for a specific user\ndisk = client.disks.create(user='alice@acontext.io')\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Create a disk\nconst disk = await client.disks.create();\nconsole.log(`Created disk: ${disk.id}`);\n\n// Create a disk for a specific user\nconst userDisk = await client.disks.create({ user: 'alice@acontext.io' });\n","label":"JavaScript"}]
func (h *DiskHandler) CreateDisk(c *gin.Context) {
	req := CreateDiskReq{}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("project not found")))
		return
	}

	// If user identifier is provided, get or create the user
	var userID *uuid.UUID
	if req.User != "" {
		user, err := h.userSvc.GetOrCreate(c.Request.Context(), project.ID, req.User)
		if err != nil {
			c.JSON(http.StatusInternalServerError, serializer.DBErr("failed to get or create user", err))
			return
		}
		userID = &user.ID
	}

	disk, err := h.svc.Create(c.Request.Context(), project.ID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusCreated, serializer.Response{Data: disk})
}

type ListDisksReq struct {
	User     string `form:"user" json:"user" example:"alice@acontext.io"`
	Limit    int    `form:"limit,default=20" json:"limit" binding:"required,min=1,max=200" example:"20"`
	Cursor   string `form:"cursor" json:"cursor" example:"cHJvdGVjdGVkIHZlcnNpb24gdG8gYmUgZXhjbHVkZWQgaW4gcGFyc2luZyB0aGUgY3Vyc29y"`
	TimeDesc bool   `form:"time_desc,default=false" json:"time_desc" example:"false"`
}

// ListDisks godoc
//
//	@Summary		List disks
//	@Description	List all disks under a project
//	@Tags			disk
//	@Accept			json
//	@Produce		json
//	@Param			user		query	string	false	"User identifier to filter disks"	example(alice@acontext.io)
//	@Param			limit		query	integer	false	"Limit of disks to return, default 20. Max 200."
//	@Param			cursor		query	string	false	"Cursor for pagination. Use the cursor from the previous response to get the next page."
//	@Param			time_desc	query	boolean	false	"Order by created_at descending if true, ascending if false (default false)"	example(false)
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=service.ListDisksOutput}
//	@Router			/disk [get]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# List disks\ndisks = client.disks.list(limit=10, time_desc=True)\nfor disk in disks.items:\n    print(f\"Disk: {disk.id}\")\n\n# List disks for a specific user\ndisks = client.disks.list(user='alice@acontext.io', limit=10)\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// List disks\nconst disks = await client.disks.list({ limit: 10, timeDesc: true });\nfor (const disk of disks.items) {\n  console.log(`Disk: ${disk.id}`);\n}\n\n// List disks for a specific user\nconst userDisks = await client.disks.list({ user: 'alice@acontext.io', limit: 10 });\n","label":"JavaScript"}]
func (h *DiskHandler) ListDisks(c *gin.Context) {
	req := ListDisksReq{}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("project not found")))
		return
	}

	out, err := h.svc.List(c.Request.Context(), service.ListDisksInput{
		ProjectID: project.ID,
		User:      req.User,
		Limit:     req.Limit,
		Cursor:    req.Cursor,
		TimeDesc:  req.TimeDesc,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: out})
}

// DeleteDisk godoc
//
//	@Summary		Delete disk
//	@Description	Delete a disk by its UUID
//	@Tags			disk
//	@Accept			json
//	@Produce		json
//	@Param			disk_id	path	string	true	"Disk ID"	Format(uuid)	Example(123e4567-e89b-12d3-a456-426614174000)
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{}
//	@Router			/disk/{disk_id} [delete]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Delete a disk\nclient.disks.delete(disk_id='disk-uuid')\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Delete a disk\nawait client.disks.delete('disk-uuid');\n","label":"JavaScript"}]
func (h *DiskHandler) DeleteDisk(c *gin.Context) {
	diskID, err := uuid.Parse(c.Param("disk_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("project not found")))
		return
	}

	if err := h.svc.Delete(c.Request.Context(), project.ID, diskID); err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{})
}
