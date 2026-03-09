package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const (
	DefaultBaseURL      = "https://api.acontext.app"
	DefaultAdminBaseURL = "https://admin.acontext.app"
	requestTimeout      = 30 * time.Second
)

// Client is a thin HTTP wrapper for Acontext APIs.
type Client struct {
	baseURL    string
	httpClient *http.Client
	headers    map[string]string
}

// NewClient creates a client that authenticates with both JWT and API key.
// The /api/v1 routes require ProjectAuth (API key) + SupabaseAuth (JWT).
func NewClient(baseURL, apiKey, accessToken string) *Client {
	if baseURL == "" {
		baseURL = DefaultBaseURL
	}
	headers := map[string]string{
		"Content-Type": "application/json",
	}
	if apiKey != "" {
		headers["Authorization"] = "Bearer " + apiKey
	}
	if accessToken != "" {
		headers["X-Access-Token"] = accessToken
	}
	return &Client{
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: requestTimeout},
		headers:    headers,
	}
}

// NewAdminClient creates a client for /admin/v1 routes (JWT only).
func NewAdminClient(baseURL, accessToken string) *Client {
	if baseURL == "" {
		baseURL = DefaultAdminBaseURL
	}
	return &Client{
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: requestTimeout},
		headers: map[string]string{
			"X-Access-Token": accessToken,
			"Content-Type":   "application/json",
		},
	}
}

// doJSON performs an HTTP request and decodes the JSON response into result.
func (c *Client) doJSON(ctx context.Context, method, path string, body interface{}, result interface{}) error {
	var bodyReader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("marshal request body: %w", err)
		}
		bodyReader = bytes.NewReader(data)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, bodyReader)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	for k, v := range c.headers {
		req.Header.Set(k, v)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("HTTP request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read response body: %w", err)
	}

	if resp.StatusCode >= 400 {
		var env struct {
			Code  int    `json:"code"`
			Msg   string `json:"msg"`
			Error string `json:"error"`
		}
		if json.Unmarshal(respBody, &env) == nil && (env.Msg != "" || env.Error != "") {
			msg := env.Msg
			if msg == "" {
				msg = env.Error
			}
			return &APIError{StatusCode: resp.StatusCode, Code: env.Code, Message: msg}
		}
		return &APIError{StatusCode: resp.StatusCode, Message: string(respBody)}
	}

	if result == nil {
		return nil
	}

	// Try to unwrap envelope
	var env struct {
		Code int             `json:"code"`
		Data json.RawMessage `json:"data"`
		Msg  string          `json:"msg"`
	}
	if err := json.Unmarshal(respBody, &env); err == nil && env.Data != nil {
		return json.Unmarshal(env.Data, result)
	}

	// Fall back to direct decode
	return json.Unmarshal(respBody, result)
}

// Get performs a GET request.
func (c *Client) Get(ctx context.Context, path string, result interface{}) error {
	return c.doJSON(ctx, http.MethodGet, path, nil, result)
}

// Post performs a POST request.
func (c *Client) Post(ctx context.Context, path string, body interface{}, result interface{}) error {
	return c.doJSON(ctx, http.MethodPost, path, body, result)
}

// Put performs a PUT request.
func (c *Client) Put(ctx context.Context, path string, body interface{}, result interface{}) error {
	return c.doJSON(ctx, http.MethodPut, path, body, result)
}

// Patch performs a PATCH request.
func (c *Client) Patch(ctx context.Context, path string, body interface{}, result interface{}) error {
	return c.doJSON(ctx, http.MethodPatch, path, body, result)
}

// Delete performs a DELETE request.
func (c *Client) Delete(ctx context.Context, path string, result interface{}) error {
	return c.doJSON(ctx, http.MethodDelete, path, nil, result)
}

// PostMultipart performs a multipart/form-data POST request.
func (c *Client) PostMultipart(ctx context.Context, path string, body io.Reader, contentType string, result interface{}) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+path, body)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", contentType)
	for k, v := range c.headers {
		if k == "Content-Type" {
			continue // use multipart content type
		}
		req.Header.Set(k, v)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("HTTP request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read response body: %w", err)
	}

	if resp.StatusCode >= 400 {
		var env struct {
			Code  int    `json:"code"`
			Msg   string `json:"msg"`
			Error string `json:"error"`
		}
		if json.Unmarshal(respBody, &env) == nil && (env.Msg != "" || env.Error != "") {
			msg := env.Msg
			if msg == "" {
				msg = env.Error
			}
			return &APIError{StatusCode: resp.StatusCode, Code: env.Code, Message: msg}
		}
		return &APIError{StatusCode: resp.StatusCode, Message: string(respBody)}
	}

	if result == nil {
		return nil
	}

	var env struct {
		Code int             `json:"code"`
		Data json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(respBody, &env); err == nil && env.Data != nil {
		return json.Unmarshal(env.Data, result)
	}
	return json.Unmarshal(respBody, result)
}
