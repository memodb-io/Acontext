package handler

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/bytedance/sonic"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/config"
	"github.com/memodb-io/Acontext/internal/modules/serializer"
	"github.com/memodb-io/Acontext/internal/modules/service"
	"github.com/redis/go-redis/v9"
)

type MetricsHandler struct {
	svc    service.MetricService
	redis  *redis.Client
	cfg    *config.Config
	client *http.Client
}

func NewMetricsHandler(s service.MetricService, rdb *redis.Client, cfg *config.Config) *MetricsHandler {
	return &MetricsHandler{
		svc:    s,
		redis:  rdb,
		cfg:    cfg,
		client: &http.Client{Timeout: 30 * time.Second},
	}
}

type PushMetricsResponse struct {
	Quota []service.QuotaItem `json:"quota"`
}

// PushMetrics godoc
//
//	@Summary		Push metrics to external API
//	@Description	Create storage metrics, fetch metrics, push to external API, and store quota status in Redis
//	@Tags			metrics
//	@Accept			json
//	@Produce		json
//	@Success		200	{object}	serializer.Response
//	@Failure		400	{object}	serializer.Response
//	@Failure		429	{object}	serializer.Response
//	@Failure		500	{object}	serializer.Response
//	@Router			/metrics/v1 [post]
func (h *MetricsHandler) PushMetrics(c *gin.Context) {
	ctx := c.Request.Context()
	now := time.Now().UTC()
	to := now

	// Check last request time from Redis
	var from time.Time
	lastRequestStr, err := h.redis.Get(ctx, h.cfg.Metrics.PushLastRequestKey).Result()
	switch err {
	case nil:
		// Parse last request time
		lastRequest, parseErr := time.Parse(time.RFC3339, lastRequestStr)
		if parseErr == nil {
			// Rate limiting: if within 1 minute, return error
			if now.Sub(lastRequest) < time.Minute {
				c.JSON(http.StatusTooManyRequests, serializer.ParamErr("request too frequent, please try again later", nil))
				return
			}
			from = lastRequest
		} else {
			from = to.Add(-1 * time.Hour)
		}
	case redis.Nil:
		// Key not found, use default
		from = to.Add(-1 * time.Hour)
	default:
		// Redis error
		c.JSON(http.StatusInternalServerError, serializer.DBErr("failed to read from Redis", err))
		return
	}

	// Step 1: Create storage usage metrics
	_, err = h.svc.CreateStorageUsageMetrics(ctx, service.CreateStorageUsageMetricsInput{
		From: from,
		To:   to,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("failed to create storage usage metrics", err))
		return
	}

	// Step 2: Get metrics (with +10 minutes to include newly created ones)
	toWithBuffer := to.Add(10 * time.Minute)
	metricsOut, err := h.svc.GetMetrics(ctx, service.GetMetricsInput{
		From: from,
		To:   toWithBuffer,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("failed to get metrics", err))
		return
	}

	if len(metricsOut.Metrics) == 0 {
		c.JSON(http.StatusOK, serializer.Response{Msg: "no metrics to push"})
		return
	}

	// Step 3: POST metrics to external API
	reqBody, err := sonic.Marshal(metricsOut)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("failed to marshal metrics", err))
		return
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, h.cfg.Metrics.PushURL, bytes.NewReader(reqBody))
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("failed to create request", err))
		return
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", h.cfg.Root.ApiBearerToken))

	resp, err := h.client.Do(httpReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("failed to call external API", err))
		return
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("failed to read response", err))
		return
	}

	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusInternalServerError, serializer.DBErr(fmt.Sprintf("external API returned status %d: %s", resp.StatusCode, string(respBody)), nil))
		return
	}

	// Step 4: Parse response and process quota items
	var pushResp PushMetricsResponse
	if err := sonic.Unmarshal(respBody, &pushResp); err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("failed to unmarshal response", err))
		return
	}

	// Process quota items via service (handles both Redis and DB operations)
	if err := h.svc.ProcessQuotaItems(ctx, pushResp.Quota); err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("failed to process quota items", err))
		return
	}

	// Store current request time in Redis
	_ = h.redis.Set(ctx, h.cfg.Metrics.PushLastRequestKey, now.Format(time.RFC3339), 0).Err()

	c.JSON(http.StatusOK, serializer.Response{Msg: "metrics pushed successfully"})
}

type GetProjectQuotaReq struct {
	Path   string `form:"path" json:"path" binding:"required" example:"/api/example"`
	Method string `form:"method" json:"method" binding:"required" example:"GET"`
}

// GetProjectQuota godoc
//
//	@Summary		Get project quota
//	@Description	Get quota information for a project based on path and method
//	@Tags			metrics
//	@Accept			json
//	@Produce		json
//	@Param			project_id	path		string	true	"Project ID"
//	@Param			path		query		string	true	"Path"
//	@Param			method		query		string	true	"Method"
//	@Success		200			{object}	serializer.Response
//	@Failure		400			{object}	serializer.Response
//	@Router			/metrics/v1/:project_id/quota [get]
func (h *MetricsHandler) GetProjectQuota(c *gin.Context) {
	// Get project_id from URL path and parse as UUID
	projectIDStr := c.Param("project_id")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid project id", err))
		return
	}

	// Bind query parameters to struct
	req := GetProjectQuotaReq{}
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("", err))
		return
	}

	// Delegate quota check to service
	out, err := h.svc.CheckQuota(c.Request.Context(), service.CheckQuotaInput{
		ProjectID: projectID,
		Path:      req.Path,
		Method:    req.Method,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("failed to check quota", err))
		return
	}

	if !out.Allowed {
		c.JSON(http.StatusForbidden, serializer.Response{Msg: out.Reason})
		return
	}

	c.JSON(http.StatusOK, serializer.Response{Msg: "ok"})
}
