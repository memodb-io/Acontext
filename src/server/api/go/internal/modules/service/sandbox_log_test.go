package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/pkg/paging"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"gorm.io/datatypes"
)

// MockSandboxLogRepo is a mock implementation of SandboxLogRepo
type MockSandboxLogRepo struct {
	mock.Mock
}

func (m *MockSandboxLogRepo) ListByProjectWithCursor(ctx context.Context, projectID uuid.UUID, afterCreatedAt time.Time, afterID uuid.UUID, limit int, timeDesc bool) ([]model.SandboxLog, error) {
	args := m.Called(ctx, projectID, afterCreatedAt, afterID, limit, timeDesc)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]model.SandboxLog), args.Error(1)
}

func TestSandboxLogService_GetSandboxLogs(t *testing.T) {
	ctx := context.Background()
	projectID := uuid.New()

	tests := []struct {
		name    string
		input   GetSandboxLogsInput
		setup   func(*MockSandboxLogRepo)
		wantErr bool
		errMsg  string
		check   func(*testing.T, *GetSandboxLogsOutput)
	}{
		{
			name: "successful sandbox logs retrieval",
			input: GetSandboxLogsInput{
				ProjectID: projectID,
				Limit:     10,
				TimeDesc:  false,
			},
			setup: func(repo *MockSandboxLogRepo) {
				expectedLogs := []model.SandboxLog{
					{
						ID:             uuid.New(),
						ProjectID:      projectID,
						BackendType:    "e2b",
						HistoryCommands: datatypes.NewJSONType([]model.HistoryCommand{}),
						GeneratedFiles:  datatypes.NewJSONType([]model.GeneratedFile{}),
					},
					{
						ID:             uuid.New(),
						ProjectID:      projectID,
						BackendType:    "cloudflare",
						HistoryCommands: datatypes.NewJSONType([]model.HistoryCommand{}),
						GeneratedFiles:  datatypes.NewJSONType([]model.GeneratedFile{}),
					},
				}
				repo.On("ListByProjectWithCursor", ctx, projectID, time.Time{}, uuid.UUID{}, 11, false).Return(expectedLogs, nil)
			},
			wantErr: false,
			check: func(t *testing.T, out *GetSandboxLogsOutput) {
				assert.NotNil(t, out)
				assert.Len(t, out.Items, 2)
				assert.False(t, out.HasMore)
			},
		},
		{
			name: "empty sandbox logs list",
			input: GetSandboxLogsInput{
				ProjectID: projectID,
				Limit:     10,
				TimeDesc:  false,
			},
			setup: func(repo *MockSandboxLogRepo) {
				repo.On("ListByProjectWithCursor", ctx, projectID, time.Time{}, uuid.UUID{}, 11, false).Return([]model.SandboxLog{}, nil)
			},
			wantErr: false,
			check: func(t *testing.T, out *GetSandboxLogsOutput) {
				assert.NotNil(t, out)
				assert.Len(t, out.Items, 0)
				assert.False(t, out.HasMore)
			},
		},
		{
			name: "list failure",
			input: GetSandboxLogsInput{
				ProjectID: projectID,
				Limit:     10,
				TimeDesc:  false,
			},
			setup: func(repo *MockSandboxLogRepo) {
				repo.On("ListByProjectWithCursor", ctx, projectID, time.Time{}, uuid.UUID{}, 11, false).Return(nil, errors.New("database error"))
			},
			wantErr: true,
		},
		{
			name: "successful retrieval with time_desc=true",
			input: GetSandboxLogsInput{
				ProjectID: projectID,
				Limit:     10,
				TimeDesc:  true,
			},
			setup: func(repo *MockSandboxLogRepo) {
				expectedLogs := []model.SandboxLog{
					{
						ID:             uuid.New(),
						ProjectID:      projectID,
						BackendType:    "e2b",
						HistoryCommands: datatypes.NewJSONType([]model.HistoryCommand{}),
						GeneratedFiles:  datatypes.NewJSONType([]model.GeneratedFile{}),
					},
				}
				repo.On("ListByProjectWithCursor", ctx, projectID, time.Time{}, uuid.UUID{}, 11, true).Return(expectedLogs, nil)
			},
			wantErr: false,
			check: func(t *testing.T, out *GetSandboxLogsOutput) {
				assert.NotNil(t, out)
				assert.Len(t, out.Items, 1)
			},
		},
		{
			name: "pagination with cursor and has_more",
			input: GetSandboxLogsInput{
				ProjectID: projectID,
				Limit:     10,
				TimeDesc:  false,
			},
			setup: func(repo *MockSandboxLogRepo) {
				// Return 11 items to trigger has_more
				logs := make([]model.SandboxLog, 11)
				now := time.Now()
				for i := 0; i < 11; i++ {
					logs[i] = model.SandboxLog{
						ID:              uuid.New(),
						ProjectID:       projectID,
						BackendType:     "e2b",
						HistoryCommands: datatypes.NewJSONType([]model.HistoryCommand{}),
						GeneratedFiles:  datatypes.NewJSONType([]model.GeneratedFile{}),
						CreatedAt:       now.Add(time.Duration(i) * time.Second),
					}
				}
				repo.On("ListByProjectWithCursor", ctx, projectID, time.Time{}, uuid.UUID{}, 11, false).Return(logs, nil)
			},
			wantErr: false,
			check: func(t *testing.T, out *GetSandboxLogsOutput) {
				assert.NotNil(t, out)
				assert.Len(t, out.Items, 10) // Should be limited to 10
				assert.True(t, out.HasMore)
				assert.NotEmpty(t, out.NextCursor)
			},
		},
		{
			name: "pagination with valid cursor",
			input: func() GetSandboxLogsInput {
				cursorTime := time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC)
				cursorID := uuid.MustParse("087c6033-7f73-4307-bdf4-6d408af761ab")
				return GetSandboxLogsInput{
					ProjectID: projectID,
					Limit:     10,
					Cursor:    paging.EncodeCursor(cursorTime, cursorID),
					TimeDesc:  false,
				}
			}(),
			setup: func(repo *MockSandboxLogRepo) {
				cursorTime := time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC)
				cursorID := uuid.MustParse("087c6033-7f73-4307-bdf4-6d408af761ab")
				expectedLogs := []model.SandboxLog{
					{
						ID:              uuid.New(),
						ProjectID:       projectID,
						BackendType:     "e2b",
						HistoryCommands: datatypes.NewJSONType([]model.HistoryCommand{}),
						GeneratedFiles:  datatypes.NewJSONType([]model.GeneratedFile{}),
					},
				}
				repo.On("ListByProjectWithCursor", ctx, projectID, cursorTime, cursorID, 11, false).Return(expectedLogs, nil)
			},
			wantErr: false,
			check: func(t *testing.T, out *GetSandboxLogsOutput) {
				assert.NotNil(t, out)
				assert.Len(t, out.Items, 1)
			},
		},
		{
			name: "invalid cursor",
			input: GetSandboxLogsInput{
				ProjectID: projectID,
				Limit:     10,
				Cursor:    "invalid-cursor",
				TimeDesc:  false,
			},
			setup:   func(repo *MockSandboxLogRepo) {},
			wantErr: true,
			errMsg:  "bad cursor",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &MockSandboxLogRepo{}
			tt.setup(repo)

			service := NewSandboxLogService(repo)
			result, err := service.GetSandboxLogs(ctx, tt.input)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, result)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, result)
				if tt.check != nil {
					tt.check(t, result)
				}
			}

			repo.AssertExpectations(t)
		})
	}
}
