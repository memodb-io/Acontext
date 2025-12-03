package telemetry

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"runtime"
	"sync"
	"time"
)

const (
	telemetryEndpoint = "https://telemetry.acontext.io/v1/events"
)

// telemetryBearerToken is set at build time via ldflags
var telemetryBearerToken = ""

// Event represents a telemetry event
type Event struct {
	Command   string `json:"command"`
	Success   bool   `json:"success"`
	Error     string `json:"error,omitempty"`
	Duration  int64  `json:"duration_ms"`
	Timestamp string `json:"timestamp"`
	Version   string `json:"version"`
	OS        string `json:"os"`
	Arch      string `json:"arch"`
}

// SendEvent sends a telemetry event asynchronously
func SendEvent(event Event) {
	// Send in a goroutine to avoid blocking
	go func() {
		_ = sendEvent(event)
		// Silently fail - telemetry should not affect user experience
	}()
}

// SendEventAsync sends a telemetry event asynchronously and returns a WaitGroup to wait for completion
func SendEventAsync(event Event) *sync.WaitGroup {
	var wg sync.WaitGroup
	wg.Add(1)
	// Send in a goroutine to avoid blocking
	go func() {
		defer wg.Done()
		_ = sendEvent(event)
		// Silently fail - telemetry should not affect user experience
	}()
	return &wg
}

// SendEventSync sends a telemetry event synchronously and waits for completion
func SendEventSync(event Event) error {
	return sendEvent(event)
}

// sendEvent actually sends the event to the telemetry endpoint
func sendEvent(event Event) error {
	// Set timestamp if not set
	if event.Timestamp == "" {
		event.Timestamp = time.Now().UTC().Format(time.RFC3339)
	}

	// Set system info if not set
	if event.OS == "" {
		event.OS = runtime.GOOS
	}
	if event.Arch == "" {
		event.Arch = runtime.GOARCH
	}

	// Marshal event to JSON
	jsonData, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	// Create HTTP request
	req, err := http.NewRequest("POST", telemetryEndpoint, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "acontext-cli")

	// Add bearer token if available (set at build time)
	if telemetryBearerToken != "" {
		req.Header.Set("Authorization", "Bearer "+telemetryBearerToken)
	}

	// Create HTTP client with timeout
	client := &http.Client{
		Timeout: 5 * time.Second,
	}

	// Send request
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	// Check response status
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	return nil
}

// TrackCommand tracks a command execution
func TrackCommand(command string, success bool, err error, duration time.Duration, version string) {
	event := Event{
		Command:  command,
		Success:  success,
		Duration: duration.Milliseconds(),
		Version:  version,
	}

	if err != nil {
		event.Error = err.Error()
	}

	SendEvent(event)
}

// TrackCommandAsync tracks a command execution asynchronously and returns a WaitGroup to wait for completion
func TrackCommandAsync(command string, success bool, err error, duration time.Duration, version string) *sync.WaitGroup {
	event := Event{
		Command:  command,
		Success:  success,
		Duration: duration.Milliseconds(),
		Version:  version,
	}

	if err != nil {
		event.Error = err.Error()
	}

	return SendEventAsync(event)
}

// TrackCommandSync tracks a command execution synchronously and waits for completion
func TrackCommandSync(command string, success bool, err error, duration time.Duration, version string) error {
	event := Event{
		Command:  command,
		Success:  success,
		Duration: duration.Milliseconds(),
		Version:  version,
	}

	if err != nil {
		event.Error = err.Error()
	}

	return SendEventSync(event)
}
