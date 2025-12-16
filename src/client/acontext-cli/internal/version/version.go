package version

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"
)

const (
	githubAPIURL = "https://api.github.com/repos/memodb-io/Acontext/releases"
	timeout      = 10 * time.Second
)

// Release represents a GitHub release
type Release struct {
	TagName string `json:"tag_name"`
}

// GetLatestVersion fetches the latest CLI version from GitHub releases
// Returns the version string (e.g., "v0.0.1") without the "cli/" prefix
func GetLatestVersion() (string, error) {
	client := &http.Client{
		Timeout: timeout,
	}

	resp, err := client.Get(githubAPIURL)
	if err != nil {
		return "", fmt.Errorf("failed to fetch releases: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var releases []Release
	if err := json.NewDecoder(resp.Body).Decode(&releases); err != nil {
		return "", fmt.Errorf("failed to decode response: %w", err)
	}

	// Filter and extract CLI versions (format: cli/vX.X.X)
	var cliVersions []string
	for _, release := range releases {
		if strings.HasPrefix(release.TagName, "cli/v") {
			// Remove "cli/" prefix
			version := strings.TrimPrefix(release.TagName, "cli/")
			cliVersions = append(cliVersions, version)
		}
	}

	if len(cliVersions) == 0 {
		return "", fmt.Errorf("no CLI releases found")
	}

	// Sort versions (simple string sort works for semantic versions)
	sort.Sort(sort.Reverse(sort.StringSlice(cliVersions)))

	return cliVersions[0], nil
}

// CompareVersions compares two version strings
// Returns:
//   - -1 if current < latest
//   - 0 if current == latest
//   - 1 if current > latest
func CompareVersions(current, latest string) int {
	// Remove 'v' prefix if present
	current = strings.TrimPrefix(current, "v")
	latest = strings.TrimPrefix(latest, "v")

	// Simple string comparison works for semantic versions
	if current < latest {
		return -1
	} else if current > latest {
		return 1
	}
	return 0
}

// IsUpdateAvailable checks if an update is available
func IsUpdateAvailable(currentVersion string) (bool, string, error) {
	// Skip check for dev version
	if currentVersion == "dev" {
		return false, "", nil
	}

	latestVersion, err := GetLatestVersion()
	if err != nil {
		return false, "", err
	}

	// Remove 'v' prefix from current version for comparison
	current := strings.TrimPrefix(currentVersion, "v")
	latest := strings.TrimPrefix(latestVersion, "v")

	if current < latest {
		return true, latestVersion, nil
	}

	return false, "", nil
}

