package auth

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

// httpClient is a shared HTTP client with a reasonable timeout.
// Used instead of http.DefaultClient throughout the auth package.
var httpClient = &http.Client{Timeout: 30 * time.Second}

// Organization represents a user's organization from Supabase.
type Organization struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// OrgMembership is the PostgREST join result for organization_members.
type OrgMembership struct {
	OrganizationID string       `json:"organization_id"`
	Role           string       `json:"role"`
	Organizations  Organization `json:"organizations"`
}

// OrgProject represents a project within an organization.
type OrgProject struct {
	ProjectID string `json:"project_id"`
	Name      string `json:"name"`
	OrgID     string `json:"org_id,omitempty"`
	OrgName   string `json:"org_name,omitempty"`
	CreatedAt string `json:"created_at"`
}

// ListOrganizations fetches the user's organizations via PostgREST.
func ListOrganizations(jwt, userID string) ([]Organization, error) {
	// Query: organization_members?user_id=eq.<uid>&select=organization_id,role,organizations(id,name)
	params := url.Values{
		"user_id": {"eq." + userID},
		"select":  {"organization_id,role,organizations(id,name)"},
	}

	data, err := supabaseGet("/rest/v1/organization_members", params, jwt)
	if err != nil {
		return nil, fmt.Errorf("list organizations: %w", err)
	}

	var memberships []OrgMembership
	if err := json.Unmarshal(data, &memberships); err != nil {
		return nil, fmt.Errorf("parse organizations: %w", err)
	}

	orgs := make([]Organization, len(memberships))
	for i, m := range memberships {
		orgs[i] = m.Organizations
	}
	return orgs, nil
}

// ListProjects fetches projects for the given organization via PostgREST.
func ListProjects(jwt, orgID string) ([]OrgProject, error) {
	params := url.Values{
		"organization_id": {"eq." + orgID},
		"select":          {"project_id,name,created_at"},
	}

	data, err := supabaseGet("/rest/v1/organization_projects", params, jwt)
	if err != nil {
		return nil, fmt.Errorf("list projects: %w", err)
	}

	var projects []OrgProject
	if err := json.Unmarshal(data, &projects); err != nil {
		return nil, fmt.Errorf("parse projects: %w", err)
	}
	return projects, nil
}

// CreateOrganization creates a new organization via Supabase RPC.
func CreateOrganization(jwt, name string) (string, error) {
	params := map[string]interface{}{
		"org_name": name,
	}
	data, err := supabaseRPC("create_organization", params, jwt)
	if err != nil {
		return "", fmt.Errorf("create organization: %w", err)
	}
	// RPC returns a UUID string (JSON-encoded)
	var orgID string
	if err := json.Unmarshal(data, &orgID); err != nil {
		return "", fmt.Errorf("parse organization id: %w", err)
	}
	return orgID, nil
}

// LinkProjectToOrg links an existing project to an organization via Supabase RPC.
func LinkProjectToOrg(jwt, orgID, projectName, projectID string) error {
	params := map[string]interface{}{
		"p_org_id":       orgID,
		"p_project_name": projectName,
		"p_project_id":   projectID,
	}
	_, err := supabaseRPC("create_organization_project", params, jwt)
	if err != nil {
		return fmt.Errorf("link project to org: %w", err)
	}
	return nil
}

// UnlinkProjectFromOrg deletes a project record from organization_projects in Supabase.
func UnlinkProjectFromOrg(jwt, projectID string) error {
	params := url.Values{
		"project_id": {"eq." + projectID},
	}
	_, err := supabaseDelete("/rest/v1/organization_projects", params, jwt)
	if err != nil {
		return fmt.Errorf("unlink project from org: %w", err)
	}
	return nil
}

// ClaimCLISession calls the claim-cli-session Edge Function.
// Returns nil, nil if no session found yet (pending).
func ClaimCLISession(state string) (*AuthFile, error) {
	u := SupabaseURL + "/functions/v1/claim-cli-session"

	bodyBytes, err := json.Marshal(map[string]string{"state": state})
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", u, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+SupabaseAnonKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("claim session failed (%d): %s", resp.StatusCode, string(body))
	}

	var result struct {
		Status       string `json:"status"`
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		ExpiresAt    int64  `json:"expires_at"`
		UserID       string `json:"user_id"`
		UserEmail    string `json:"user_email"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("parse response: %w", err)
	}

	if result.Status == "pending" {
		return nil, nil
	}

	return &AuthFile{
		AccessToken:  result.AccessToken,
		RefreshToken: result.RefreshToken,
		ExpiresAt:    result.ExpiresAt,
		User: AuthUser{
			ID:    result.UserID,
			Email: result.UserEmail,
		},
	}, nil
}

func supabaseGet(path string, params url.Values, jwt string) ([]byte, error) {
	u := SupabaseURL + path + "?" + params.Encode()

	req, err := http.NewRequest("GET", u, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+jwt)
	req.Header.Set("apikey", SupabaseAnonKey)

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("supabase request failed (%d): %s", resp.StatusCode, string(body))
	}
	return body, nil
}

// maskSecretKey shows first 8 and last 8 characters with ***** in between.
func maskSecretKey(key string) string {
	if len(key) <= 16 {
		return key[:4] + "*****" + key[len(key)-4:]
	}
	return key[:8] + "*****" + key[len(key)-8:]
}

// RecordKeyRotation inserts a rotation record into project_secret_key_rotations via PostgREST.
func RecordKeyRotation(jwt, projectID, userEmail, secretKey string) error {
	record := map[string]string{
		"project_id": projectID,
		"user_email": userEmail,
		"secret_key": maskSecretKey(secretKey),
	}
	_, err := supabasePost("/rest/v1/project_secret_key_rotations", record, jwt)
	return err
}

func supabasePost(path string, payload interface{}, jwt string) ([]byte, error) {
	u := SupabaseURL + path

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal payload: %w", err)
	}

	req, err := http.NewRequest("POST", u, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+jwt)
	req.Header.Set("apikey", SupabaseAnonKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=minimal")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("supabase POST failed (%d): %s", resp.StatusCode, string(body))
	}
	return body, nil
}

func supabaseDelete(path string, params url.Values, jwt string) ([]byte, error) {
	u := SupabaseURL + path + "?" + params.Encode()

	req, err := http.NewRequest("DELETE", u, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+jwt)
	req.Header.Set("apikey", SupabaseAnonKey)

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("supabase DELETE failed (%d): %s", resp.StatusCode, string(body))
	}
	return body, nil
}

func supabaseRPC(funcName string, params map[string]interface{}, jwt string) ([]byte, error) {
	u := SupabaseURL + "/rest/v1/rpc/" + funcName

	bodyBytes, err := json.Marshal(params)
	if err != nil {
		return nil, fmt.Errorf("marshal RPC params: %w", err)
	}

	req, err := http.NewRequest("POST", u, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+jwt)
	req.Header.Set("apikey", SupabaseAnonKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("supabase RPC failed (%d): %s", resp.StatusCode, string(body))
	}
	return body, nil
}
