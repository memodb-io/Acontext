package cmd

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestValidateProjectName(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		wantErr bool
	}{
		{
			name:    "valid project name",
			input:   "my-project",
			wantErr: false,
		},
		{
			name:    "valid with numbers",
			input:   "project123",
			wantErr: false,
		},
		{
			name:    "valid with underscores",
			input:   "my_project",
			wantErr: false,
		},
		{
			name:    "valid with hyphens",
			input:   "my-acontext-app",
			wantErr: false,
		},
		{
			name:    "empty name",
			input:   "",
			wantErr: true,
		},
		{
			name:    "contains slash",
			input:   "project/name",
			wantErr: true,
		},
		{
			name:    "contains backslash",
			input:   "project\\name",
			wantErr: true,
		},
		{
			name:    "reserved name .git",
			input:   ".git",
			wantErr: true,
		},
		{
			name:    "reserved name .env",
			input:   ".env",
			wantErr: true,
		},
		{
			name:    "reserved name .",
			input:   ".",
			wantErr: true,
		},
		{
			name:    "reserved name ..",
			input:   "..",
			wantErr: true,
		},
		{
			name:    "contains colon",
			input:   "project:name",
			wantErr: true,
		},
		{
			name:    "contains asterisk",
			input:   "project*name",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateProjectName(tt.input)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}
