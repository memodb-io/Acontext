package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
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

// callbackPayload is the JSON body POSTed by the Dashboard relay page.
type callbackPayload struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresAt    int64  `json:"expires_at"`
	UserID       string `json:"user_id"`
	UserEmail    string `json:"user_email"`
	State        string `json:"state"`
	Error        string `json:"error"`
}

// authResult is used internally to pass callback results via channel.
type authResult struct {
	af  *AuthFile
	err error
}

// callbackHandler returns an http.HandlerFunc that accepts the OAuth callback.
// It supports POST with JSON body (preferred) and GET with query params (fallback).
func callbackHandler(expectedState string, resultCh chan<- authResult) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Allow CORS for the POST from the Dashboard page
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		var p callbackPayload

		if r.Method == http.MethodPost && r.Body != nil {
			body, err := io.ReadAll(r.Body)
			if err != nil {
				resultCh <- authResult{err: fmt.Errorf("read callback body: %w", err)}
				http.Error(w, "Failed to read body", http.StatusBadRequest)
				return
			}
			if err := json.Unmarshal(body, &p); err != nil {
				resultCh <- authResult{err: fmt.Errorf("parse callback body: %w", err)}
				http.Error(w, "Invalid JSON", http.StatusBadRequest)
				return
			}
		} else {
			// GET fallback for backwards compat
			q := r.URL.Query()
			p.AccessToken = q.Get("access_token")
			p.RefreshToken = q.Get("refresh_token")
			p.ExpiresAt, _ = strconv.ParseInt(q.Get("expires_at"), 10, 64)
			p.UserID = q.Get("user_id")
			p.UserEmail = q.Get("user_email")
			p.State = q.Get("state")
			p.Error = q.Get("error")
		}

		if p.State != expectedState {
			resultCh <- authResult{err: fmt.Errorf("state mismatch")}
			http.Error(w, "State mismatch", http.StatusBadRequest)
			return
		}

		if p.Error != "" {
			resultCh <- authResult{err: fmt.Errorf("login error: %s", p.Error)}
			http.Error(w, p.Error, http.StatusBadRequest)
			return
		}

		if p.AccessToken == "" {
			resultCh <- authResult{err: fmt.Errorf("no access_token in callback")}
			http.Error(w, "No access token", http.StatusBadRequest)
			return
		}

		af := &AuthFile{
			AccessToken:  p.AccessToken,
			RefreshToken: p.RefreshToken,
			ExpiresAt:    p.ExpiresAt,
			User: AuthUser{
				ID:    p.UserID,
				Email: p.UserEmail,
			},
		}

		w.Header().Set("Content-Type", "text/html")
		fmt.Fprint(w, successHTML)
		resultCh <- authResult{af: af}
	}
}

// LoginStartBackground starts a background callback server and prints the login URL.
// The command returns immediately. The background server waits for the Dashboard
// to POST tokens, saves auth.json, and exits.
//
// The listener fd is passed to the child process to avoid a TOCTOU port race.
// Port and state are passed as command arguments (no temp state file needed).
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

	listener, err := listenOnPreferredPort()
	if err != nil {
		return "", fmt.Errorf("find available port: %w", err)
	}
	port := listener.Addr().(*net.TCPAddr).Port

	loginURL := fmt.Sprintf("%s/auth/cli-callback?cli_port=%d&state=%s",
		DashboardURL, port, state)

	// Fork background process: pass the listener fd (fd 3) + port & state as args.
	exe, err := os.Executable()
	if err != nil {
		listener.Close()
		return "", fmt.Errorf("find executable: %w", err)
	}

	// Get the underlying file from the TCP listener so we can pass it as ExtraFiles.
	tcpListener, ok := listener.(*net.TCPListener)
	if !ok {
		listener.Close()
		return "", fmt.Errorf("unexpected listener type")
	}
	listenerFile, err := tcpListener.File()
	if err != nil {
		listener.Close()
		return "", fmt.Errorf("get listener fd: %w", err)
	}
	// Close the original listener — the fd in listenerFile keeps the socket open.
	listener.Close()

	bgCmd := exec.Command(exe, "login", "--wait",
		fmt.Sprintf("%d", port), state)
	bgCmd.ExtraFiles = []*os.File{listenerFile} // fd 3
	bgCmd.Stdout = nil
	bgCmd.Stderr = nil
	bgCmd.Stdin = nil
	if err := bgCmd.Start(); err != nil {
		listenerFile.Close()
		return "", fmt.Errorf("start background listener: %w", err)
	}
	listenerFile.Close() // parent no longer needs it
	// Detach — don't wait for the background process
	go bgCmd.Wait()

	return loginURL, nil
}

// LoginWaitForCallback runs the background callback server.
// Called by `acontext login --wait <port> <state>`.
// The listener is inherited from the parent process via fd 3.
// Blocks until callback received or timeout, then saves auth.json and exits.
func LoginWaitForCallback(portStr, state string) error {
	port, err := strconv.Atoi(portStr)
	if err != nil {
		return fmt.Errorf("invalid port: %w", err)
	}

	// Recover the listener from fd 3 (passed via ExtraFiles).
	f := os.NewFile(3, "listener")
	if f == nil {
		return fmt.Errorf("no listener fd passed (fd 3)")
	}
	listener, err := net.FileListener(f)
	f.Close()
	if err != nil {
		return fmt.Errorf("recover listener from fd 3: %w", err)
	}
	_ = port // port is informational; the listener already has the right address

	resultCh := make(chan authResult, 1)

	mux := http.NewServeMux()
	mux.HandleFunc("/callback", callbackHandler(state, resultCh))

	server := &http.Server{Handler: mux}
	go server.Serve(listener)

	ctx, cancel := context.WithTimeout(context.Background(), callbackTimeout)
	defer func() {
		cancel()
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer shutdownCancel()
		server.Shutdown(shutdownCtx)
	}()

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

	resultCh := make(chan authResult, 1)

	mux := http.NewServeMux()
	mux.HandleFunc("/callback", callbackHandler(state, resultCh))

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
	defer func() {
		cancel()
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer shutdownCancel()
		server.Shutdown(shutdownCtx)
	}()

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
