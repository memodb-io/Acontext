package httpclient

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/bytedance/sonic"
	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/config"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.uber.org/zap"
)

// CoreClient is the HTTP client for Acontext Core service
type CoreClient struct {
	BaseURL    string
	HTTPClient *http.Client
	Logger     *zap.Logger
}

// NewCoreClient creates a new CoreClient with OpenTelemetry instrumentation
func NewCoreClient(cfg *config.Config, log *zap.Logger) *CoreClient {
	return &CoreClient{
		BaseURL: cfg.Core.BaseURL,
		HTTPClient: &http.Client{
			Timeout:   5 * time.Minute,
			Transport: otelhttp.NewTransport(http.DefaultTransport),
		},
		Logger: log,
	}
}

// SearchResultBlockItem represents a search result block item
type SearchResultBlockItem struct {
	BlockID  uuid.UUID              `json:"block_id"`
	Title    string                 `json:"title"`
	Type     string                 `json:"type"`
	Props    map[string]interface{} `json:"props"`
	Distance *float64               `json:"distance"`
}

// SpaceSearchResult represents the result of a space search
type SpaceSearchResult struct {
	CitedBlocks []SearchResultBlockItem `json:"cited_blocks"`
}

// ExperienceSearchRequest represents the request for experience search
type ExperienceSearchRequest struct {
	Query             string   `json:"query"`
	Limit             int      `json:"limit"`
	Mode              string   `json:"mode"`
	SemanticThreshold *float64 `json:"semantic_threshold"`
	MaxIterations     int      `json:"max_iterations"`
}

// ExperienceSearch calls the experience_search endpoint
func (c *CoreClient) ExperienceSearch(ctx context.Context, projectID, spaceID uuid.UUID, req ExperienceSearchRequest) (*SpaceSearchResult, error) {
	endpoint := fmt.Sprintf("%s/api/v1/project/%s/space/%s/experience_search", c.BaseURL, projectID.String(), spaceID.String())

	// Build query parameters
	params := url.Values{}
	params.Set("query", req.Query)
	params.Set("limit", fmt.Sprintf("%d", req.Limit))
	params.Set("mode", req.Mode)
	if req.SemanticThreshold != nil {
		params.Set("semantic_threshold", fmt.Sprintf("%f", *req.SemanticThreshold))
	}
	params.Set("max_iterations", fmt.Sprintf("%d", req.MaxIterations))

	fullURL := fmt.Sprintf("%s?%s", endpoint, params.Encode())

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, fullURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	resp, err := c.HTTPClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		c.Logger.Error("experience_search request failed",
			zap.Int("status_code", resp.StatusCode),
			zap.String("body", string(body)))
		return nil, fmt.Errorf("request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var result SpaceSearchResult
	if err := sonic.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	return &result, nil
}

// InsertBlockRequest represents the request for inserting a block
type InsertBlockRequest struct {
	ParentID *uuid.UUID     `json:"parent_id,omitempty"`
	Props    map[string]any `json:"props"`
	Title    string         `json:"title"`
	Type     string         `json:"type"`
}

// InsertBlockResponse represents the response from insert_block endpoint
type InsertBlockResponse struct {
	ID uuid.UUID `json:"id"`
}

// InsertBlock calls the insert_block endpoint
func (c *CoreClient) InsertBlock(ctx context.Context, projectID, spaceID uuid.UUID, req InsertBlockRequest) (*InsertBlockResponse, error) {
	endpoint := fmt.Sprintf("%s/api/v1/project/%s/space/%s/insert_block", c.BaseURL, projectID.String(), spaceID.String())

	// Marshal request body
	body, err := sonic.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		c.Logger.Error("insert_block request failed",
			zap.Int("status_code", resp.StatusCode),
			zap.String("body", string(respBody)))
		return nil, fmt.Errorf("request failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	var result InsertBlockResponse
	if err := sonic.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	return &result, nil
}

// FlagResponse represents the response with status and error message
type FlagResponse struct {
	Status int    `json:"status"`
	Errmsg string `json:"errmsg"`
}

// LearningStatusResponse represents the learning status response
type LearningStatusResponse struct {
	SpaceDigestedCount    int `json:"space_digested_count"`
	NotSpaceDigestedCount int `json:"not_space_digested_count"`
}

// SessionFlush calls the session flush endpoint
func (c *CoreClient) SessionFlush(ctx context.Context, projectID, sessionID uuid.UUID) (*FlagResponse, error) {
	endpoint := fmt.Sprintf("%s/api/v1/project/%s/session/%s/flush", c.BaseURL, projectID.String(), sessionID.String())

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	resp, err := c.HTTPClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		c.Logger.Error("session_flush request failed",
			zap.Int("status_code", resp.StatusCode),
			zap.String("body", string(respBody)))
		return nil, fmt.Errorf("request failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	var result FlagResponse
	if err := sonic.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	return &result, nil
}

// GetLearningStatus calls the get learning status endpoint
func (c *CoreClient) GetLearningStatus(ctx context.Context, projectID, sessionID uuid.UUID) (*LearningStatusResponse, error) {
	endpoint := fmt.Sprintf("%s/api/v1/project/%s/session/%s/get_learning_status", c.BaseURL, projectID.String(), sessionID.String())

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	resp, err := c.HTTPClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		c.Logger.Error("get_learning_status request failed",
			zap.Int("status_code", resp.StatusCode),
			zap.String("body", string(respBody)))
		return nil, fmt.Errorf("request failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	var result LearningStatusResponse
	if err := sonic.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	return &result, nil
}

// ToolRenameItem represents a single tool rename operation
type ToolRenameItem struct {
	OldName string `json:"old_name"`
	NewName string `json:"new_name"`
}

// ToolRenameRequest represents the request for renaming tools
type ToolRenameRequest struct {
	Rename []ToolRenameItem `json:"rename"`
}

// ToolReferenceData represents a tool reference data
type ToolReferenceData struct {
	Name     string `json:"name"`
	SopCount int    `json:"sop_count"`
}

// SandboxUpdateConfig represents the configuration for updating a sandbox
type SandboxUpdateConfig struct {
	KeepaliveLongerBySeconds int `json:"keepalive_longer_by_seconds"`
}

// SandboxRuntimeInfo represents runtime information about a sandbox
type SandboxRuntimeInfo struct {
	SandboxID        string `json:"sandbox_id"`
	SandboxStatus    string `json:"sandbox_status"`
	SandboxCreatedAt string `json:"sandbox_created_at"`
	SandboxExpiresAt string `json:"sandbox_expires_at"`
}

// SandboxCommandOutput represents the output of a command execution in sandbox
type SandboxCommandOutput struct {
	Stdout   string `json:"stdout"`
	Stderr   string `json:"stderr"`
	ExitCode int    `json:"exit_code"`
}

// SandboxExecRequest represents the request for executing a command in sandbox
type SandboxExecRequest struct {
	Command string `json:"command"`
}

// SandboxDownloadRequest represents the request for downloading a file from sandbox
type SandboxDownloadRequest struct {
	FromSandboxFile  string `json:"from_sandbox_file"`
	DownloadToS3Path string `json:"download_to_s3_path"`
}

// SandboxUploadRequest represents the request for uploading a file to sandbox
type SandboxUploadRequest struct {
	FromS3File          string `json:"from_s3_file"`
	UploadToSandboxPath string `json:"upload_to_sandbox_path"`
}

// SandboxFileTransferResponse represents the response from file transfer operations
type SandboxFileTransferResponse struct {
	Success bool `json:"success"`
}

// ToolRename calls the tool rename endpoint
func (c *CoreClient) ToolRename(ctx context.Context, projectID uuid.UUID, renameItems []ToolRenameItem) (*FlagResponse, error) {
	endpoint := fmt.Sprintf("%s/api/v1/project/%s/tool/rename", c.BaseURL, projectID.String())

	// Marshal request body
	reqBody := ToolRenameRequest{Rename: renameItems}
	body, err := sonic.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		c.Logger.Error("tool_rename request failed",
			zap.Int("status_code", resp.StatusCode),
			zap.String("body", string(respBody)))
		return nil, fmt.Errorf("request failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	var result FlagResponse
	if err := sonic.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	return &result, nil
}

// GetToolNames calls the get tool names endpoint
func (c *CoreClient) GetToolNames(ctx context.Context, projectID uuid.UUID) ([]ToolReferenceData, error) {
	endpoint := fmt.Sprintf("%s/api/v1/project/%s/tool/name", c.BaseURL, projectID.String())

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	resp, err := c.HTTPClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		c.Logger.Error("get_tool_names request failed",
			zap.Int("status_code", resp.StatusCode),
			zap.String("body", string(respBody)))
		return nil, fmt.Errorf("request failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	var result []ToolReferenceData
	if err := sonic.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	return result, nil
}

// StartSandbox creates and starts a new sandbox
func (c *CoreClient) StartSandbox(ctx context.Context, projectID uuid.UUID) (*SandboxRuntimeInfo, error) {
	endpoint := fmt.Sprintf("%s/api/v1/project/%s/sandbox", c.BaseURL, projectID.String())

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	resp, err := c.HTTPClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		c.Logger.Error("start_sandbox request failed",
			zap.Int("status_code", resp.StatusCode),
			zap.String("body", string(respBody)))
		return nil, fmt.Errorf("request failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	var result SandboxRuntimeInfo
	if err := sonic.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	return &result, nil
}

// KillSandbox kills a running sandbox
func (c *CoreClient) KillSandbox(ctx context.Context, projectID, sandboxID uuid.UUID) (*FlagResponse, error) {
	endpoint := fmt.Sprintf("%s/api/v1/project/%s/sandbox/%s", c.BaseURL, projectID.String(), sandboxID.String())

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodDelete, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	resp, err := c.HTTPClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		c.Logger.Error("kill_sandbox request failed",
			zap.Int("status_code", resp.StatusCode),
			zap.String("body", string(respBody)))
		return nil, fmt.Errorf("request failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	var result FlagResponse
	if err := sonic.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	return &result, nil
}

// GetSandbox gets runtime information about a sandbox
func (c *CoreClient) GetSandbox(ctx context.Context, projectID, sandboxID uuid.UUID) (*SandboxRuntimeInfo, error) {
	endpoint := fmt.Sprintf("%s/api/v1/project/%s/sandbox/%s", c.BaseURL, projectID.String(), sandboxID.String())

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	resp, err := c.HTTPClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		c.Logger.Error("get_sandbox request failed",
			zap.Int("status_code", resp.StatusCode),
			zap.String("body", string(respBody)))
		return nil, fmt.Errorf("request failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	var result SandboxRuntimeInfo
	if err := sonic.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	return &result, nil
}

// UpdateSandbox updates sandbox configuration (e.g., extend timeout)
func (c *CoreClient) UpdateSandbox(ctx context.Context, projectID, sandboxID uuid.UUID, config SandboxUpdateConfig) (*SandboxRuntimeInfo, error) {
	endpoint := fmt.Sprintf("%s/api/v1/project/%s/sandbox/%s", c.BaseURL, projectID.String(), sandboxID.String())

	body, err := sonic.Marshal(config)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPatch, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		c.Logger.Error("update_sandbox request failed",
			zap.Int("status_code", resp.StatusCode),
			zap.String("body", string(respBody)))
		return nil, fmt.Errorf("request failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	var result SandboxRuntimeInfo
	if err := sonic.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	return &result, nil
}

// ExecSandboxCommand executes a shell command in the sandbox
func (c *CoreClient) ExecSandboxCommand(ctx context.Context, projectID, sandboxID uuid.UUID, command string) (*SandboxCommandOutput, error) {
	endpoint := fmt.Sprintf("%s/api/v1/project/%s/sandbox/%s/exec", c.BaseURL, projectID.String(), sandboxID.String())

	reqBody := SandboxExecRequest{Command: command}
	body, err := sonic.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		c.Logger.Error("exec_sandbox_command request failed",
			zap.Int("status_code", resp.StatusCode),
			zap.String("body", string(respBody)))
		return nil, fmt.Errorf("request failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	var result SandboxCommandOutput
	if err := sonic.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	return &result, nil
}

// DownloadSandboxFile downloads a file from the sandbox and uploads it to S3
func (c *CoreClient) DownloadSandboxFile(ctx context.Context, projectID, sandboxID uuid.UUID, fromSandboxFile, downloadToS3Path string) (*SandboxFileTransferResponse, error) {
	endpoint := fmt.Sprintf("%s/api/v1/project/%s/sandbox/%s/download", c.BaseURL, projectID.String(), sandboxID.String())

	reqBody := SandboxDownloadRequest{
		FromSandboxFile:  fromSandboxFile,
		DownloadToS3Path: downloadToS3Path,
	}
	body, err := sonic.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		c.Logger.Error("download_sandbox_file request failed",
			zap.Int("status_code", resp.StatusCode),
			zap.String("body", string(respBody)))
		return nil, fmt.Errorf("request failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	var result SandboxFileTransferResponse
	if err := sonic.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	return &result, nil
}

// UploadSandboxFile downloads a file from S3 and uploads it to the sandbox
func (c *CoreClient) UploadSandboxFile(ctx context.Context, projectID, sandboxID uuid.UUID, fromS3File, uploadToSandboxPath string) (*SandboxFileTransferResponse, error) {
	endpoint := fmt.Sprintf("%s/api/v1/project/%s/sandbox/%s/upload", c.BaseURL, projectID.String(), sandboxID.String())

	reqBody := SandboxUploadRequest{
		FromS3File:          fromS3File,
		UploadToSandboxPath: uploadToSandboxPath,
	}
	body, err := sonic.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		c.Logger.Error("upload_sandbox_file request failed",
			zap.Int("status_code", resp.StatusCode),
			zap.String("body", string(respBody)))
		return nil, fmt.Errorf("request failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	var result SandboxFileTransferResponse
	if err := sonic.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	return &result, nil
}
