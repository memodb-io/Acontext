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
	svc service.AgentSkillsService
}

func NewAgentSkillsHandler(s service.AgentSkillsService) *AgentSkillsHandler {
	return &AgentSkillsHandler{svc: s}
}

type CreateAgentSkillsReq struct {
	Meta string `form:"meta" json:"meta" example:"{\"version\":\"1.0\"}"`
}

// CreateAgentSkills godoc
//
//	@Summary		Create agent skills
//	@Description	Upload a zip file containing agent skills and extract it to S3. The zip file must contain a SKILL.md file (case-insensitive) with YAML format containing 'name' and 'description' fields. The name and description will be extracted from SKILL.md.
//	@Tags			agent_skills
//	@Accept			multipart/form-data
//	@Produce		json
//	@Param			file	formData	file	true	"ZIP file containing agent skills. Must contain SKILL.md (case-insensitive) with YAML format: name and description fields."
//	@Param			meta	formData	string	false	"Additional metadata (JSON string)"
//	@Security		BearerAuth
//	@Success		201	{object}	serializer.Response{data=model.AgentSkills}	"Returns agent_skills with name and description extracted from SKILL.md"
//	@Router			/agent_skills [post]
func (h *AgentSkillsHandler) CreateAgentSkills(c *gin.Context) {
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

	agentSkills, err := h.svc.Create(c.Request.Context(), service.CreateAgentSkillsInput{
		ProjectID: project.ID,
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
//	@Summary		Get agent skills by ID
//	@Description	Get agent skills by its UUID
//	@Tags			agent_skills
//	@Accept			json
//	@Produce		json
//	@Param			id	path	string	true	"Agent skills UUID"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=model.AgentSkills}
//	@Router			/agent_skills/{id} [get]
func (h *AgentSkillsHandler) GetAgentSkills(c *gin.Context) {
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

// GetAgentSkillsByName godoc
//
//	@Summary		Get agent skills by name
//	@Description	Get agent skills by its name (unique within project)
//	@Tags			agent_skills
//	@Accept			json
//	@Produce		json
//	@Param			name	query	string	true	"Agent skills name"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=model.AgentSkills}
//	@Router			/agent_skills/by_name [get]
func (h *AgentSkillsHandler) GetAgentSkillsByName(c *gin.Context) {
	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("project not found")))
		return
	}

	name := c.Query("name")
	if name == "" {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("name is required")))
		return
	}

	agentSkills, err := h.svc.GetByName(c.Request.Context(), project.ID, name)
	if err != nil {
		c.JSON(http.StatusNotFound, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: agentSkills})
}

type UpdateAgentSkillsReq struct {
	Name        *string                `json:"name" example:"updated-name"`
	Description *string                `json:"description" example:"Updated description"`
	Meta        map[string]interface{} `json:"meta"`
}

// UpdateAgentSkills godoc
//
//	@Summary		Update agent skills
//	@Description	Update agent skills metadata (name, description, meta)
//	@Tags			agent_skills
//	@Accept			json
//	@Produce		json
//	@Param			id		path	string					true	"Agent skills UUID"
//	@Param			body	body	UpdateAgentSkillsReq	true	"Update request"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=model.AgentSkills}
//	@Router			/agent_skills/{id} [put]
func (h *AgentSkillsHandler) UpdateAgentSkills(c *gin.Context) {
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

	var req UpdateAgentSkillsReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	agentSkills, err := h.svc.Update(c.Request.Context(), service.UpdateAgentSkillsInput{
		ProjectID:   project.ID,
		ID:          id,
		Name:        req.Name,
		Description: req.Description,
		Meta:        req.Meta,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: agentSkills})
}

// DeleteAgentSkills godoc
//
//	@Summary		Delete agent skills
//	@Description	Delete agent skills and all extracted files from S3
//	@Tags			agent_skills
//	@Accept			json
//	@Produce		json
//	@Param			id	path	string	true	"Agent skills UUID"
//	@Security		BearerAuth
//	@Success		204	""
//	@Router			/agent_skills/{id} [delete]
func (h *AgentSkillsHandler) DeleteAgentSkills(c *gin.Context) {
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
//	@Param			limit		query	integer	false	"Limit of agent skills to return, default 20. Max 200."
//	@Param			cursor		query	string	false	"Cursor for pagination"
//	@Param			time_desc	query	boolean	false	"Order by created_at descending if true"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=service.ListAgentSkillsOutput}
//	@Router			/agent_skills [get]
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

// GetAgentSkillsFileURL godoc
//
//	@Summary		Get presigned URL for a file
//	@Description	Get a presigned URL to download a specific file from agent skills
//	@Tags			agent_skills
//	@Accept			json
//	@Produce		json
//	@Param			id			path	string	true	"Agent skills UUID"
//	@Param			file_path	query	string	true	"File path within the zip (e.g., 'github/GTM/find_trending_repos.json')"
//	@Param			expire		query	int		false	"URL expiration in seconds (default 900)"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=map[string]string}
//	@Router			/agent_skills/{id}/file [get]
func (h *AgentSkillsHandler) GetAgentSkillsFileURL(c *gin.Context) {
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

	url, err := h.svc.GetPresignedURL(c.Request.Context(), agentSkills, filePath, expire)
	if err != nil {
		c.JSON(http.StatusNotFound, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: map[string]string{"url": url}})
}
