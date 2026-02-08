package tui

import (
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/AlecAivazis/survey/v2"
	tea "github.com/charmbracelet/bubbletea"
)

// InputModel is a bubbletea model for a text input.
// cursorPos is tracked as a rune offset (not byte offset) so that
// multi-byte Unicode characters are handled correctly.
type InputModel struct {
	prompt       string
	placeholder  string
	value        string
	cursorPos    int // rune offset
	done         bool
	quitting     bool
	defaultValue string
}

// NewInput creates a new input model
func NewInput(prompt, placeholder, defaultValue string) InputModel {
	return InputModel{
		prompt:       prompt,
		placeholder:  placeholder,
		value:        defaultValue,
		cursorPos:    utf8.RuneCountInString(defaultValue),
		defaultValue: defaultValue,
	}
}

func (m InputModel) Init() tea.Cmd {
	return nil
}

// runeSlice converts a rune offset to a byte offset in s.
func runeOffset(s string, runePos int) int {
	bytePos := 0
	for i := 0; i < runePos && bytePos < len(s); i++ {
		_, size := utf8.DecodeRuneInString(s[bytePos:])
		bytePos += size
	}
	return bytePos
}

func (m InputModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		runeCount := utf8.RuneCountInString(m.value)

		switch msg.String() {
		case "ctrl+c":
			m.quitting = true
			return m, tea.Quit
		case "enter":
			m.done = true
			return m, tea.Quit
		case "backspace":
			if m.cursorPos > 0 {
				bytePos := runeOffset(m.value, m.cursorPos-1)
				byteEnd := runeOffset(m.value, m.cursorPos)
				m.value = m.value[:bytePos] + m.value[byteEnd:]
				m.cursorPos--
			}
		case "delete":
			if m.cursorPos < runeCount {
				bytePos := runeOffset(m.value, m.cursorPos)
				byteEnd := runeOffset(m.value, m.cursorPos+1)
				m.value = m.value[:bytePos] + m.value[byteEnd:]
			}
		case "left":
			if m.cursorPos > 0 {
				m.cursorPos--
			}
		case "right":
			if m.cursorPos < runeCount {
				m.cursorPos++
			}
		case "home", "ctrl+a":
			m.cursorPos = 0
		case "end", "ctrl+e":
			m.cursorPos = runeCount
		case "ctrl+u":
			bytePos := runeOffset(m.value, m.cursorPos)
			m.value = m.value[bytePos:]
			m.cursorPos = 0
		case "ctrl+k":
			bytePos := runeOffset(m.value, m.cursorPos)
			m.value = m.value[:bytePos]
		default:
			// Handle regular character input (supports multi-byte Unicode)
			if utf8.RuneCountInString(msg.String()) == 1 {
				char := msg.String()
				bytePos := runeOffset(m.value, m.cursorPos)
				m.value = m.value[:bytePos] + char + m.value[bytePos:]
				m.cursorPos++
			}
		}
	}
	return m, nil
}

func (m InputModel) View() string {
	if m.quitting {
		return ""
	}
	if m.done {
		displayValue := m.value
		if displayValue == "" {
			displayValue = m.defaultValue
		}
		return PromptStyle.Render(m.prompt) + " " + SuccessStyle.Render(displayValue)
	}

	var b strings.Builder

	// Prompt
	b.WriteString(PromptStyle.Render(m.prompt))
	b.WriteString(" ")

	// Input field with cursor
	if m.value == "" && m.placeholder != "" {
		// Show placeholder
		b.WriteString(PlaceholderStyle.Render(m.placeholder))
	} else {
		// Show value with cursor (rune-safe splitting)
		bytePos := runeOffset(m.value, m.cursorPos)
		before := m.value[:bytePos]
		after := m.value[bytePos:]
		b.WriteString(InputStyle.Render(before))
		b.WriteString(CursorStyle.Render("▌"))
		b.WriteString(InputStyle.Render(after))
	}

	b.WriteString("\n")
	b.WriteString(MutedStyle.Render("enter confirm • ctrl+c cancel"))

	return b.String()
}

// Value returns the input value
func (m InputModel) Value() string {
	if m.value == "" {
		return m.defaultValue
	}
	return m.value
}

// Cancelled returns true if the input was cancelled
func (m InputModel) Cancelled() bool {
	return m.quitting
}

// RunInput runs an input prompt and returns the entered value
func RunInput(prompt, placeholder, defaultValue string) (string, error) {
	if !IsTTY() {
		// Fallback to survey for non-TTY
		return runInputSurvey(prompt, placeholder, defaultValue)
	}

	m := NewInput(prompt, placeholder, defaultValue)
	p := tea.NewProgram(m)

	finalModel, err := p.Run()
	if err != nil {
		return "", fmt.Errorf("input error: %w", err)
	}

	result, ok := finalModel.(InputModel)
	if !ok {
		return "", fmt.Errorf("unexpected model type")
	}
	if result.quitting {
		return "", fmt.Errorf("input cancelled")
	}

	fmt.Println() // Print newline after input
	return result.Value(), nil
}

// runInputSurvey is a fallback using survey library
func runInputSurvey(prompt, placeholder, defaultValue string) (string, error) {
	var value string
	surveyPrompt := &survey.Input{
		Message: prompt,
		Help:    placeholder,
		Default: defaultValue,
	}

	if err := survey.AskOne(surveyPrompt, &value); err != nil {
		return "", err
	}

	if value == "" {
		return defaultValue, nil
	}
	return value, nil
}
