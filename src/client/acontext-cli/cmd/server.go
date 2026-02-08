package cmd

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/memodb-io/Acontext/acontext-cli/internal/docker"
	"github.com/memodb-io/Acontext/acontext-cli/internal/pkgmgr"
	"github.com/memodb-io/Acontext/acontext-cli/internal/platform"
	"github.com/memodb-io/Acontext/acontext-cli/internal/sandbox"
	"github.com/spf13/cobra"
)

const (
	defaultSandboxType   = "cloudflare"
	defaultBufferSize    = 500
	dockerStatusInterval = 2 * time.Second
)

// dockerComposeServiceShort maps compose service names to short display labels.
var dockerComposeServiceShort = map[string]string{
	"acontext-server-pg":              "pg",
	"acontext-server-redis":           "redis",
	"acontext-server-rabbitmq":        "rabbitmq",
	"acontext-server-seaweedfs":       "seaweedfs",
	"acontext-server-seaweedfs-setup": "s3-setup",
	"acontext-server-jaeger":          "jaeger",
	"acontext-server-core":            "core",
	"acontext-server-api":             "api",
	"acontext-server-ui":              "ui",
}

var dockerStatusDisplayOrder = []string{"pg", "redis", "rabbitmq", "seaweedfs", "jaeger", "core", "api", "ui"}

var ServerCmd = &cobra.Command{
	Use:   "server",
	Short: "Start Acontext server with sandbox and docker",
	Long: `Start Acontext server with both sandbox and docker services running concurrently.

This command will:
  1. Check if sandbox/cloudflare exists, create it if missing
  2. Start sandbox development server
  3. Start docker services
  4. Display both outputs in a split-screen terminal UI`,
}

var serverUpCmd = &cobra.Command{
	Use:   "up",
	Short: "Start server with sandbox and docker",
	Long:  "Start both sandbox and docker services in a split-screen view",
	RunE:  runServerUp,
}

func init() {
	ServerCmd.AddCommand(serverUpCmd)
}

// OutputBuffer is a thread-safe buffer for storing output lines
type OutputBuffer struct {
	mu        sync.RWMutex
	lines     []string
	maxLen    int
	onNewLine func()
}

func NewOutputBuffer(maxLen int) *OutputBuffer {
	return &OutputBuffer{
		lines:  make([]string, 0),
		maxLen: maxLen,
	}
}

func (b *OutputBuffer) SetOnNewLine(callback func()) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.onNewLine = callback
}

func (b *OutputBuffer) AddLine(line string) {
	var callback func()
	b.mu.Lock()
	b.lines = append(b.lines, line)
	if len(b.lines) > b.maxLen {
		// Copy to a new slice to avoid leaking memory from the underlying array.
		// Without this, b.lines = b.lines[1:] would advance the slice header while
		// the old elements remain in the underlying array, causing unbounded growth.
		newLines := make([]string, b.maxLen)
		copy(newLines, b.lines[len(b.lines)-b.maxLen:])
		b.lines = newLines
	}
	callback = b.onNewLine
	b.mu.Unlock()

	// Call callback outside of lock to avoid deadlock
	if callback != nil {
		callback()
	}
}

func (b *OutputBuffer) GetLines() []string {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return append([]string(nil), b.lines...)
}

type model struct {
	sandboxBuffer     *OutputBuffer
	dockerBuffer      *OutputBuffer
	width             int
	height            int
	sandboxScroll     int
	dockerScroll      int
	quitting          bool
	autoScroll        bool
	mu                sync.RWMutex
	dockerStatus      map[string]string // short name -> "running", "exited", etc.
	dockerStatusMu    sync.RWMutex
	dockerStatusLines int // reserved lines for header+status in docker panel (2)
}

func initialModel() *model {
	m := &model{
		sandboxBuffer:     NewOutputBuffer(defaultBufferSize),
		dockerBuffer:      NewOutputBuffer(defaultBufferSize),
		sandboxScroll:     0,
		dockerScroll:      0,
		autoScroll:        true,
		dockerStatus:      make(map[string]string),
		dockerStatusLines: 2, // DOCKER header + status bar
	}
	m.sandboxBuffer.SetOnNewLine(func() {
		m.mu.RLock()
		shouldAutoScroll := m.autoScroll
		m.mu.RUnlock()
		if shouldAutoScroll {
			m.autoScrollSandbox()
		}
	})
	m.dockerBuffer.SetOnNewLine(func() {
		m.mu.RLock()
		shouldAutoScroll := m.autoScroll
		m.mu.RUnlock()
		if shouldAutoScroll {
			m.autoScrollDocker()
		}
	})

	return m
}

func (m *model) autoScrollSandbox() {
	m.mu.RLock()
	height := m.height
	m.mu.RUnlock()

	if height == 0 {
		return
	}
	sandboxLines := m.sandboxBuffer.GetLines()
	panelHeight := (height - 3) / 2
	if panelHeight <= 0 {
		panelHeight = 1
	}
	maxScroll := 0
	if len(sandboxLines) > panelHeight {
		maxScroll = len(sandboxLines) - panelHeight
	}
	if maxScroll < 0 {
		maxScroll = 0
	}
	m.mu.Lock()
	m.sandboxScroll = maxScroll
	m.mu.Unlock()
}

func (m *model) autoScrollDocker() {
	m.mu.RLock()
	height := m.height
	statusLines := m.dockerStatusLines
	m.mu.RUnlock()

	if height == 0 {
		return
	}
	dockerLines := m.dockerBuffer.GetLines()
	panelHeight := (height - 3) / 2
	if panelHeight <= 0 {
		panelHeight = 1
	}
	contentHeight := panelHeight - statusLines
	if contentHeight <= 0 {
		contentHeight = 1
	}
	maxScroll := 0
	if len(dockerLines) > contentHeight {
		maxScroll = len(dockerLines) - contentHeight
	}
	if maxScroll < 0 {
		maxScroll = 0
	}
	m.mu.Lock()
	m.dockerScroll = maxScroll
	m.mu.Unlock()
}

func (m *model) Init() tea.Cmd {
	return tea.Batch(
		tea.EnterAltScreen,
		tickCmd(),
	)
}

func tickCmd() tea.Cmd {
	return tea.Tick(time.Millisecond*100, func(time.Time) tea.Msg {
		return tickMsg{}
	})
}

type tickMsg struct{}

func (m *model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.mu.Lock()
		m.width = msg.Width
		m.height = msg.Height
		autoScroll := m.autoScroll
		m.mu.Unlock()
		if autoScroll {
			m.autoScrollSandbox()
			m.autoScrollDocker()
		}
		return m, nil
	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "q":
			m.mu.Lock()
			m.quitting = true
			m.mu.Unlock()
			return m, tea.Quit
		}
	case tea.MouseMsg:
		m.mu.RLock()
		height := m.height
		m.mu.RUnlock()

		panelHeight := (height - 3) / 2
		if panelHeight <= 0 {
			panelHeight = 1
		}

		switch msg.Button {
		case tea.MouseButtonWheelUp, tea.MouseButtonWheelDown:
			isSandboxPanel := msg.Y < height/2

			if isSandboxPanel {
				m.mu.Lock()
				m.autoScroll = false
				m.mu.Unlock()

				switch msg.Button {
				case tea.MouseButtonWheelUp:
					m.mu.Lock()
					if m.sandboxScroll > 0 {
						m.sandboxScroll--
					}
					m.mu.Unlock()
				case tea.MouseButtonWheelDown:
					sandboxLines := m.sandboxBuffer.GetLines()
					maxScroll := 0
					if len(sandboxLines) > panelHeight {
						maxScroll = len(sandboxLines) - panelHeight
					}
					m.mu.Lock()
					if m.sandboxScroll < maxScroll {
						m.sandboxScroll++
					} else {
						m.autoScroll = true
					}
					m.mu.Unlock()
				}
			} else {
				m.mu.Lock()
				m.autoScroll = false
				m.mu.Unlock()

				contentHeight := panelHeight - m.dockerStatusLines
				if contentHeight <= 0 {
					contentHeight = 1
				}
				switch msg.Button {
				case tea.MouseButtonWheelUp:
					m.mu.Lock()
					if m.dockerScroll > 0 {
						m.dockerScroll--
					}
					m.mu.Unlock()
				case tea.MouseButtonWheelDown:
					dockerLines := m.dockerBuffer.GetLines()
					maxScroll := 0
					if len(dockerLines) > contentHeight {
						maxScroll = len(dockerLines) - contentHeight
					}
					m.mu.Lock()
					if m.dockerScroll < maxScroll {
						m.dockerScroll++
					} else {
						m.autoScroll = true
					}
					m.mu.Unlock()
				}
			}
			return m, nil
		}
	case tickMsg:
		m.mu.RLock()
		autoScroll := m.autoScroll
		m.mu.RUnlock()
		if autoScroll {
			m.autoScrollSandbox()
			m.autoScrollDocker()
		}
		return m, tickCmd()
	}
	return m, nil
}

func (m *model) renderDockerStatusBar(panelWidth int) string {
	m.dockerStatusMu.RLock()
	defer m.dockerStatusMu.RUnlock()
	okStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("42"))   // green
	badStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("196")) // red
	runStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("214")) // yellow
	unkStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("240")) // gray
	sepStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("240")) // gray for separator
	var parts []string
	for _, name := range dockerStatusDisplayOrder {
		state, ok := m.dockerStatus[name]
		var symbol string
		var style lipgloss.Style
		if !ok {
			symbol = "?"
			style = unkStyle
		} else {
			s := strings.ToLower(state)
			switch {
			case s == "running" || strings.Contains(s, "healthy"):
				symbol = "●"
				style = okStyle
			case s == "exited" || s == "dead":
				symbol = "✗"
				style = badStyle
			case strings.Contains(s, "start") || s == "restarting":
				symbol = "…"
				style = runStyle
			default:
				symbol = "○"
				style = unkStyle
			}
		}
		parts = append(parts, style.Render(symbol+" "+name))
	}
	separator := sepStyle.Render(" | ")
	result := "| " + strings.Join(parts, separator) + " |"
	return lipgloss.NewStyle().Padding(0, 1).MaxWidth(panelWidth).Render(result)
}

func (m *model) View() string {
	m.mu.RLock()
	quitting := m.quitting
	width := m.width
	height := m.height
	sandboxScroll := m.sandboxScroll
	dockerScroll := m.dockerScroll
	autoScroll := m.autoScroll
	statusLines := m.dockerStatusLines
	m.mu.RUnlock()

	if quitting {
		return ""
	}

	if width == 0 {
		return "Initializing..."
	}

	panelWidth := width
	panelHeight := (height - 3) / 2
	if panelHeight <= 0 {
		panelHeight = 1
	}
	dockerContentHeight := panelHeight - statusLines
	if dockerContentHeight <= 0 {
		dockerContentHeight = 1
	}
	sandboxHeaderStyle := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("205")).
		Padding(0, 1)

	dockerHeaderStyle := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("39")).
		Padding(0, 1)

	sandboxBufferLines := m.sandboxBuffer.GetLines()
	dockerBufferLines := m.dockerBuffer.GetLines()
	maxSandboxScroll := 0
	if len(sandboxBufferLines) > panelHeight {
		maxSandboxScroll = len(sandboxBufferLines) - panelHeight
	}
	maxDockerScroll := 0
	if len(dockerBufferLines) > dockerContentHeight {
		maxDockerScroll = len(dockerBufferLines) - dockerContentHeight
	}

	// Use local vars only; never mutate model in View (keep View pure).
	if autoScroll {
		sandboxScroll = maxSandboxScroll
		dockerScroll = maxDockerScroll
	}
	if sandboxScroll < 0 {
		sandboxScroll = 0
	}
	if sandboxScroll > maxSandboxScroll {
		sandboxScroll = maxSandboxScroll
	}
	if dockerScroll < 0 {
		dockerScroll = 0
	}
	if dockerScroll > maxDockerScroll {
		dockerScroll = maxDockerScroll
	}

	sandboxStart := sandboxScroll
	sandboxEnd := sandboxStart + panelHeight
	if sandboxEnd > len(sandboxBufferLines) {
		sandboxEnd = len(sandboxBufferLines)
	}

	dockerStart := dockerScroll
	dockerEnd := dockerStart + dockerContentHeight
	if dockerEnd > len(dockerBufferLines) {
		dockerEnd = len(dockerBufferLines)
	}

	var sandboxContentLines []string
	if sandboxStart < len(sandboxBufferLines) && sandboxEnd > sandboxStart {
		sandboxContentLines = sandboxBufferLines[sandboxStart:sandboxEnd]
	}
	for len(sandboxContentLines) < panelHeight {
		sandboxContentLines = append(sandboxContentLines, "")
	}
	sandboxContent := strings.Join(sandboxContentLines, "\n")

	var dockerContentLines []string
	if dockerStart < len(dockerBufferLines) && dockerEnd > dockerStart {
		dockerContentLines = dockerBufferLines[dockerStart:dockerEnd]
	}
	for len(dockerContentLines) < dockerContentHeight {
		dockerContentLines = append(dockerContentLines, "")
	}
	dockerContent := strings.Join(dockerContentLines, "\n")

	sandboxHeader := sandboxHeaderStyle.Render("SANDBOX")
	dockerHeader := dockerHeaderStyle.Render("DOCKER")
	dockerStatusBar := m.renderDockerStatusBar(panelWidth)

	sandboxFullContent := sandboxHeader
	if sandboxContent != "" {
		sandboxFullContent += "\n" + sandboxContent
	}

	dockerFullContent := dockerHeader + "\n" + dockerStatusBar
	if dockerContent != "" {
		dockerFullContent += "\n" + dockerContent
	}

	separator := strings.Repeat("─", panelWidth)
	combined := sandboxFullContent + "\n" + separator + "\n" + dockerFullContent

	footerText := "Press 'q' or Ctrl+C to quit | Use mouse wheel to scroll"
	if !autoScroll {
		footerText += " | Auto-scroll disabled"
	}
	footer := lipgloss.NewStyle().
		Width(width).
		Foreground(lipgloss.Color("240")).
		Render(footerText)

	return combined + "\n" + footer
}

type composePsEntry struct {
	Service string `json:"Service"`
	State   string `json:"State"`
	Health  string `json:"Health"`
}

func runDockerStatusPoll(ctx context.Context, cwd, composeFile string, m *model) {
	run := func() {
		cmd := exec.CommandContext(ctx, "docker", "compose", "-f", composeFile, "ps", "-a", "--format", "json")
		cmd.Dir = cwd
		out, err := cmd.Output()
		if err != nil {
			return
		}
		next := make(map[string]string)
		raw := strings.TrimSpace(string(out))
		if strings.HasPrefix(raw, "[") {
			var entries []composePsEntry
			if err := json.Unmarshal([]byte(raw), &entries); err != nil {
				return
			}
			for _, e := range entries {
				short, ok := dockerComposeServiceShort[e.Service]
				if !ok {
					continue
				}
				state := e.State
				if e.Health != "" {
					state = e.Health
				}
				next[short] = state
			}
		} else {
			sc := bufio.NewScanner(strings.NewReader(raw))
			for sc.Scan() {
				line := strings.TrimSpace(sc.Text())
				if line == "" || line == "[" || line == "]" {
					continue
				}
				var e composePsEntry
				if err := json.Unmarshal([]byte(line), &e); err != nil {
					continue
				}
				short, ok := dockerComposeServiceShort[e.Service]
				if !ok {
					continue
				}
				state := e.State
				if e.Health != "" {
					state = e.Health
				}
				next[short] = state
			}
		}
		m.dockerStatusMu.Lock()
		m.dockerStatus = next
		m.dockerStatusMu.Unlock()
	}
	run() // initial poll
	tick := time.NewTicker(dockerStatusInterval)
	defer tick.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-tick.C:
			run()
		}
	}
}

func runServerUp(cmd *cobra.Command, args []string) error {
	cwd, err := os.Getwd()
	if err != nil {
		return fmt.Errorf("failed to get current directory: %w", err)
	}

	sandboxPath := filepath.Join(cwd, "sandbox", defaultSandboxType)
	if _, err := os.Stat(sandboxPath); os.IsNotExist(err) {
		fmt.Printf("📦 sandbox/%s not found. Creating...\n", defaultSandboxType)

		pm, err := pkgmgr.PromptPackageManager()
		if err != nil {
			return fmt.Errorf("failed to detect package manager: %w", err)
		}

		if err := sandbox.CreateSandboxProject(defaultSandboxType, pm, cwd); err != nil {
			return fmt.Errorf("failed to create sandbox: %w", err)
		}
		fmt.Println("✅ Sandbox created successfully")
	}

	m := initialModel()
	p := tea.NewProgram(m, tea.WithAltScreen(), tea.WithMouseCellMotion())

	ctx, cancel := context.WithCancel(context.Background())
	var sandboxCmd *exec.Cmd
	var dockerComposeFile string
	var dockerLogsCmd *exec.Cmd
	var mu sync.Mutex
	done := make(chan error, 2)

	var cleanupOnce sync.Once
	cleanupFunc := func() {
		cancel() // signal workers to stop sending; reader will exit on ctx.Done()
		cleanup(cwd, &mu, sandboxCmd, dockerLogsCmd, dockerComposeFile)
		// Do not close(done): workers may still send after we kill processes.
		// Reader exits via ctx.Done().
	}

	defer func() {
		fmt.Println("\n🛑 Stopping services...")
		cleanupOnce.Do(cleanupFunc)
		fmt.Println("✅ Services stopped successfully")
	}()

	go func() {
		for {
			select {
			case err := <-done:
				if err != nil {
					m.sandboxBuffer.AddLine(fmt.Sprintf("⚠️  Process error: %v", err))
				}
			case <-ctx.Done():
				return
			}
		}
	}()

	sendDone := func(err error) {
		if ctx.Err() != nil {
			return
		}
		select {
		case done <- err:
		case <-ctx.Done():
		}
	}

	go func() {
		projectDir, err := sandbox.GetProjectDir(cwd, filepath.Join("sandbox", defaultSandboxType))
		if err != nil {
			m.sandboxBuffer.AddLine(fmt.Sprintf("❌ Failed to get sandbox directory: %v", err))
			sendDone(fmt.Errorf("failed to get sandbox directory: %w", err))
			return
		}

		m.sandboxBuffer.AddLine(fmt.Sprintf("📦 Project directory: %s", projectDir))

		pm, err := pkgmgr.DetectPackageManager(projectDir)
		if err != nil {
			m.sandboxBuffer.AddLine(fmt.Sprintf("❌ Failed to detect package manager: %v", err))
			sendDone(fmt.Errorf("failed to detect package manager: %w", err))
			return
		}

		m.sandboxBuffer.AddLine(fmt.Sprintf("📦 Using package manager: %s", pm))

		devCmd := pkgmgr.GetDevCommand(pm)
		parts := strings.Fields(devCmd)
		if len(parts) == 0 {
			m.sandboxBuffer.AddLine("❌ Invalid dev command")
			sendDone(fmt.Errorf("invalid dev command"))
			return
		}

		m.sandboxBuffer.AddLine(fmt.Sprintf("🚀 Starting: %s", devCmd))

		mu.Lock()
		sandboxCmd = exec.Command(parts[0], parts[1:]...)
		sandboxCmd.Dir = projectDir
		platform.SetProcessGroup(sandboxCmd)
		mu.Unlock()

		sandboxStdout, err := sandboxCmd.StdoutPipe()
		if err != nil {
			m.sandboxBuffer.AddLine(fmt.Sprintf("❌ Failed to create stdout pipe: %v", err))
			sendDone(fmt.Errorf("failed to create sandbox stdout pipe: %w", err))
			return
		}
		sandboxStderr, err := sandboxCmd.StderrPipe()
		if err != nil {
			m.sandboxBuffer.AddLine(fmt.Sprintf("❌ Failed to create stderr pipe: %v", err))
			sendDone(fmt.Errorf("failed to create sandbox stderr pipe: %w", err))
			return
		}

		if err := sandboxCmd.Start(); err != nil {
			m.sandboxBuffer.AddLine(fmt.Sprintf("❌ Failed to start sandbox: %v", err))
			sendDone(fmt.Errorf("failed to start sandbox: %w", err))
			return
		}

		m.sandboxBuffer.AddLine("✅ Sandbox process started")

		go func() {
			scanner := bufio.NewScanner(sandboxStdout)
			for scanner.Scan() {
				line := scanner.Text()
				if line != "" {
					m.sandboxBuffer.AddLine(line)
				}
			}
			if err := scanner.Err(); err != nil {
				m.sandboxBuffer.AddLine(fmt.Sprintf("⚠️  Error reading stdout: %v", err))
			}
		}()
		go func() {
			scanner := bufio.NewScanner(sandboxStderr)
			for scanner.Scan() {
				line := scanner.Text()
				if line != "" {
					m.sandboxBuffer.AddLine(line)
				}
			}
			if err := scanner.Err(); err != nil {
				m.sandboxBuffer.AddLine(fmt.Sprintf("⚠️  Error reading stderr: %v", err))
			}
		}()

		if err := sandboxCmd.Wait(); err != nil && ctx.Err() == nil {
			m.sandboxBuffer.AddLine(fmt.Sprintf("❌ Sandbox exited with error: %v", err))
			sendDone(fmt.Errorf("sandbox exited with error: %w", err))
			return
		}

		if ctx.Err() == nil {
			m.sandboxBuffer.AddLine("📴 Sandbox process ended")
		}
	}()

	go func() {
		if err := docker.CheckDockerInstalled(); err != nil {
			m.dockerBuffer.AddLine(fmt.Sprintf("❌ Docker check failed: %v", err))
			sendDone(fmt.Errorf("docker check failed: %w", err))
			return
		}

		composeFile, err := docker.CreateTempDockerCompose(cwd)
		if err != nil {
			m.dockerBuffer.AddLine(fmt.Sprintf("❌ Failed to create docker-compose file: %v", err))
			sendDone(fmt.Errorf("failed to create docker-compose file: %w", err))
			return
		}
		mu.Lock()
		dockerComposeFile = composeFile
		mu.Unlock()

		envFile := filepath.Join(cwd, ".env")
		if _, err := os.Stat(envFile); os.IsNotExist(err) {
			envConfig := &docker.EnvConfig{
				LLMConfig: &docker.LLMConfig{
					APIKey:  "your-api-key",
					BaseURL: "https://api.openai.com/v1",
					SDK:     "openai",
				},
				RootAPIBearerToken: "your-root-api-bearer-token",
				CoreConfigYAMLFile: "./config.yaml",
			}
			if err := docker.GenerateEnvFile(envFile, envConfig); err != nil {
				m.dockerBuffer.AddLine(fmt.Sprintf("❌ Failed to generate .env file: %v", err))
				sendDone(fmt.Errorf("failed to generate .env file: %w", err))
				return
			}
		}

		m.dockerBuffer.AddLine("🚀 Starting docker compose up -d...")
		upCmd := exec.Command("docker", "compose", "-f", composeFile, "up", "-d")
		upCmd.Dir = cwd
		out, upErr := upCmd.CombinedOutput()
		for _, line := range strings.Split(strings.TrimSuffix(string(out), "\n"), "\n") {
			if strings.TrimSpace(line) != "" {
				m.dockerBuffer.AddLine(line)
			}
		}
		if upErr != nil {
			m.dockerBuffer.AddLine(fmt.Sprintf("❌ Failed to start docker services: %v", upErr))
			sendDone(fmt.Errorf("failed to start docker services: %w", upErr))
			return
		}
		m.dockerBuffer.AddLine("✅ Docker compose up finished")

		go runDockerStatusPoll(ctx, cwd, composeFile, m)

		mu.Lock()
		dockerLogsCmd = exec.Command("docker", "compose", "-f", composeFile, "logs", "-f", "--tail", "0")
		dockerLogsCmd.Dir = cwd
		mu.Unlock()

		logsStdout, err := dockerLogsCmd.StdoutPipe()
		if err != nil {
			m.dockerBuffer.AddLine(fmt.Sprintf("❌ Failed to create docker logs stdout pipe: %v", err))
			sendDone(fmt.Errorf("failed to create docker logs stdout pipe: %w", err))
			return
		}
		logsStderr, err := dockerLogsCmd.StderrPipe()
		if err != nil {
			m.dockerBuffer.AddLine(fmt.Sprintf("❌ Failed to create docker logs stderr pipe: %v", err))
			sendDone(fmt.Errorf("failed to create docker logs stderr pipe: %w", err))
			return
		}

		if err := dockerLogsCmd.Start(); err != nil {
			m.dockerBuffer.AddLine(fmt.Sprintf("❌ Failed to start docker logs: %v", err))
			sendDone(fmt.Errorf("failed to start docker logs: %w", err))
			return
		}

		go func() {
			scanner := bufio.NewScanner(logsStdout)
			for scanner.Scan() {
				line := scanner.Text()
				if line != "" {
					m.dockerBuffer.AddLine(line)
				}
			}
			if err := scanner.Err(); err != nil {
				m.dockerBuffer.AddLine(fmt.Sprintf("⚠️  Error reading docker stdout: %v", err))
			}
		}()
		go func() {
			scanner := bufio.NewScanner(logsStderr)
			for scanner.Scan() {
				line := scanner.Text()
				if line != "" {
					m.dockerBuffer.AddLine(line)
				}
			}
			if err := scanner.Err(); err != nil {
				m.dockerBuffer.AddLine(fmt.Sprintf("⚠️  Error reading docker stderr: %v", err))
			}
		}()

		if err := dockerLogsCmd.Wait(); err != nil {
			m.dockerBuffer.AddLine(fmt.Sprintf("⚠️  Docker logs process ended with error: %v", err))
		}
	}()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-sigChan
		p.Quit()
	}()

	if _, err := p.Run(); err != nil {
		return fmt.Errorf("TUI error: %w", err)
	}

	return nil
}

func cleanup(cwd string, mu *sync.Mutex, sandboxCmd, dockerLogsCmd *exec.Cmd, dockerComposeFile string) {
	// Kill processes only. Do not Wait(): the sandbox and docker goroutines each
	// call Wait() on their Cmd; calling Wait() twice on the same Cmd is invalid.
	mu.Lock()
	if sandboxCmd != nil && sandboxCmd.Process != nil {
		if err := platform.KillProcessGroup(sandboxCmd); err != nil {
			fmt.Printf("⚠️  Warning: failed to send SIGTERM to process group: %v\n", err)
		}
		time.Sleep(500 * time.Millisecond)
		if err := platform.KillProcessGroupForce(sandboxCmd); err != nil {
			fmt.Printf("⚠️  Warning: failed to send SIGKILL to process group: %v\n", err)
		}
	}
	if dockerLogsCmd != nil && dockerLogsCmd.Process != nil {
		if err := dockerLogsCmd.Process.Kill(); err != nil && !errors.Is(err, os.ErrProcessDone) {
			fmt.Printf("⚠️  Warning: failed to kill docker logs process: %v\n", err)
		}
	}
	mu.Unlock()

	if dockerComposeFile != "" {
		downCmd := exec.Command("docker", "compose", "-f", dockerComposeFile, "down")
		downCmd.Dir = cwd
		if err := downCmd.Run(); err != nil {
			fmt.Printf("⚠️  Warning: failed to stop docker compose services: %v\n", err)
		}
		if err := os.Remove(dockerComposeFile); err != nil {
			fmt.Printf("⚠️  Warning: failed to remove temporary docker-compose file: %v\n", err)
		}
	}
}
