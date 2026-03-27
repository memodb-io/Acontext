package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/bytedance/sonic"
	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/config"
	encryptionpkg "github.com/memodb-io/Acontext/internal/infra/crypto"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/repo"
	"github.com/memodb-io/Acontext/internal/pkg/utils/secrets"
	"github.com/memodb-io/Acontext/internal/pkg/utils/tokens"
	"gorm.io/datatypes"
)

type ProjectService interface {
	Create(ctx context.Context, configs map[string]interface{}) (*CreateProjectOutput, error)
	Delete(ctx context.Context, projectID uuid.UUID) error
	// RotateSecretKey rotates the auth_secret and re-wraps the master_key.
	// If masterKey is nil, a new master_key is generated.
	RotateSecretKey(ctx context.Context, projectID uuid.UUID, masterKey []byte) (*UpdateSecretKeyOutput, error)
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

func (s *projectService) Create(ctx context.Context, configs map[string]interface{}) (*CreateProjectOutput, error) {
	pepper := s.cfg.Root.SecretPepper
	if pepper == "" {
		return nil, errors.New("secret pepper is not configured")
	}

	// Generate 16-byte auth_secret for compact token format
	authSecretRaw := make([]byte, encryptionpkg.CompactAuthSecretLen)
	if _, err := rand.Read(authSecretRaw); err != nil {
		return nil, err
	}
	authSecretHex := hex.EncodeToString(authSecretRaw) // 32 hex chars

	// Generate master_key (32 bytes) — used directly as KEK for S3 encryption
	masterKey, err := encryptionpkg.GenerateMasterKey()
	if err != nil {
		return nil, err
	}

	// Derive wrapping key and pack compact token
	wrappingKey, err := encryptionpkg.DeriveUserKEK(authSecretHex, pepper)
	if err != nil {
		return nil, err
	}
	compactBody, err := encryptionpkg.PackCompactToken(authSecretRaw, masterKey, wrappingKey)
	if err != nil {
		return nil, err
	}

	// Generate HMAC for lookup (based on hex auth_secret)
	lookup := tokens.HMAC256Hex(pepper, authSecretHex)

	// Hash the auth_secret with PHC format
	phc, err := secrets.HashSecret(authSecretHex, pepper)
	if err != nil {
		return nil, err
	}

	// Prepare configs
	if configs == nil {
		configs = make(map[string]interface{})
	}

	project := &model.Project{
		SecretKeyHMAC:    lookup,
		SecretKeyHashPHC: phc,
		Configs:          datatypes.JSONMap(configs),
	}

	if err := s.r.Create(ctx, project); err != nil {
		return nil, err
	}

	// Compact token format: sk-ac-{base64url(0x01 | auth_16B | aes_kw(mk))}
	token := s.cfg.Root.ProjectBearerTokenPrefix + compactBody

	return &CreateProjectOutput{
		ProjectID: project.ID,
		SecretKey: token,
	}, nil
}

func (s *projectService) Delete(ctx context.Context, projectID uuid.UUID) error {
	if projectID == uuid.Nil {
		return errors.New("project id is empty")
	}
	return s.r.Delete(ctx, projectID)
}

// RotateSecretKey rotates the auth_secret and re-wraps the master_key.
// If masterKey is nil, a new master_key is generated (for legacy keys without encryption).
func (s *projectService) RotateSecretKey(ctx context.Context, projectID uuid.UUID, masterKey []byte) (*UpdateSecretKeyOutput, error) {
	if projectID == uuid.Nil {
		return nil, errors.New("project id is empty")
	}

	project, err := s.r.GetByID(ctx, projectID)
	if err != nil {
		return nil, err
	}

	pepper := s.cfg.Root.SecretPepper
	if pepper == "" {
		return nil, errors.New("secret pepper is not configured")
	}

	// If no master key provided, generate a new one
	if masterKey == nil {
		masterKey, err = encryptionpkg.GenerateMasterKey()
		if err != nil {
			return nil, err
		}
	}

	// Generate new 16-byte auth_secret for compact format
	authSecretRaw := make([]byte, encryptionpkg.CompactAuthSecretLen)
	if _, err := rand.Read(authSecretRaw); err != nil {
		return nil, err
	}
	authSecretHex := hex.EncodeToString(authSecretRaw)

	// Derive wrapping key and pack compact token
	wrappingKey, err := encryptionpkg.DeriveUserKEK(authSecretHex, pepper)
	if err != nil {
		return nil, err
	}
	compactBody, err := encryptionpkg.PackCompactToken(authSecretRaw, masterKey, wrappingKey)
	if err != nil {
		return nil, err
	}

	// Compute HMAC and PHC for new auth_secret
	lookup := tokens.HMAC256Hex(pepper, authSecretHex)
	phc, err := secrets.HashSecret(authSecretHex, pepper)
	if err != nil {
		return nil, err
	}

	// Update project
	project.SecretKeyHMAC = lookup
	project.SecretKeyHashPHC = phc

	if err := s.r.Update(ctx, project); err != nil {
		return nil, err
	}

	token := s.cfg.Root.ProjectBearerTokenPrefix + compactBody

	return &UpdateSecretKeyOutput{
		SecretKey: token,
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
