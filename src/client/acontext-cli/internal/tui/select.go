package tui

import (
	"fmt"
	"strings"

	"github.com/AlecAivazis/survey/v2"
	tea "github.com/charmbracelet/bubbletea"
)

// SelectOption represents an option in a select list
type SelectOption struct {
	Label       string
	Value       string
	Description string
}

// SelectModel is a bubbletea model for a select component
type SelectModel struct {
	title    string
	options  []SelectOption
	cursor   int
	selected int
	done     bool
	quitting bool
	height   int
}

// NewSelect creates a new select model
func NewSelect(title string, options []SelectOption) SelectModel {
	return SelectModel{
		title:    title,
		options:  options,
		cursor:   0,
		selected: -1,
	}
}

func (m SelectModel) Init() tea.Cmd {
	return nil
}

func (m SelectModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.height = msg.Height
		return m, nil
	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "q":
			m.quitting = true
			return m, tea.Quit
		case "up", "k":
			if m.cursor > 0 {
				m.cursor--
			}
		case "down", "j":
			if m.cursor < len(m.options)-1 {
				m.cursor++
			}
		case "enter", " ":
			m.selected = m.cursor
			m.done = true
			return m, tea.Quit
		}
	}
	return m, nil
}

func (m SelectModel) View() string {
	if m.quitting {
		return ""
	}
	if m.done && m.selected >= 0 && m.selected < len(m.options) {
		return PromptStyle.Render(m.title) + " " +
			SuccessStyle.Render(m.options[m.selected].Label)
	}

	var b strings.Builder

	// Title
	b.WriteString(PromptStyle.Render(m.title))
	b.WriteString("\n")

	// Options
	for i, opt := range m.options {
		cursor := "  "
		style := UnselectedStyle
		if i == m.cursor {
			cursor = CursorStyle.Render(IconPointer + " ")
			style = SelectedStyle
		}

		b.WriteString(cursor)
		b.WriteString(style.Render(opt.Label))

		if opt.Description != "" {
			b.WriteString(" ")
			b.WriteString(MutedStyle.Render("- " + opt.Description))
		}
		b.WriteString("\n")
	}

	// Help
	b.WriteString("\n")
	b.WriteString(MutedStyle.Render("↑/↓ navigate • enter select • q quit"))

	return b.String()
}

// Selected returns the selected option index, or -1 if cancelled
func (m SelectModel) Selected() int {
	if m.quitting {
		return -1
	}
	return m.selected
}

// SelectedValue returns the selected option value, or empty string if cancelled
func (m SelectModel) SelectedValue() string {
	if m.quitting || m.selected < 0 || m.selected >= len(m.options) {
		return ""
	}
	return m.options[m.selected].Value
}

// RunSelect runs a select prompt and returns the selected value
func RunSelect(title string, options []SelectOption) (string, error) {
	if !IsTTY() {
		// Fallback to survey for non-TTY
		return runSelectSurvey(title, options)
	}

	m := NewSelect(title, options)
	p := tea.NewProgram(m)

	finalModel, err := p.Run()
	if err != nil {
		return "", fmt.Errorf("select error: %w", err)
	}

	result, ok := finalModel.(SelectModel)
	if !ok {
		return "", fmt.Errorf("unexpected model type")
	}
	if result.quitting {
		return "", fmt.Errorf("selection cancelled")
	}
	if result.selected < 0 || result.selected >= len(options) {
		return "", fmt.Errorf("no selection made")
	}

	fmt.Println() // Print newline after select
	return options[result.selected].Value, nil
}

// RunSelectWithLabel runs a select prompt and returns the selected label
func RunSelectWithLabel(title string, options []SelectOption) (string, string, error) {
	if !IsTTY() {
		// Fallback to survey for non-TTY
		value, err := runSelectSurvey(title, options)
		if err != nil {
			return "", "", err
		}
		// Find the label for the selected value
		for _, opt := range options {
			if opt.Value == value {
				return opt.Label, opt.Value, nil
			}
		}
		return value, value, nil
	}

	m := NewSelect(title, options)
	p := tea.NewProgram(m)

	finalModel, err := p.Run()
	if err != nil {
		return "", "", fmt.Errorf("select error: %w", err)
	}

	result, ok := finalModel.(SelectModel)
	if !ok {
		return "", "", fmt.Errorf("unexpected model type")
	}
	if result.quitting {
		return "", "", fmt.Errorf("selection cancelled")
	}
	if result.selected < 0 || result.selected >= len(options) {
		return "", "", fmt.Errorf("no selection made")
	}

	fmt.Println() // Print newline after select
	return options[result.selected].Label, options[result.selected].Value, nil
}

// runSelectSurvey is a fallback using survey library
func runSelectSurvey(title string, options []SelectOption) (string, error) {
	labels := make([]string, len(options))
	labelToValue := make(map[string]string)

	for i, opt := range options {
		label := opt.Label
		if opt.Description != "" {
			label = fmt.Sprintf("%s - %s", opt.Label, opt.Description)
		}
		labels[i] = label
		labelToValue[label] = opt.Value
	}

	var selected string
	prompt := &survey.Select{
		Message: title,
		Options: labels,
	}

	if err := survey.AskOne(prompt, &selected); err != nil {
		return "", err
	}

	return labelToValue[selected], nil
}
