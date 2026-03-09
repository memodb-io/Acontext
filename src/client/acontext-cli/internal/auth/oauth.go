package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
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
	callbackTimeout = 60 * time.Second
	successHTML     = `<!DOCTYPE html><html><head><title>Login Successful</title><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#f8f9fa}div{text-align:center;padding:2rem;background:white;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.1)}</style></head><body><div><h2>Login Successful!</h2><p>You can close this tab and return to the terminal.</p></div></body></html>`
)

// LoginStartBackground starts a background callback server and prints the login URL.
// The command returns immediately. The background server waits for the Dashboard
// to redirect tokens, saves auth.json, and exits.
//
// Returns the login URL.
func LoginStartBackground() (string, error) {
	if DashboardURL == "" {
		return "", fmt.Errorf("Dashboard URL not configured")
	}

	state, err := generateState()
	if err != nil {
		return "", fmt.Errorf("generate state: %w", err)
	}

	// Find a port
	listener, err := listenOnPreferredPort()
	if err != nil {
		return "", fmt.Errorf("find available port: %w", err)
	}
	port := listener.Addr().(*net.TCPAddr).Port
	listener.Close() // release so the background process can bind

	loginURL := fmt.Sprintf("%s/auth/cli-callback?cli_port=%d&state=%s",
		DashboardURL, port, state)

	// Write state file for background process
	stateFile := filepath.Join(os.TempDir(), fmt.Sprintf("acontext-login-%d.json", port))
	stateData, _ := json.Marshal(map[string]interface{}{
		"port":  port,
		"state": state,
	})
	if err := os.WriteFile(stateFile, stateData, 0600); err != nil {
		return "", fmt.Errorf("write state file: %w", err)
	}

	// Fork background process: re-exec ourselves with --wait flag
	exe, err := os.Executable()
	if err != nil {
		return "", fmt.Errorf("find executable: %w", err)
	}

	bgCmd := exec.Command(exe, "login", "--wait", stateFile)
	bgCmd.Stdout = nil
	bgCmd.Stderr = nil
	bgCmd.Stdin = nil
	if err := bgCmd.Start(); err != nil {
		return "", fmt.Errorf("start background listener: %w", err)
	}
	// Detach — don't wait for the background process
	go bgCmd.Wait()

	return loginURL, nil
}

// LoginWaitForCallback runs the background callback server.
// Called by `acontext login --wait <state-file>`.
// Blocks until callback received or timeout, then saves auth.json and exits.
func LoginWaitForCallback(stateFile string) error {
	data, err := os.ReadFile(stateFile)
	if err != nil {
		return fmt.Errorf("read state file: %w", err)
	}
	defer os.Remove(stateFile)

	var sf struct {
		Port  int    `json:"port"`
		State string `json:"state"`
	}
	if err := json.Unmarshal(data, &sf); err != nil {
		return fmt.Errorf("parse state file: %w", err)
	}

	listener, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", sf.Port))
	if err != nil {
		return fmt.Errorf("bind port %d: %w", sf.Port, err)
	}

	type authResult struct {
		af  *AuthFile
		err error
	}
	resultCh := make(chan authResult, 1)

	mux := http.NewServeMux()
	mux.HandleFunc("/callback", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()

		if q.Get("state") != sf.State {
			resultCh <- authResult{err: fmt.Errorf("state mismatch")}
			http.Error(w, "State mismatch", http.StatusBadRequest)
			return
		}

		if errMsg := q.Get("error"); errMsg != "" {
			resultCh <- authResult{err: fmt.Errorf("login error: %s", errMsg)}
			http.Error(w, errMsg, http.StatusBadRequest)
			return
		}

		accessToken := q.Get("access_token")
		if accessToken == "" {
			resultCh <- authResult{err: fmt.Errorf("no access_token")}
			http.Error(w, "No access token", http.StatusBadRequest)
			return
		}

		expiresAt, _ := strconv.ParseInt(q.Get("expires_at"), 10, 64)
		af := &AuthFile{
			AccessToken:  accessToken,
			RefreshToken: q.Get("refresh_token"),
			ExpiresAt:    expiresAt,
			User: AuthUser{
				ID:    q.Get("user_id"),
				Email: q.Get("user_email"),
			},
		}

		w.Header().Set("Content-Type", "text/html")
		fmt.Fprint(w, successHTML)
		resultCh <- authResult{af: af}
	})

	server := &http.Server{Handler: mux}
	go server.Serve(listener)

	ctx, cancel := context.WithTimeout(context.Background(), callbackTimeout)
	defer cancel()
	defer server.Shutdown(ctx)

	select {
	case result := <-resultCh:
		if result.err != nil {
			return result.err
		}
		return Save(result.af)
	case <-ctx.Done():
		return fmt.Errorf("login timed out")
	}
}

// LoginInteractive performs the full blocking login flow (for TTY use).
func LoginInteractive() (*AuthFile, error) {
	if DashboardURL == "" {
		return nil, fmt.Errorf("Dashboard URL not configured")
	}

	state, err := generateState()
	if err != nil {
		return nil, fmt.Errorf("generate state: %w", err)
	}

	listener, err := listenOnPreferredPort()
	if err != nil {
		return nil, fmt.Errorf("start callback server: %w", err)
	}
	port := listener.Addr().(*net.TCPAddr).Port

	type authResult struct {
		af  *AuthFile
		err error
	}
	resultCh := make(chan authResult, 1)

	mux := http.NewServeMux()
	mux.HandleFunc("/callback", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()

		if q.Get("state") != state {
			resultCh <- authResult{err: fmt.Errorf("state mismatch — possible CSRF attack")}
			http.Error(w, "State mismatch", http.StatusBadRequest)
			return
		}
		if errMsg := q.Get("error"); errMsg != "" {
			resultCh <- authResult{err: fmt.Errorf("login error: %s", errMsg)}
			http.Error(w, errMsg, http.StatusBadRequest)
			return
		}
		accessToken := q.Get("access_token")
		if accessToken == "" {
			resultCh <- authResult{err: fmt.Errorf("no access_token in callback")}
			http.Error(w, "No access token", http.StatusBadRequest)
			return
		}

		expiresAt, _ := strconv.ParseInt(q.Get("expires_at"), 10, 64)
		af := &AuthFile{
			AccessToken:  accessToken,
			RefreshToken: q.Get("refresh_token"),
			ExpiresAt:    expiresAt,
			User: AuthUser{
				ID:    q.Get("user_id"),
				Email: q.Get("user_email"),
			},
		}

		w.Header().Set("Content-Type", "text/html")
		fmt.Fprint(w, successHTML)
		resultCh <- authResult{af: af}
	})

	server := &http.Server{Handler: mux}
	go server.Serve(listener)

	loginURL := fmt.Sprintf("%s/auth/cli-callback?cli_port=%d&state=%s",
		DashboardURL, port, state)

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

	ctx, cancel := context.WithTimeout(context.Background(), callbackTimeout)
	defer cancel()
	defer server.Shutdown(ctx)

	select {
	case result := <-resultCh:
		if result.err != nil {
			return nil, result.err
		}
		return result.af, nil
	case <-ctx.Done():
		return nil, fmt.Errorf("login timed out — please try again")
	}
}

// --- Helpers ---

func listenOnPreferredPort() (net.Listener, error) {
	preferredPorts := []int{19876, 19877, 19878}
	for _, p := range preferredPorts {
		l, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", p))
		if err == nil {
			return l, nil
		}
	}
	return net.Listen("tcp", "127.0.0.1:0")
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
