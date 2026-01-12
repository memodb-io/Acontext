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
//	@Description	Delete a user by identifier and cascade delete all associated resources (Space, Session, Disk, Skill)
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
