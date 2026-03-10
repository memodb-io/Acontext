package auth

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"time"
)

// Supabase configuration — injected via ldflags at build time.
var (
	SupabaseURL     = ""
	SupabaseAnonKey = ""
)

// DashboardURL is the Dashboard base URL used for the CLI login relay.
var DashboardURL = "https://dash.acontext.io"

const (
	pollInterval = 2 * time.Second
	pollTimeout  = 120 * time.Second
)

const pendingLoginFile = "pending_login.json"

// pendingLogin is the on-disk format for ~/.acontext/pending_login.json.
type pendingLogin struct {
	State     string `json:"state"`
	LoginURL  string `json:"login_url"`
	CreatedAt int64  `json:"created_at"`
}

// LoginInteractive performs the full blocking login flow (for TTY use).
// Opens the browser and polls Supabase until the Dashboard stores tokens.
func LoginInteractive() (*AuthFile, error) {
	if err := validateConfig(); err != nil {
		return nil, err
	}

	state, err := generateState()
	if err != nil {
		return nil, fmt.Errorf("generate state: %w", err)
	}

	loginURL := fmt.Sprintf("%s/auth/cli-callback?state=%s", DashboardURL, state)

	fmt.Println()
	fmt.Println("Please open the following URL in your browser to authenticate:")
	fmt.Println()
	fmt.Printf("  ➜  %s\n", loginURL)
	fmt.Println()

	fmt.Println("Opening browser...")
	if err := openBrowser(loginURL); err != nil {
		fmt.Println("Could not open browser — please open the URL above manually.")
	}

	fmt.Println("Waiting for authentication...")

	af, err := pollForSession(state, pollTimeout)
	if err != nil {
		return nil, err
	}
	return af, nil
}

// LoginNonInteractive prints the login URL and saves state for later polling.
// Used in non-TTY (agent) mode. Returns the login URL.
func LoginNonInteractive() (string, error) {
	if err := validateConfig(); err != nil {
		return "", err
	}

	state, err := generateState()
	if err != nil {
		return "", fmt.Errorf("generate state: %w", err)
	}

	loginURL := fmt.Sprintf("%s/auth/cli-callback?state=%s", DashboardURL, state)

	// Save state for later polling via `login --poll`
	if err := savePendingLogin(state, loginURL); err != nil {
		return "", fmt.Errorf("save pending login: %w", err)
	}

	return loginURL, nil
}

// LoginPoll checks for a pending login and polls Supabase for the session.
// Used by `acontext login --poll`.
func LoginPoll() error {
	pending, err := loadPendingLogin()
	if err != nil {
		return fmt.Errorf("load pending login: %w", err)
	}
	if pending == nil {
		return fmt.Errorf("no pending login found — run 'acontext login' first")
	}

	// Check if pending login is too old (5 minutes, matching Supabase TTL)
	if time.Since(time.Unix(pending.CreatedAt, 0)) > 5*time.Minute {
		_ = clearPendingLogin()
		return fmt.Errorf("pending login expired — run 'acontext login' again")
	}

	// Use a shorter timeout for non-interactive polling — the agent should
	// only call --poll after the user confirms browser login is complete.
	const pollPollTimeout = 15 * time.Second
	af, err := pollForSession(pending.State, pollPollTimeout)
	if err != nil {
		return err
	}

	if err := Save(af); err != nil {
		return fmt.Errorf("save auth: %w", err)
	}

	_ = clearPendingLogin()
	return nil
}

// pollForSession polls Supabase claim_cli_session until tokens are available.
// Transient errors (network issues, 5xx) are retried up to maxTransientErrors
// times before aborting.
func pollForSession(state string, timeout time.Duration) (*AuthFile, error) {
	const maxTransientErrors = 5

	deadline := time.After(timeout)
	ticker := time.NewTicker(pollInterval)
	defer ticker.Stop()

	transientErrors := 0
	for {
		select {
		case <-deadline:
			return nil, fmt.Errorf("login timed out — please try again")
		case <-ticker.C:
			af, err := ClaimCLISession(state)
			if err != nil {
				transientErrors++
				if transientErrors >= maxTransientErrors {
					return nil, fmt.Errorf("poll failed after %d consecutive errors: %w", transientErrors, err)
				}
				// Transient error, keep retrying
				continue
			}
			transientErrors = 0
			if af != nil {
				return af, nil
			}
			// Not ready yet, keep polling
		}
	}
}

// --- Pending login file helpers ---

func savePendingLogin(state, loginURL string) error {
	dir, err := getConfigDir()
	if err != nil {
		return err
	}
	p := &pendingLogin{
		State:     state,
		LoginURL:  loginURL,
		CreatedAt: time.Now().Unix(),
	}
	data, err := json.MarshalIndent(p, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(dir, pendingLoginFile), data, 0600)
}

func loadPendingLogin() (*pendingLogin, error) {
	dir, err := getConfigDir()
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(filepath.Join(dir, pendingLoginFile))
	if os.IsNotExist(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var p pendingLogin
	if err := json.Unmarshal(data, &p); err != nil {
		return nil, err
	}
	return &p, nil
}

func clearPendingLogin() error {
	dir, err := getConfigDir()
	if err != nil {
		return err
	}
	err = os.Remove(filepath.Join(dir, pendingLoginFile))
	if os.IsNotExist(err) {
		return nil
	}
	return err
}

// --- Helpers ---

// validateConfig checks that required build-time configuration is set.
func validateConfig() error {
	if DashboardURL == "" {
		return fmt.Errorf("dashboard URL not configured")
	}
	if SupabaseURL == "" || SupabaseAnonKey == "" {
		return fmt.Errorf("supabase configuration missing — this binary was not built with required ldflags (SUPABASE_URL, SUPABASE_ANON_KEY)")
	}
	return nil
}

func GetConfigDir() (string, error) {
	return getConfigDir()
}

func generateState() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func IsTTY() bool {
	fi, err := os.Stdout.Stat()
	if err != nil {
		return false
	}
	return (fi.Mode() & os.ModeCharDevice) != 0
}

func openBrowser(rawURL string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", rawURL)
	case "linux":
		cmd = exec.Command("xdg-open", rawURL)
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", rawURL)
	default:
		return fmt.Errorf("unsupported platform")
	}
	return cmd.Start()
}
