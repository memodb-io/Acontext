package handler

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/serializer"
	"github.com/memodb-io/Acontext/internal/modules/service"
)

type TaskHandler struct {
	svc service.TaskService
}

func NewTaskHandler(s service.TaskService) *TaskHandler {
	return &TaskHandler{svc: s}
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

type UpdateTaskStatusReq struct {
	Status string `json:"status" binding:"required,oneof=success failed running pending"`
}

// UpdateTaskStatus godoc
//
//	@Summary		Update task status
//	@Description	Update a task's status. Setting status to "success" or "failed" triggers the skill learning pipeline.
//	@Tags			task
//	@Accept			json
//	@Produce		json
//	@Param			session_id	path	string					true	"Session ID"	format(uuid)
//	@Param			task_id		path	string					true	"Task ID"		format(uuid)
//	@Param			body		body	UpdateTaskStatusReq		true	"Status update"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=model.Task}
//	@Failure		400	{object}	serializer.Response
//	@Failure		404	{object}	serializer.Response
//	@Router			/session/{session_id}/task/{task_id}/status [patch]
func (h *TaskHandler) UpdateTaskStatus(c *gin.Context) {
	req := UpdateTaskStatusReq{}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid status value, must be one of: success, failed, running, pending", err))
		return
	}

	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("project not found", nil))
		return
	}

	sessionID, err := uuid.Parse(c.Param("session_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid session_id", err))
		return
	}

	taskID, err := uuid.Parse(c.Param("task_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid task_id", err))
		return
	}

	task, err := h.svc.UpdateTaskStatus(c.Request.Context(), service.UpdateTaskStatusInput{
		ProjectID: project.ID,
		SessionID: sessionID,
		TaskID:    taskID,
		Status:    req.Status,
	})
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			c.JSON(http.StatusNotFound, serializer.Err(http.StatusNotFound, err.Error(), nil))
			return
		}
		c.JSON(http.StatusBadRequest, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: task})
}
