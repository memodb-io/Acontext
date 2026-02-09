package httpclient

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
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

// FlagResponse represents the response with status and error message
type FlagResponse struct {
	Status int    `json:"status"`
	Errmsg string `json:"errmsg"`
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
	FromSandboxFile string `json:"from_sandbox_file"`
	DownloadToS3Key string `json:"download_to_s3_key"`
}

// SandboxUploadRequest represents the request for uploading a file to sandbox
type SandboxUploadRequest struct {
	FromS3Key           string `json:"from_s3_key"`
	UploadToSandboxFile string `json:"upload_to_sandbox_file"`
}

// SandboxFileTransferResponse represents the response from file transfer operations
type SandboxFileTransferResponse struct {
	Success bool `json:"success"`
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
func (c *CoreClient) DownloadSandboxFile(ctx context.Context, projectID, sandboxID uuid.UUID, fromSandboxFile, downloadToS3Key string) (*SandboxFileTransferResponse, error) {
	endpoint := fmt.Sprintf("%s/api/v1/project/%s/sandbox/%s/download", c.BaseURL, projectID.String(), sandboxID.String())

	reqBody := SandboxDownloadRequest{
		FromSandboxFile: fromSandboxFile,
		DownloadToS3Key: downloadToS3Key,
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
func (c *CoreClient) UploadSandboxFile(ctx context.Context, projectID, sandboxID uuid.UUID, fromS3Key, uploadToSandboxFile string) (*SandboxFileTransferResponse, error) {
	endpoint := fmt.Sprintf("%s/api/v1/project/%s/sandbox/%s/upload", c.BaseURL, projectID.String(), sandboxID.String())

	reqBody := SandboxUploadRequest{
		FromS3Key:           fromS3Key,
		UploadToSandboxFile: uploadToSandboxFile,
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

// SessionSearchResponse represents the response from session search
type SessionSearchResponse struct {
	SessionIDs []uuid.UUID `json:"session_ids"`
}

// SessionSearch calls the session search endpoint in Python Core
func (c *CoreClient) SessionSearch(ctx context.Context, userID string, query string, limit int) (*SessionSearchResponse, error) {
	endpoint := fmt.Sprintf("%s/api/v1/sessions/search", c.BaseURL)

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	// Add query parameters
	q := httpReq.URL.Query()
	q.Add("user_id", userID)
	q.Add("query", query)
	q.Add("limit", fmt.Sprintf("%d", limit))
	httpReq.URL.RawQuery = q.Encode()

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
		c.Logger.Error("session_search request failed",
			zap.Int("status_code", resp.StatusCode),
			zap.String("body", string(respBody)))
		return nil, fmt.Errorf("request failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	var result SessionSearchResponse
	if err := sonic.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	return &result, nil
}
