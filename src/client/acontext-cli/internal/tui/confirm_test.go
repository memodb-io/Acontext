package tui

import (
	"testing"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/stretchr/testify/assert"
)

func updateConfirm(m ConfirmModel, msgs ...tea.Msg) ConfirmModel {
	var model tea.Model = m
	for _, msg := range msgs {
		model, _ = model.Update(msg)
	}
	return model.(ConfirmModel)
}

func TestNewConfirm_DefaultValue(t *testing.T) {
	m := NewConfirm("Continue?", true)
	assert.True(t, m.value)
	assert.True(t, m.defaultValue)
	assert.False(t, m.done)
	assert.False(t, m.quitting)
}

func TestConfirm_PressY(t *testing.T) {
	m := NewConfirm("Continue?", false)
	m = updateConfirm(m, tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("y")})
	assert.True(t, m.value)
	assert.True(t, m.done)
}

func TestConfirm_PressN(t *testing.T) {
	m := NewConfirm("Continue?", true)
	m = updateConfirm(m, tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("n")})
	assert.False(t, m.value)
	assert.True(t, m.done)
}

func TestConfirm_EnterUsesDefault(t *testing.T) {
	m := NewConfirm("Continue?", true)
	m = updateConfirm(m, tea.KeyMsg{Type: tea.KeyEnter})
	assert.True(t, m.value)
	assert.True(t, m.done)

	m2 := NewConfirm("Continue?", false)
	m2 = updateConfirm(m2, tea.KeyMsg{Type: tea.KeyEnter})
	assert.False(t, m2.value)
	assert.True(t, m2.done)
}

func TestConfirm_CtrlC(t *testing.T) {
	m := NewConfirm("Continue?", true)
	m = updateConfirm(m, tea.KeyMsg{Type: tea.KeyCtrlC})
	assert.True(t, m.quitting)
	assert.True(t, m.Cancelled())
}

func TestConfirm_Tab(t *testing.T) {
	m := NewConfirm("Continue?", true)
	assert.True(t, m.value)
	m = updateConfirm(m, tea.KeyMsg{Type: tea.KeyTab})
	assert.False(t, m.value)
	m = updateConfirm(m, tea.KeyMsg{Type: tea.KeyTab})
	assert.True(t, m.value)
}

func TestConfirm_LeftRight(t *testing.T) {
	m := NewConfirm("Continue?", false)
	m = updateConfirm(m, tea.KeyMsg{Type: tea.KeyLeft})
	assert.True(t, m.Value())
	m = updateConfirm(m, tea.KeyMsg{Type: tea.KeyRight})
	assert.False(t, m.Value())
}
