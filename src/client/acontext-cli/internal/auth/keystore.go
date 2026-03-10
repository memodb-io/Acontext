package auth

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

const credentialsFileName = "credentials.json"

// KeyStore is the on-disk format for ~/.acontext/credentials.json.
// Maps project_id → API key (sk-ac-...).
type KeyStore struct {
	DefaultProject string            `json:"default_project,omitempty"`
	Keys           map[string]string `json:"keys"` // project_id → api_key
}

// LoadKeyStore reads credentials.json. Returns empty store if file doesn't exist.
func LoadKeyStore() (*KeyStore, error) {
	dir, err := getConfigDir()
	if err != nil {
		return nil, err
	}
	path := filepath.Join(dir, credentialsFileName)

	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return &KeyStore{Keys: make(map[string]string)}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read credentials: %w", err)
	}

	var ks KeyStore
	if err := json.Unmarshal(data, &ks); err != nil {
		return nil, fmt.Errorf("parse credentials: %w", err)
	}
	if ks.Keys == nil {
		ks.Keys = make(map[string]string)
	}
	return &ks, nil
}

// SaveKeyStore writes credentials.json with 0600 permissions.
func SaveKeyStore(ks *KeyStore) error {
	dir, err := getConfigDir()
	if err != nil {
		return err
	}
	path := filepath.Join(dir, credentialsFileName)
	data, err := json.MarshalIndent(ks, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal credentials: %w", err)
	}
	return os.WriteFile(path, data, 0600)
}

// GetProjectKey returns the API key for a project, or empty string if not found.
func GetProjectKey(projectID string) string {
	ks, err := LoadKeyStore()
	if err != nil {
		return ""
	}
	return ks.Keys[projectID]
}

// SetProjectKey saves an API key for a project.
func SetProjectKey(projectID, apiKey string) error {
	ks, err := LoadKeyStore()
	if err != nil {
		return err
	}
	ks.Keys[projectID] = apiKey
	return SaveKeyStore(ks)
}

// SetDefaultProject sets the default project.
func SetDefaultProject(projectID string) error {
	ks, err := LoadKeyStore()
	if err != nil {
		return err
	}
	ks.DefaultProject = projectID
	return SaveKeyStore(ks)
}

// RemoveProjectKey removes a project's API key.
func RemoveProjectKey(projectID string) error {
	ks, err := LoadKeyStore()
	if err != nil {
		return err
	}
	delete(ks.Keys, projectID)
	if ks.DefaultProject == projectID {
		ks.DefaultProject = ""
	}
	return SaveKeyStore(ks)
}
