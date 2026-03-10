package auth

import (
	"context"
	"fmt"

	"github.com/memodb-io/Acontext/acontext-cli/internal/api"
	"github.com/memodb-io/Acontext/acontext-cli/internal/tui"
)

// ErrNoProjects is returned when the user has no projects.
var ErrNoProjects = fmt.Errorf("no projects found")

// ProjectChoice holds an identified project for selection.
type ProjectChoice struct {
	ProjectID string
	Name      string
}

// SelectProject lists the user's orgs and projects, then prompts for selection (TTY).
// If only one project exists, it is auto-selected.
// Returns the selected project ID and name.
func SelectProject(jwt, userID string) (*ProjectChoice, error) {
	orgs, err := ListOrganizations(jwt, userID)
	if err != nil {
		return nil, fmt.Errorf("fetch organizations: %w", err)
	}

	// Collect all projects across all orgs
	var allProjects []OrgProject
	for _, org := range orgs {
		projects, err := ListProjects(jwt, org.ID)
		if err != nil {
			continue
		}
		for i := range projects {
			projects[i].OrgName = org.Name
		}
		allProjects = append(allProjects, projects...)
	}

	if len(allProjects) == 0 {
		return nil, ErrNoProjects
	}

	// Auto-select if only one project
	if len(allProjects) == 1 {
		p := allProjects[0]
		fmt.Printf("Auto-selected project: %s (%s)\n", p.Name, p.ProjectID)
		return &ProjectChoice{ProjectID: p.ProjectID, Name: p.Name}, nil
	}

	// Build select options
	options := make([]tui.SelectOption, len(allProjects))
	for i, p := range allProjects {
		options[i] = tui.SelectOption{
			Label: fmt.Sprintf("%s / %s (%s)", p.OrgName, p.Name, p.ProjectID),
			Value: p.ProjectID,
		}
	}

	label, value, err := tui.RunSelectWithLabel("Select a project:", options)
	if err != nil {
		return nil, fmt.Errorf("project selection: %w", err)
	}

	return &ProjectChoice{ProjectID: value, Name: label}, nil
}

// SaveProjectKey checks local key store for the project.
// If a key already exists locally, just sets as default.
// If no key, in TTY mode asks user to paste or rotate; in non-TTY mode rotates automatically.
// It also sets the project as the default.
func SaveProjectKey(projectID string, adminClient *api.Client) error {
	// Check if we already have a key for this project
	existingKey := GetProjectKey(projectID)
	if existingKey != "" {
		// Key exists locally, just set as default
		return SetDefaultProject(projectID)
	}

	if IsTTY() {
		return saveProjectKeyInteractive(projectID, adminClient)
	}
	return saveProjectKeyRotate(projectID, adminClient)
}

func saveProjectKeyInteractive(projectID string, adminClient *api.Client) error {
	// Ask: paste existing key or rotate to generate new one
	action, err := tui.RunSelect("No local API key found for this project. How to proceed?", []tui.SelectOption{
		{Label: "Paste an existing API key", Value: "paste"},
		{Label: "Generate a new key (rotates existing key)", Value: "rotate"},
	})
	if err != nil {
		return fmt.Errorf("key setup: %w", err)
	}

	if action == "paste" {
		key, err := tui.RunInput("API key (sk-ac-...):", "", "")
		if err != nil || key == "" {
			return fmt.Errorf("no key provided")
		}
		if err := SetProjectKey(projectID, key); err != nil {
			return fmt.Errorf("save API key: %w", err)
		}
		return SetDefaultProject(projectID)
	}

	return saveProjectKeyRotate(projectID, adminClient)
}

func saveProjectKeyRotate(projectID string, adminClient *api.Client) error {
	project, err := adminClient.AdminRotateKey(context.Background(), projectID)
	if err != nil {
		return fmt.Errorf("generate API key: %w", err)
	}

	if project.SecretKey == "" {
		return fmt.Errorf("server did not return an API key")
	}

	if err := SetProjectKey(projectID, project.SecretKey); err != nil {
		return fmt.Errorf("save API key: %w", err)
	}

	return SetDefaultProject(projectID)
}
