package handler

import (
	"errors"
	"fmt"
	"mime/multipart"
	"net/http"
	"strings"
	"time"

	"github.com/bytedance/sonic"
	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/serializer"
	"github.com/memodb-io/Acontext/internal/modules/service"
	"github.com/memodb-io/Acontext/internal/pkg/utils/converter"
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

// GetSessions godoc
//
//	@Summary		Get sessions
//	@Description	Get all sessions under a project, optionally filtered by space_id
//	@Tags			session
//	@Accept			json
//	@Produce		json
//	@Param			space_id		query	string	false	"Space ID to filter sessions"								format(uuid)
//	@Param			not_connected	query	string	false	"Filter sessions not connected to any space (true/false)"	example(true)
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=[]model.Session}
//	@Router			/session [get]
func (h *SessionHandler) GetSessions(c *gin.Context) {
	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("project not found")))
		return
	}

	// Parse space_id query parameter
	var spaceID *uuid.UUID
	spaceIDStr := c.Query("space_id")
	if spaceIDStr != "" {
		parsed, err := uuid.Parse(spaceIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid space_id", err))
			return
		}
		spaceID = &parsed
	}

	// Parse not_connected query parameter
	notConnected := false
	notConnectedStr := c.Query("not_connected")
	if notConnectedStr == "true" {
		notConnected = true
	}

	sessions, err := h.svc.List(c.Request.Context(), project.ID, spaceID, notConnected)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: sessions})
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

	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("project not found")))
		return
	}

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

	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("project not found")))
		return
	}

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
	Role   string           `form:"role" json:"role" binding:"required" validate:"oneof=user assistant system" example:"user"`
	Parts  []service.PartIn `form:"parts" json:"parts" binding:"required"`
	Format string           `form:"format" json:"format" binding:"omitempty,oneof=acontext openai anthropic" example:"openai" enums:"acontext,openai,anthropic"`
}

// SendMessage godoc
//
//	@Summary		Send message to session
//	@Description	Supports JSON and multipart/form-data. In multipart mode: the payload is a JSON string placed in a form field. The format parameter indicates the format of the input message (default: openai, same as GET).
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
//	@Success		201	{object}	serializer.Response{data=model.Message}
//	@Router			/session/{session_id}/messages [post]
func (h *SessionHandler) SendMessage(c *gin.Context) {
	req := SendMessageReq{}

	ct := c.ContentType()
	fileMap := map[string]*multipart.FileHeader{}
	if strings.HasPrefix(ct, "multipart/form-data") {
		if p := c.PostForm("payload"); p != "" {
			if err := sonic.Unmarshal([]byte(p), &req); err != nil {
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

	validate := validator.New()
	if err := validate.Struct(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	for _, p := range req.Parts {
		if err := p.Validate(); err != nil {
			c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
			return
		}
	}

	// Normalize input format to internal format
	formatStr := req.Format
	if formatStr == "" {
		formatStr = string(converter.FormatOpenAI) // Default to OpenAI format, same as GET
	}

	format, err := converter.ValidateFormat(formatStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid format", err))
		return
	}

	normalizer, err := converter.GetNormalizer(format)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.ParamErr("failed to get normalizer", err))
		return
	}

	normalizedRole, normalizedParts, err := normalizer.Normalize(req.Role, req.Parts)
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("failed to normalize message", err))
		return
	}

	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("project not found")))
		return
	}

	sessionID, err := uuid.Parse(c.Param("session_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}
	out, err := h.svc.SendMessage(c.Request.Context(), service.SendMessageInput{
		ProjectID: project.ID,
		SessionID: sessionID,
		Role:      normalizedRole,
		Parts:     normalizedParts,
		Files:     fileMap,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusCreated, serializer.Response{Data: out})
}

type GetMessagesReq struct {
	Limit              int    `form:"limit,default=20" json:"limit" binding:"required,min=1,max=200" example:"20"`
	Cursor             string `form:"cursor" json:"cursor" example:"cHJvdGVjdGVkIHZlcnNpb24gdG8gYmUgZXhjbHVkZWQgaW4gcGFyc2luZyB0aGUgY3Vyc29y"`
	WithAssetPublicURL bool   `form:"with_asset_public_url,default=true" json:"with_asset_public_url" example:"true"`
	Format             string `form:"format,default=openai" json:"format" binding:"omitempty,oneof=acontext openai anthropic" example:"openai" enums:"acontext,openai,anthropic"`
}

// GetMessages godoc
//
//	@Summary		Get messages from session
//	@Description	Get messages from session. Default format is openai. Can convert to acontext (original) or anthropic format.
//	@Tags			session
//	@Accept			json
//	@Produce		json
//	@Param			session_id				path	string	true	"Session ID"	format(uuid)
//	@Param			limit					query	integer	false	"Limit of messages to return, default 20. Max 200."
//	@Param			cursor					query	string	false	"Cursor for pagination. Use the cursor from the previous response to get the next page."
//	@Param			with_asset_public_url	query	string	false	"Whether to return asset public url, default is true"								example:"true"
//	@Param			format					query	string	false	"Format to convert messages to: acontext (original), openai (default), anthropic."	enums(acontext,openai,anthropic)
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=service.GetMessagesOutput}
//	@Router			/session/{session_id}/messages [get]
func (h *SessionHandler) GetMessages(c *gin.Context) {
	req := GetMessagesReq{}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	sessionID, err := uuid.Parse(c.Param("session_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}
	out, err := h.svc.GetMessages(c.Request.Context(), service.GetMessagesInput{
		SessionID:          sessionID,
		Limit:              req.Limit,
		Cursor:             req.Cursor,
		WithAssetPublicURL: req.WithAssetPublicURL,
		AssetExpire:        time.Hour * 24,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.DBErr("", err))
		return
	}

	// Convert messages to specified format (default: openai)
	formatStr := req.Format
	if formatStr == "" {
		formatStr = string(converter.FormatOpenAI)
	}

	format, err := converter.ValidateFormat(formatStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid format", err))
		return
	}

	convertedOut, err := converter.GetConvertedMessagesOutput(
		out.Items,
		format,
		out.PublicURLs,
		out.NextCursor,
		out.HasMore,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("failed to convert messages", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: convertedOut})
}
