package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/serializer"
	"github.com/memodb-io/Acontext/internal/modules/service"
)

type LearningSpaceHandler struct {
	svc     service.LearningSpaceService
	userSvc service.UserService
}

func NewLearningSpaceHandler(svc service.LearningSpaceService, userSvc service.UserService) *LearningSpaceHandler {
	return &LearningSpaceHandler{svc: svc, userSvc: userSvc}
}

// ---------------------------------------------------------------------------
// Request structs
// ---------------------------------------------------------------------------

type CreateLearningSpaceReq struct {
	User string                 `json:"user" example:"alice@acontext.io"`
	Meta map[string]interface{} `json:"meta" swaggertype:"object"`
}

type ListLearningSpacesReq struct {
	User         string `form:"user" json:"user" example:"alice@acontext.io"`
	Limit        int    `form:"limit,default=20" json:"limit" binding:"min=1,max=200" example:"20"`
	Cursor       string `form:"cursor" json:"cursor"`
	TimeDesc     bool   `form:"time_desc,default=false" json:"time_desc" example:"false"`
	FilterByMeta string `form:"filter_by_meta" json:"filter_by_meta" example:"{\"version\":\"1.0\"}"`
}

type UpdateLearningSpaceReq struct {
	Meta map[string]interface{} `json:"meta" binding:"required" swaggertype:"object"`
}

type LearnReq struct {
	SessionID string `json:"session_id" binding:"required" example:"session-uuid"`
}

type IncludeSkillReq struct {
	SkillID string `json:"skill_id" binding:"required" example:"skill-uuid"`
}

// ---------------------------------------------------------------------------
// Error helper
// ---------------------------------------------------------------------------

func (h *LearningSpaceHandler) handleErr(c *gin.Context, err error) {
	msg := err.Error()
	if strings.Contains(msg, "not found") {
		c.JSON(http.StatusNotFound, serializer.Err(http.StatusNotFound, msg, nil))
		return
	}
	if strings.Contains(msg, "already") {
		c.JSON(http.StatusConflict, serializer.Err(http.StatusConflict, msg, nil))
		return
	}
	c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

// Create godoc
//
//	@Summary		Create learning space
//	@Description	Create a new learning space. Optionally associate with a user.
//	@Tags			learning_spaces
//	@Accept			json
//	@Produce		json
//	@Param			request	body	handler.CreateLearningSpaceReq	true	"Create learning space request"
//	@Security		BearerAuth
//	@Success		201	{object}	serializer.Response{data=model.LearningSpace}
//	@Router			/learning_spaces [post]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Create a learning space\nspace = client.learning_spaces.create(\n    user='alice@acontext.io',\n    meta={'version': '1.0'}\n)\nprint(f\"Created space: {space.id}\")\n\n# Create a learning space without a user\nspace = client.learning_spaces.create()\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Create a learning space\nconst space = await client.learningSpaces.create({\n  user: 'alice@acontext.io',\n  meta: { version: '1.0' }\n});\nconsole.log(`Created space: ${space.id}`);\n\n// Create a learning space without a user\nconst space2 = await client.learningSpaces.create();\n","label":"JavaScript"}]
func (h *LearningSpaceHandler) Create(c *gin.Context) {
	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("project not found")))
		return
	}

	var req CreateLearningSpaceReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	// Resolve user if provided
	var userID *uuid.UUID
	if req.User != "" {
		user, err := h.userSvc.GetOrCreate(c.Request.Context(), project.ID, req.User)
		if err != nil {
			c.JSON(http.StatusInternalServerError, serializer.DBErr("failed to get or create user", err))
			return
		}
		userID = &user.ID
	}

	ls, err := h.svc.Create(c.Request.Context(), service.CreateLearningSpaceInput{
		ProjectID: project.ID,
		UserID:    userID,
		Meta:      req.Meta,
	})
	if err != nil {
		h.handleErr(c, err)
		return
	}

	c.JSON(http.StatusCreated, serializer.Response{Data: ls})
}

// List godoc
//
//	@Summary		List learning spaces
//	@Description	List learning spaces with optional user, meta filter, and cursor pagination.
//	@Tags			learning_spaces
//	@Accept			json
//	@Produce		json
//	@Param			user			query	string	false	"Filter by user identifier"
//	@Param			limit			query	integer	false	"Limit per page, default 20, max 200"
//	@Param			cursor			query	string	false	"Cursor for pagination"
//	@Param			time_desc		query	boolean	false	"Order by created_at descending"
//	@Param			filter_by_meta	query	string	false	"URL-encoded JSON for JSONB containment filter"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=service.ListLearningSpacesOutput}
//	@Router			/learning_spaces [get]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# List learning spaces\nresult = client.learning_spaces.list(limit=20, time_desc=True)\nfor space in result.items:\n    print(f\"{space.id}: {space.meta}\")\n\n# List with user filter\nresult = client.learning_spaces.list(user='alice@acontext.io')\n\n# List with meta filter\nresult = client.learning_spaces.list(\n    filter_by_meta={'version': '1.0'}\n)\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// List learning spaces\nconst result = await client.learningSpaces.list({ limit: 20, timeDesc: true });\nfor (const space of result.items) {\n  console.log(`${space.id}: ${JSON.stringify(space.meta)}`);\n}\n\n// List with user filter\nconst userSpaces = await client.learningSpaces.list({ user: 'alice@acontext.io' });\n\n// List with meta filter\nconst filtered = await client.learningSpaces.list({\n  filterByMeta: { version: '1.0' }\n});\n","label":"JavaScript"}]
func (h *LearningSpaceHandler) List(c *gin.Context) {
	var req ListLearningSpacesReq
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("project not found")))
		return
	}

	// Parse filter_by_meta from JSON string
	var filterByMeta map[string]interface{}
	if req.FilterByMeta != "" {
		if err := json.Unmarshal([]byte(req.FilterByMeta), &filterByMeta); err != nil {
			c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid filter_by_meta JSON", err))
			return
		}
	}

	out, err := h.svc.List(c.Request.Context(), service.ListLearningSpacesInput{
		ProjectID:    project.ID,
		User:         req.User,
		FilterByMeta: filterByMeta,
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

// Get godoc
//
//	@Summary		Get learning space
//	@Description	Get a learning space by ID.
//	@Tags			learning_spaces
//	@Accept			json
//	@Produce		json
//	@Param			id	path	string	true	"Learning space UUID"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=model.LearningSpace}
//	@Router			/learning_spaces/{id} [get]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Get a learning space by ID\nspace = client.learning_spaces.get('space-uuid')\nprint(f\"Space: {space.id}\")\nprint(f\"Meta: {space.meta}\")\nprint(f\"Created at: {space.created_at}\")\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Get a learning space by ID\nconst space = await client.learningSpaces.get('space-uuid');\nconsole.log(`Space: ${space.id}`);\nconsole.log(`Meta: ${JSON.stringify(space.meta)}`);\nconsole.log(`Created at: ${space.created_at}`);\n","label":"JavaScript"}]
func (h *LearningSpaceHandler) Get(c *gin.Context) {
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

	ls, err := h.svc.GetByID(c.Request.Context(), project.ID, id)
	if err != nil {
		h.handleErr(c, err)
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: ls})
}

// Update godoc
//
//	@Summary		Update learning space (patch meta)
//	@Description	Merge provided meta into existing meta. Existing keys not in the request are preserved.
//	@Tags			learning_spaces
//	@Accept			json
//	@Produce		json
//	@Param			id		path	string							true	"Learning space UUID"
//	@Param			request	body	handler.UpdateLearningSpaceReq	true	"Patch meta request"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=model.LearningSpace}
//	@Router			/learning_spaces/{id} [patch]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Update a learning space's meta (patch semantics)\nspace = client.learning_spaces.update(\n    'space-uuid',\n    meta={'version': '2.0', 'environment': 'production'}\n)\nprint(f\"Updated meta: {space.meta}\")\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Update a learning space's meta (patch semantics)\nconst space = await client.learningSpaces.update('space-uuid', {\n  meta: { version: '2.0', environment: 'production' }\n});\nconsole.log(`Updated meta: ${JSON.stringify(space.meta)}`);\n","label":"JavaScript"}]
func (h *LearningSpaceHandler) Update(c *gin.Context) {
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

	var req UpdateLearningSpaceReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	ls, err := h.svc.Update(c.Request.Context(), service.UpdateLearningSpaceInput{
		ProjectID: project.ID,
		ID:        id,
		Meta:      req.Meta,
	})
	if err != nil {
		h.handleErr(c, err)
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: ls})
}

// Delete godoc
//
//	@Summary		Delete learning space
//	@Description	Delete a learning space. Junction records are cascade-deleted by the DB.
//	@Tags			learning_spaces
//	@Accept			json
//	@Produce		json
//	@Param			id	path	string	true	"Learning space UUID"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response
//	@Router			/learning_spaces/{id} [delete]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Delete a learning space\nclient.learning_spaces.delete('space-uuid')\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Delete a learning space\nawait client.learningSpaces.delete('space-uuid');\n","label":"JavaScript"}]
func (h *LearningSpaceHandler) Delete(c *gin.Context) {
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
		h.handleErr(c, err)
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Msg: "ok"})
}

// Learn godoc
//
//	@Summary		Learn from session
//	@Description	Create an async learning record from a session. Initially stays in pending status.
//	@Tags			learning_spaces
//	@Accept			json
//	@Produce		json
//	@Param			id		path	string				true	"Learning space UUID"
//	@Param			request	body	handler.LearnReq	true	"Learn request"
//	@Security		BearerAuth
//	@Success		201	{object}	serializer.Response{data=model.LearningSpaceSession}
//	@Failure		404	{object}	serializer.Response
//	@Failure		409	{object}	serializer.Response
//	@Router			/learning_spaces/{id}/learn [post]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Learn from a session\nrecord = client.learning_spaces.learn(\n    'space-uuid',\n    session_id='session-uuid'\n)\nprint(f\"Learning record: {record.id}, status: {record.status}\")\n\n# Wait for learning to complete\nresult = client.learning_spaces.wait_for_learning(\n    'space-uuid',\n    session_id='session-uuid',\n    timeout=120.0\n)\nprint(f\"Final status: {result.status}\")\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Learn from a session\nconst record = await client.learningSpaces.learn({\n  spaceId: 'space-uuid',\n  sessionId: 'session-uuid'\n});\nconsole.log(`Learning record: ${record.id}, status: ${record.status}`);\n\n// Wait for learning to complete\nconst result = await client.learningSpaces.waitForLearning({\n  spaceId: 'space-uuid',\n  sessionId: 'session-uuid',\n  timeout: 120\n});\nconsole.log(`Final status: ${result.status}`);\n","label":"JavaScript"}]
func (h *LearningSpaceHandler) Learn(c *gin.Context) {
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

	var req LearnReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	sessionID, err := uuid.Parse(req.SessionID)
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("invalid session_id")))
		return
	}

	record, err := h.svc.Learn(c.Request.Context(), service.LearnInput{
		ProjectID:       project.ID,
		LearningSpaceID: id,
		SessionID:       sessionID,
	})
	if err != nil {
		h.handleErr(c, err)
		return
	}

	c.JSON(http.StatusCreated, serializer.Response{Data: record})
}

// IncludeSkill godoc
//
//	@Summary		Include skill in space
//	@Description	Add a skill to a learning space.
//	@Tags			learning_spaces
//	@Accept			json
//	@Produce		json
//	@Param			id		path	string					true	"Learning space UUID"
//	@Param			request	body	handler.IncludeSkillReq	true	"Include skill request"
//	@Security		BearerAuth
//	@Success		201	{object}	serializer.Response{data=model.LearningSpaceSkill}
//	@Failure		404	{object}	serializer.Response
//	@Failure		409	{object}	serializer.Response
//	@Router			/learning_spaces/{id}/skills [post]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Include a skill in a learning space\nrecord = client.learning_spaces.include_skill(\n    'space-uuid',\n    skill_id='skill-uuid'\n)\nprint(f\"Linked skill {record.skill_id} to space {record.learning_space_id}\")\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Include a skill in a learning space\nconst record = await client.learningSpaces.includeSkill({\n  spaceId: 'space-uuid',\n  skillId: 'skill-uuid'\n});\nconsole.log(`Linked skill ${record.skill_id} to space ${record.learning_space_id}`);\n","label":"JavaScript"}]
func (h *LearningSpaceHandler) IncludeSkill(c *gin.Context) {
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

	var req IncludeSkillReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	skillID, err := uuid.Parse(req.SkillID)
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("invalid skill_id")))
		return
	}

	record, err := h.svc.IncludeSkill(c.Request.Context(), service.IncludeSkillInput{
		ProjectID:       project.ID,
		LearningSpaceID: id,
		SkillID:         skillID,
	})
	if err != nil {
		h.handleErr(c, err)
		return
	}

	c.JSON(http.StatusCreated, serializer.Response{Data: record})
}

// ListSkills godoc
//
//	@Summary		List skills in space
//	@Description	List all skills associated with a learning space. Returns full skill data.
//	@Tags			learning_spaces
//	@Accept			json
//	@Produce		json
//	@Param			id	path	string	true	"Learning space UUID"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=[]model.AgentSkills}
//	@Router			/learning_spaces/{id}/skills [get]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# List all skills in a learning space\nskills = client.learning_spaces.list_skills('space-uuid')\nfor skill in skills:\n    print(f\"{skill.name}: {skill.description}\")\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// List all skills in a learning space\nconst skills = await client.learningSpaces.listSkills('space-uuid');\nfor (const skill of skills) {\n  console.log(`${skill.name}: ${skill.description}`);\n}\n","label":"JavaScript"}]
func (h *LearningSpaceHandler) ListSkills(c *gin.Context) {
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

	skills, err := h.svc.ListSkills(c.Request.Context(), project.ID, id)
	if err != nil {
		h.handleErr(c, err)
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: skills})
}

// ExcludeSkill godoc
//
//	@Summary		Exclude skill from space
//	@Description	Remove a skill from a learning space. Idempotent — silently succeeds if not associated.
//	@Tags			learning_spaces
//	@Accept			json
//	@Produce		json
//	@Param			id			path	string	true	"Learning space UUID"
//	@Param			skill_id	path	string	true	"Skill UUID"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response
//	@Router			/learning_spaces/{id}/skills/{skill_id} [delete]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Exclude a skill from a learning space (idempotent)\nclient.learning_spaces.exclude_skill(\n    'space-uuid',\n    skill_id='skill-uuid'\n)\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Exclude a skill from a learning space (idempotent)\nawait client.learningSpaces.excludeSkill({\n  spaceId: 'space-uuid',\n  skillId: 'skill-uuid'\n});\n","label":"JavaScript"}]
func (h *LearningSpaceHandler) ExcludeSkill(c *gin.Context) {
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

	skillID, err := uuid.Parse(c.Param("skill_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("invalid skill_id")))
		return
	}

	if err := h.svc.ExcludeSkill(c.Request.Context(), project.ID, id, skillID); err != nil {
		h.handleErr(c, err)
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Msg: "ok"})
}

// GetSession godoc
//
//	@Summary		Get session in space
//	@Description	Get a single learning session record by session ID within a learning space.
//	@Tags			learning_spaces
//	@Accept			json
//	@Produce		json
//	@Param			id			path	string	true	"Learning space UUID"
//	@Param			session_id	path	string	true	"Session UUID"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=model.LearningSpaceSession}
//	@Failure		400	{object}	serializer.Response
//	@Failure		404	{object}	serializer.Response
//	@Router			/learning_spaces/{id}/sessions/{session_id} [get]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Get a learning session record\nsession = client.learning_spaces.get_session(\n    'space-uuid',\n    session_id='session-uuid'\n)\nprint(f\"Session {session.session_id}: {session.status}\")\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Get a learning session record\nconst session = await client.learningSpaces.getSession({\n  spaceId: 'space-uuid',\n  sessionId: 'session-uuid'\n});\nconsole.log(`Session ${session.session_id}: ${session.status}`);\n","label":"JavaScript"}]
func (h *LearningSpaceHandler) GetSession(c *gin.Context) {
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

	sessionID, err := uuid.Parse(c.Param("session_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("invalid session_id")))
		return
	}

	session, err := h.svc.GetSession(c.Request.Context(), project.ID, id, sessionID)
	if err != nil {
		h.handleErr(c, err)
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: session})
}

// ListSessions godoc
//
//	@Summary		List sessions in space
//	@Description	List all learning session records for a space, including their processing status.
//	@Tags			learning_spaces
//	@Accept			json
//	@Produce		json
//	@Param			id	path	string	true	"Learning space UUID"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=[]model.LearningSpaceSession}
//	@Router			/learning_spaces/{id}/sessions [get]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# List all learning sessions in a space\nsessions = client.learning_spaces.list_sessions('space-uuid')\nfor s in sessions:\n    print(f\"Session {s.session_id}: {s.status}\")\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// List all learning sessions in a space\nconst sessions = await client.learningSpaces.listSessions('space-uuid');\nfor (const s of sessions) {\n  console.log(`Session ${s.session_id}: ${s.status}`);\n}\n","label":"JavaScript"}]
func (h *LearningSpaceHandler) ListSessions(c *gin.Context) {
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

	sessions, err := h.svc.ListSessions(c.Request.Context(), project.ID, id)
	if err != nil {
		h.handleErr(c, err)
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: sessions})
}
