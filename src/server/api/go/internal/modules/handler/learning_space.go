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
//	@Tags			LearningSpaces
//	@Accept			json
//	@Produce		json
//	@Param			request	body	handler.CreateLearningSpaceReq	true	"Create learning space request"
//	@Security		BearerAuth
//	@Success		201	{object}	serializer.Response{data=model.LearningSpace}
//	@Router			/learning_spaces [post]
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
//	@Tags			LearningSpaces
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
//	@Tags			LearningSpaces
//	@Accept			json
//	@Produce		json
//	@Param			id	path	string	true	"Learning space UUID"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=model.LearningSpace}
//	@Router			/learning_spaces/{id} [get]
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
//	@Tags			LearningSpaces
//	@Accept			json
//	@Produce		json
//	@Param			id		path	string							true	"Learning space UUID"
//	@Param			request	body	handler.UpdateLearningSpaceReq	true	"Patch meta request"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=model.LearningSpace}
//	@Router			/learning_spaces/{id} [patch]
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
//	@Tags			LearningSpaces
//	@Accept			json
//	@Produce		json
//	@Param			id	path	string	true	"Learning space UUID"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response
//	@Router			/learning_spaces/{id} [delete]
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
//	@Tags			LearningSpaces
//	@Accept			json
//	@Produce		json
//	@Param			id		path	string				true	"Learning space UUID"
//	@Param			request	body	handler.LearnReq	true	"Learn request"
//	@Security		BearerAuth
//	@Success		201	{object}	serializer.Response{data=model.LearningSpaceSession}
//	@Failure		404	{object}	serializer.Response
//	@Failure		409	{object}	serializer.Response
//	@Router			/learning_spaces/{id}/learn [post]
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
//	@Tags			LearningSpaces
//	@Accept			json
//	@Produce		json
//	@Param			id		path	string					true	"Learning space UUID"
//	@Param			request	body	handler.IncludeSkillReq	true	"Include skill request"
//	@Security		BearerAuth
//	@Success		201	{object}	serializer.Response{data=model.LearningSpaceSkill}
//	@Failure		404	{object}	serializer.Response
//	@Failure		409	{object}	serializer.Response
//	@Router			/learning_spaces/{id}/skills [post]
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
//	@Tags			LearningSpaces
//	@Accept			json
//	@Produce		json
//	@Param			id	path	string	true	"Learning space UUID"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=[]model.AgentSkills}
//	@Router			/learning_spaces/{id}/skills [get]
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
//	@Tags			LearningSpaces
//	@Accept			json
//	@Produce		json
//	@Param			id			path	string	true	"Learning space UUID"
//	@Param			skill_id	path	string	true	"Skill UUID"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response
//	@Router			/learning_spaces/{id}/skills/{skill_id} [delete]
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

// ListSessions godoc
//
//	@Summary		List sessions in space
//	@Description	List all learning session records for a space, including their processing status.
//	@Tags			LearningSpaces
//	@Accept			json
//	@Produce		json
//	@Param			id	path	string	true	"Learning space UUID"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=[]model.LearningSpaceSession}
//	@Router			/learning_spaces/{id}/sessions [get]
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
