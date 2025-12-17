package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/memodb-io/Acontext/internal/modules/service"
)

// MessageObservingHandler handles HTTP requests for message observing status
type MessageObservingHandler struct {
	svc service.MessageObservingService
}

// NewMessageObservingHandler creates a new message observing handler
func NewMessageObservingHandler(svc service.MessageObservingService) *MessageObservingHandler {
	if svc == nil {
		panic("message observing service cannot be nil")
	}
	return &MessageObservingHandler{
		svc: svc,
	}
}

// GetSessionObservingStatus handles GET /api/v1/sessions/:session_id/observing-status
//
// @Summary Get message observing status for a session
// @Description Returns the count of observed, in_process, and pending messages
// @Tags sessions
// @Accept json
// @Produce json
// @Param session_id path string true "Session ID" format(uuid)
// @Success 200 {object} model.MessageObservingStatus
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/sessions/{session_id}/observing-status [get]
func (h *MessageObservingHandler) GetSessionObservingStatus(c *gin.Context) {
	// Extract session_id from URL path
	sessionID := c.Param("session_id")

	// Validate session ID
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "session_id is required",
		})
		return
	}

	// Call service
	status, err := h.svc.GetSessionObservingStatus(c.Request.Context(), sessionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	// Return success response
	c.JSON(http.StatusOK, status)
}
