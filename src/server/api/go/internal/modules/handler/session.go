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
	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/serializer"
	"github.com/memodb-io/Acontext/internal/modules/service"
	"github.com/memodb-io/Acontext/internal/pkg/converter"
	"github.com/memodb-io/Acontext/internal/pkg/normalizer"
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
	Blob   interface{} `form:"blob" json:"blob" binding:"required"`
	Format string      `form:"format" json:"format" binding:"omitempty,oneof=acontext openai anthropic" example:"openai" enums:"acontext,openai,anthropic"`
}

// SendMessage godoc
//
//	@Summary		Send message to session
//	@Description	Supports JSON and multipart/form-data. In multipart mode: the payload is a JSON string placed in a form field. The format parameter indicates the format of the input message (default: openai, same as GET). The blob field should be a complete message object: for openai, use OpenAI ChatCompletionMessageParam format (with role and content); for anthropic, use Anthropic MessageParam format (with role and content); for acontext (internal), use {role, parts} format.
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
	if strings.HasPrefix(ct, "multipart/form-data") {
		if p := c.PostForm("payload"); p != "" {
			if err := sonic.Unmarshal([]byte(p), &req); err != nil {
				c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid payload json", err))
				return
			}
		}
	} else {
		if err := c.ShouldBind(&req); err != nil {
			c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
			return
		}
	}

	// Determine format
	formatStr := req.Format
	if formatStr == "" {
		formatStr = string(model.FormatOpenAI) // Default to OpenAI format
	}

	format, err := converter.ValidateFormat(formatStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid format", err))
		return
	}

	// Parse and normalize based on format
	// Blob contains the complete message object, directly use official SDK validation
	var normalizedRole string
	var normalizedParts []service.PartIn
	var fileFields []string

	blobJSON, err := sonic.Marshal(req.Blob)
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid blob", err))
		return
	}

	switch format {
	case model.FormatAcontext:
		// Parse and validate using Acontext normalizer
		norm := &normalizer.AcontextNormalizer{}
		normalizedRole, normalizedParts, err = norm.NormalizeFromAcontextMessage(blobJSON)
		if err != nil {
			c.JSON(http.StatusBadRequest, serializer.ParamErr("failed to normalize Acontext message", err))
			return
		}

		// Collect file fields from normalized parts
		for _, p := range normalizedParts {
			if p.FileField != "" {
				fileFields = append(fileFields, p.FileField)
			}
		}

	case model.FormatOpenAI:
		// Parse and validate using official OpenAI SDK
		norm := &normalizer.OpenAINormalizer{}
		normalizedRole, normalizedParts, err = norm.NormalizeFromOpenAIMessage(blobJSON)
		if err != nil {
			c.JSON(http.StatusBadRequest, serializer.ParamErr("failed to normalize OpenAI message", err))
			return
		}

		// Collect file fields from normalized parts
		for _, p := range normalizedParts {
			if p.FileField != "" {
				fileFields = append(fileFields, p.FileField)
			}
		}

	case model.FormatAnthropic:
		// Parse and validate using official Anthropic SDK
		norm := &normalizer.AnthropicNormalizer{}
		normalizedRole, normalizedParts, err = norm.NormalizeFromAnthropicMessage(blobJSON)
		if err != nil {
			c.JSON(http.StatusBadRequest, serializer.ParamErr("failed to normalize Anthropic message", err))
			return
		}

		// Collect file fields from normalized parts
		for _, p := range normalizedParts {
			if p.FileField != "" {
				fileFields = append(fileFields, p.FileField)
			}
		}

	default:
		c.JSON(http.StatusBadRequest, serializer.ParamErr("unsupported format", fmt.Errorf("format %s is not supported", format)))
		return
	}

	// Validate that we have at least one part
	if len(normalizedParts) == 0 {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("message must contain at least one part")))
		return
	}

	// Handle file uploads if multipart
	fileMap := map[string]*multipart.FileHeader{}
	if strings.HasPrefix(ct, "multipart/form-data") {
		for _, fileField := range fileFields {
			fh, err := c.FormFile(fileField)
			if err != nil {
				c.JSON(http.StatusBadRequest, serializer.ParamErr(fmt.Sprintf("missing file %s", fileField), err))
				return
			}
			fileMap[fileField] = fh
		}
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
	TimeDesc           bool   `form:"time_desc,default=false" json:"time_desc" example:"false"`
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
//	@Param			time_desc				query	string	false	"Order by created_at descending if true, ascending if false (default false)"		example:"false"
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
		TimeDesc:           req.TimeDesc,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.DBErr("", err))
		return
	}

	// Convert messages to specified format (default: openai)
	formatStr := req.Format
	if formatStr == "" {
		formatStr = string(model.FormatOpenAI)
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
