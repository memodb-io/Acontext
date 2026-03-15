package tui

import (
	"testing"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/stretchr/testify/assert"
)

var testOptions = []SelectOption{
	{Label: "Option A", Value: "a"},
	{Label: "Option B", Value: "b"},
	{Label: "Option C", Value: "c"},
}

func updateSelect(m SelectModel, msgs ...tea.Msg) SelectModel {
	var model tea.Model = m
	for _, msg := range msgs {
		model, _ = model.Update(msg)
	}
	return model.(SelectModel)
}

func TestNewSelect_Defaults(t *testing.T) {
	m := NewSelect("Pick one:", testOptions)
	assert.Equal(t, 0, m.cursor)
	assert.Equal(t, -1, m.selected)
	assert.False(t, m.done)
	assert.False(t, m.quitting)
}

func TestSelect_DownArrow(t *testing.T) {
	m := NewSelect("Pick one:", testOptions)
	m = updateSelect(m, tea.KeyMsg{Type: tea.KeyDown})
	assert.Equal(t, 1, m.cursor)
	m = updateSelect(m, tea.KeyMsg{Type: tea.KeyDown})
	assert.Equal(t, 2, m.cursor)
	// Should not go past last option
	m = updateSelect(m, tea.KeyMsg{Type: tea.KeyDown})
	assert.Equal(t, 2, m.cursor)
}

func TestSelect_UpArrow(t *testing.T) {
	m := NewSelect("Pick one:", testOptions)
	// At 0, up should stay at 0
	m = updateSelect(m, tea.KeyMsg{Type: tea.KeyUp})
	assert.Equal(t, 0, m.cursor)
}

func TestSelect_EnterSelects(t *testing.T) {
	m := NewSelect("Pick one:", testOptions)
	m = updateSelect(m, tea.KeyMsg{Type: tea.KeyDown}) // cursor = 1
	m = updateSelect(m, tea.KeyMsg{Type: tea.KeyEnter})
	assert.True(t, m.done)
	assert.Equal(t, 1, m.Selected())
	assert.Equal(t, "b", m.SelectedValue())
}

func TestSelect_CtrlC(t *testing.T) {
	m := NewSelect("Pick one:", testOptions)
	m = updateSelect(m, tea.KeyMsg{Type: tea.KeyCtrlC})
	assert.True(t, m.quitting)
	assert.Equal(t, -1, m.Selected())
	assert.Equal(t, "", m.SelectedValue())
}

func TestSelect_SelectedValueAfterSelection(t *testing.T) {
	m := NewSelect("Pick one:", testOptions)
	m = updateSelect(m, tea.KeyMsg{Type: tea.KeyDown}, tea.KeyMsg{Type: tea.KeyDown}) // cursor = 2
	m = updateSelect(m, tea.KeyMsg{Type: tea.KeyEnter})
	assert.Equal(t, "c", m.SelectedValue())
	assert.Equal(t, "Option C", testOptions[m.Selected()].Label)
}
