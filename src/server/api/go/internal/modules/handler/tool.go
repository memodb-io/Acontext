package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/infra/httpclient"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/serializer"
	"github.com/memodb-io/Acontext/internal/modules/service"
	"gorm.io/gorm"
)

type ToolHandler struct {
	userSvc    service.UserService
	coreClient *httpclient.CoreClient
}

func NewToolHandler(userSvc service.UserService, coreClient *httpclient.CoreClient) *ToolHandler {
	return &ToolHandler{
		userSvc:    userSvc,
		coreClient: coreClient,
	}
}

func coreHTTPErrorMessage(body string) string {
	// FastAPI default error format: {"detail":"..."}
	var payload struct {
		Detail string `json:"detail"`
		Msg    string `json:"msg"`
		Error  string `json:"error"`
	}
	if err := json.Unmarshal([]byte(body), &payload); err == nil {
		if strings.TrimSpace(payload.Detail) != "" {
			return payload.Detail
		}
		if strings.TrimSpace(payload.Msg) != "" {
			return payload.Msg
		}
		if strings.TrimSpace(payload.Error) != "" {
			return payload.Error
		}
	}
	return strings.TrimSpace(body)
}

func normalizeToolFormat(raw string) (string, error) {
	format := strings.TrimSpace(raw)
	if format == "" {
		return "openai", nil
	}
	switch format {
	case "openai", "anthropic", "gemini":
		return format, nil
	default:
		return "", fmt.Errorf("invalid format: %s", format)
	}
}

// resolveUserIDForRead resolves a user identifier without creating a new user row.
func (h *ToolHandler) resolveUserIDForRead(c *gin.Context, projectID uuid.UUID, identifier string) (*uuid.UUID, bool, error) {
	identifier = strings.TrimSpace(identifier)
	if identifier == "" {
		return nil, true, nil
	}
	user, err := h.userSvc.GetByIdentifier(c.Request.Context(), projectID, identifier)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, false, nil
		}
		return nil, false, err
	}
	return &user.ID, true, nil
}

type UpsertToolReq struct {
	User         string                 `json:"user" example:"alice@acontext.io"`
	OpenAISchema map[string]interface{} `json:"openai_schema" binding:"required" swaggertype:"object"`
	Config       map[string]interface{} `json:"config,omitempty" swaggertype:"object"`
}

// UpsertTool godoc
//
//	@Summary		Upsert tool
//	@Description	Create or update a tool schema for a user. Schema input must be in OpenAI tool schema format.
//	@Tags			tools
//	@Accept			json
//	@Produce		json
//	@Param			payload	body	handler.UpsertToolReq	true	"UpsertTool payload"
//	@Param			format	query	string	false	"Schema output format: openai|anthropic|gemini"	default(openai)
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=httpclient.ToolOut}
//	@Router			/tools [post]
func (h *ToolHandler) UpsertTool(c *gin.Context) {
	req := UpsertToolReq{}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("project not found")))
		return
	}

	userIdentifier := strings.TrimSpace(req.User)
	var userID *uuid.UUID
	if userIdentifier != "" {
		user, err := h.userSvc.GetOrCreate(c.Request.Context(), project.ID, userIdentifier)
		if err != nil {
			c.JSON(http.StatusInternalServerError, serializer.DBErr("failed to get or create user", err))
			return
		}
		userID = &user.ID
	}

	format, err := normalizeToolFormat(c.Query("format"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("format", err))
		return
	}

	out, err := h.coreClient.UpsertTool(c.Request.Context(), project.ID, httpclient.ToolUpsertRequest{
		UserID:       userID,
		OpenAISchema: req.OpenAISchema,
		Config:       req.Config,
	}, format)
	if err != nil {
		var coreErr *httpclient.CoreHTTPError
		if errors.As(err, &coreErr) {
			msg := coreHTTPErrorMessage(coreErr.Body)
			c.JSON(coreErr.StatusCode, serializer.Err(coreErr.StatusCode, msg, err))
			return
		}
		c.JSON(http.StatusServiceUnavailable, serializer.Err(http.StatusServiceUnavailable, "core request failed", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: out})
}

type ListToolsReq struct {
	User         string `form:"user" json:"user" example:"alice@acontext.io"`
	Limit        int    `form:"limit,default=20" json:"limit" binding:"required,min=1,max=200" example:"20"`
	Cursor       string `form:"cursor" json:"cursor"`
	TimeDesc     bool   `form:"time_desc,default=false" json:"time_desc" example:"false"`
	FilterConfig string `form:"filter_config" json:"filter_config"` // JSON-encoded string for JSONB containment filter
	Format       string `form:"format" json:"format" example:"openai"`
}

// ListTools godoc
//
//	@Summary		List tools
//	@Description	List tools for a user under a project. Supports config filtering and schema format conversion.
//	@Tags			tools
//	@Accept			json
//	@Produce		json
//	@Param			user			query	string	false	"User identifier"	example(alice@acontext.io)
//	@Param			filter_config	query	string	false	"JSON-encoded object for JSONB containment filter. Example: {\"tag\":\"web\"}"
//	@Param			format			query	string	false	"Schema output format: openai|anthropic|gemini"	default(openai)
//	@Param			limit			query	integer	false	"Limit of tools to return, default 20. Max 200."
//	@Param			cursor			query	string	false	"Cursor for pagination"
//	@Param			time_desc		query	boolean	false	"Order by created_at descending if true"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=httpclient.ListToolsResponse}
//	@Router			/tools [get]
func (h *ToolHandler) ListTools(c *gin.Context) {
	req := ListToolsReq{}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("project not found")))
		return
	}

	format, err := normalizeToolFormat(req.Format)
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("format", err))
		return
	}

	userID, found, err := h.resolveUserIDForRead(c, project.ID, req.User)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("failed to resolve user", err))
		return
	}
	if !found {
		c.JSON(http.StatusOK, serializer.Response{
			Data: httpclient.ListToolsResponse{
				Items:   []httpclient.ToolOut{},
				HasMore: false,
			},
		})
		return
	}

	out, err := h.coreClient.ListTools(
		c.Request.Context(),
		project.ID,
		userID,
		req.Limit,
		req.Cursor,
		req.TimeDesc,
		req.FilterConfig,
		format,
	)
	if err != nil {
		var coreErr *httpclient.CoreHTTPError
		if errors.As(err, &coreErr) {
			msg := coreHTTPErrorMessage(coreErr.Body)
			c.JSON(coreErr.StatusCode, serializer.Err(coreErr.StatusCode, msg, err))
			return
		}
		c.JSON(http.StatusServiceUnavailable, serializer.Err(http.StatusServiceUnavailable, "core request failed", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: out})
}

type SearchToolsReq struct {
	User   string `form:"user" json:"user" example:"alice@acontext.io"`
	Query  string `form:"query" json:"query" binding:"required" example:"search in slack and save it to CRM"`
	Limit  int    `form:"limit,default=10" json:"limit" binding:"required,min=1,max=50" example:"10"`
	Format string `form:"format" json:"format" example:"openai"`
}

// SearchTools godoc
//
//	@Summary		Search tools
//	@Description	Semantic search for tools by natural-language query.
//	@Tags			tools
//	@Accept			json
//	@Produce		json
//	@Param			user	query	string	false	"User identifier"	example(alice@acontext.io)
//	@Param			query	query	string	true	"Search query"
//	@Param			limit	query	integer	false	"Max results (default 10, max 50)"
//	@Param			format	query	string	false	"Schema output format: openai|anthropic|gemini"	default(openai)
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=httpclient.SearchToolsResponse}
//	@Router			/tools/search [get]
func (h *ToolHandler) SearchTools(c *gin.Context) {
	req := SearchToolsReq{}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("project not found")))
		return
	}

	format, err := normalizeToolFormat(req.Format)
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("format", err))
		return
	}

	userID, found, err := h.resolveUserIDForRead(c, project.ID, req.User)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("failed to resolve user", err))
		return
	}
	if !found {
		c.JSON(http.StatusOK, serializer.Response{
			Data: httpclient.SearchToolsResponse{
				Items: []httpclient.ToolSearchHit{},
			},
		})
		return
	}

	out, err := h.coreClient.SearchTools(
		c.Request.Context(),
		project.ID,
		userID,
		req.Query,
		req.Limit,
		format,
	)
	if err != nil {
		var coreErr *httpclient.CoreHTTPError
		if errors.As(err, &coreErr) {
			msg := coreHTTPErrorMessage(coreErr.Body)
			c.JSON(coreErr.StatusCode, serializer.Err(coreErr.StatusCode, msg, err))
			return
		}
		c.JSON(http.StatusServiceUnavailable, serializer.Err(http.StatusServiceUnavailable, "core request failed", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: out})
}

type DeleteToolReq struct {
	User string `form:"user" json:"user" example:"alice@acontext.io"`
}

// DeleteTool godoc
//
//	@Summary		Delete tool
//	@Description	Delete a tool by name for a user.
//	@Tags			tools
//	@Accept			json
//	@Produce		json
//	@Param			name	path	string	true	"Tool name"
//	@Param			user	query	string	false	"User identifier"	example(alice@acontext.io)
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response
//	@Router			/tools/{name} [delete]
func (h *ToolHandler) DeleteTool(c *gin.Context) {
	req := DeleteToolReq{}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	name := c.Param("name")
	if strings.TrimSpace(name) == "" {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("name is required")))
		return
	}

	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("project not found")))
		return
	}

	userID, found, err := h.resolveUserIDForRead(c, project.ID, req.User)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("failed to resolve user", err))
		return
	}
	if !found {
		c.JSON(http.StatusNotFound, serializer.Err(http.StatusNotFound, fmt.Sprintf("tool %s not found", name), nil))
		return
	}

	if err := h.coreClient.DeleteTool(c.Request.Context(), project.ID, userID, name); err != nil {
		var coreErr *httpclient.CoreHTTPError
		if errors.As(err, &coreErr) {
			msg := coreHTTPErrorMessage(coreErr.Body)
			c.JSON(coreErr.StatusCode, serializer.Err(coreErr.StatusCode, msg, err))
			return
		}
		c.JSON(http.StatusServiceUnavailable, serializer.Err(http.StatusServiceUnavailable, "core request failed", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{})
}
