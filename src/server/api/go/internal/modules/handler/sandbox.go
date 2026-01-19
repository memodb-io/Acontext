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
)

type SandboxHandler struct {
	coreClient        *httpclient.CoreClient
	sandboxLogService service.SandboxLogService
}

func NewSandboxHandler(coreClient *httpclient.CoreClient, sandboxLogService service.SandboxLogService) *SandboxHandler {
	return &SandboxHandler{
		coreClient:        coreClient,
		sandboxLogService: sandboxLogService,
	}
}

type ExecCommandReq struct {
	Command string `json:"command" binding:"required"`
}

// CreateSandbox godoc
//
//	@Summary		Create a new sandbox
//	@Description	Create and start a new sandbox for the project
//	@Tags			sandbox
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Success		201	{object}	serializer.Response{data=httpclient.SandboxRuntimeInfo}
//	@Router			/sandbox [post]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Create a new sandbox\nsandbox = client.sandboxes.create()\nprint(f\"Sandbox ID: {sandbox.sandbox_id}\")\nprint(f\"Status: {sandbox.sandbox_status}\")\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Create a new sandbox\nconst sandbox = await client.sandboxes.create();\nconsole.log(`Sandbox ID: ${sandbox.sandbox_id}`);\nconsole.log(`Status: ${sandbox.sandbox_status}`);\n","label":"JavaScript"}]
func (h *SandboxHandler) CreateSandbox(c *gin.Context) {
	// Get project from context
	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("project not found")))
		return
	}

	// Call Core service to create sandbox
	result, err := h.coreClient.StartSandbox(c.Request.Context(), project.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.Err(http.StatusInternalServerError, "failed to create sandbox", err))
		return
	}

	c.JSON(http.StatusCreated, serializer.Response{Data: result})
}

// ExecCommand godoc
//
//	@Summary		Execute command in sandbox
//	@Description	Execute a shell command in the specified sandbox
//	@Tags			sandbox
//	@Accept			json
//	@Produce		json
//	@Param			sandbox_id	path	string					true	"Sandbox ID"
//	@Param			payload		body	handler.ExecCommandReq	true	"Command to execute"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=httpclient.SandboxCommandOutput}
//	@Router			/sandbox/{sandbox_id}/exec [post]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Execute a command in the sandbox\nresult = client.sandboxes.exec_command(\n    sandbox_id='sandbox-uuid',\n    command='ls -la'\n)\nprint(f\"stdout: {result.stdout}\")\nprint(f\"stderr: {result.stderr}\")\nprint(f\"exit_code: {result.exit_code}\")\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Execute a command in the sandbox\nconst result = await client.sandboxes.execCommand({\n  sandboxId: 'sandbox-uuid',\n  command: 'ls -la'\n});\nconsole.log(`stdout: ${result.stdout}`);\nconsole.log(`stderr: ${result.stderr}`);\nconsole.log(`exit_code: ${result.exit_code}`);\n","label":"JavaScript"}]
func (h *SandboxHandler) ExecCommand(c *gin.Context) {
	// Get project from context
	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("project not found")))
		return
	}

	// Parse sandbox ID from path
	sandboxIDStr := c.Param("sandbox_id")
	sandboxID, err := uuid.Parse(sandboxIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid sandbox_id", err))
		return
	}

	// Parse request body
	req := ExecCommandReq{}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	// Call Core service to execute command
	result, err := h.coreClient.ExecSandboxCommand(c.Request.Context(), project.ID, sandboxID, req.Command)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.Err(http.StatusInternalServerError, "failed to execute command", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: result})
}

// KillSandbox godoc
//
//	@Summary		Kill a sandbox
//	@Description	Kill a running sandbox
//	@Tags			sandbox
//	@Accept			json
//	@Produce		json
//	@Param			sandbox_id	path	string	true	"Sandbox ID"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=httpclient.FlagResponse}
//	@Router			/sandbox/{sandbox_id} [delete]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Kill a sandbox\nresult = client.sandboxes.kill(sandbox_id='sandbox-uuid')\nprint(f\"Status: {result.status}\")\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Kill a sandbox\nconst result = await client.sandboxes.kill('sandbox-uuid');\nconsole.log(`Status: ${result.status}`);\n","label":"JavaScript"}]
func (h *SandboxHandler) KillSandbox(c *gin.Context) {
	// Get project from context
	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("project not found")))
		return
	}

	// Parse sandbox ID from path
	sandboxIDStr := c.Param("sandbox_id")
	sandboxID, err := uuid.Parse(sandboxIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid sandbox_id", err))
		return
	}

	// Call Core service to kill sandbox
	result, err := h.coreClient.KillSandbox(c.Request.Context(), project.ID, sandboxID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.Err(http.StatusInternalServerError, "failed to kill sandbox", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: result})
}

type GetSandboxLogsReq struct {
	Limit    int    `form:"limit,default=20" json:"limit" binding:"required,min=1,max=200" example:"20"`
	Cursor   string `form:"cursor" json:"cursor" example:"cHJvdGVjdGVkIHZlcnNpb24gdG8gYmUgZXhjbHVkZWQgaW4gcGFyc2luZyB0aGUgY3Vyc29y"`
	TimeDesc bool   `form:"time_desc,default=false" json:"time_desc" example:"false"`
}

// GetSandboxLogs godoc
//
//	@Summary		Get sandbox logs
//	@Description	Get sandbox logs for the project with cursor-based pagination
//	@Tags			sandbox
//	@Accept			json
//	@Produce		json
//	@Param			limit		query	integer	false	"Limit of sandbox logs to return, default 20. Max 200."
//	@Param			cursor		query	string	false	"Cursor for pagination. Use the cursor from the previous response to get the next page."
//	@Param			time_desc	query	boolean	false	"Order by created_at descending if true, ascending if false (default false)"	example(false)
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=service.GetSandboxLogsOutput}
//	@Router			/sandbox/logs [get]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Get sandbox logs\nlogs = client.sandboxes.get_logs(limit=20, time_desc=True)\nfor log in logs.items:\n    print(f\"Log {log.id}: {log.backend_type}\")\n\n# If there are more logs, use the cursor for pagination\nif logs.has_more:\n    next_logs = client.sandboxes.get_logs(\n        limit=20,\n        cursor=logs.next_cursor\n    )\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Get sandbox logs\nconst logs = await client.sandboxes.getLogs({ limit: 20, timeDesc: true });\nfor (const log of logs.items) {\n  console.log(`Log ${log.id}: ${log.backend_type}`);\n}\n\n// If there are more logs, use the cursor for pagination\nif (logs.hasMore) {\n  const nextLogs = await client.sandboxes.getLogs({\n    limit: 20,\n    cursor: logs.nextCursor\n  });\n}\n","label":"JavaScript"}]
func (h *SandboxHandler) GetSandboxLogs(c *gin.Context) {
	req := GetSandboxLogsReq{}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	// Get project from context
	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("project not found")))
		return
	}

	out, err := h.sandboxLogService.GetSandboxLogs(c.Request.Context(), service.GetSandboxLogsInput{
		ProjectID: project.ID,
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
