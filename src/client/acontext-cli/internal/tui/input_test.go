package tui

import (
	"testing"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/stretchr/testify/assert"
)

// --- runeOffset tests ---

func TestRuneOffset_ASCII(t *testing.T) {
	assert.Equal(t, 3, runeOffset("hello", 3))
}

func TestRuneOffset_MultiByte(t *testing.T) {
	// "中文" is 6 bytes, 2 runes
	assert.Equal(t, 3, runeOffset("中文", 1))
	assert.Equal(t, 6, runeOffset("中文", 2))
}

func TestRuneOffset_Empty(t *testing.T) {
	assert.Equal(t, 0, runeOffset("", 0))
}

func TestRuneOffset_BeyondLength(t *testing.T) {
	// Should clamp to string length
	assert.Equal(t, 5, runeOffset("hello", 10))
}

// --- InputModel tests ---

func keyMsg(key string) tea.KeyMsg {
	return tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune(key)}
}

func ctrlMsg(key string) tea.KeyMsg {
	switch key {
	case "ctrl+c":
		return tea.KeyMsg{Type: tea.KeyCtrlC}
	case "enter":
		return tea.KeyMsg{Type: tea.KeyEnter}
	case "backspace":
		return tea.KeyMsg{Type: tea.KeyBackspace}
	case "delete":
		return tea.KeyMsg{Type: tea.KeyDelete}
	case "left":
		return tea.KeyMsg{Type: tea.KeyLeft}
	case "right":
		return tea.KeyMsg{Type: tea.KeyRight}
	case "home":
		return tea.KeyMsg{Type: tea.KeyHome}
	case "end":
		return tea.KeyMsg{Type: tea.KeyEnd}
	case "ctrl+u":
		return tea.KeyMsg{Type: tea.KeyCtrlU}
	case "ctrl+k":
		return tea.KeyMsg{Type: tea.KeyCtrlK}
	default:
		return tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune(key)}
	}
}

func updateInput(m InputModel, msgs ...tea.Msg) InputModel {
	var model tea.Model = m
	for _, msg := range msgs {
		model, _ = model.Update(msg)
	}
	return model.(InputModel)
}

func TestInputModel_TypeCharacters(t *testing.T) {
	m := NewInput("Name:", "", "")
	m = updateInput(m, keyMsg("a"), keyMsg("b"), keyMsg("c"))
	assert.Equal(t, "abc", m.value)
	assert.Equal(t, 3, m.cursorPos)
}

func TestInputModel_Backspace(t *testing.T) {
	m := NewInput("Name:", "", "")
	m = updateInput(m, keyMsg("a"), keyMsg("b"), ctrlMsg("backspace"))
	assert.Equal(t, "a", m.value)
	assert.Equal(t, 1, m.cursorPos)
}

func TestInputModel_Delete(t *testing.T) {
	m := NewInput("Name:", "", "")
	m = updateInput(m, keyMsg("a"), keyMsg("b"), ctrlMsg("home"), ctrlMsg("delete"))
	assert.Equal(t, "b", m.value)
	assert.Equal(t, 0, m.cursorPos)
}

func TestInputModel_LeftRight(t *testing.T) {
	m := NewInput("Name:", "", "")
	m = updateInput(m, keyMsg("a"), keyMsg("b"), ctrlMsg("left"))
	assert.Equal(t, 1, m.cursorPos)
	m = updateInput(m, ctrlMsg("right"))
	assert.Equal(t, 2, m.cursorPos)
}

func TestInputModel_HomeEnd(t *testing.T) {
	m := NewInput("Name:", "", "")
	m = updateInput(m, keyMsg("a"), keyMsg("b"), keyMsg("c"))
	m = updateInput(m, ctrlMsg("home"))
	assert.Equal(t, 0, m.cursorPos)
	m = updateInput(m, ctrlMsg("end"))
	assert.Equal(t, 3, m.cursorPos)
}

func TestInputModel_CtrlU(t *testing.T) {
	m := NewInput("Name:", "", "")
	m = updateInput(m, keyMsg("a"), keyMsg("b"), keyMsg("c"), ctrlMsg("left"))
	m = updateInput(m, ctrlMsg("ctrl+u"))
	assert.Equal(t, "c", m.value)
	assert.Equal(t, 0, m.cursorPos)
}

func TestInputModel_CtrlK(t *testing.T) {
	m := NewInput("Name:", "", "")
	m = updateInput(m, keyMsg("a"), keyMsg("b"), keyMsg("c"), ctrlMsg("home"), ctrlMsg("right"))
	m = updateInput(m, ctrlMsg("ctrl+k"))
	assert.Equal(t, "a", m.value)
	assert.Equal(t, 1, m.cursorPos)
}

func TestInputModel_CtrlC(t *testing.T) {
	m := NewInput("Name:", "", "")
	m = updateInput(m, ctrlMsg("ctrl+c"))
	assert.True(t, m.quitting)
	assert.True(t, m.Cancelled())
}

func TestInputModel_Enter(t *testing.T) {
	m := NewInput("Name:", "", "")
	m = updateInput(m, keyMsg("h"), keyMsg("i"), ctrlMsg("enter"))
	assert.True(t, m.done)
	assert.Equal(t, "hi", m.Value())
}

func TestInputModel_ValueReturnsDefault(t *testing.T) {
	m := NewInput("Name:", "", "default-val")
	// Clear the pre-filled default value
	m.value = ""
	assert.Equal(t, "default-val", m.Value())
}

func TestInputModel_PasteMultiRune(t *testing.T) {
	m := NewInput("Name:", "", "")
	// Simulate paste by sending a multi-rune KeyRunes message
	paste := tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("hello")}
	m = updateInput(m, paste)
	assert.Equal(t, "hello", m.value)
	assert.Equal(t, 5, m.cursorPos)
}
