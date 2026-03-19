package service

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/bytedance/sonic"
	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/config"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/repo"
	"github.com/memodb-io/Acontext/internal/pkg/utils/secrets"
	"github.com/memodb-io/Acontext/internal/pkg/utils/tokens"
	"gorm.io/datatypes"
)

type ProjectService interface {
	Create(ctx context.Context, configs map[string]interface{}) (*CreateProjectOutput, error)
	Delete(ctx context.Context, projectID uuid.UUID) error
	UpdateSecretKey(ctx context.Context, projectID uuid.UUID) (*UpdateSecretKeyOutput, error)
	AnalyzeUsages(ctx context.Context, projectID uuid.UUID, intervalDays int, fields []string) (*AnalyzeUsagesOutput, error)
	AnalyzeStatistics(ctx context.Context, projectID uuid.UUID) (*AnalyzeStatisticsOutput, error)
	AnalyzeMetrics(ctx context.Context, projectID uuid.UUID, requestURL string, requestMethod string, requestHeaders http.Header) (*http.Response, error)
}

type projectService struct {
	r      repo.ProjectRepo
	cfg    *config.Config
	client *http.Client
}

func NewProjectService(r repo.ProjectRepo, cfg *config.Config) ProjectService {
	return &projectService{
		r:   r,
		cfg: cfg,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

type CreateProjectOutput struct {
	ProjectID uuid.UUID `json:"project_id"`
	SecretKey string    `json:"secret_key"`
}

type UpdateSecretKeyOutput struct {
	SecretKey string `json:"secret_key"`
}

// generateRandomSecret generates a random secret key with the specified byte length
func generateRandomSecret(byteLength int) (string, error) {
	b := make([]byte, byteLength)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func (s *projectService) Create(ctx context.Context, configs map[string]interface{}) (*CreateProjectOutput, error) {
	// Generate a random secret key (32 bytes = 256 bits)
	secret, err := generateRandomSecret(32)
	if err != nil {
		return nil, err
	}

	pepper := s.cfg.Root.SecretPepper
	if pepper == "" {
		return nil, errors.New("secret pepper is not configured")
	}

	// Generate HMAC for lookup
	lookup := tokens.HMAC256Hex(pepper, secret)

	// Hash the secret with PHC format
	phc, err := secrets.HashSecret(secret, pepper)
	if err != nil {
		return nil, err
	}

	// Prepare configs
	if configs == nil {
		configs = make(map[string]interface{})
	}

	// Create project
	project := &model.Project{
		SecretKeyHMAC:    lookup,
		SecretKeyHashPHC: phc,
		Configs:          datatypes.JSONMap(configs),
	}

	if err := s.r.Create(ctx, project); err != nil {
		return nil, err
	}

	return &CreateProjectOutput{
		ProjectID: project.ID,
		SecretKey: s.cfg.Root.ProjectBearerTokenPrefix + secret,
	}, nil
}

func (s *projectService) Delete(ctx context.Context, projectID uuid.UUID) error {
	if projectID == uuid.Nil {
		return errors.New("project id is empty")
	}
	return s.r.Delete(ctx, projectID)
}

func (s *projectService) UpdateSecretKey(ctx context.Context, projectID uuid.UUID) (*UpdateSecretKeyOutput, error) {
	if projectID == uuid.Nil {
		return nil, errors.New("project id is empty")
	}

	// Get existing project
	project, err := s.r.GetByID(ctx, projectID)
	if err != nil {
		return nil, err
	}

	// Generate a new random secret key
	secret, err := generateRandomSecret(32)
	if err != nil {
		return nil, err
	}

	pepper := s.cfg.Root.SecretPepper
	if pepper == "" {
		return nil, errors.New("secret pepper is not configured")
	}

	// Generate HMAC for lookup
	lookup := tokens.HMAC256Hex(pepper, secret)

	// Hash the secret with PHC format
	phc, err := secrets.HashSecret(secret, pepper)
	if err != nil {
		return nil, err
	}

	// Update project
	project.SecretKeyHMAC = lookup
	project.SecretKeyHashPHC = phc

	if err := s.r.Update(ctx, project); err != nil {
		return nil, err
	}

	return &UpdateSecretKeyOutput{
		SecretKey: s.cfg.Root.ProjectBearerTokenPrefix + secret,
	}, nil
}

// AnalyzeUsagesOutput represents the output of usage analysis
type AnalyzeUsagesOutput struct {
	TaskSuccess    []repo.TaskSuccessRow    `json:"task_success"`
	TaskStatus     []repo.TaskStatusRow     `json:"task_status"`
	SessionMessage []repo.SessionMessageRow `json:"session_message"`
	SessionTask    []repo.SessionTaskRow    `json:"session_task"`
	TaskMessage    []repo.TaskMessageRow    `json:"task_message"`
	Storage        []repo.StorageRow        `json:"storage"`
	TaskStats      []repo.TaskStatsRow      `json:"task_stats"`
	NewSessions    []repo.CountRow          `json:"new_sessions"`
	NewDisks       []repo.CountRow          `json:"new_disks"`
	NewSpaces      []repo.CountRow          `json:"new_spaces"`
}

func (s *projectService) AnalyzeUsages(ctx context.Context, projectID uuid.UUID, intervalDays int, fields []string) (*AnalyzeUsagesOutput, error) {
	if projectID == uuid.Nil {
		return nil, errors.New("project id is empty")
	}
	if intervalDays <= 0 {
		intervalDays = 30
	}

	result, err := s.r.AnalyzeUsages(ctx, projectID, intervalDays, fields)
	if err != nil {
		return nil, err
	}

	return &AnalyzeUsagesOutput{
		TaskSuccess:    result.TaskSuccess,
		TaskStatus:     result.TaskStatus,
		SessionMessage: result.SessionMessage,
		SessionTask:    result.SessionTask,
		TaskMessage:    result.TaskMessage,
		Storage:        result.Storage,
		TaskStats:      result.TaskStats,
		NewSessions:    result.NewSessions,
		NewDisks:       result.NewDisks,
		NewSpaces:      result.NewSpaces,
	}, nil
}

// AnalyzeStatisticsOutput represents the output of statistics analysis
type AnalyzeStatisticsOutput struct {
	TaskCount    int64 `json:"taskCount"`
	SkillCount   int64 `json:"skillCount"`
	SessionCount int64 `json:"sessionCount"`
}

func (s *projectService) AnalyzeStatistics(ctx context.Context, projectID uuid.UUID) (*AnalyzeStatisticsOutput, error) {
	if projectID == uuid.Nil {
		return nil, errors.New("project id is empty")
	}

	result, err := s.r.AnalyzeStatistics(ctx, projectID)
	if err != nil {
		return nil, err
	}

	return &AnalyzeStatisticsOutput{
		TaskCount:    result.TaskCount,
		SkillCount:   result.SkillCount,
		SessionCount: result.SessionCount,
	}, nil
}

func (s *projectService) AnalyzeMetrics(ctx context.Context, projectID uuid.UUID, requestURL string, requestMethod string, requestHeaders http.Header) (*http.Response, error) {
	if projectID == uuid.Nil {
		return nil, errors.New("project id is empty")
	}

	// Get Jaeger query API URL from config or environment
	jaegerURL := s.cfg.Telemetry.JaegerQueryEndpoint
	if jaegerURL == "" {
		jaegerURL = "http://localhost:16686"
	}

	// Parse the incoming request URL to get query parameters
	reqURL, err := url.Parse(requestURL)
	if err != nil {
		return nil, err
	}

	// Build Jaeger API URL - use /api/traces endpoint
	jaegerAPIURL := strings.TrimSuffix(jaegerURL, "/") + "/api/traces"

	// Only allow known Jaeger /api/traces query parameters
	allowedParams := map[string]bool{
		"service": true, "operation": true, "start": true, "end": true,
		"limit": true, "lookback": true, "minDuration": true, "maxDuration": true,
		"tags": true,
	}
	incomingParams := reqURL.Query()
	queryParams := make(url.Values)
	for key, values := range incomingParams {
		if allowedParams[key] {
			queryParams[key] = values
		}
	}

	// Add fixed tags parameter with project_id as JSON format
	tags := map[string]string{
		"project_id": projectID.String(),
	}

	// If existing tags parameter exists, merge it
	if existingTags := queryParams.Get("tags"); existingTags != "" {
		var existingTagsMap map[string]string
		if err := sonic.Unmarshal([]byte(existingTags), &existingTagsMap); err == nil {
			for k, v := range existingTagsMap {
				if k != "project_id" { // project_id is always enforced
					tags[k] = v
				}
			}
		}
	}

	tagsJSON, err := sonic.Marshal(tags)
	if err != nil {
		return nil, err
	}
	queryParams.Set("tags", string(tagsJSON))

	// Build the final URL with query parameters
	finalURL := jaegerAPIURL + "?" + queryParams.Encode()

	// Create HTTP request to Jaeger
	httpReq, err := http.NewRequestWithContext(ctx, requestMethod, finalURL, nil)
	if err != nil {
		return nil, err
	}

	// Only forward safe headers to internal Jaeger service
	for _, key := range []string{"Accept", "Content-Type"} {
		if values := requestHeaders.Values(key); len(values) > 0 {
			for _, value := range values {
				httpReq.Header.Add(key, value)
			}
		}
	}

	return s.client.Do(httpReq)
}
