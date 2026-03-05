package service

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type MockTaskRepo struct {
	mock.Mock
}

func (m *MockTaskRepo) ListBySessionWithCursor(ctx context.Context, sessionID uuid.UUID, afterCreatedAt time.Time, afterID uuid.UUID, limit int, timeDesc bool) ([]model.Task, error) {
	args := m.Called(ctx, sessionID, afterCreatedAt, afterID, limit, timeDesc)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]model.Task), args.Error(1)
}

func (m *MockTaskRepo) UpdateStatus(ctx context.Context, projectID uuid.UUID, sessionID uuid.UUID, taskID uuid.UUID, status string) (*model.Task, error) {
	args := m.Called(ctx, projectID, sessionID, taskID, status)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Task), args.Error(1)
}

// MockLearningSpaceSessionRepo is defined in learning_space_test.go

func TestTaskService_UpdateTaskStatus(t *testing.T) {
	projectID := uuid.New()
	sessionID := uuid.New()
	taskID := uuid.New()

	tests := []struct {
		name        string
		input       UpdateTaskStatusInput
		setupRepo   func(*MockTaskRepo)
		setupLSS    func(*MockLearningSpaceSessionRepo)
		expectErr   bool
		errContains string
		checkResult func(*testing.T, *model.Task)
	}{
		{
			name: "success - update to success, learning space exists",
			input: UpdateTaskStatusInput{
				ProjectID: projectID,
				SessionID: sessionID,
				TaskID:    taskID,
				Status:    "success",
			},
			setupRepo: func(r *MockTaskRepo) {
				r.On("UpdateStatus", mock.Anything, projectID, sessionID, taskID, "success").
					Return(&model.Task{
						ID:        taskID,
						SessionID: sessionID,
						ProjectID: projectID,
						Status:    "success",
					}, nil)
			},
			setupLSS: func(lss *MockLearningSpaceSessionRepo) {
				lss.On("ExistsBySessionID", mock.Anything, sessionID).Return(true, nil)
			},
			checkResult: func(t *testing.T, task *model.Task) {
				assert.Equal(t, "success", task.Status)
				assert.Equal(t, taskID, task.ID)
			},
		},
		{
			name: "success - update to failed, no learning space",
			input: UpdateTaskStatusInput{
				ProjectID: projectID,
				SessionID: sessionID,
				TaskID:    taskID,
				Status:    "failed",
			},
			setupRepo: func(r *MockTaskRepo) {
				r.On("UpdateStatus", mock.Anything, projectID, sessionID, taskID, "failed").
					Return(&model.Task{
						ID:        taskID,
						SessionID: sessionID,
						ProjectID: projectID,
						Status:    "failed",
					}, nil)
			},
			setupLSS: func(lss *MockLearningSpaceSessionRepo) {
				lss.On("ExistsBySessionID", mock.Anything, sessionID).Return(false, nil)
			},
			checkResult: func(t *testing.T, task *model.Task) {
				assert.Equal(t, "failed", task.Status)
			},
		},
		{
			name: "success - update to running, no learning space check",
			input: UpdateTaskStatusInput{
				ProjectID: projectID,
				SessionID: sessionID,
				TaskID:    taskID,
				Status:    "running",
			},
			setupRepo: func(r *MockTaskRepo) {
				r.On("UpdateStatus", mock.Anything, projectID, sessionID, taskID, "running").
					Return(&model.Task{
						ID:        taskID,
						SessionID: sessionID,
						ProjectID: projectID,
						Status:    "running",
					}, nil)
			},
			setupLSS: func(lss *MockLearningSpaceSessionRepo) {
				// ExistsBySessionID should NOT be called for running/pending
			},
			checkResult: func(t *testing.T, task *model.Task) {
				assert.Equal(t, "running", task.Status)
			},
		},
		{
			name: "success - update to pending, no learning space check",
			input: UpdateTaskStatusInput{
				ProjectID: projectID,
				SessionID: sessionID,
				TaskID:    taskID,
				Status:    "pending",
			},
			setupRepo: func(r *MockTaskRepo) {
				r.On("UpdateStatus", mock.Anything, projectID, sessionID, taskID, "pending").
					Return(&model.Task{
						ID:        taskID,
						SessionID: sessionID,
						ProjectID: projectID,
						Status:    "pending",
					}, nil)
			},
			setupLSS: func(lss *MockLearningSpaceSessionRepo) {},
			checkResult: func(t *testing.T, task *model.Task) {
				assert.Equal(t, "pending", task.Status)
			},
		},
		{
			name: "error - task not found (gorm.ErrRecordNotFound)",
			input: UpdateTaskStatusInput{
				ProjectID: projectID,
				SessionID: sessionID,
				TaskID:    taskID,
				Status:    "success",
			},
			setupRepo: func(r *MockTaskRepo) {
				r.On("UpdateStatus", mock.Anything, projectID, sessionID, taskID, "success").
					Return(nil, gorm.ErrRecordNotFound)
			},
			setupLSS:    func(lss *MockLearningSpaceSessionRepo) {},
			expectErr:   true,
			errContains: "not found",
		},
		{
			name: "error - repo returns generic error",
			input: UpdateTaskStatusInput{
				ProjectID: projectID,
				SessionID: sessionID,
				TaskID:    taskID,
				Status:    "success",
			},
			setupRepo: func(r *MockTaskRepo) {
				r.On("UpdateStatus", mock.Anything, projectID, sessionID, taskID, "success").
					Return(nil, fmt.Errorf("database connection error"))
			},
			setupLSS:    func(lss *MockLearningSpaceSessionRepo) {},
			expectErr:   true,
			errContains: "failed to update task status",
		},
		{
			name: "success - learning space check fails, status still updated",
			input: UpdateTaskStatusInput{
				ProjectID: projectID,
				SessionID: sessionID,
				TaskID:    taskID,
				Status:    "success",
			},
			setupRepo: func(r *MockTaskRepo) {
				r.On("UpdateStatus", mock.Anything, projectID, sessionID, taskID, "success").
					Return(&model.Task{
						ID:        taskID,
						SessionID: sessionID,
						ProjectID: projectID,
						Status:    "success",
					}, nil)
			},
			setupLSS: func(lss *MockLearningSpaceSessionRepo) {
				lss.On("ExistsBySessionID", mock.Anything, sessionID).Return(false, fmt.Errorf("db error"))
			},
			checkResult: func(t *testing.T, task *model.Task) {
				assert.Equal(t, "success", task.Status)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := &MockTaskRepo{}
			mockLSS := &MockLearningSpaceSessionRepo{}
			tt.setupRepo(mockRepo)
			tt.setupLSS(mockLSS)

			svc := NewTaskService(mockRepo, mockLSS, nil, nil, zap.NewNop())

			result, err := svc.UpdateTaskStatus(context.Background(), tt.input)

			if tt.expectErr {
				assert.Error(t, err)
				if tt.errContains != "" {
					assert.Contains(t, err.Error(), tt.errContains)
				}
				assert.Nil(t, result)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, result)
				if tt.checkResult != nil {
					tt.checkResult(t, result)
				}
			}

			mockRepo.AssertExpectations(t)
			mockLSS.AssertExpectations(t)
		})
	}
}
