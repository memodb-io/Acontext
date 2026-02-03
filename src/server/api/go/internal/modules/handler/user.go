package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/serializer"
	"github.com/memodb-io/Acontext/internal/modules/service"
)

type UserHandler struct {
	svc service.UserService
}

func NewUserHandler(s service.UserService) *UserHandler {
	return &UserHandler{svc: s}
}

// DeleteUser godoc
//
//	@Summary		Delete user
//	@Description	Delete a user by identifier and cascade delete all associated resources (Session, Disk, Skill)
//	@Tags			user
//	@Accept			json
//	@Produce		json
//	@Param			identifier	path	string	true	"User identifier string"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{}
//	@Router			/user/{identifier} [delete]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Delete a user and all associated resources\nclient.users.delete('alice@acontext.io')\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Delete a user and all associated resources\nawait client.users.delete('alice@acontext.io');\n","label":"JavaScript"}]
func (h *UserHandler) DeleteUser(c *gin.Context) {
	identifier := c.Param("identifier")
	if identifier == "" {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("user identifier is required")))
		return
	}

	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("project not found")))
		return
	}

	if err := h.svc.Delete(c.Request.Context(), project.ID, identifier); err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{})
}

type ListUsersReq struct {
	Limit    *int   `form:"limit" json:"limit" binding:"omitempty,min=0,max=200" example:"20"`
	Cursor   string `form:"cursor" json:"cursor" example:"cHJvdGVjdGVkIHZlcnNpb24gdG8gYmUgZXhjbHVkZWQgaW4gcGFyc2luZyB0aGUgY3Vyc29y"`
	TimeDesc bool   `form:"time_desc,default=false" json:"time_desc" example:"false"`
}

// ListUsers godoc
//
//	@Summary		List users
//	@Description	Get all users under a project. If limit is not provided or 0, all users will be returned.
//	@Tags			user
//	@Accept			json
//	@Produce		json
//	@Param			limit		query	integer	false	"Limit of users to return. Max 200. If limit is 0 or not provided, all users will be returned."
//	@Param			cursor		query	string	false	"Cursor for pagination. Use the cursor from the previous response to get the next page."
//	@Param			time_desc	query	boolean	false	"Order by created_at descending if true, ascending if false (default false)"	example(false)
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=service.ListUsersOutput}
//	@Router			/user/ls [get]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# List all users\nusers = client.users.list()\nfor user in users.items:\n    print(f\"{user.identifier}: {user.id}\")\n\n# List users with pagination\nusers = client.users.list(limit=20, time_desc=True)\nif users.has_more:\n    next_users = client.users.list(limit=20, cursor=users.next_cursor)\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// List all users\nconst users = await client.users.list();\nfor (const user of users.items) {\n  console.log(`${user.identifier}: ${user.id}`);\n}\n\n// List users with pagination\nconst paginatedUsers = await client.users.list({ limit: 20, timeDesc: true });\nif (paginatedUsers.hasMore) {\n  const nextUsers = await client.users.list({ limit: 20, cursor: paginatedUsers.nextCursor });\n}\n","label":"JavaScript"}]
func (h *UserHandler) ListUsers(c *gin.Context) {
	req := ListUsersReq{}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("project not found")))
		return
	}

	// If limit is not provided, set it to 0 to fetch all users
	limit := 0
	if req.Limit != nil {
		limit = *req.Limit
	}

	out, err := h.svc.List(c.Request.Context(), service.ListUsersInput{
		ProjectID: project.ID,
		Limit:     limit,
		Cursor:    req.Cursor,
		TimeDesc:  req.TimeDesc,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: out})
}

// GetUserResources godoc
//
//	@Summary		Get user resources
//	@Description	Get the resource counts (Sessions, Disks, Skills) associated with a user
//	@Tags			user
//	@Accept			json
//	@Produce		json
//	@Param			identifier	path	string	true	"User identifier string"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=service.GetUserResourcesOutput}
//	@Router			/user/{identifier}/resources [get]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Get user resource counts\nresources = client.users.get_resources('alice@acontext.io')\nprint(f\"Sessions: {resources.counts.sessions_count}\")\nprint(f\"Disks: {resources.counts.disks_count}\")\nprint(f\"Skills: {resources.counts.skills_count}\")\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Get user resource counts\nconst resources = await client.users.getResources('alice@acontext.io');\nconsole.log(`Sessions: ${resources.counts.sessions_count}`);\nconsole.log(`Disks: ${resources.counts.disks_count}`);\nconsole.log(`Skills: ${resources.counts.skills_count}`);\n","label":"JavaScript"}]
func (h *UserHandler) GetUserResources(c *gin.Context) {
	identifier := c.Param("identifier")
	if identifier == "" {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("user identifier is required")))
		return
	}

	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("project not found")))
		return
	}

	out, err := h.svc.GetResourceCounts(c.Request.Context(), project.ID, identifier)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: out})
}
