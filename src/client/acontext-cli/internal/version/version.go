package version

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"
)

const (
	defaultGithubAPIURL = "https://api.github.com/repos/memodb-io/Acontext/releases"
	timeout             = 10 * time.Second
)

// githubAPIURL is a variable that can be overridden in tests
var githubAPIURL = defaultGithubAPIURL

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
	defer func() {
		if closeErr := resp.Body.Close(); closeErr != nil {
			// Log error but don't fail the function
			_ = closeErr
		}
	}()

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

	// Sort versions using semantic version comparison
	sort.Slice(cliVersions, func(i, j int) bool {
		return CompareVersions(cliVersions[i], cliVersions[j]) > 0
	})

	return cliVersions[0], nil
}

// parseVersion parses a version string into major, minor, patch numbers
// Returns (major, minor, patch, error)
func parseVersion(version string) (int, int, int, error) {
	// Remove 'v' prefix if present
	version = strings.TrimPrefix(version, "v")

	parts := strings.Split(version, ".")
	if len(parts) != 3 {
		return 0, 0, 0, fmt.Errorf("invalid version format: %s", version)
	}

	major, err := strconv.Atoi(parts[0])
	if err != nil {
		return 0, 0, 0, fmt.Errorf("invalid major version: %s", parts[0])
	}

	minor, err := strconv.Atoi(parts[1])
	if err != nil {
		return 0, 0, 0, fmt.Errorf("invalid minor version: %s", parts[1])
	}

	patch, err := strconv.Atoi(parts[2])
	if err != nil {
		return 0, 0, 0, fmt.Errorf("invalid patch version: %s", parts[2])
	}

	return major, minor, patch, nil
}

// CompareVersions compares two version strings using semantic versioning
// Returns:
//   - -1 if current < latest
//   - 0 if current == latest
//   - 1 if current > latest
func CompareVersions(current, latest string) int {
	currentMajor, currentMinor, currentPatch, err1 := parseVersion(current)
	latestMajor, latestMinor, latestPatch, err2 := parseVersion(latest)

	// If either version fails to parse, fall back to string comparison
	if err1 != nil || err2 != nil {
		current = strings.TrimPrefix(current, "v")
		latest = strings.TrimPrefix(latest, "v")
		if current < latest {
			return -1
		} else if current > latest {
			return 1
		}
		return 0
	}

	// Compare major version
	if currentMajor < latestMajor {
		return -1
	} else if currentMajor > latestMajor {
		return 1
	}

	// Compare minor version
	if currentMinor < latestMinor {
		return -1
	} else if currentMinor > latestMinor {
		return 1
	}

	// Compare patch version
	if currentPatch < latestPatch {
		return -1
	} else if currentPatch > latestPatch {
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

	// Compare versions using semantic versioning
	if CompareVersions(currentVersion, latestVersion) < 0 {
		return true, latestVersion, nil
	}

	return false, "", nil
}
