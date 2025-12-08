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
	"github.com/memodb-io/Acontext/internal/infra/httpclient"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/serializer"
	"github.com/memodb-io/Acontext/internal/modules/service"
	"github.com/memodb-io/Acontext/internal/pkg/converter"
	"github.com/memodb-io/Acontext/internal/pkg/editor"
	"github.com/memodb-io/Acontext/internal/pkg/normalizer"
	"github.com/memodb-io/Acontext/internal/pkg/tokenizer"
	"gorm.io/datatypes"
)

type SessionHandler struct {
	svc        service.SessionService
	coreClient *httpclient.CoreClient
}

func NewSessionHandler(s service.SessionService, coreClient *httpclient.CoreClient) *SessionHandler {
	return &SessionHandler{
		svc:        s,
		coreClient: coreClient,
	}
}

type CreateSessionReq struct {
	SpaceID string                 `form:"space_id" json:"space_id" format:"uuid" example:"123e4567-e89b-12d3-a456-42661417"`
	Configs map[string]interface{} `form:"configs" json:"configs"`
}

type GetSessionsReq struct {
	SpaceID      string `form:"space_id" json:"space_id" format:"uuid" example:"123e4567-e89b-12d3-a456-42661417"`
	NotConnected bool   `form:"not_connected,default=false" json:"not_connected" example:"false"`
	Limit        int    `form:"limit,default=20" json:"limit" binding:"required,min=1,max=200" example:"20"`
	Cursor       string `form:"cursor" json:"cursor" example:"cHJvdGVjdGVkIHZlcnNpb24gdG8gYmUgZXhjbHVkZWQgaW4gcGFyc2luZyB0aGUgY3Vyc29y"`
	TimeDesc     bool   `form:"time_desc,default=false" json:"time_desc" example:"false"`
}

// GetSessions godoc
//
//	@Summary		Get sessions
//	@Description	Get all sessions under a project, optionally filtered by space_id
//	@Tags			session
//	@Accept			json
//	@Produce		json
//	@Param			space_id		query	string	false	"Space ID to filter sessions"									format(uuid)
//	@Param			not_connected	query	boolean	false	"Filter sessions not connected to any space (default false)"	example(false)
//	@Param			limit			query	integer	false	"Limit of sessions to return, default 20. Max 200."
//	@Param			cursor			query	string	false	"Cursor for pagination. Use the cursor from the previous response to get the next page."
//	@Param			time_desc		query	string	false	"Order by created_at descending if true, ascending if false (default false)"	example(false)
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=service.ListSessionsOutput}
//	@Router			/session [get]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# List sessions\nsessions = client.sessions.list(\n    space_id='space-uuid',\n    limit=20,\n    time_desc=True\n)\nfor session in sessions.items:\n    print(f\"{session.id}: {session.space_id}\")\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// List sessions\nconst sessions = await client.sessions.list({\n  spaceId: 'space-uuid',\n  limit: 20,\n  timeDesc: true\n});\nfor (const session of sessions.items) {\n  console.log(`${session.id}: ${session.space_id}`);\n}\n","label":"JavaScript"}]
func (h *SessionHandler) GetSessions(c *gin.Context) {
	req := GetSessionsReq{}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("project not found")))
		return
	}

	// Parse space_id query parameter
	var spaceID *uuid.UUID
	if req.SpaceID != "" {
		parsed, err := uuid.Parse(req.SpaceID)
		if err != nil {
			c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid space_id", err))
			return
		}
		spaceID = &parsed
	}

	out, err := h.svc.List(c.Request.Context(), service.ListSessionsInput{
		ProjectID:    project.ID,
		SpaceID:      spaceID,
		NotConnected: req.NotConnected,
		Limit:        req.Limit,
		Cursor:       req.Cursor,
		TimeDesc:     req.TimeDesc,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: out})
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
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Create a session\nsession = client.sessions.create(\n    space_id='space-uuid',\n    configs={\"mode\": \"chat\"}\n)\nprint(f\"Created session: {session.id}\")\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Create a session\nconst session = await client.sessions.create({\n  spaceId: 'space-uuid',\n  configs: { mode: 'chat' }\n});\nconsole.log(`Created session: ${session.id}`);\n","label":"JavaScript"}]
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
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Delete a session\nclient.sessions.delete(session_id='session-uuid')\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Delete a session\nawait client.sessions.delete('session-uuid');\n","label":"JavaScript"}]
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
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Update session configs\nclient.sessions.update_configs(\n    session_id='session-uuid',\n    configs={\"mode\": \"updated-mode\"}\n)\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Update session configs\nawait client.sessions.updateConfigs('session-uuid', {\n  configs: { mode: 'updated-mode' }\n});\n","label":"JavaScript"}]
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
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Get session configs\nsession = client.sessions.get_configs(session_id='session-uuid')\nprint(session.configs)\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Get session configs\nconst session = await client.sessions.getConfigs('session-uuid');\nconsole.log(session.configs);\n","label":"JavaScript"}]
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
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Connect session to space\nclient.sessions.connect_to_space(\n    session_id='session-uuid',\n    space_id='space-uuid'\n)\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Connect session to space\nawait client.sessions.connectToSpace('session-uuid', {\n  spaceId: 'space-uuid'\n});\n","label":"JavaScript"}]
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
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\nfrom acontext.messages import build_acontext_message\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Send a message in Acontext format\nmessage = build_acontext_message(role='user', parts=['Hello!'])\nclient.sessions.send_message(\n    session_id='session-uuid',\n    blob=message,\n    format='acontext'\n)\n\n# Send a message in OpenAI format\nopenai_message = {'role': 'user', 'content': 'Hello from OpenAI format!'}\nclient.sessions.send_message(\n    session_id='session-uuid',\n    blob=openai_message,\n    format='openai'\n)\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient, MessagePart } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Send a message in Acontext format\nawait client.sessions.sendMessage(\n  'session-uuid',\n  {\n    role: 'user',\n    parts: [MessagePart.textPart('Hello!')]\n  },\n  { format: 'acontext' }\n);\n\n// Send a message in OpenAI format\nawait client.sessions.sendMessage(\n  'session-uuid',\n  {\n    role: 'user',\n    content: 'Hello from OpenAI format!'\n  },\n  { format: 'openai' }\n);\n","label":"JavaScript"}]
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
	var normalizedMeta map[string]interface{}
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
		normalizedRole, normalizedParts, normalizedMeta, err = norm.NormalizeFromAcontextMessage(blobJSON)
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
		normalizedRole, normalizedParts, normalizedMeta, err = norm.NormalizeFromOpenAIMessage(blobJSON)
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
		normalizedRole, normalizedParts, normalizedMeta, err = norm.NormalizeFromAnthropicMessage(blobJSON)
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
		ProjectID:   project.ID,
		SessionID:   sessionID,
		Role:        normalizedRole,
		Parts:       normalizedParts,
		MessageMeta: normalizedMeta,
		Files:       fileMap,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusCreated, serializer.Response{Data: out})
}

type GetMessagesReq struct {
	Limit              *int   `form:"limit" json:"limit" binding:"omitempty,min=0,max=200" example:"20"`
	Cursor             string `form:"cursor" json:"cursor" example:"cHJvdGVjdGVkIHZlcnNpb24gdG8gYmUgZXhjbHVkZWQgaW4gcGFyc2luZyB0aGUgY3Vyc29y"`
	WithAssetPublicURL bool   `form:"with_asset_public_url,default=true" json:"with_asset_public_url" example:"true"`
	Format             string `form:"format,default=openai" json:"format" binding:"omitempty,oneof=acontext openai anthropic" example:"openai" enums:"acontext,openai,anthropic"`
	TimeDesc           bool   `form:"time_desc,default=false" json:"time_desc" example:"false"`
	EditStrategies     string `form:"edit_strategies" json:"edit_strategies" example:"[{\"type\":\"remove_tool_result\",\"params\":{\"keep_recent_n_tool_results\":3}}]"`
}

// GetMessages godoc
//
//	@Summary		Get messages from session
//	@Description	Get messages from session. Default format is openai. Can convert to acontext (original) or anthropic format.
//	@Tags			session
//	@Accept			json
//	@Produce		json
//	@Param			session_id				path	string	true	"Session ID"	format(uuid)
//	@Param			limit					query	integer	false	"Limit of messages to return. Max 200. If limit is 0 or not provided, all messages will be returned."
//	@Param			cursor					query	string	false	"Cursor for pagination. Use the cursor from the previous response to get the next page."
//	@Param			with_asset_public_url	query	string	false	"Whether to return asset public url, default is true"								example(true)
//	@Param			format					query	string	false	"Format to convert messages to: acontext (original), openai (default), anthropic."	enums(acontext,openai,anthropic)
//	@Param			time_desc				query	string	false	"Order by created_at descending if true, ascending if false (default false)"		example(false)
//	@Param			edit_strategies			query	string	false	"JSON array of edit strategies to apply before format conversion"					example([{"type":"remove_tool_result","params":{"keep_recent_n_tool_results":3}}])
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=service.GetMessagesOutput}
//	@Router			/session/{session_id}/messages [get]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Get messages from session\nmessages = client.sessions.get_messages(\n    session_id='session-uuid',\n    limit=50,\n    format='acontext',\n    time_desc=True\n)\nfor message in messages.items:\n    print(f\"{message.role}: {message.parts}\")\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Get messages from session\nconst messages = await client.sessions.getMessages('session-uuid', {\n  limit: 50,\n  format: 'acontext',\n  timeDesc: true\n});\nfor (const message of messages.items) {\n  console.log(`${message.role}: ${JSON.stringify(message.parts)}`);\n}\n","label":"JavaScript"}]
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

	// If limit is not provided, set it to 0 to fetch all messages
	limit := 0
	if req.Limit != nil {
		limit = *req.Limit
	}

	// Parse edit strategies if provided
	var editStrategies []editor.StrategyConfig
	if req.EditStrategies != "" {
		if err := sonic.Unmarshal([]byte(req.EditStrategies), &editStrategies); err != nil {
			c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid edit_strategies JSON", err))
			return
		}
	}

	out, err := h.svc.GetMessages(c.Request.Context(), service.GetMessagesInput{
		SessionID:          sessionID,
		Limit:              limit,
		Cursor:             req.Cursor,
		WithAssetPublicURL: req.WithAssetPublicURL,
		AssetExpire:        time.Hour * 24,
		TimeDesc:           req.TimeDesc,
		EditStrategies:     editStrategies,
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

// SessionFlush godoc
//
//	@Summary		Flush session
//	@Description	Flush the session buffer for a given session
//	@Tags			session
//	@Accept			json
//	@Produce		json
//	@Param			session_id	path	string	true	"Session ID"	format(uuid)
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=httpclient.FlagResponse}
//	@Router			/session/{session_id}/flush [post]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Flush session buffer\nresult = client.sessions.flush(session_id='session-uuid')\nprint(result.status)\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Flush session buffer\nconst result = await client.sessions.flush('session-uuid');\nconsole.log(result.status);\n","label":"JavaScript"}]
func (h *SessionHandler) SessionFlush(c *gin.Context) {
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

	result, err := h.coreClient.SessionFlush(c.Request.Context(), project.ID, sessionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.Err(http.StatusInternalServerError, "failed to flush session", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: result})
}

// GetLearningStatus godoc
//
//	@Summary		Get learning status
//	@Description	Get learning status for a session. Returns the count of space digested tasks and not space digested tasks. If the session is not connected to a space, returns 0 and 0.
//	@Tags			session
//	@Accept			json
//	@Produce		json
//	@Param			session_id	path	string	true	"Session ID"	format(uuid)
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=httpclient.LearningStatusResponse}
//	@Router			/session/{session_id}/get_learning_status [get]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Get learning status\nresult = client.sessions.get_learning_status(session_id='session-uuid')\nprint(f\"Space digested: {result.space_digested_count}, Not digested: {result.not_space_digested_count}\")\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Get learning status\nconst result = await client.sessions.getLearningStatus('session-uuid');\nconsole.log(`Space digested: ${result.space_digested_count}, Not digested: ${result.not_space_digested_count}`);\n","label":"JavaScript"}]
func (h *SessionHandler) GetLearningStatus(c *gin.Context) {
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

	result, err := h.coreClient.GetLearningStatus(c.Request.Context(), project.ID, sessionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.Err(http.StatusInternalServerError, "failed to get learning status", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: result})
}

type TokenCountsResp struct {
	TotalTokens int `json:"total_tokens"`
}

// GetTokenCounts godoc
//
//	@Summary		Get token counts for session
//	@Description	Get total token counts for all text and tool-call parts in a session
//	@Tags			session
//	@Accept			json
//	@Produce		json
//	@Param			session_id	path	string	true	"Session ID"	format(uuid)
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=handler.TokenCountsResp}
//	@Router			/session/{session_id}/token_counts [get]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Get token counts\nresult = client.sessions.get_token_counts(session_id='session-uuid')\nprint(f\"Total tokens: {result.total_tokens}\")\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Get token counts\nconst result = await client.sessions.getTokenCounts('session-uuid');\nconsole.log(`Total tokens: ${result.total_tokens}`);\n","label":"JavaScript"}]
func (h *SessionHandler) GetTokenCounts(c *gin.Context) {
	sessionID, err := uuid.Parse(c.Param("session_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	// Get all messages for the session
	messages, err := h.svc.GetAllMessages(c.Request.Context(), sessionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("failed to get messages", err))
		return
	}

	// Count tokens for all text and tool-call parts
	totalTokens, err := tokenizer.CountMessagePartsTokens(c.Request.Context(), messages)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.Err(http.StatusInternalServerError, "failed to count tokens", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: TokenCountsResp{
		TotalTokens: totalTokens,
	}})
}
