package auth

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

const authFileName = "auth.json"

// AuthUser holds basic user info from Supabase.
type AuthUser struct {
	ID    string `json:"id"`
	Email string `json:"email"`
}

// AuthFile is the on-disk format for ~/.acontext/auth.json.
type AuthFile struct {
	AccessToken  string   `json:"access_token"`
	RefreshToken string   `json:"refresh_token"`
	ExpiresAt    int64    `json:"expires_at"`
	User         AuthUser `json:"user"`
}

// getConfigDir returns ~/.acontext/, creating it with 0700 if needed.
func getConfigDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("cannot determine home directory: %w", err)
	}
	dir := filepath.Join(home, ".acontext")
	if err := os.MkdirAll(dir, 0700); err != nil {
		return "", fmt.Errorf("cannot create config directory: %w", err)
	}
	return dir, nil
}

// Load reads auth.json, returning nil if it doesn't exist.
func Load() (*AuthFile, error) {
	dir, err := getConfigDir()
	if err != nil {
		return nil, err
	}
	path := filepath.Join(dir, authFileName)

	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("cannot read auth file: %w", err)
	}

	var af AuthFile
	if err := json.Unmarshal(data, &af); err != nil {
		return nil, fmt.Errorf("cannot parse auth file: %w", err)
	}
	return &af, nil
}

// Save writes auth.json with 0600 permissions.
func Save(af *AuthFile) error {
	dir, err := getConfigDir()
	if err != nil {
		return err
	}
	path := filepath.Join(dir, authFileName)

	data, err := json.MarshalIndent(af, "", "  ")
	if err != nil {
		return fmt.Errorf("cannot marshal auth file: %w", err)
	}
	return os.WriteFile(path, data, 0600)
}

// Clear removes auth.json and credentials.json (logout).
func Clear() error {
	dir, err := getConfigDir()
	if err != nil {
		return err
	}

	// Remove auth.json
	authPath := filepath.Join(dir, authFileName)
	if err := os.Remove(authPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("cannot remove auth file: %w", err)
	}

	// Remove credentials.json
	credPath := filepath.Join(dir, credentialsFileName)
	if err := os.Remove(credPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("cannot remove credentials file: %w", err)
	}

	return nil
}

// IsLoggedIn returns true if a valid auth file exists with a token.
func IsLoggedIn() bool {
	af, err := Load()
	return err == nil && af != nil && af.AccessToken != ""
}

// IsExpired returns true if the access token has expired.
func (af *AuthFile) IsExpired() bool {
	return time.Now().Unix() >= af.ExpiresAt
}

// ExpiresWithin returns true if the token expires within the given duration.
func (af *AuthFile) ExpiresWithin(d time.Duration) bool {
	return time.Now().Add(d).Unix() >= af.ExpiresAt
}

// MustLoad loads auth.json and returns an error if not logged in.
func MustLoad() (*AuthFile, error) {
	af, err := Load()
	if err != nil {
		return nil, err
	}
	if af == nil || af.AccessToken == "" {
		return nil, fmt.Errorf("not logged in — run 'acontext login' first")
	}
	return af, nil
}
