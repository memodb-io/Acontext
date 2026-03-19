package handler

import (
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/serializer"
	"github.com/memodb-io/Acontext/internal/modules/service"
)

type AdminHandler struct {
	projectSvc service.ProjectService
}

func NewAdminHandler(projectSvc service.ProjectService) *AdminHandler {
	return &AdminHandler{
		projectSvc: projectSvc,
	}
}

type CreateProjectReq struct {
	Configs map[string]interface{} `json:"configs,omitempty"`
}

// CreateProject godoc
//
//	@Summary		Create a new project
//	@Description	Create a new project with a randomly generated secret key
//	@Tags			admin
//	@Accept			json
//	@Produce		json
//	@Param			body	body		CreateProjectReq	false	"Project configuration"
//	@Success		200		{object}	serializer.Response{data=service.CreateProjectOutput}
//	@Failure		400		{object}	serializer.Response
//	@Failure		500		{object}	serializer.Response
//	@Router			/admin/v1/project [post]
func (h *AdminHandler) CreateProject(c *gin.Context) {
	var req CreateProjectReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	// Set default value to empty map if configs is nil
	if req.Configs == nil {
		req.Configs = make(map[string]interface{})
	}

	output, err := h.projectSvc.Create(c.Request.Context(), req.Configs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: output})
}

// DeleteProject godoc
//
//	@Summary		Delete a project
//	@Description	Delete a project by ID
//	@Tags			admin
//	@Accept			json
//	@Produce		json
//	@Param			project_id	path		string	true	"Project ID"	format(uuid)
//	@Success		200			{object}	serializer.Response
//	@Failure		400			{object}	serializer.Response
//	@Failure		500			{object}	serializer.Response
//	@Router			/admin/v1/project/{project_id} [delete]
func (h *AdminHandler) DeleteProject(c *gin.Context) {
	projectIDStr := c.Param("project_id")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid project id", err))
		return
	}

	if err := h.projectSvc.Delete(c.Request.Context(), projectID); err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Msg: "project deleted"})
}

// UpdateProjectSecretKey godoc
//
//	@Summary		Update project secret key
//	@Description	Generate a new secret key for a project
//	@Tags			admin
//	@Accept			json
//	@Produce		json
//	@Param			project_id	path		string	true	"Project ID"	format(uuid)
//	@Success		200			{object}	serializer.Response{data=service.UpdateSecretKeyOutput}
//	@Failure		400			{object}	serializer.Response
//	@Failure		500			{object}	serializer.Response
//	@Router			/admin/v1/project/{project_id}/secret_key [put]
func (h *AdminHandler) UpdateProjectSecretKey(c *gin.Context) {
	projectIDStr := c.Param("project_id")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid project id", err))
		return
	}

	output, err := h.projectSvc.UpdateSecretKey(c.Request.Context(), projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: output})
}

// AnalyzeProjectUsages godoc
//
//	@Summary		Analyze project usages
//	@Description	Get usage analytics for a project
//	@Tags			admin
//	@Accept			json
//	@Produce		json
//	@Param			project_id		path		string	true	"Project ID"								format(uuid)
//	@Param			interval_days	query		int		false	"Number of days to analyze (default: 30)"	default(30)
//	@Param			fields			query		string	false	"Comma-separated list of fields to fetch (empty = all)"
//	@Success		200				{object}	serializer.Response
//	@Router			/admin/v1/project/{project_id}/usages [get]
func (h *AdminHandler) AnalyzeProjectUsages(c *gin.Context) {
	projectIDStr := c.Param("project_id")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid project id", err))
		return
	}

	// Get interval_days from query parameter, default to 30
	intervalDaysStr := c.DefaultQuery("interval_days", "30")
	intervalDays, err := strconv.Atoi(intervalDaysStr)
	if err != nil || intervalDays <= 0 {
		intervalDays = 30
	}

	// Parse fields query parameter
	var fields []string
	if fieldsStr := c.Query("fields"); fieldsStr != "" {
		for _, f := range strings.Split(fieldsStr, ",") {
			if trimmed := strings.TrimSpace(f); trimmed != "" {
				fields = append(fields, trimmed)
			}
		}
	}

	output, err := h.projectSvc.AnalyzeUsages(c.Request.Context(), projectID, intervalDays, fields)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: output})
}

// AnalyzeProjectStatistics godoc
//
//	@Summary		Analyze project statistics
//	@Description	Get statistics for a project
//	@Tags			admin
//	@Accept			json
//	@Produce		json
//	@Param			project_id	path		string	true	"Project ID"	format(uuid)
//	@Success		200			{object}	serializer.Response
//	@Router			/admin/v1/project/{project_id}/statistics [get]
func (h *AdminHandler) AnalyzeProjectStatistics(c *gin.Context) {
	projectIDStr := c.Param("project_id")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid project id", err))
		return
	}

	output, err := h.projectSvc.AnalyzeStatistics(c.Request.Context(), projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("", err))
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Data: output})
}

// AnalyzeProjectMetrics godoc
//
//	@Summary		Analyze project metrics
//	@Description	Get metrics for a project by querying Jaeger API with project_id filter
//	@Tags			admin
//	@Accept			json
//	@Produce		json
//	@Param			project_id	path		string	true	"Project ID"	format(uuid)
//	@Success		200			{object}	serializer.Response
//	@Router			/admin/v1/project/{project_id}/metrics [get]
func (h *AdminHandler) AnalyzeProjectMetrics(c *gin.Context) {
	projectIDStr := c.Param("project_id")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid project id", err))
		return
	}

	resp, err := h.projectSvc.AnalyzeMetrics(
		c.Request.Context(),
		projectID,
		c.Request.URL.String(),
		c.Request.Method,
		c.Request.Header,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("failed to query Jaeger", err))
		return
	}
	defer resp.Body.Close()

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("failed to read response", err))
		return
	}

	// Only forward safe response headers from Jaeger
	safeHeaders := map[string]bool{
		"Content-Type":     true,
		"Content-Encoding": true,
	}
	for key, values := range resp.Header {
		if safeHeaders[http.CanonicalHeaderKey(key)] {
			for _, value := range values {
				c.Header(key, value)
			}
		}
	}

	// Return the response from Jaeger
	c.Data(resp.StatusCode, resp.Header.Get("Content-Type"), body)
}
