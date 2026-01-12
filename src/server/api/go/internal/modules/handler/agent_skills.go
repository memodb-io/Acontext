package handler

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/bytedance/sonic"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/serializer"
	"github.com/memodb-io/Acontext/internal/modules/service"
)

type AgentSkillsHandler struct {
	svc     service.AgentSkillsService
	userSvc service.UserService
}

func NewAgentSkillsHandler(s service.AgentSkillsService, userSvc service.UserService) *AgentSkillsHandler {
	return &AgentSkillsHandler{svc: s, userSvc: userSvc}
}

type CreateAgentSkillsReq struct {
	User string `form:"user" json:"user" example:"alice@acontext.io"`
	Meta string `form:"meta" json:"meta" example:"{\"version\":\"1.0\"}"`
}

// CreateAgentSkills godoc
//
//	@Summary		Create agent skill
//	@Description	Upload a zip file containing agent skill and extract it to S3. The zip file must contain a SKILL.md file (case-insensitive) with YAML format containing 'name' and 'description' fields. The name and description will be extracted from SKILL.md. Optionally associate with a user identifier.
//	@Tags			agent_skills
//	@Accept			multipart/form-data
//	@Produce		json
//	@Param			file	formData	file	true	"ZIP file containing agent skill. Must contain SKILL.md (case-insensitive) with YAML format: name and description fields."
//	@Param			user	formData	string	false	"User identifier to associate with the skill"	example(alice@acontext.io)
//	@Param			meta	formData	string	false	"Additional metadata (JSON string)"
//	@Security		BearerAuth
//	@Success		201	{object}	serializer.Response{data=model.AgentSkills}	"Returns agent skill with name and description extracted from SKILL.md"
//	@Router			/agent_skills [post]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\nfrom acontext.uploads import FileUpload\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Upload a skill from a zip file\nwith open('my_skill.zip', 'rb') as f:\n    skill = client.skills.create(\n        file=FileUpload(filename='my_skill.zip', content=f.read(), content_type='application/zip'),\n        user='alice@example.com',\n        meta={'version': '1.0'}\n    )\nprint(f\"Created skill: {skill.name} (ID: {skill.id})\")\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@anthropic/acontext';\nimport fs from 'fs';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Upload a skill from a zip file\nconst fileBuffer = fs.readFileSync('my_skill.zip');\nconst skill = await client.skills.create({\n  file: ['my_skill.zip', fileBuffer, 'application/zip'],\n  user: 'alice@example.com',\n  meta: { version: '1.0' }\n});\nconsole.log(`Created skill: ${skill.name} (ID: ${skill.id})`);\n","label":"JavaScript"}]
func (h *AgentSkillsHandler) CreateAgentSkill(c *gin.Context) {
	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("project not found")))
		return
	}

	var req CreateAgentSkillsReq
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	// Get file from form
	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("file is required")))
		return
	}

	// Validate file is zip
	if !strings.HasSuffix(strings.ToLower(fileHeader.Filename), ".zip") {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("file must be a zip archive")))
		return
	}

	// Parse meta from JSON string if provided
	var meta map[string]interface{}
	if req.Meta != "" {
		if err := sonic.Unmarshal([]byte(req.Meta), &meta); err != nil {
			c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid meta JSON format", err))
			return
		}
	}

	// If user identifier is provided, get or create the user
	var userID *uuid.UUID
	if req.User != "" {
		user, err := h.userSvc.GetOrCreate(c.Request.Context(), project.ID, req.User)
		if err != nil {
			c.JSON(http.StatusInternalServerError, serializer.DBErr("failed to get or create user", err))
			return
		}
		userID = &user.ID
	}

	agentSkills, err := h.svc.Create(c.Request.Context(), service.CreateAgentSkillsInput{
		ProjectID: project.ID,
		UserID:    userID,
		ZipFile:   fileHeader,
		Meta:      meta,
	})
	if err != nil {
		// Check if error is a validation error (SKILL.md related)
		errMsg := err.Error()
		if strings.Contains(errMsg, "SKILL.md") || strings.Contains(errMsg, "name is required") || strings.Contains(errMsg, "description is required") {
			c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		} else {
			c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		}
		return
	}

	c.JSON(http.StatusCreated, serializer.Response{Data: agentSkills})
}

// GetAgentSkills godoc
//
//	@Summary		Get agent skill by ID
//	@Description	Get agent skill by its UUID
//	@Tags			agent_skills
//	@Accept			json
//	@Produce		json
//	@Param			id	path	string	true	"Agent skill UUID"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=model.AgentSkills}
//	@Router			/agent_skills/{id} [get]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Get a skill by ID\nskill = client.skills.get('skill-uuid-here')\nprint(f\"Skill: {skill.name}\")\nprint(f\"Description: {skill.description}\")\nprint(f\"Files: {len(skill.file_index)} file(s)\")\nfor f in skill.file_index:\n    print(f\"  - {f.path} ({f.mime})\")\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@anthropic/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Get a skill by ID\nconst skill = await client.skills.get('skill-uuid-here');\nconsole.log(`Skill: ${skill.name}`);\nconsole.log(`Description: ${skill.description}`);\nconsole.log(`Files: ${skill.file_index.length} file(s)`);\nskill.file_index.forEach(f => console.log(`  - ${f.path} (${f.mime})`));\n","label":"JavaScript"}]
func (h *AgentSkillsHandler) GetAgentSkill(c *gin.Context) {
	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("project not found")))
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("invalid id")))
		return
	}

	agentSkills, err := h.svc.GetByID(c.Request.Context(), project.ID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: agentSkills})
}

// DeleteAgentSkills godoc
//
//	@Summary		Delete agent skill
//	@Description	Delete agent skill and all extracted files from S3
//	@Tags			agent_skills
//	@Accept			json
//	@Produce		json
//	@Param			id	path	string	true	"Agent skill UUID"
//	@Security		BearerAuth
//	@Success		204	""
//	@Router			/agent_skills/{id} [delete]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Delete a skill by ID\nclient.skills.delete('skill-uuid-here')\nprint('Skill deleted successfully')\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@anthropic/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Delete a skill by ID\nawait client.skills.delete('skill-uuid-here');\nconsole.log('Skill deleted successfully');\n","label":"JavaScript"}]
func (h *AgentSkillsHandler) DeleteAgentSkill(c *gin.Context) {
	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("project not found")))
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("invalid id")))
		return
	}

	if err := h.svc.Delete(c.Request.Context(), project.ID, id); err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.Status(http.StatusNoContent)
}

type ListAgentSkillsReq struct {
	User     string `form:"user" json:"user" example:"alice@acontext.io"`
	Limit    int    `form:"limit,default=20" json:"limit" binding:"required,min=1,max=200" example:"20"`
	Cursor   string `form:"cursor" json:"cursor" example:"cHJvdGVjdGVkIHZlcnNpb24gdG8gYmUgZXhjbHVkZWQgaW4gcGFyc2luZyB0aGUgY3Vyc29y"`
	TimeDesc bool   `form:"time_desc,default=false" json:"time_desc" example:"false"`
}

// ListAgentSkills godoc
//
//	@Summary		List agent skills
//	@Description	List all agent skills under a project
//	@Tags			agent_skills
//	@Accept			json
//	@Produce		json
//	@Param			user		query	string	false	"User identifier to filter skills"	example(alice@acontext.io)
//	@Param			limit		query	integer	false	"Limit of agent skills to return, default 20. Max 200."
//	@Param			cursor		query	string	false	"Cursor for pagination"
//	@Param			time_desc	query	boolean	false	"Order by created_at descending if true"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=service.ListAgentSkillsOutput}
//	@Router			/agent_skills [get]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# List all skills with pagination\nresult = client.skills.list_catalog(limit=50)\nfor skill in result.items:\n    print(f\"{skill.name}: {skill.description}\")\n\n# Paginate through all skills\nif result.has_more:\n    next_page = client.skills.list_catalog(cursor=result.next_cursor)\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@anthropic/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// List all skills with pagination\nconst result = await client.skills.list_catalog({ limit: 50 });\nresult.items.forEach(skill => {\n  console.log(`${skill.name}: ${skill.description}`);\n});\n\n// Paginate through all skills\nif (result.has_more) {\n  const nextPage = await client.skills.list_catalog({ cursor: result.next_cursor });\n}\n","label":"JavaScript"}]
func (h *AgentSkillsHandler) ListAgentSkills(c *gin.Context) {
	req := ListAgentSkillsReq{}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("project not found")))
		return
	}

	out, err := h.svc.List(c.Request.Context(), service.ListAgentSkillsInput{
		ProjectID: project.ID,
		User:      req.User,
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

// GetAgentSkillFile godoc
//
//	@Summary		Get file from agent skill
//	@Description	Get file content or download URL from agent skill. If the file is text-based (parseable), returns parsed content. Otherwise, returns a presigned download URL.
//	@Tags			agent_skills
//	@Accept			json
//	@Produce		json
//	@Param			id			path	string	true	"Agent skill UUID"
//	@Param			file_path	query	string	true	"File path within the skill (e.g., 'scripts/extract_text.json')"
//	@Param			expire		query	int		false	"URL expiration in seconds for presigned URL (default 900)"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=service.GetFileOutput}
//	@Router			/agent_skills/{id}/file [get]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Get a file from a skill (text files return content, binary files return URL)\nfile_resp = client.skills.get_file(\n    skill_id='skill-uuid-here',\n    file_path='scripts/main.py',\n    expire=1800  # URL expires in 30 minutes\n)\n\nprint(f\"File: {file_resp.path} ({file_resp.mime})\")\nif file_resp.content:\n    print(f\"Content: {file_resp.content.raw}\")\nif file_resp.url:\n    print(f\"Download URL: {file_resp.url}\")\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@anthropic/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Get a file from a skill (text files return content, binary files return URL)\nconst fileResp = await client.skills.getFile({\n  skillId: 'skill-uuid-here',\n  filePath: 'scripts/main.py',\n  expire: 1800  // URL expires in 30 minutes\n});\n\nconsole.log(`File: ${fileResp.path} (${fileResp.mime})`);\nif (fileResp.content) {\n  console.log(`Content: ${fileResp.content.raw}`);\n}\nif (fileResp.url) {\n  console.log(`Download URL: ${fileResp.url}`);\n}\n","label":"JavaScript"}]
func (h *AgentSkillsHandler) GetAgentSkillFile(c *gin.Context) {
	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("project not found")))
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("invalid id")))
		return
	}

	filePath := c.Query("file_path")
	if filePath == "" {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("file_path is required")))
		return
	}

	agentSkills, err := h.svc.GetByID(c.Request.Context(), project.ID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, serializer.DBErr("", err))
		return
	}

	expire := time.Duration(900) * time.Second // default 15 minutes
	if expireStr := c.Query("expire"); expireStr != "" {
		if expireInt, err := time.ParseDuration(expireStr + "s"); err == nil {
			expire = expireInt
		}
	}

	output, err := h.svc.GetFile(c.Request.Context(), agentSkills, filePath, expire)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			c.JSON(http.StatusNotFound, serializer.DBErr("", err))
		} else {
			c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		}
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: output})
}
