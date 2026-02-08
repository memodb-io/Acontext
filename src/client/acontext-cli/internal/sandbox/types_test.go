package sandbox

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGetAvailableSandboxTypes(t *testing.T) {
	types := GetAvailableSandboxTypes()
	assert.NotEmpty(t, types)

	// Verify cloudflare type exists
	found := false
	for _, st := range types {
		if st.Name == "cloudflare" {
			found = true
			assert.Equal(t, "Cloudflare Sandbox", st.DisplayName)
			assert.Equal(t, "@acontext/sandbox-cloudflare", st.NpmPackage)
		}
	}
	assert.True(t, found, "cloudflare sandbox type should be available")
}

func TestGetSandboxTypeByName(t *testing.T) {
	tests := []struct {
		name        string
		input       string
		wantErr     bool
		displayName string
	}{
		{
			name:        "valid cloudflare type",
			input:       "cloudflare",
			wantErr:     false,
			displayName: "Cloudflare Sandbox",
		},
		{
			name:    "nonexistent type",
			input:   "nonexistent",
			wantErr: true,
		},
		{
			name:    "empty name",
			input:   "",
			wantErr: true,
		},
		{
			name:    "case sensitive - uppercase",
			input:   "Cloudflare",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := GetSandboxTypeByName(tt.input)
			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, result)
				assert.Contains(t, err.Error(), "sandbox type not found")
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, result)
				assert.Equal(t, tt.displayName, result.DisplayName)
			}
		})
	}
}
