package handler

import (
	"encoding/json"
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
	"github.com/memodb-io/Acontext/internal/modules/repo"
	"github.com/memodb-io/Acontext/internal/modules/serializer"
	"github.com/memodb-io/Acontext/internal/modules/service"
	"github.com/memodb-io/Acontext/internal/pkg/converter"
	"github.com/memodb-io/Acontext/internal/pkg/editor"
	"github.com/memodb-io/Acontext/internal/pkg/normalizer"
	"github.com/memodb-io/Acontext/internal/pkg/tokenizer"
	"gorm.io/datatypes"
)

// MaxMetaSize is the maximum allowed size for user-provided message metadata (64KB)
const MaxMetaSize = 64 * 1024

// MaxCopyableMessages aliases repo.MaxCopyableMessages for handler-layer use.
var MaxCopyableMessages = repo.MaxCopyableMessages

type SessionHandler struct {
	svc        service.SessionService
	userSvc    service.UserService
	coreClient *httpclient.CoreClient
}

func NewSessionHandler(s service.SessionService, userSvc service.UserService, coreClient *httpclient.CoreClient) *SessionHandler {
	return &SessionHandler{
		svc:        s,
		userSvc:    userSvc,
		coreClient: coreClient,
	}
}

type CreateSessionReq struct {
	User                    string                 `form:"user" json:"user" example:"alice@acontext.io"`
	DisableTaskTracking     *bool                  `form:"disable_task_tracking" json:"disable_task_tracking" example:"false"`
	DisableTaskStatusChange *bool                  `form:"disable_task_status_change" json:"disable_task_status_change" example:"false"`
	Configs                 map[string]interface{} `form:"configs" json:"configs"`
	UseUUID                 *string                `form:"use_uuid" json:"use_uuid" example:"123e4567-e89b-12d3-a456-426614174000"`
}

type GetSessionsReq struct {
	User            string `form:"user" json:"user" example:"alice@acontext.io"`
	Limit           int    `form:"limit,default=20" json:"limit" binding:"required,min=1,max=200" example:"20"`
	Cursor          string `form:"cursor" json:"cursor" example:"cHJvdGVjdGVkIHZlcnNpb24gdG8gYmUgZXhjbHVkZWQgaW4gcGFyc2luZyB0aGUgY3Vyc29y"`
	TimeDesc        bool   `form:"time_desc,default=false" json:"time_desc" example:"false"`
	FilterByConfigs string `form:"filter_by_configs" json:"filter_by_configs"` // JSON-encoded string for JSONB containment filter
}

// GetSessions godoc
//
//	@Summary		Get sessions
//	@Description	Get all sessions under a project, optionally filtered by user or configs
//	@Tags			session
//	@Accept			json
//	@Produce		json
//	@Param			user				query	string	false	"User identifier to filter sessions"	example(alice@acontext.io)
//	@Param			filter_by_configs	query	string	false	"JSON-encoded object for JSONB containment filter. Example: {\"agent\":\"bot1\"}"
//	@Param			limit				query	integer	false	"Limit of sessions to return, default 20. Max 200."
//	@Param			cursor				query	string	false	"Cursor for pagination. Use the cursor from the previous response to get the next page."
//	@Param			time_desc			query	boolean	false	"Order by created_at descending if true, ascending if false (default false)"	example(false)
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=service.ListSessionsOutput}
//	@Router			/session [get]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# List sessions\nsessions = client.sessions.list(\n    limit=20,\n    time_desc=True\n)\nfor session in sessions.items:\n    print(f\"{session.id}\")\n\n# List sessions for a specific user\nsessions = client.sessions.list(user='alice@acontext.io', limit=20)\n\n# List sessions filtered by configs\nsessions = client.sessions.list(\n    limit=20,\n    filter_by_configs={\"agent\": \"bot1\"}\n)\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// List sessions\nconst sessions = await client.sessions.list({\n  limit: 20,\n  timeDesc: true\n});\nfor (const session of sessions.items) {\n  console.log(`${session.id}`);\n}\n\n// List sessions for a specific user\nconst userSessions = await client.sessions.list({ user: 'alice@acontext.io', limit: 20 });\n\n// List sessions filtered by configs\nconst filteredSessions = await client.sessions.list({\n  limit: 20,\n  filterByConfigs: { agent: 'bot1' }\n});\n","label":"JavaScript"}]
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

	// Parse filter_by_configs JSON string
	var filterByConfigs map[string]interface{}
	if req.FilterByConfigs != "" {
		if err := json.Unmarshal([]byte(req.FilterByConfigs), &filterByConfigs); err != nil {
			c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid filter_by_configs JSON", err))
			return
		}
		// Skip empty object - treat as no filter
		if len(filterByConfigs) == 0 {
			filterByConfigs = nil
		}
	}

	out, err := h.svc.List(c.Request.Context(), service.ListSessionsInput{
		ProjectID:       project.ID,
		User:            req.User,
		FilterByConfigs: filterByConfigs,
		Limit:           req.Limit,
		Cursor:          req.Cursor,
		TimeDesc:        req.TimeDesc,
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
//	@Description	Create a new session. Optionally associate with a user identifier. You can also specify a custom UUID using use_uuid.
//	@Tags			session
//	@Accept			json
//	@Produce		json
//	@Param			payload	body	handler.CreateSessionReq	true	"CreateSession payload"
//	@Security		BearerAuth
//	@Success		201	{object}	serializer.Response{data=model.Session}
//	@Failure		400	{object}	serializer.Response	"Invalid UUID format"
//	@Failure		409	{object}	serializer.Response	"Session with this UUID already exists"
//	@Router			/session [post]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Create a session\nsession = client.sessions.create()\nprint(f\"Created session: {session.id}\")\n\n# Create a session for a specific user\nsession = client.sessions.create(user='alice@acontext.io')\n\n# Create a session with a specific UUID\nsession = client.sessions.create(use_uuid='123e4567-e89b-12d3-a456-426614174000')\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Create a session\nconst session = await client.sessions.create();\nconsole.log(`Created session: ${session.id}`);\n\n// Create a session for a specific user\nconst userSession = await client.sessions.create({ user: 'alice@acontext.io' });\n\n// Create a session with a specific UUID\nconst customSession = await client.sessions.create({ useUuid: '123e4567-e89b-12d3-a456-426614174000' });\n","label":"JavaScript"}]
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
		ProjectID:           project.ID,
		DisableTaskTracking: false, // Default value
		Configs:             datatypes.JSONMap(req.Configs),
	}

	// If use_uuid is provided, validate and set the session ID
	if req.UseUUID != nil && *req.UseUUID != "" {
		parsedUUID, err := uuid.Parse(*req.UseUUID)
		if err != nil {
			c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid UUID format for use_uuid", err))
			return
		}
		session.ID = parsedUUID
	}

	// If user identifier is provided, get or create the user
	if req.User != "" {
		user, err := h.userSvc.GetOrCreate(c.Request.Context(), project.ID, req.User)
		if err != nil {
			c.JSON(http.StatusInternalServerError, serializer.DBErr("failed to get or create user", err))
			return
		}
		session.UserID = &user.ID
	}

	if req.DisableTaskTracking != nil {
		session.DisableTaskTracking = *req.DisableTaskTracking
	}
	if req.DisableTaskStatusChange != nil {
		session.DisableTaskStatusChange = *req.DisableTaskStatusChange
	}
	if err := h.svc.Create(c.Request.Context(), &session); err != nil {
		// Check for duplicate key error (PostgreSQL unique violation)
		if strings.Contains(err.Error(), "duplicate key") || strings.Contains(err.Error(), "23505") {
			c.JSON(http.StatusConflict, serializer.Err(http.StatusConflict, "session with this UUID already exists", nil))
			return
		}
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
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Update session configs\nclient.sessions.update_configs(\n    session_id='session-uuid'\n)\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Update session configs\nawait client.sessions.updateConfigs('session-uuid');\n","label":"JavaScript"}]
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

type StoreMessageReq struct {
	Blob   interface{}            `form:"blob" json:"blob" binding:"required"`
	Format string                 `form:"format" json:"format" binding:"omitempty,oneof=acontext openai anthropic gemini" example:"openai" enums:"acontext,openai,anthropic,gemini"`
	Meta   map[string]interface{} `form:"meta" json:"meta"` // Optional user-provided metadata for the message
}

// StoreMessage godoc
//
//	@Summary		Store message to session
//	@Description	Supports JSON and multipart/form-data. In multipart mode: the payload is a JSON string placed in a form field. The format parameter indicates the format of the input message (default: openai, same as GET). The blob field should be a complete message object: for openai, use OpenAI ChatCompletionMessageParam format (with role and content); for anthropic, use Anthropic MessageParam format (with role and content); for acontext (internal), use {role, parts} format. The optional meta field allows attaching user-provided metadata to the message, which can be retrieved via get_messages().metas or updated via patch_message_meta().
//	@Tags			session
//	@Accept			json
//	@Accept			multipart/form-data
//	@Produce		json
//	@Param			session_id	path		string					true	"Session ID"	Format(uuid)
//
//	// Content-Type: application/json
//	@Param			payload		body		handler.StoreMessageReq	true	"StoreMessage payload (Content-Type: application/json)"
//
//	// Content-Type: multipart/form-data
//	@Param			payload		formData	string					false	"StoreMessage payload (Content-Type: multipart/form-data)"
//	@Param			file		formData	file					false	"When uploading files, the field name must correspond to parts[*].file_field."
//	@Security		BearerAuth
//	@Success		201	{object}	serializer.Response{data=model.Message}
//	@Router			/session/{session_id}/messages [post]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\nfrom acontext.messages import build_acontext_message\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Store a message in OpenAI format with user metadata\nclient.sessions.store_message(\n    session_id='session-uuid',\n    blob={'role': 'user', 'content': 'Hello!'},\n    format='openai',\n    meta={'source': 'web', 'request_id': 'abc123'}\n)\n\n# Store a message in Acontext format\nmessage = build_acontext_message(role='user', parts=['Hello!'])\nclient.sessions.store_message(\n    session_id='session-uuid',\n    blob=message,\n    format='acontext'\n)\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient, MessagePart } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Store a message in OpenAI format with user metadata\nawait client.sessions.storeMessage(\n  'session-uuid',\n  { role: 'user', content: 'Hello!' },\n  { format: 'openai', meta: { source: 'web', request_id: 'abc123' } }\n);\n\n// Store a message in Acontext format\nawait client.sessions.storeMessage(\n  'session-uuid',\n  {\n    role: 'user',\n    parts: [MessagePart.textPart('Hello!')]\n  },\n  { format: 'acontext' }\n);\n","label":"JavaScript"}]
func (h *SessionHandler) StoreMessage(c *gin.Context) {
	req := StoreMessageReq{}

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

	// Validate meta size (max 64KB)
	if req.Meta != nil {
		metaBytes, _ := json.Marshal(req.Meta)
		if len(metaBytes) > MaxMetaSize {
			c.JSON(http.StatusBadRequest, serializer.ParamErr("meta size exceeds 64KB limit", nil))
			return
		}
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

	norm, normErr := normalizer.GetNormalizer(format)
	if normErr != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("unsupported format", normErr))
		return
	}
	normalizedRole, normalizedParts, normalizedMeta, err = norm.Normalize(blobJSON)
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr(fmt.Sprintf("failed to normalize %s message", format), err))
		return
	}
	for _, p := range normalizedParts {
		if p.FileField != "" {
			fileFields = append(fileFields, p.FileField)
		}
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

	// Store user-provided meta in __user_meta__ field for complete isolation from system fields
	if len(req.Meta) > 0 {
		if normalizedMeta == nil {
			normalizedMeta = make(map[string]interface{})
		}
		normalizedMeta[model.UserMetaKey] = req.Meta
	}

	out, err := h.svc.StoreMessage(c.Request.Context(), service.StoreMessageInput{
		ProjectID:   project.ID,
		SessionID:   sessionID,
		Role:        normalizedRole,
		Parts:       normalizedParts,
		Format:      format,
		MessageMeta: normalizedMeta,
		Files:       fileMap,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.DBErr("", err))
		return
	}

	// Extract user meta for response (hide internal __user_meta__ wrapper from users)
	responseMeta := converter.ExtractUserMeta(out.Meta.Data())
	out.Meta = datatypes.NewJSONType(responseMeta)

	c.JSON(http.StatusCreated, serializer.Response{Data: out})
}

type GetMessagesReq struct {
	Limit                         *int   `form:"limit" json:"limit" binding:"omitempty,min=0,max=200" example:"20"`
	Cursor                        string `form:"cursor" json:"cursor" example:"cHJvdGVjdGVkIHZlcnNpb24gdG8gYmUgZXhjbHVkZWQgaW4gcGFyc2luZyB0aGUgY3Vyc29y"`
	WithAssetPublicURL            bool   `form:"with_asset_public_url,default=true" json:"with_asset_public_url" example:"true"`
	Format                        string `form:"format,default=openai" json:"format" binding:"omitempty,oneof=acontext openai anthropic gemini" example:"openai" enums:"acontext,openai,anthropic,gemini"`
	TimeDesc                      bool   `form:"time_desc,default=false" json:"time_desc" example:"false"`
	EditStrategies                string `form:"edit_strategies" json:"edit_strategies" example:"[{\"type\":\"remove_tool_result\",\"params\":{\"keep_recent_n_tool_results\":3}}]"`
	PinEditingStrategiesAtMessage string `form:"pin_editing_strategies_at_message" json:"pin_editing_strategies_at_message" example:""`
}

// GetMessages godoc
//
//	@Summary		Get messages from session
//	@Description	Get messages from session. Default format is openai. Can convert to acontext (original), anthropic, or gemini format.
//	@Tags			session
//	@Accept			json
//	@Produce		json
//	@Param			session_id							path	string	true	"Session ID"	format(uuid)
//	@Param			limit								query	integer	false	"Limit of messages to return. Max 200. If limit is 0 or not provided, all messages will be returned. \n\nWARNING!\n Use `limit` only for read-only/display purposes (pagination, viewing). Do NOT use `limit` to truncate messages before sending to LLM as it may cause tool-call and tool-result unpairing issues. Instead, use the `token_limit` edit strategy in `edit_strategies` parameter to safely manage message context size."
//	@Param			cursor								query	string	false	"Cursor for pagination. Use the cursor from the previous response to get the next page."
//	@Param			with_asset_public_url				query	boolean	false	"Whether to return asset public url, default is true"																																																																							example(true)
//	@Param			format								query	string	false	"Format to convert messages to: acontext (original), openai (default), anthropic, gemini."																																																														enums(acontext,openai,anthropic,gemini)
//	@Param			time_desc							query	boolean	false	"Order by created_at descending if true, ascending if false (default false)"																																																																	example(false)
//	@Param			edit_strategies						query	string	false	"JSON array of edit strategies to apply before format conversion"																																																																				example([{"type":"remove_tool_result","params":{"keep_recent_n_tool_results":3}}])
//	@Param			pin_editing_strategies_at_message	query	string	false	"Message ID to pin editing strategies at. When provided, strategies are only applied to messages up to and including this message ID, keeping subsequent messages unchanged. This helps maintain prompt cache stability by preserving a stable prefix. The response will include edit_at_message_id indicating where strategies were applied."	example()
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=converter.GetMessagesOutput}
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
		SessionID:                     sessionID,
		Limit:                         limit,
		Cursor:                        req.Cursor,
		WithAssetPublicURL:            req.WithAssetPublicURL,
		AssetExpire:                   time.Hour * 24,
		TimeDesc:                      req.TimeDesc,
		EditStrategies:                editStrategies,
		PinEditingStrategiesAtMessage: req.PinEditingStrategiesAtMessage,
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

	// Calculate token count for the returned messages
	thisTimeTokens, err := tokenizer.CountMessagePartsTokens(c.Request.Context(), out.Items)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("failed to count tokens", err))
		return
	}

	convertedOut, err := converter.GetConvertedMessagesOutput(
		out.Items,
		format,
		out.PublicURLs,
		out.NextCursor,
		out.HasMore,
		thisTimeTokens,
		out.EditAtMessageID,
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

// GetSessionObservingStatus godoc
//
//	@Summary		Get message observing status for a session
//	@Description	Returns the count of observed, in_process, and pending messages
//	@Tags			session
//	@Accept			json
//	@Produce		json
//	@Param			session_id	path	string	true	"Session ID"	format(uuid)
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=model.MessageObservingStatus}
//	@Router			/session/{session_id}/observing_status [get]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Get message observing status\nresult = client.sessions.messages_observing_status(session_id='session-uuid')\nprint(f\"Observed: {result.observed}, In Process: {result.in_process}, Pending: {result.pending}\")\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Get message observing status\nconst result = await client.sessions.messagesObservingStatus('session-uuid');\nconsole.log(`Observed: ${result.observed}, In Process: ${result.in_process}, Pending: ${result.pending}`);\n","label":"JavaScript"}]
func (h *SessionHandler) GetSessionObservingStatus(c *gin.Context) {
	sessionID, err := uuid.Parse(c.Param("session_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	status, err := h.svc.GetSessionObservingStatus(c.Request.Context(), sessionID.String())
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: status})
}

type PatchMessageMetaReq struct {
	Meta map[string]interface{} `form:"meta" json:"meta" binding:"required"`
}

type PatchMessageMetaResp struct {
	Meta map[string]interface{} `json:"meta"`
}

type PatchSessionConfigsReq struct {
	Configs map[string]interface{} `form:"configs" json:"configs" binding:"required"`
}

type PatchSessionConfigsResp struct {
	Configs map[string]interface{} `json:"configs"`
}

type CopySessionResp struct {
	OldSessionID string `json:"old_session_id"`
	NewSessionID string `json:"new_session_id"`
}

// PatchMessageMeta godoc
//
//	@Summary		Patch message metadata
//	@Description	Update message metadata using patch semantics. Only updates keys present in the request. Pass null as value to delete a key.
//	@Tags			session
//	@Accept			json
//	@Produce		json
//	@Param			session_id	path	string						true	"Session ID"	format(uuid)
//	@Param			message_id	path	string						true	"Message ID"	format(uuid)
//	@Param			payload		body	handler.PatchMessageMetaReq	true	"PatchMessageMeta payload"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=handler.PatchMessageMetaResp}
//	@Failure		400	{object}	serializer.Response	"Invalid request"
//	@Failure		404	{object}	serializer.Response	"Message not found"
//	@Router			/session/{session_id}/messages/{message_id}/meta [patch]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Patch message meta (adds/updates keys, use None to delete)\nupdated_meta = client.sessions.patch_message_meta(\n    session_id='session-uuid',\n    message_id='message-uuid',\n    meta={'status': 'processed', 'old_key': None}  # None deletes the key\n)\nprint(updated_meta)  # {'existing_key': 'value', 'status': 'processed'}\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Patch message meta (adds/updates keys, use null to delete)\nconst updatedMeta = await client.sessions.patchMessageMeta(\n  'session-uuid',\n  'message-uuid',\n  { status: 'processed', old_key: null }  // null deletes the key\n);\nconsole.log(updatedMeta);  // { existing_key: 'value', status: 'processed' }\n","label":"JavaScript"}]
func (h *SessionHandler) PatchMessageMeta(c *gin.Context) {
	req := PatchMessageMetaReq{}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	// Validate meta size (max 64KB)
	metaBytes, _ := json.Marshal(req.Meta)
	if len(metaBytes) > MaxMetaSize {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("meta size exceeds 64KB limit", nil))
		return
	}

	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("project not found")))
		return
	}

	sessionID, err := uuid.Parse(c.Param("session_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid session_id", err))
		return
	}

	messageID, err := uuid.Parse(c.Param("message_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid message_id", err))
		return
	}

	updatedMeta, err := h.svc.PatchMessageMeta(c.Request.Context(), project.ID, sessionID, messageID, req.Meta)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			c.JSON(http.StatusNotFound, serializer.Err(http.StatusNotFound, err.Error(), nil))
			return
		}
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: PatchMessageMetaResp{Meta: updatedMeta}})
}

// PatchConfigs godoc
//
//	@Summary		Patch session configs
//	@Description	Update session configs using patch semantics. Only updates keys present in the request. Pass null as value to delete a key. Returns the complete configs after patch.
//	@Tags			session
//	@Accept			json
//	@Produce		json
//	@Param			session_id	path	string							true	"Session ID"	format(uuid)
//	@Param			payload		body	handler.PatchSessionConfigsReq	true	"PatchSessionConfigs payload"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=handler.PatchSessionConfigsResp}
//	@Failure		400	{object}	serializer.Response	"Invalid request"
//	@Failure		404	{object}	serializer.Response	"Session not found"
//	@Router			/session/{session_id}/configs [patch]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Patch session configs (adds/updates keys, use None to delete)\nupdated_configs = client.sessions.patch_configs(\n    session_id='session-uuid',\n    configs={'agent': 'bot2', 'old_key': None}  # None deletes the key\n)\nprint(updated_configs)  # {'existing_key': 'value', 'agent': 'bot2'}\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Patch session configs (adds/updates keys, use null to delete)\nconst updatedConfigs = await client.sessions.patchConfigs(\n  'session-uuid',\n  { agent: 'bot2', old_key: null }  // null deletes the key\n);\nconsole.log(updatedConfigs);  // { existing_key: 'value', agent: 'bot2' }\n","label":"JavaScript"}]
func (h *SessionHandler) PatchConfigs(c *gin.Context) {
	req := PatchSessionConfigsReq{}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	// Validate configs size (max 64KB)
	configsBytes, _ := json.Marshal(req.Configs)
	if len(configsBytes) > MaxMetaSize {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("configs size exceeds 64KB limit", nil))
		return
	}

	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("project not found")))
		return
	}

	sessionID, err := uuid.Parse(c.Param("session_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid session_id", err))
		return
	}

	updatedConfigs, err := h.svc.PatchConfigs(c.Request.Context(), project.ID, sessionID, req.Configs)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			c.JSON(http.StatusNotFound, serializer.Err(http.StatusNotFound, err.Error(), nil))
			return
		}
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: PatchSessionConfigsResp{Configs: updatedConfigs}})
}

// CopySession godoc
//
//	@Summary		Copy session
//	@Description	Create a complete copy of a session with all its messages and tasks. The copied session will be independent and can be modified without affecting the original.
//	@Tags			session
//	@Accept			json
//	@Produce		json
//	@Param			session_id	path	string	true	"Session ID"	format(uuid)
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=handler.CopySessionResp}
//	@Failure		400	{object}	serializer.Response	"Invalid session ID"
//	@Failure		404	{object}	serializer.Response	"Session not found"
//	@Failure		413	{object}	serializer.Response	"Session exceeds maximum copyable size"
//	@Failure		500	{object}	serializer.Response	"Failed to copy session"
//	@Router			/session/{session_id}/copy [post]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Copy a session\nresult = client.sessions.copy(session_id='session-uuid')\nprint(f\"Copied session: {result.new_session_id}\")\nprint(f\"Original session: {result.old_session_id}\")\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Copy a session\nconst result = await client.sessions.copy('session-uuid');\nconsole.log(`Copied session: ${result.newSessionId}`);\nconsole.log(`Original session: ${result.oldSessionId}`);\n","label":"JavaScript"}]
func (h *SessionHandler) CopySession(c *gin.Context) {
	// Parse and validate session ID
	sessionID, err := uuid.Parse(c.Param("session_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.Err(http.StatusBadRequest, "INVALID_SESSION_ID", err))
		return
	}

	// Get project from context
	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("project not found")))
		return
	}

	// Call service to copy session
	result, err := h.svc.CopySession(c.Request.Context(), service.CopySessionInput{
		ProjectID: project.ID,
		SessionID: sessionID,
	})
	if err != nil {
		// Handle specific error cases using typed errors
		if errors.Is(err, service.ErrSessionNotFound) {
			c.JSON(http.StatusNotFound, serializer.Err(http.StatusNotFound, "SESSION_NOT_FOUND", err))
			return
		}
		if errors.Is(err, service.ErrSessionTooLarge) {
			c.JSON(http.StatusRequestEntityTooLarge, serializer.Err(
				http.StatusRequestEntityTooLarge,
				"SESSION_TOO_LARGE",
				fmt.Errorf("Session exceeds maximum copyable size (%d messages).", repo.MaxCopyableMessages),
			))
			return
		}
		c.JSON(http.StatusInternalServerError, serializer.Err(http.StatusInternalServerError, "INTERNAL_ERROR", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{
		Data: CopySessionResp{
			OldSessionID: result.OldSessionID.String(),
			NewSessionID: result.NewSessionID.String(),
		},
	})
}
