package auth

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
)

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

func supabaseGet(path string, params url.Values, jwt string) ([]byte, error) {
	u := SupabaseURL + path + "?" + params.Encode()

	req, err := http.NewRequest("GET", u, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+jwt)
	req.Header.Set("apikey", SupabaseAnonKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("Supabase request failed (%d): %s", resp.StatusCode, string(body))
	}
	return body, nil
}
