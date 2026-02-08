package tui

import (
	"fmt"
	"os"

	"github.com/charmbracelet/lipgloss"
)

// Color palette - consistent with server.go
var (
	ColorPrimary   = lipgloss.Color("#FF79C6") // Pink
	ColorSecondary = lipgloss.Color("#8BE9FD") // Cyan
	ColorSuccess   = lipgloss.Color("#50FA7B") // Green
	ColorError     = lipgloss.Color("#FF5555") // Red
	ColorWarning   = lipgloss.Color("#FFB86C") // Orange
	ColorMuted     = lipgloss.Color("#6272A4") // Gray
	ColorWhite     = lipgloss.Color("#F8F8F2") // White
	ColorPurple    = lipgloss.Color("#BD93F9") // Purple
)

// Predefined styles
var (
	// Title styles
	TitleStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(ColorPrimary)

	SubtitleStyle = lipgloss.NewStyle().
			Foreground(ColorSecondary)

	// Status styles
	SuccessStyle = lipgloss.NewStyle().
			Foreground(ColorSuccess)

	ErrorStyle = lipgloss.NewStyle().
			Foreground(ColorError)

	WarningStyle = lipgloss.NewStyle().
			Foreground(ColorWarning)

	MutedStyle = lipgloss.NewStyle().
			Foreground(ColorMuted)

	// Interactive styles
	SelectedStyle = lipgloss.NewStyle().
			Foreground(ColorPrimary).
			Bold(true)

	UnselectedStyle = lipgloss.NewStyle().
			Foreground(ColorWhite)

	CursorStyle = lipgloss.NewStyle().
			Foreground(ColorPrimary)

	// Input styles
	PromptStyle = lipgloss.NewStyle().
			Foreground(ColorSecondary).
			Bold(true)

	InputStyle = lipgloss.NewStyle().
			Foreground(ColorWhite)

	PlaceholderStyle = lipgloss.NewStyle().
				Foreground(ColorMuted)
)

// Icons
const (
	IconSuccess   = "✓"
	IconError     = "✗"
	IconWarning   = "⚠"
	IconInfo      = "ℹ"
	IconArrow     = "→"
	IconPointer   = "❯"
	IconCheck     = "◉"
	IconUncheck   = "○"
	IconSpinner   = "◐"
	IconPackage   = "📦"
	IconRocket    = "🚀"
	IconFolder    = "📁"
	IconGit       = "🔧"
	IconSkip      = "⏭️"
	IconSearch    = "🔍"
	IconDownload  = "⬇️"
	IconDone      = "✅"
	IconStop      = "🛑"
	IconLightbulb = "💡"
)

// IsTTY returns true if stdout is a terminal
func IsTTY() bool {
	fileInfo, err := os.Stdout.Stat()
	if err != nil {
		return false
	}
	return (fileInfo.Mode() & os.ModeCharDevice) != 0
}

// RenderSuccess renders a success message
func RenderSuccess(msg string) string {
	return SuccessStyle.Render(IconSuccess+" ") + msg
}

// RenderError renders an error message
func RenderError(msg string) string {
	return ErrorStyle.Render(IconError+" ") + msg
}

// RenderWarning renders a warning message
func RenderWarning(msg string) string {
	return WarningStyle.Render(IconWarning+" ") + msg
}

// RenderInfo renders an info message
func RenderInfo(msg string) string {
	return MutedStyle.Render(IconInfo+" ") + msg
}

// RenderStep renders a step indicator
func RenderStep(current, total int, msg string) string {
	step := MutedStyle.Render("[") +
		SuccessStyle.Render(fmt.Sprintf("%d/%d", current, total)) +
		MutedStyle.Render("]")
	return step + " " + msg
}
