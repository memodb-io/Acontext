package handler

import (
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/serializer"
	"github.com/memodb-io/Acontext/internal/modules/service"
	"github.com/memodb-io/Acontext/internal/pkg/types"
	"gorm.io/datatypes"
)

type SessionHandler struct {
	svc service.SessionService
}

func NewSessionHandler(s service.SessionService) *SessionHandler {
	return &SessionHandler{svc: s}
}

type CreateSessionReq struct {
	SpaceID string                 `form:"space_id" json:"space_id" format:"uuid" example:"123e4567-e89b-12d3-a456-42661417"`
	Configs map[string]interface{} `form:"configs" json:"configs"`
}

// CreateSession godoc
//
//	@Summary		Create session
//	@Description	Create a new session under a space
//	@Tags			session
//	@Accept			json
//	@Produce		json
//	@Param			payload	body	handler.CreateSessionReq	true	"CreateSession payload"
//	@Security		BearerAuth
//	@Success		201	{object}	serializer.Response{data=model.Session}
//	@Router			/session [post]
func (h *SessionHandler) CreateSession(c *gin.Context) {
	req := CreateSessionReq{}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	project := c.MustGet("project").(*model.Project)

	session := model.Session{
		ProjectID: project.ID,
		Configs:   datatypes.JSONMap(req.Configs),
	}
	if len(req.SpaceID) != 0 {
		spaceID, err := uuid.Parse(req.SpaceID)
		if err != nil {
			c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
			return
		}
		session.SpaceID = &spaceID
	}
	if err := h.svc.Create(c.Request.Context(), &session); err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusCreated, serializer.Response{Data: session})
}

// DeleteSession godoc
//
//	@Summary		Delete session
//	@Description	Delete a session by id
//	@Tags			session
//	@Accept			json
//	@Produce		json
//	@Param			session_id	path	string	true	"Session ID"	format(uuid)
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{}
//	@Router			/session/{session_id} [delete]
func (h *SessionHandler) DeleteSession(c *gin.Context) {
	sessionID, err := uuid.Parse(c.Param("session_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}
	project := c.MustGet("project").(*model.Project)
	if err := h.svc.Delete(c.Request.Context(), project.ID, sessionID); err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{})
}

type UpdateSessionConfigsReq struct {
	Configs map[string]interface{} `form:"configs" json:"configs"`
}

// UpdateSessionConfigs godoc
//
//	@Summary		Update session configs
//	@Description	Update session configs by id
//	@Tags			session
//	@Accept			json
//	@Produce		json
//	@Param			session_id	path	string							true	"Session ID"	format(uuid)
//	@Param			payload		body	handler.UpdateSessionConfigsReq	true	"UpdateSessionConfigs payload"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{}
//	@Router			/session/{session_id}/configs [put]
func (h *SessionHandler) UpdateConfigs(c *gin.Context) {
	req := UpdateSessionConfigsReq{}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	sessionID, err := uuid.Parse(c.Param("session_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}
	if err := h.svc.UpdateByID(c.Request.Context(), &model.Session{
		ID:      sessionID,
		Configs: datatypes.JSONMap(req.Configs),
	}); err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{})
}

// GetSessionConfigs godoc
//
//	@Summary		Get session configs
//	@Description	Get session configs by id
//	@Tags			session
//	@Accept			json
//	@Produce		json
//	@Param			session_id	path	string	true	"Session ID"	format(uuid)
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=model.Session}
//	@Router			/session/{session_id}/configs [get]
func (h *SessionHandler) GetConfigs(c *gin.Context) {
	sessionID, err := uuid.Parse(c.Param("session_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}
	session, err := h.svc.GetByID(c.Request.Context(), &model.Session{ID: sessionID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: session})
}

type ConnectToSpaceReq struct {
	SpaceID string `form:"space_id" json:"space_id" binding:"required,uuid" format:"uuid" example:"123e4567-e89b-12d3-a456-426614174000"`
}

// ConnectToSpace godoc
//
//	@Summary		Connect session to space
//	@Description	Connect a session to a space by id
//	@Tags			session
//	@Accept			json
//	@Produce		json
//	@Param			session_id	path	string						true	"Session ID"	format(uuid)
//	@Param			payload		body	handler.ConnectToSpaceReq	true	"ConnectToSpace payload"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{}
//	@Router			/session/{session_id}/connect_to_space [post]
func (h *SessionHandler) ConnectToSpace(c *gin.Context) {
	req := ConnectToSpaceReq{}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	sessionID, err := uuid.Parse(c.Param("session_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}
	spaceID, err := uuid.Parse(req.SpaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	if err := h.svc.UpdateByID(c.Request.Context(), &model.Session{
		ID:      sessionID,
		SpaceID: &spaceID,
	}); err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{})
}

type SendMessageReq struct {
	Role  string         `form:"role" json:"role" binding:"required" example:"user"`
	Parts []types.PartIn `form:"parts" json:"parts" binding:"required"`
}

// SendMessage godoc
//
//	@Summary		Send message to session
//	@Description	Supports JSON and multipart/form-data. In multipart mode: the payload is a JSON string placed in a form field.
//	@Tags			session
//	@Accept			json
//	@Accept			multipart/form-data
//	@Produce		json
//	@Param			session_id	path		string					true	"Session ID"	Format(uuid)
//
//	// Content-Type: application/json
//	@Param			payload		body		handler.SendMessageReq	true	"SendMessage payload (Content-Type: application/json)"
//
//	// Content-Type: multipart/form-data
//	@Param			payload		formData	string					false	"SendMessage payload (Content-Type: multipart/form-data)"
//	@Param			file		formData	file					false	"When uploading files, the field name must correspond to parts[*].file_field."
//	@Security		BearerAuth
//	@Success		201	{object}	serializer.Response{}
//	@Router			/session/{session_id}/messages [post]
func (h *SessionHandler) SendMessage(c *gin.Context) {
	req := SendMessageReq{}

	ct := c.ContentType()
	fileMap := map[string]*multipart.FileHeader{}
	if strings.HasPrefix(ct, "multipart/form-data") {
		if p := c.PostForm("payload"); p != "" {
			if err := json.Unmarshal([]byte(p), &req); err != nil {
				c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid payload json", err))
				return
			}
		}

		for _, p := range req.Parts {
			if p.FileField != "" {
				fh, err := c.FormFile(p.FileField)
				if err != nil {
					c.JSON(http.StatusBadRequest, serializer.ParamErr(fmt.Sprintf("missing file %s", p.FileField), err))
					return
				}
				fileMap[p.FileField] = fh
			}
		}
	} else {
		if err := c.ShouldBind(&req); err != nil {
			c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
			return
		}
	}

	project := c.MustGet("project").(*model.Project)
	sessionID, err := uuid.Parse(c.Param("session_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}
	out, err := h.svc.SendMessage(c.Request.Context(), service.SendMessageInput{
		ProjectID: project.ID,
		SessionID: sessionID,
		Role:      req.Role,
		Parts:     req.Parts,
		Files:     fileMap,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusCreated, serializer.Response{Data: out})
}
