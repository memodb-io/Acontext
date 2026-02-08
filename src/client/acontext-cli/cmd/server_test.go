package cmd

import (
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNewOutputBuffer(t *testing.T) {
	buf := NewOutputBuffer(10)
	assert.NotNil(t, buf)
	assert.Empty(t, buf.GetLines())
}

func TestOutputBuffer_AddLine(t *testing.T) {
	buf := NewOutputBuffer(5)

	buf.AddLine("line1")
	buf.AddLine("line2")
	buf.AddLine("line3")

	lines := buf.GetLines()
	assert.Equal(t, 3, len(lines))
	assert.Equal(t, "line1", lines[0])
	assert.Equal(t, "line2", lines[1])
	assert.Equal(t, "line3", lines[2])
}

func TestOutputBuffer_MaxLen(t *testing.T) {
	buf := NewOutputBuffer(3)

	buf.AddLine("line1")
	buf.AddLine("line2")
	buf.AddLine("line3")
	buf.AddLine("line4")
	buf.AddLine("line5")

	lines := buf.GetLines()
	assert.Equal(t, 3, len(lines), "buffer should respect maxLen")
	assert.Equal(t, "line3", lines[0], "oldest lines should be evicted")
	assert.Equal(t, "line4", lines[1])
	assert.Equal(t, "line5", lines[2])
}

func TestOutputBuffer_GetLines_ReturnsCopy(t *testing.T) {
	buf := NewOutputBuffer(10)
	buf.AddLine("line1")
	buf.AddLine("line2")

	lines := buf.GetLines()
	lines[0] = "modified"

	// Original buffer should not be affected
	original := buf.GetLines()
	assert.Equal(t, "line1", original[0], "GetLines should return a copy")
}

func TestOutputBuffer_Callback(t *testing.T) {
	buf := NewOutputBuffer(10)

	callCount := 0
	buf.SetOnNewLine(func() {
		callCount++
	})

	buf.AddLine("line1")
	buf.AddLine("line2")

	assert.Equal(t, 2, callCount, "callback should be called for each AddLine")
}

func TestOutputBuffer_ConcurrentAccess(t *testing.T) {
	buf := NewOutputBuffer(100)
	var wg sync.WaitGroup

	// Concurrent writers
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for j := 0; j < 50; j++ {
				buf.AddLine("line")
			}
		}(i)
	}

	// Concurrent readers
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 50; j++ {
				_ = buf.GetLines()
			}
		}()
	}

	wg.Wait()

	lines := buf.GetLines()
	assert.LessOrEqual(t, len(lines), 100, "buffer should not exceed maxLen")
	assert.Greater(t, len(lines), 0, "buffer should have lines")
}

func TestOutputBuffer_EmptyBuffer(t *testing.T) {
	buf := NewOutputBuffer(10)
	lines := buf.GetLines()
	assert.Empty(t, lines)
	assert.Equal(t, 0, len(lines))
}

func TestOutputBuffer_SingleCapacity(t *testing.T) {
	buf := NewOutputBuffer(1)

	buf.AddLine("first")
	buf.AddLine("second")

	lines := buf.GetLines()
	assert.Equal(t, 1, len(lines))
	assert.Equal(t, "second", lines[0])
}
