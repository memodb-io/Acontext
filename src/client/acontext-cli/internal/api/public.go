package api

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"mime/multipart"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
)

// buildQuery builds query params for list endpoints.
func buildQuery(params *ListParams) string {
	if params == nil {
		return ""
	}
	v := url.Values{}
	if params.User != "" {
		v.Set("user", params.User)
	}
	if params.Limit > 0 {
		v.Set("limit", strconv.Itoa(params.Limit))
	}
	if params.Cursor != "" {
		v.Set("cursor", params.Cursor)
	}
	if params.TimeDesc {
		v.Set("time_desc", "true")
	}
	if len(v) == 0 {
		return ""
	}
	return "?" + v.Encode()
}

// --- Ping (/api/v1/ping) ---

// Ping checks connectivity to the API. Returns nil on success.
func (c *Client) Ping(ctx context.Context) error {
	return c.Get(ctx, "/api/v1/ping", nil)
}

// --- Sessions (/api/v1/session) ---

func (c *Client) ListSessions(ctx context.Context, params *ListParams) ([]Session, error) {
	var resp PaginatedResponse[Session]
	if err := c.Get(ctx, "/api/v1/session"+buildQuery(params), &resp); err != nil {
		return nil, err
	}
	return resp.Items, nil
}

func (c *Client) CreateSession(ctx context.Context, req *CreateSessionRequest) (*Session, error) {
	var session Session
	if err := c.Post(ctx, "/api/v1/session", req, &session); err != nil {
		return nil, err
	}
	return &session, nil
}

func (c *Client) GetSession(ctx context.Context, sessionID string) (*Session, error) {
	var resp PaginatedResponse[Session]
	v := url.Values{"id": {sessionID}}
	if err := c.Get(ctx, "/api/v1/session?"+v.Encode(), &resp); err != nil {
		return nil, err
	}
	if len(resp.Items) == 0 {
		return nil, &APIError{StatusCode: 404, Message: "session not found"}
	}
	return &resp.Items[0], nil
}

func (c *Client) DeleteSession(ctx context.Context, sessionID string) error {
	return c.Delete(ctx, "/api/v1/session/"+sessionID, nil)
}

// --- Messages (/api/v1/session/:id/messages) ---

func (c *Client) ListMessages(ctx context.Context, sessionID string, params *ListParams) ([]Message, error) {
	var resp PaginatedResponse[Message]
	if err := c.Get(ctx, "/api/v1/session/"+sessionID+"/messages"+buildQuery(params), &resp); err != nil {
		return nil, err
	}
	return resp.Items, nil
}

func (c *Client) StoreMessage(ctx context.Context, sessionID string, req *StoreMessageRequest) (*Message, error) {
	var msg Message
	if err := c.Post(ctx, "/api/v1/session/"+sessionID+"/messages", req, &msg); err != nil {
		return nil, err
	}
	return &msg, nil
}

// --- Disks (/api/v1/disk) ---

func (c *Client) ListDisks(ctx context.Context, params *ListParams) ([]Disk, error) {
	var resp PaginatedResponse[Disk]
	if err := c.Get(ctx, "/api/v1/disk"+buildQuery(params), &resp); err != nil {
		return nil, err
	}
	return resp.Items, nil
}

func (c *Client) CreateDisk(ctx context.Context, req *CreateDiskRequest) (*Disk, error) {
	var disk Disk
	if err := c.Post(ctx, "/api/v1/disk", req, &disk); err != nil {
		return nil, err
	}
	return &disk, nil
}

func (c *Client) GetDisk(ctx context.Context, diskID string) (*Disk, error) {
	var resp PaginatedResponse[Disk]
	v := url.Values{"id": {diskID}}
	if err := c.Get(ctx, "/api/v1/disk?"+v.Encode(), &resp); err != nil {
		return nil, err
	}
	if len(resp.Items) == 0 {
		return nil, &APIError{StatusCode: 404, Message: "disk not found"}
	}
	return &resp.Items[0], nil
}

func (c *Client) DeleteDisk(ctx context.Context, diskID string) error {
	return c.Delete(ctx, "/api/v1/disk/"+diskID, nil)
}

// --- Artifacts (/api/v1/disk/:disk_id/artifact) ---

func (c *Client) ListArtifacts(ctx context.Context, diskID string) ([]Artifact, error) {
	var resp ListArtifactsResponse
	if err := c.Get(ctx, "/api/v1/disk/"+diskID+"/artifact/ls", &resp); err != nil {
		return nil, err
	}
	return resp.Artifacts, nil
}

func (c *Client) UploadArtifact(ctx context.Context, diskID, filePath, destPath string) (*Artifact, error) {
	f, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("open file: %w", err)
	}
	defer func() { _ = f.Close() }()

	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)

	part, err := w.CreateFormFile("file", filepath.Base(filePath))
	if err != nil {
		return nil, err
	}
	if _, err := io.Copy(part, f); err != nil {
		return nil, err
	}
	if destPath != "" {
		_ = w.WriteField("file_path", destPath)
	}
	_ = w.Close()

	var artifact Artifact
	if err := c.PostMultipart(ctx, "/api/v1/disk/"+diskID+"/artifact", &buf, w.FormDataContentType(), &artifact); err != nil {
		return nil, err
	}
	return &artifact, nil
}

func (c *Client) DeleteArtifact(ctx context.Context, diskID, path string) error {
	v := url.Values{"path": {path}}
	return c.Delete(ctx, "/api/v1/disk/"+diskID+"/artifact?"+v.Encode(), nil)
}

// --- Agent Skills (/api/v1/agent_skills) ---

// CreateAgentSkill uploads a ZIP file to create an agent skill.
func (c *Client) CreateAgentSkill(ctx context.Context, zipPath, user, meta string) (*AgentSkill, error) {
	f, err := os.Open(zipPath)
	if err != nil {
		return nil, fmt.Errorf("open zip: %w", err)
	}
	defer func() { _ = f.Close() }()

	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)

	// file field
	part, err := w.CreateFormFile("file", filepath.Base(zipPath))
	if err != nil {
		return nil, err
	}
	if _, err := io.Copy(part, f); err != nil {
		return nil, err
	}

	// user field
	if user != "" {
		_ = w.WriteField("user", user)
	}
	// meta field
	if meta != "" {
		_ = w.WriteField("meta", meta)
	}
	_ = w.Close()

	var skill AgentSkill
	if err := c.PostMultipart(ctx, "/api/v1/agent_skills", &buf, w.FormDataContentType(), &skill); err != nil {
		return nil, err
	}
	return &skill, nil
}

func (c *Client) ListAgentSkills(ctx context.Context, params *ListParams) ([]AgentSkill, error) {
	var resp PaginatedResponse[AgentSkill]
	if err := c.Get(ctx, "/api/v1/agent_skills"+buildQuery(params), &resp); err != nil {
		return nil, err
	}
	return resp.Items, nil
}

func (c *Client) GetAgentSkill(ctx context.Context, skillID string) (*AgentSkill, error) {
	var skill AgentSkill
	if err := c.Get(ctx, "/api/v1/agent_skills/"+skillID, &skill); err != nil {
		return nil, err
	}
	return &skill, nil
}

func (c *Client) DeleteAgentSkill(ctx context.Context, skillID string) error {
	return c.Delete(ctx, "/api/v1/agent_skills/"+skillID, nil)
}

// --- Users (/api/v1/user) ---

func (c *Client) ListUsers(ctx context.Context, params *ListParams) ([]User, error) {
	var resp PaginatedResponse[User]
	q := ""
	if params != nil && params.Limit > 0 {
		q = fmt.Sprintf("?limit=%d", params.Limit)
	}
	if err := c.Get(ctx, "/api/v1/user/ls"+q, &resp); err != nil {
		return nil, err
	}
	return resp.Items, nil
}

func (c *Client) DeleteUser(ctx context.Context, identifier string) error {
	return c.Delete(ctx, "/api/v1/user/"+identifier, nil)
}

// --- Learning Spaces (/api/v1/learning_spaces) ---

func (c *Client) ListLearningSpaces(ctx context.Context, params *ListParams) ([]LearningSpace, error) {
	var resp PaginatedResponse[LearningSpace]
	if err := c.Get(ctx, "/api/v1/learning_spaces"+buildQuery(params), &resp); err != nil {
		return nil, err
	}
	return resp.Items, nil
}

func (c *Client) CreateLearningSpace(ctx context.Context, req *CreateLearningSpaceRequest) (*LearningSpace, error) {
	var space LearningSpace
	if err := c.Post(ctx, "/api/v1/learning_spaces", req, &space); err != nil {
		return nil, err
	}
	return &space, nil
}

func (c *Client) GetLearningSpace(ctx context.Context, spaceID string) (*LearningSpace, error) {
	var space LearningSpace
	if err := c.Get(ctx, "/api/v1/learning_spaces/"+spaceID, &space); err != nil {
		return nil, err
	}
	return &space, nil
}

func (c *Client) DeleteLearningSpace(ctx context.Context, spaceID string) error {
	return c.Delete(ctx, "/api/v1/learning_spaces/"+spaceID, nil)
}

func (c *Client) LearnFromSession(ctx context.Context, spaceID, sessionID string) error {
	return c.Post(ctx, fmt.Sprintf("/api/v1/learning_spaces/%s/learn?session_id=%s", spaceID, url.QueryEscape(sessionID)), nil, nil)
}
