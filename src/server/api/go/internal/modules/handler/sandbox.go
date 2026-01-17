package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/infra/httpclient"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/serializer"
)

type SandboxHandler struct {
	coreClient *httpclient.CoreClient
}

func NewSandboxHandler(coreClient *httpclient.CoreClient) *SandboxHandler {
	return &SandboxHandler{
		coreClient: coreClient,
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
//	@Success		200	{object}	serializer.Response{data=httpclient.SandboxRuntimeInfo}
//	@Router			/sandbox [post]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Create a new sandbox\nsandbox = client.sandboxes.create()\nprint(f\"Sandbox ID: {sandbox.sandbox_id}\")\nprint(f\"Status: {sandbox.sandbox_status}\")\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Create a new sandbox\nconst sandbox = await client.sandboxes.create();\nconsole.log(`Sandbox ID: ${sandbox.sandboxId}`);\nconsole.log(`Status: ${sandbox.sandboxStatus}`);\n","label":"JavaScript"}]
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

	c.JSON(http.StatusOK, serializer.Response{Data: result})
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
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Execute a command in the sandbox\nresult = client.sandboxes.exec_command(\n    sandbox_id='sandbox-uuid',\n    command='ls -la'\n)\nprint(f\"stdout: {result.stdout}\")\nprint(f\"stderr: {result.stderr}\")\nprint(f\"exit_code: {result.exit_code}\")\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Execute a command in the sandbox\nconst result = await client.sandboxes.execCommand({\n  sandboxId: 'sandbox-uuid',\n  command: 'ls -la'\n});\nconsole.log(`stdout: ${result.stdout}`);\nconsole.log(`stderr: ${result.stderr}`);\nconsole.log(`exitCode: ${result.exitCode}`);\n","label":"JavaScript"}]
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
