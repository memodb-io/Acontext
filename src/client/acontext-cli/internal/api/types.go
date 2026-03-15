package api

import (
	"encoding/json"
	"fmt"
)

// Envelope is the standard API response wrapper.
type Envelope struct {
	Code  int             `json:"code"`
	Data  json.RawMessage `json:"data"`
	Msg   string          `json:"msg"`
	Error string          `json:"error"`
}

// APIError represents an error response from the API.
type APIError struct {
	StatusCode int
	Code       int
	Message    string
}

func (e *APIError) Error() string {
	if e.Message != "" {
		return fmt.Sprintf("API error %d: %s", e.StatusCode, e.Message)
	}
	return fmt.Sprintf("API error %d", e.StatusCode)
}

// --- /api/v1/session ---

type Session struct {
	ID        string                 `json:"id"`
	ProjectID string                 `json:"project_id"`
	UserID    string                 `json:"user_id,omitempty"`
	Configs   map[string]interface{} `json:"configs,omitempty"`
	CreatedAt string                 `json:"created_at"`
	UpdatedAt string                 `json:"updated_at"`
}

type CreateSessionRequest struct {
	User                string                 `json:"user,omitempty"`
	DisableTaskTracking *bool                  `json:"disable_task_tracking,omitempty"`
	Configs             map[string]interface{} `json:"configs,omitempty"`
	UseUUID             string                 `json:"use_uuid,omitempty"`
}

// --- /api/v1/session/:session_id/messages ---

type Message struct {
	ID        string                 `json:"id"`
	SessionID string                 `json:"session_id"`
	Role      string                 `json:"role"`
	Content   string                 `json:"content"`
	Type      string                 `json:"type,omitempty"`
	Meta      map[string]interface{} `json:"meta,omitempty"`
	CreatedAt string                 `json:"created_at"`
}

type StoreMessageRequest struct {
	Role    string                 `json:"role"`
	Content string                 `json:"content"`
	Type    string                 `json:"type,omitempty"`
	Meta    map[string]interface{} `json:"meta,omitempty"`
}

// --- /api/v1/disk ---

type Disk struct {
	ID        string `json:"id"`
	ProjectID string `json:"project_id"`
	UserID    string `json:"user_id,omitempty"`
	CreatedAt string `json:"created_at"`
}

type CreateDiskRequest struct {
	User string `json:"user,omitempty"`
}

// --- /api/v1/disk/:disk_id/artifact ---

type Artifact struct {
	ID        string `json:"id"`
	DiskID    string `json:"disk_id"`
	Path      string `json:"path"`
	Size      int64  `json:"size,omitempty"`
	MimeType  string `json:"mime_type,omitempty"`
	CreatedAt string `json:"created_at"`
}

// --- /api/v1/agent_skills ---

type AgentSkill struct {
	ID          string `json:"id"`
	ProjectID   string `json:"project_id"`
	UserID      string `json:"user_id,omitempty"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
}

// --- /api/v1/user ---

type User struct {
	ID         string `json:"id"`
	ProjectID  string `json:"project_id"`
	Identifier string `json:"identifier"`
	CreatedAt  string `json:"created_at"`
}

// --- /api/v1/learning_spaces ---

type LearningSpace struct {
	ID        string                 `json:"id"`
	ProjectID string                 `json:"project_id"`
	UserID    string                 `json:"user_id,omitempty"`
	Meta      map[string]interface{} `json:"meta,omitempty"`
	CreatedAt string                 `json:"created_at"`
}

type CreateLearningSpaceRequest struct {
	User string                 `json:"user,omitempty"`
	Meta map[string]interface{} `json:"meta,omitempty"`
}

type LearnRequest struct {
	SessionID string `json:"session_id"`
}

// --- /admin/v1/project ---

// CreateProjectResponse matches the admin server's CreateProjectOutput.
type CreateProjectResponse struct {
	ProjectID string `json:"project_id"`
	SecretKey string `json:"secret_key"`
}

type CreateProjectRequest struct {
	Name string `json:"name"`
}

// RotateKeyResponse matches the admin server's UpdateSecretKeyOutput.
type RotateKeyResponse struct {
	SecretKey string `json:"secret_key"`
}

type ProjectStats struct {
	TaskCount    int64 `json:"taskCount"`
	SkillCount   int64 `json:"skillCount"`
	SessionCount int64 `json:"sessionCount"`
}

// --- Pagination ---

type ListParams struct {
	User     string `json:"user,omitempty"`
	Limit    int    `json:"limit,omitempty"`
	Cursor   string `json:"cursor,omitempty"`
	TimeDesc bool   `json:"time_desc,omitempty"`
}

// PaginatedResponse wraps list endpoints that return {items, next_cursor, has_more}.
type PaginatedResponse[T any] struct {
	Items      []T    `json:"items"`
	NextCursor string `json:"next_cursor,omitempty"`
	HasMore    bool   `json:"has_more"`
}

// ListArtifactsResponse wraps the artifact ls endpoint response.
type ListArtifactsResponse struct {
	Artifacts   []Artifact `json:"artifacts"`
	Directories []string   `json:"directories"`
}
