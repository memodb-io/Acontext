package output

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestRenderTable_NoPanic(t *testing.T) {
	assert.NotPanics(t, func() {
		RenderTable(
			[]string{"ID", "Name", "Status"},
			[][]string{
				{"1", "Project A", "active"},
				{"2", "Project B", "inactive"},
			},
		)
	})
}
