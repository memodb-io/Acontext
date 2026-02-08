package tui

import (
	"fmt"
	"strings"

	"github.com/AlecAivazis/survey/v2"
	tea "github.com/charmbracelet/bubbletea"
)

// ConfirmModel is a bubbletea model for a confirm dialog
type ConfirmModel struct {
	prompt       string
	defaultValue bool
	value        bool
	done         bool
	quitting     bool
}

// NewConfirm creates a new confirm model
func NewConfirm(prompt string, defaultValue bool) ConfirmModel {
	return ConfirmModel{
		prompt:       prompt,
		defaultValue: defaultValue,
		value:        defaultValue,
	}
}

func (m ConfirmModel) Init() tea.Cmd {
	return nil
}

func (m ConfirmModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c":
			m.quitting = true
			return m, tea.Quit
		case "y", "Y":
			m.value = true
			m.done = true
			return m, tea.Quit
		case "n", "N":
			m.value = false
			m.done = true
			return m, tea.Quit
		case "enter":
			m.value = m.defaultValue
			m.done = true
			return m, tea.Quit
		case "left", "h":
			m.value = true
		case "right", "l":
			m.value = false
		case "tab":
			m.value = !m.value
		}
	}
	return m, nil
}

func (m ConfirmModel) View() string {
	if m.quitting {
		return ""
	}
	if m.done {
		answer := "No"
		if m.value {
			answer = "Yes"
		}
		return PromptStyle.Render(m.prompt) + " " + SuccessStyle.Render(answer)
	}

	var b strings.Builder

	// Prompt
	b.WriteString(PromptStyle.Render(m.prompt))
	b.WriteString(" ")

	// Options
	yesStyle := UnselectedStyle
	noStyle := UnselectedStyle
	if m.value {
		yesStyle = SelectedStyle
	} else {
		noStyle = SelectedStyle
	}

	b.WriteString(yesStyle.Render("Yes"))
	b.WriteString(MutedStyle.Render(" / "))
	b.WriteString(noStyle.Render("No"))

	// Default indicator
	if m.defaultValue {
		b.WriteString(MutedStyle.Render(" (Y)"))
	} else {
		b.WriteString(MutedStyle.Render(" (n)"))
	}

	b.WriteString("\n")
	b.WriteString(MutedStyle.Render("y/n select • ←/→ toggle • enter confirm"))

	return b.String()
}

// Value returns the confirm value
func (m ConfirmModel) Value() bool {
	return m.value
}

// Cancelled returns true if the confirm was cancelled
func (m ConfirmModel) Cancelled() bool {
	return m.quitting
}

// RunConfirm runs a confirm prompt and returns the result
func RunConfirm(prompt string, defaultValue bool) (bool, error) {
	if !IsTTY() {
		// Fallback to survey for non-TTY
		return runConfirmSurvey(prompt, defaultValue)
	}

	m := NewConfirm(prompt, defaultValue)
	p := tea.NewProgram(m)

	finalModel, err := p.Run()
	if err != nil {
		return false, fmt.Errorf("confirm error: %w", err)
	}

	result, ok := finalModel.(ConfirmModel)
	if !ok {
		return false, fmt.Errorf("unexpected model type")
	}
	if result.quitting {
		return false, fmt.Errorf("confirm cancelled")
	}

	fmt.Println() // Print newline after confirm
	return result.Value(), nil
}

// runConfirmSurvey is a fallback using survey library
func runConfirmSurvey(prompt string, defaultValue bool) (bool, error) {
	var value bool
	surveyPrompt := &survey.Confirm{
		Message: prompt,
		Default: defaultValue,
	}

	if err := survey.AskOne(surveyPrompt, &value); err != nil {
		return false, err
	}

	return value, nil
}
