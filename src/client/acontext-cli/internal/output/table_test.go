package output

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRenderJSON_ValidStruct(t *testing.T) {
	data := struct {
		Name string `json:"name"`
		Age  int    `json:"age"`
	}{Name: "Alice", Age: 30}

	err := RenderJSON(data)
	require.NoError(t, err)
}

func TestRenderJSON_UnmarshalableType(t *testing.T) {
	ch := make(chan int)
	err := RenderJSON(ch)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "marshal JSON")
}

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
