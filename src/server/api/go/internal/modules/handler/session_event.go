package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/serializer"
	"github.com/memodb-io/Acontext/internal/modules/service"
)

type SessionEventHandler struct {
	svc service.SessionEventService
}

func NewSessionEventHandler(svc service.SessionEventService) *SessionEventHandler {
	return &SessionEventHandler{svc: svc}
}

type AddEventReq struct {
	Type string          `json:"type" binding:"required"`
	Data json.RawMessage `json:"data" binding:"required"`
}

type GetEventsReq struct {
	Limit    int    `form:"limit,default=50" json:"limit" binding:"min=1,max=200" example:"50"`
	Cursor   string `form:"cursor" json:"cursor"`
	TimeDesc bool   `form:"time_desc,default=false" json:"time_desc" example:"false"`
}

// AddEvent godoc
//
//	@Summary		Add event to session
//	@Description	Add a structured event to a session. Events are stored alongside messages and can be retrieved chronologically.
//	@Tags			session
//	@Accept			json
//	@Produce		json
//	@Param			session_id	path	string				true	"Session ID"	format(uuid)
//	@Param			payload		body	handler.AddEventReq	true	"AddEvent payload"
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=model.SessionEvent}
//	@Failure		400	{object}	serializer.Response	"Invalid request"
//	@Failure		404	{object}	serializer.Response	"Session not found"
//	@Router			/session/{session_id}/events [post]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\nfrom acontext.event import DiskEvent, TextEvent\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Add a disk event\nclient.sessions.add_event(session_id, DiskEvent(disk_id='xxxx', path='/data/report.csv', note='Uploaded report'))\n\n# Add a text event\nclient.sessions.add_event(session_id, TextEvent(text='User switched to dark mode'))\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient, DiskEvent, TextEvent } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Add a disk event\nawait client.sessions.addEvent(sessionId, new DiskEvent({ diskId: 'xxxx', path: '/data/report.csv', note: 'Uploaded report' }));\n\n// Add a text event\nawait client.sessions.addEvent(sessionId, new TextEvent({ text: 'User switched to dark mode' }));\n","label":"JavaScript"}]
func (h *SessionEventHandler) AddEvent(c *gin.Context) {
	sessionID, err := uuid.Parse(c.Param("session_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid session_id", err))
		return
	}

	req := AddEventReq{}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("project not found")))
		return
	}

	event, err := h.svc.AddEvent(c.Request.Context(), service.AddEventInput{
		ProjectID: project.ID,
		SessionID: sessionID,
		Type:      req.Type,
		Data:      req.Data,
	})
	if err != nil {
		if err.Error() == "session not found" {
			c.JSON(http.StatusNotFound, serializer.Err(http.StatusNotFound, "session not found", nil))
			return
		}
		c.JSON(http.StatusBadRequest, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: event})
}

// GetEvents godoc
//
//	@Summary		Get events for session
//	@Description	Get events for a session with cursor-based pagination.
//	@Tags			session
//	@Accept			json
//	@Produce		json
//	@Param			session_id	path	string	true	"Session ID"	format(uuid)
//	@Param			limit		query	integer	false	"Limit of events to return, default 50. Max 200."
//	@Param			cursor		query	string	false	"Cursor for pagination."
//	@Param			time_desc	query	boolean	false	"Order by created_at descending if true, ascending if false (default false)"	example(false)
//	@Security		BearerAuth
//	@Success		200	{object}	serializer.Response{data=service.ListEventsOutput}
//	@Router			/session/{session_id}/events [get]
//	@x-code-samples	[{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# Get events for a session\nevents = client.sessions.get_events(session_id, limit=50)\nfor event in events.items:\n    print(f\"{event.type}: {event.data}\")\n","label":"Python"},{"lang":"javascript","source":"import { AcontextClient } from '@acontext/acontext';\n\nconst client = new AcontextClient({ apiKey: 'sk_project_token' });\n\n// Get events for a session\nconst events = await client.sessions.getEvents(sessionId, { limit: 50 });\nfor (const event of events.items) {\n  console.log(`${event.type}: ${JSON.stringify(event.data)}`);\n}\n","label":"JavaScript"}]
func (h *SessionEventHandler) GetEvents(c *gin.Context) {
	sessionID, err := uuid.Parse(c.Param("session_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid session_id", err))
		return
	}

	req := GetEventsReq{}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", errors.New("project not found")))
		return
	}

	out, err := h.svc.ListEvents(c.Request.Context(), service.ListEventsInput{
		ProjectID: project.ID,
		SessionID: sessionID,
		Limit:     req.Limit,
		Cursor:    req.Cursor,
		TimeDesc:  req.TimeDesc,
	})
	if err != nil {
		if err.Error() == "session not found" {
			c.JSON(http.StatusNotFound, serializer.Err(http.StatusNotFound, "session not found", nil))
			return
		}
		c.JSON(http.StatusBadRequest, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: out})
}
