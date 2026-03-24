package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/repo"
	"github.com/memodb-io/Acontext/internal/modules/serializer"
	"github.com/memodb-io/Acontext/internal/modules/service"
)

type TaskHandler struct {
	svc         service.TaskService
	sessionRepo repo.SessionRepo
}

func NewTaskHandler(s service.TaskService, sessionRepo repo.SessionRepo) *TaskHandler {
	return &TaskHandler{svc: s, sessionRepo: sessionRepo}
}

type GetTasksReq struct {
	Limit    int    `form:"limit,default=20" json:"limit" binding:"required,min=1,max=200" example:"20"`
	Cursor   string `form:"cursor" json:"cursor" example:"cHJvdGVjdGVkIHZlcnNpb24gdG8gYmUgZXhjbHVkZWQgaW4gcGFyc2luZyB0aGUgY3Vyc29y"`
	TimeDesc bool   `form:"time_desc,default=false" json:"time_desc" example:"false"`
}

// GetTasks godoc
//
//	@Summary		Get tasks from session
//	@Description	Get tasks from session with cursor-based pagination
//	@Tags			task
//	@Accept			json
//	@Produce		json
//	@Param			session_id	path	string	true	"Session ID"	format(uuid)
//	@Param			limit		query	integer	false	"Limit of tasks to return, default 20. Max 200."
//	@Param			cursor		query	string	false	"Cursor for pagination. Use the cursor from the previous response to get the next page."
//	@Param			time_desc	query	boolean	false	"Order by created_at descending if true, ascending if false (default false)"	example(false)
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=service.GetTasksOutput}
//	@Router			/session/{session_id}/task [get]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Get tasks from a session\ntasks = client.sessions.get_tasks(\n    session_id='session-uuid',\n    limit=20,\n    time_desc=False\n)\nprint(f\"Found {len(tasks.items)} tasks\")\nfor task in tasks.items:\n    print(f\"Task {task.id}: {task.status}\")\n\n# If there are more tasks, use the cursor for pagination\nif tasks.has_more:\n    next_tasks = client.sessions.get_tasks(\n        session_id='session-uuid',\n        limit=20,\n        cursor=tasks.next_cursor\n    )\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Get tasks from a session\nconst tasks = await client.sessions.getTasks('session-uuid', {\n  limit: 20,\n  timeDesc: false\n});\nconsole.log(`Found ${tasks.items.length} tasks`);\nfor (const task of tasks.items) {\n  console.log(`Task ${task.id}: ${task.status}`);\n}\n\n// If there are more tasks, use the cursor for pagination\nif (tasks.hasMore) {\n  const nextTasks = await client.sessions.getTasks('session-uuid', {\n    limit: 20,\n    cursor: tasks.nextCursor\n  });\n}\n","label":"JavaScript"}]
func (h *TaskHandler) GetTasks(c *gin.Context) {
	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("project not found")))
		return
	}

	req := GetTasksReq{}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	sessionID, err := uuid.Parse(c.Param("session_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	// Verify session belongs to the authenticated project
	session, err := h.sessionRepo.Get(c.Request.Context(), &model.Session{ID: sessionID})
	if err != nil {
		c.JSON(http.StatusNotFound, serializer.Err(http.StatusNotFound, "session not found", nil))
		return
	}
	if session.ProjectID != project.ID {
		c.JSON(http.StatusForbidden, serializer.Err(http.StatusForbidden, "access denied: session does not belong to this project", nil))
		return
	}

	out, err := h.svc.GetTasks(c.Request.Context(), service.GetTasksInput{
		SessionID: sessionID,
		Limit:     req.Limit,
		Cursor:    req.Cursor,
		TimeDesc:  req.TimeDesc,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: out})
}
