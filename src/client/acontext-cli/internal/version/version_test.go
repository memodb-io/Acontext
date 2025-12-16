package version

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCompareVersions(t *testing.T) {
	tests := []struct {
		name     string
		current  string
		latest   string
		expected int
	}{
		{
			name:     "current less than latest",
			current:  "v0.0.1",
			latest:   "v0.0.2",
			expected: -1,
		},
		{
			name:     "current greater than latest",
			current:  "v0.0.2",
			latest:   "v0.0.1",
			expected: 1,
		},
		{
			name:     "current equals latest",
			current:  "v0.0.1",
			latest:   "v0.0.1",
			expected: 0,
		},
		{
			name:     "without v prefix - current less",
			current:  "0.0.1",
			latest:   "0.0.2",
			expected: -1,
		},
		{
			name:     "without v prefix - current greater",
			current:  "0.0.2",
			latest:   "0.0.1",
			expected: 1,
		},
		{
			name:     "mixed prefixes",
			current:  "v0.1.0",
			latest:   "0.2.0",
			expected: -1,
		},
		{
			name:     "higher minor version",
			current:  "v0.1.0",
			latest:   "v0.2.0",
			expected: -1,
		},
		{
			name:     "higher major version",
			current:  "v0.9.0",
			latest:   "v1.0.0",
			expected: -1,
		},
		{
			name:     "patch version difference",
			current:  "v1.0.0",
			latest:   "v1.0.1",
			expected: -1,
		},
		{
			name:     "patch version greater than 9",
			current:  "v0.0.9",
			latest:   "v0.0.18",
			expected: -1,
		},
		{
			name:     "patch version greater than 9 - reverse",
			current:  "v0.0.18",
			latest:   "v0.0.9",
			expected: 1,
		},
		{
			name:     "minor version greater than 9",
			current:  "v0.9.0",
			latest:   "v0.18.0",
			expected: -1,
		},
		{
			name:     "major version greater than 9",
			current:  "v9.0.0",
			latest:   "v18.0.0",
			expected: -1,
		},
		{
			name:     "complex version comparison",
			current:  "v0.0.15",
			latest:   "v0.0.20",
			expected: -1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := CompareVersions(tt.current, tt.latest)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestGetLatestVersion(t *testing.T) {
	tests := []struct {
		name            string
		releases        []Release
		statusCode      int
		responseBody    string
		wantErr         bool
		expectedVersion string
		errContains     string
	}{
		{
			name: "successful fetch with CLI versions",
			releases: []Release{
				{TagName: "cli/v0.0.1"},
				{TagName: "cli/v0.0.3"},
				{TagName: "cli/v0.0.2"},
				{TagName: "other/v1.0.0"},
			},
			statusCode:      http.StatusOK,
			wantErr:         false,
			expectedVersion: "v0.0.3",
		},
		{
			name: "versions greater than 9",
			releases: []Release{
				{TagName: "cli/v0.0.9"},
				{TagName: "cli/v0.0.18"},
				{TagName: "cli/v0.0.15"},
				{TagName: "cli/v0.0.2"},
			},
			statusCode:      http.StatusOK,
			wantErr:         false,
			expectedVersion: "v0.0.18",
		},
		{
			name: "single CLI version",
			releases: []Release{
				{TagName: "cli/v1.0.0"},
			},
			statusCode:      http.StatusOK,
			wantErr:         false,
			expectedVersion: "v1.0.0",
		},
		{
			name: "no CLI versions found",
			releases: []Release{
				{TagName: "other/v1.0.0"},
				{TagName: "api/v2.0.0"},
			},
			statusCode:  http.StatusOK,
			wantErr:     true,
			errContains: "no CLI releases found",
		},
		{
			name:        "empty releases",
			releases:    []Release{},
			statusCode:  http.StatusOK,
			wantErr:     true,
			errContains: "no CLI releases found",
		},
		{
			name:        "non-200 status code",
			statusCode:  http.StatusNotFound,
			wantErr:     true,
			errContains: "unexpected status code",
		},
		{
			name:         "invalid JSON response",
			statusCode:   http.StatusOK,
			responseBody: "invalid json",
			wantErr:      true,
			errContains:  "failed to decode response",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a mock HTTP server
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(tt.statusCode)
				if tt.responseBody != "" {
					w.Write([]byte(tt.responseBody))
				} else {
					json.NewEncoder(w).Encode(tt.releases)
				}
			}))
			defer server.Close()

			// Temporarily override the githubAPIURL for testing
			originalURL := githubAPIURL
			githubAPIURL = server.URL
			defer func() { githubAPIURL = originalURL }()

			version, err := GetLatestVersion()

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errContains != "" {
					assert.Contains(t, err.Error(), tt.errContains)
				}
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedVersion, version)
			}
		})
	}
}

func TestIsUpdateAvailable(t *testing.T) {
	tests := []struct {
		name           string
		currentVersion string
		releases       []Release
		statusCode     int
		wantErr        bool
		wantAvailable  bool
		expectedLatest string
		errContains    string
	}{
		{
			name:           "update available - current less than latest",
			currentVersion: "v0.0.1",
			releases: []Release{
				{TagName: "cli/v0.0.2"},
				{TagName: "cli/v0.0.1"},
			},
			statusCode:     http.StatusOK,
			wantErr:        false,
			wantAvailable:  true,
			expectedLatest: "v0.0.2",
		},
		{
			name:           "no update - current equals latest",
			currentVersion: "v0.0.2",
			releases: []Release{
				{TagName: "cli/v0.0.2"},
				{TagName: "cli/v0.0.1"},
			},
			statusCode:    http.StatusOK,
			wantErr:       false,
			wantAvailable: false,
		},
		{
			name:           "no update - current greater than latest",
			currentVersion: "v0.0.3",
			releases: []Release{
				{TagName: "cli/v0.0.2"},
				{TagName: "cli/v0.0.1"},
			},
			statusCode:    http.StatusOK,
			wantErr:       false,
			wantAvailable: false,
		},
		{
			name:           "dev version - skip check",
			currentVersion: "dev",
			releases: []Release{
				{TagName: "cli/v0.0.2"},
			},
			statusCode:    http.StatusOK,
			wantErr:       false,
			wantAvailable: false,
		},
		{
			name:           "version without v prefix",
			currentVersion: "0.0.1",
			releases: []Release{
				{TagName: "cli/v0.0.2"},
			},
			statusCode:     http.StatusOK,
			wantErr:        false,
			wantAvailable:  true,
			expectedLatest: "v0.0.2",
		},
		{
			name:           "update available - version greater than 9",
			currentVersion: "v0.0.9",
			releases: []Release{
				{TagName: "cli/v0.0.18"},
				{TagName: "cli/v0.0.15"},
			},
			statusCode:     http.StatusOK,
			wantErr:        false,
			wantAvailable:  true,
			expectedLatest: "v0.0.18",
		},
		{
			name:           "no update - current version greater than 9",
			currentVersion: "v0.0.18",
			releases: []Release{
				{TagName: "cli/v0.0.15"},
				{TagName: "cli/v0.0.9"},
			},
			statusCode:    http.StatusOK,
			wantErr:       false,
			wantAvailable: false,
		},
		{
			name:           "error fetching latest version",
			currentVersion: "v0.0.1",
			statusCode:     http.StatusNotFound,
			wantErr:        true,
			errContains:    "unexpected status code",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a mock HTTP server
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(tt.statusCode)
				if tt.statusCode == http.StatusOK {
					json.NewEncoder(w).Encode(tt.releases)
				}
			}))
			defer server.Close()

			// Temporarily override the githubAPIURL for testing
			originalURL := githubAPIURL
			githubAPIURL = server.URL
			defer func() { githubAPIURL = originalURL }()

			available, latest, err := IsUpdateAvailable(tt.currentVersion)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errContains != "" {
					assert.Contains(t, err.Error(), tt.errContains)
				}
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.wantAvailable, available)
				if tt.expectedLatest != "" {
					assert.Equal(t, tt.expectedLatest, latest)
				}
			}
		})
	}
}

func TestGetLatestVersion_Sorting(t *testing.T) {
	// Test that versions are sorted correctly (highest first)
	releases := []Release{
		{TagName: "cli/v0.0.1"},
		{TagName: "cli/v0.0.5"},
		{TagName: "cli/v0.0.3"},
		{TagName: "cli/v0.0.9"},
		{TagName: "cli/v0.0.2"},
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(releases)
	}))
	defer server.Close()

	originalURL := githubAPIURL
	githubAPIURL = server.URL
	defer func() { githubAPIURL = originalURL }()

	version, err := GetLatestVersion()
	require.NoError(t, err)
	assert.Equal(t, "v0.0.9", version, "should return the highest version")
}

func TestGetLatestVersion_Sorting_GreaterThan9(t *testing.T) {
	// Test that versions greater than 9 are sorted correctly
	releases := []Release{
		{TagName: "cli/v0.0.1"},
		{TagName: "cli/v0.0.9"},
		{TagName: "cli/v0.0.18"},
		{TagName: "cli/v0.0.15"},
		{TagName: "cli/v0.0.2"},
		{TagName: "cli/v0.0.20"},
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(releases)
	}))
	defer server.Close()

	originalURL := githubAPIURL
	githubAPIURL = server.URL
	defer func() { githubAPIURL = originalURL }()

	version, err := GetLatestVersion()
	require.NoError(t, err)
	assert.Equal(t, "v0.0.20", version, "should return the highest version (v0.0.20, not v0.0.9)")
}
