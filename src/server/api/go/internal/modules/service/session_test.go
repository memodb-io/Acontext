package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/config"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"go.uber.org/zap"
)

// MockSessionRepo is a mock implementation of SessionRepo
type MockSessionRepo struct {
	mock.Mock
}

func (m *MockSessionRepo) Create(ctx context.Context, s *model.Session) error {
	args := m.Called(ctx, s)
	return args.Error(0)
}

func (m *MockSessionRepo) Delete(ctx context.Context, projectID uuid.UUID, sessionID uuid.UUID) error {
	args := m.Called(ctx, projectID, sessionID)
	return args.Error(0)
}

func (m *MockSessionRepo) Update(ctx context.Context, s *model.Session) error {
	args := m.Called(ctx, s)
	return args.Error(0)
}

func (m *MockSessionRepo) Get(ctx context.Context, s *model.Session) (*model.Session, error) {
	args := m.Called(ctx, s)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Session), args.Error(1)
}

func (m *MockSessionRepo) CreateMessageWithAssets(ctx context.Context, msg *model.Message) error {
	args := m.Called(ctx, msg)
	return args.Error(0)
}

func (m *MockSessionRepo) ListBySessionWithCursor(ctx context.Context, sessionID uuid.UUID, afterT time.Time, afterID uuid.UUID, limit int, timeDesc bool) ([]model.Message, error) {
	args := m.Called(ctx, sessionID, afterT, afterID, limit, timeDesc)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]model.Message), args.Error(1)
}

func (m *MockSessionRepo) ListWithCursor(ctx context.Context, projectID uuid.UUID, spaceID *uuid.UUID, notConnected bool, afterCreatedAt time.Time, afterID uuid.UUID, limit int, timeDesc bool) ([]model.Session, error) {
	args := m.Called(ctx, projectID, spaceID, notConnected, afterCreatedAt, afterID, limit, timeDesc)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]model.Session), args.Error(1)
}

func (m *MockSessionRepo) ListAllMessagesBySession(ctx context.Context, sessionID uuid.UUID) ([]model.Message, error) {
	args := m.Called(ctx, sessionID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]model.Message), args.Error(1)
}

// MockAssetReferenceRepo is a mock implementation of AssetReferenceRepo
type MockAssetReferenceRepo struct {
	mock.Mock
}

func (m *MockAssetReferenceRepo) IncrementAssetRef(ctx context.Context, projectID uuid.UUID, asset model.Asset) error {
	args := m.Called(ctx, projectID, asset)
	return args.Error(0)
}

func (m *MockAssetReferenceRepo) DecrementAssetRef(ctx context.Context, projectID uuid.UUID, asset model.Asset) error {
	args := m.Called(ctx, projectID, asset)
	return args.Error(0)
}

func (m *MockAssetReferenceRepo) BatchIncrementAssetRefs(ctx context.Context, projectID uuid.UUID, assets []model.Asset) error {
	args := m.Called(ctx, projectID, assets)
	return args.Error(0)
}

func (m *MockAssetReferenceRepo) BatchDecrementAssetRefs(ctx context.Context, projectID uuid.UUID, assets []model.Asset) error {
	args := m.Called(ctx, projectID, assets)
	return args.Error(0)
}

// MockBlobService is a mock implementation of blob service
type MockBlobService struct {
	mock.Mock
}

func (m *MockBlobService) UploadJSON(ctx context.Context, prefix string, data interface{}) (*model.Asset, error) {
	args := m.Called(ctx, prefix, data)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Asset), args.Error(1)
}

func (m *MockBlobService) DownloadJSON(ctx context.Context, key string, dest interface{}) error {
	args := m.Called(ctx, key, dest)
	return args.Error(0)
}

func (m *MockBlobService) PresignGet(ctx context.Context, key string, expire time.Duration) (string, error) {
	args := m.Called(ctx, key, expire)
	return args.String(0), args.Error(1)
}

// MockPublisher is a mock implementation of MQ publisher
type MockPublisher struct {
	mock.Mock
}

func (m *MockPublisher) PublishJSON(ctx context.Context, exchange, routingKey string, data interface{}) error {
	args := m.Called(ctx, exchange, routingKey, data)
	return args.Error(0)
}

func TestSessionService_Create(t *testing.T) {
	ctx := context.Background()

	tests := []struct {
		name    string
		session *model.Session
		setup   func(*MockSessionRepo)
		wantErr bool
		errMsg  string
	}{
		{
			name: "successful session creation",
			session: &model.Session{
				ID:        uuid.New(),
				ProjectID: uuid.New(),
			},
			setup: func(repo *MockSessionRepo) {
				repo.On("Create", ctx, mock.AnythingOfType("*model.Session")).Return(nil)
			},
			wantErr: false,
		},
		{
			name: "creation failure",
			session: &model.Session{
				ID:        uuid.New(),
				ProjectID: uuid.New(),
			},
			setup: func(repo *MockSessionRepo) {
				repo.On("Create", ctx, mock.AnythingOfType("*model.Session")).Return(errors.New("database error"))
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &MockSessionRepo{}
			tt.setup(repo)

			logger := zap.NewNop()
			mockAssetRefRepo := &MockAssetReferenceRepo{}
			cfg := &config.Config{
				RabbitMQ: config.MQCfg{
					ExchangeName: config.MQExchangeName{
						SessionMessage: "session.message",
					},
					RoutingKey: config.MQRoutingKey{
						SessionMessageInsert: "session.message.insert",
					},
				},
			}
			service := NewSessionService(repo, mockAssetRefRepo, logger, nil, nil, cfg, nil)

			err := service.Create(ctx, tt.session)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
			} else {
				assert.NoError(t, err)
			}

			repo.AssertExpectations(t)
		})
	}
}

func TestSessionService_Delete(t *testing.T) {
	ctx := context.Background()
	projectID := uuid.New()
	sessionID := uuid.New()

	tests := []struct {
		name      string
		projectID uuid.UUID
		sessionID uuid.UUID
		setup     func(*MockSessionRepo)
		wantErr   bool
		errMsg    string
	}{
		{
			name:      "successful session deletion",
			projectID: projectID,
			sessionID: sessionID,
			setup: func(repo *MockSessionRepo) {
				repo.On("Delete", ctx, projectID, sessionID).Return(nil)
			},
			wantErr: false,
		},
		{
			name:      "empty session ID",
			projectID: projectID,
			sessionID: uuid.UUID{},
			setup: func(repo *MockSessionRepo) {
				// Empty UUID will call Delete, because len(uuid.UUID{}) != 0
				repo.On("Delete", ctx, projectID, mock.AnythingOfType("uuid.UUID")).Return(nil)
			},
			wantErr: false, // Actually won't error
		},
		{
			name:      "deletion failed",
			projectID: projectID,
			sessionID: sessionID,
			setup: func(repo *MockSessionRepo) {
				repo.On("Delete", ctx, projectID, sessionID).Return(errors.New("deletion failed"))
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &MockSessionRepo{}
			tt.setup(repo)

			logger := zap.NewNop()
			mockAssetRefRepo := &MockAssetReferenceRepo{}
			cfg := &config.Config{
				RabbitMQ: config.MQCfg{
					ExchangeName: config.MQExchangeName{
						SessionMessage: "session.message",
					},
					RoutingKey: config.MQRoutingKey{
						SessionMessageInsert: "session.message.insert",
					},
				},
			}
			service := NewSessionService(repo, mockAssetRefRepo, logger, nil, nil, cfg, nil)

			err := service.Delete(ctx, tt.projectID, tt.sessionID)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
			} else {
				assert.NoError(t, err)
			}

			repo.AssertExpectations(t)
		})
	}
}

func TestSessionService_GetByID(t *testing.T) {
	ctx := context.Background()
	sessionID := uuid.New()

	tests := []struct {
		name    string
		session *model.Session
		setup   func(*MockSessionRepo)
		wantErr bool
		errMsg  string
	}{
		{
			name: "successful session retrieval",
			session: &model.Session{
				ID: sessionID,
			},
			setup: func(repo *MockSessionRepo) {
				expectedSession := &model.Session{
					ID:        sessionID,
					ProjectID: uuid.New(),
				}
				repo.On("Get", ctx, mock.MatchedBy(func(s *model.Session) bool {
					return s.ID == sessionID
				})).Return(expectedSession, nil)
			},
			wantErr: false,
		},
		{
			name: "empty session ID",
			session: &model.Session{
				ID: uuid.UUID{},
			},
			setup: func(repo *MockSessionRepo) {
				// Empty UUID will call Get, because len(uuid.UUID{}) != 0
				repo.On("Get", ctx, mock.AnythingOfType("*model.Session")).Return(&model.Session{}, nil)
			},
			wantErr: false,
		},
		{
			name: "retrieval failure",
			session: &model.Session{
				ID: sessionID,
			},
			setup: func(repo *MockSessionRepo) {
				repo.On("Get", ctx, mock.AnythingOfType("*model.Session")).Return(nil, errors.New("session not found"))
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &MockSessionRepo{}
			tt.setup(repo)

			logger := zap.NewNop()
			mockAssetRefRepo := &MockAssetReferenceRepo{}
			cfg := &config.Config{
				RabbitMQ: config.MQCfg{
					ExchangeName: config.MQExchangeName{
						SessionMessage: "session.message",
					},
					RoutingKey: config.MQRoutingKey{
						SessionMessageInsert: "session.message.insert",
					},
				},
			}
			service := NewSessionService(repo, mockAssetRefRepo, logger, nil, nil, cfg, nil)

			result, err := service.GetByID(ctx, tt.session)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, result)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, result)
			}

			repo.AssertExpectations(t)
		})
	}
}

func TestSessionService_UpdateByID(t *testing.T) {
	ctx := context.Background()
	sessionID := uuid.New()

	tests := []struct {
		name    string
		session *model.Session
		setup   func(*MockSessionRepo)
		wantErr bool
		errMsg  string
	}{
		{
			name: "successful session update",
			session: &model.Session{
				ID: sessionID,
			},
			setup: func(repo *MockSessionRepo) {
				repo.On("Update", ctx, mock.MatchedBy(func(s *model.Session) bool {
					return s.ID == sessionID
				})).Return(nil)
			},
			wantErr: false,
		},
		{
			name: "update failure",
			session: &model.Session{
				ID: sessionID,
			},
			setup: func(repo *MockSessionRepo) {
				repo.On("Update", ctx, mock.AnythingOfType("*model.Session")).Return(errors.New("update failed"))
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &MockSessionRepo{}
			tt.setup(repo)

			logger := zap.NewNop()
			mockAssetRefRepo := &MockAssetReferenceRepo{}
			cfg := &config.Config{
				RabbitMQ: config.MQCfg{
					ExchangeName: config.MQExchangeName{
						SessionMessage: "session.message",
					},
					RoutingKey: config.MQRoutingKey{
						SessionMessageInsert: "session.message.insert",
					},
				},
			}
			service := NewSessionService(repo, mockAssetRefRepo, logger, nil, nil, cfg, nil)

			err := service.UpdateByID(ctx, tt.session)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
			} else {
				assert.NoError(t, err)
			}

			repo.AssertExpectations(t)
		})
	}
}

func TestSessionService_List(t *testing.T) {
	ctx := context.Background()
	projectID := uuid.New()
	spaceID := uuid.New()

	tests := []struct {
		name    string
		input   ListSessionsInput
		setup   func(*MockSessionRepo)
		wantErr bool
		errMsg  string
	}{
		{
			name: "successful sessions retrieval - all sessions",
			input: ListSessionsInput{
				ProjectID:    projectID,
				SpaceID:      nil,
				NotConnected: false,
				Limit:        10,
			},
			setup: func(repo *MockSessionRepo) {
				expectedSessions := []model.Session{
					{
						ID:        uuid.New(),
						ProjectID: projectID,
					},
					{
						ID:        uuid.New(),
						ProjectID: projectID,
					},
				}
				repo.On("ListWithCursor", ctx, projectID, (*uuid.UUID)(nil), false, time.Time{}, uuid.UUID{}, 11, false).Return(expectedSessions, nil)
			},
			wantErr: false,
		},
		{
			name: "successful sessions retrieval - filter by space_id",
			input: ListSessionsInput{
				ProjectID:    projectID,
				SpaceID:      &spaceID,
				NotConnected: false,
				Limit:        10,
			},
			setup: func(repo *MockSessionRepo) {
				expectedSessions := []model.Session{
					{
						ID:        uuid.New(),
						ProjectID: projectID,
						SpaceID:   &spaceID,
					},
				}
				repo.On("ListWithCursor", ctx, projectID, &spaceID, false, time.Time{}, uuid.UUID{}, 11, false).Return(expectedSessions, nil)
			},
			wantErr: false,
		},
		{
			name: "successful sessions retrieval - not connected",
			input: ListSessionsInput{
				ProjectID:    projectID,
				SpaceID:      nil,
				NotConnected: true,
				Limit:        10,
			},
			setup: func(repo *MockSessionRepo) {
				expectedSessions := []model.Session{
					{
						ID:        uuid.New(),
						ProjectID: projectID,
						SpaceID:   nil,
					},
				}
				repo.On("ListWithCursor", ctx, projectID, (*uuid.UUID)(nil), true, time.Time{}, uuid.UUID{}, 11, false).Return(expectedSessions, nil)
			},
			wantErr: false,
		},
		{
			name: "empty sessions list",
			input: ListSessionsInput{
				ProjectID:    projectID,
				SpaceID:      nil,
				NotConnected: false,
				Limit:        10,
			},
			setup: func(repo *MockSessionRepo) {
				repo.On("ListWithCursor", ctx, projectID, (*uuid.UUID)(nil), false, time.Time{}, uuid.UUID{}, 11, false).Return([]model.Session{}, nil)
			},
			wantErr: false,
		},
		{
			name: "list failure",
			input: ListSessionsInput{
				ProjectID:    projectID,
				SpaceID:      nil,
				NotConnected: false,
				Limit:        10,
			},
			setup: func(repo *MockSessionRepo) {
				repo.On("ListWithCursor", ctx, projectID, (*uuid.UUID)(nil), false, time.Time{}, uuid.UUID{}, 11, false).Return(nil, errors.New("database error"))
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &MockSessionRepo{}
			tt.setup(repo)

			logger := zap.NewNop()
			mockAssetRefRepo := &MockAssetReferenceRepo{}
			cfg := &config.Config{
				RabbitMQ: config.MQCfg{
					ExchangeName: config.MQExchangeName{
						SessionMessage: "session.message",
					},
					RoutingKey: config.MQRoutingKey{
						SessionMessageInsert: "session.message.insert",
					},
				},
			}
			service := NewSessionService(repo, mockAssetRefRepo, logger, nil, nil, cfg, nil)

			result, err := service.List(ctx, tt.input)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, result)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, result)
			}

			repo.AssertExpectations(t)
		})
	}
}

func TestPartIn_Validate(t *testing.T) {
	tests := []struct {
		name    string
		part    PartIn
		wantErr bool
		errMsg  string
	}{
		{
			name: "valid text part",
			part: PartIn{
				Type: "text",
				Text: "This is a piece of text",
			},
			wantErr: false,
		},
		{
			name: "text part with empty text",
			part: PartIn{
				Type: "text",
				Text: "",
			},
			wantErr: true,
			errMsg:  "text part requires non-empty text field",
		},
		{
			name: "valid tool-call part",
			part: PartIn{
				Type: "tool-call",
				Meta: map[string]interface{}{
					"name": "calculator", // UNIFIED FORMAT: was "tool_name", now "name"
					"arguments": map[string]interface{}{
						"expression": "2 + 2",
					},
				},
			},
			wantErr: false,
		},
		{
			name: "tool-call part missing name",
			part: PartIn{
				Type: "tool-call",
				Meta: map[string]interface{}{
					"arguments": map[string]interface{}{
						"expression": "2 + 2",
					},
				},
			},
			wantErr: true,
			errMsg:  "tool-call part requires 'name' in meta", // UNIFIED FORMAT
		},
		{
			name: "tool-call part missing arguments",
			part: PartIn{
				Type: "tool-call",
				Meta: map[string]interface{}{
					"name": "calculator", // UNIFIED FORMAT
				},
			},
			wantErr: true,
			errMsg:  "tool-call part requires 'arguments' in meta", // UNIFIED FORMAT
		},
		{
			name: "valid tool-result part",
			part: PartIn{
				Type: "tool-result",
				Meta: map[string]interface{}{
					"tool_call_id": "call_123",
					"result":       "4",
				},
			},
			wantErr: false,
		},
		{
			name: "tool-result part missing tool_call_id",
			part: PartIn{
				Type: "tool-result",
				Meta: map[string]interface{}{
					"result": "4",
				},
			},
			wantErr: true,
			errMsg:  "tool-result part requires 'tool_call_id' in meta", // UNIFIED FORMAT
		},
		{
			name: "valid data part",
			part: PartIn{
				Type: "data",
				Meta: map[string]interface{}{
					"data_type": "json",
					"content":   `{"key": "value"}`,
				},
			},
			wantErr: false,
		},
		{
			name: "data part missing data_type",
			part: PartIn{
				Type: "data",
				Meta: map[string]interface{}{
					"content": `{"key": "value"}`,
				},
			},
			wantErr: true,
			errMsg:  "data part requires 'data_type' in meta",
		},
		{
			name: "invalid type",
			part: PartIn{
				Type: "invalid",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.part.Validate()

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestSessionService_GetMessages(t *testing.T) {
	ctx := context.Background()
	sessionID := uuid.New()

	tests := []struct {
		name    string
		input   GetMessagesInput
		setup   func(*MockSessionRepo)
		wantErr bool
		errMsg  string
	}{
		{
			name: "repository query failure",
			input: GetMessagesInput{
				SessionID: sessionID,
				Limit:     10,
				TimeDesc:  false,
			},
			setup: func(repo *MockSessionRepo) {
				repo.On("ListBySessionWithCursor", ctx, sessionID, time.Time{}, uuid.UUID{}, 11, false).Return(nil, errors.New("query failure"))
			},
			wantErr: true,
		},
		{
			name: "successful message retrieval with time_desc=false",
			input: GetMessagesInput{
				SessionID: sessionID,
				Limit:     10,
				TimeDesc:  false,
			},
			setup: func(repo *MockSessionRepo) {
				msgs := []model.Message{
					{ID: uuid.New(), SessionID: sessionID, Role: "user"},
				}
				repo.On("ListBySessionWithCursor", ctx, sessionID, time.Time{}, uuid.UUID{}, 11, false).Return(msgs, nil)
			},
			wantErr: false,
		},
		{
			name: "successful message retrieval with time_desc=true",
			input: GetMessagesInput{
				SessionID: sessionID,
				Limit:     10,
				TimeDesc:  true,
			},
			setup: func(repo *MockSessionRepo) {
				msgs := []model.Message{
					{ID: uuid.New(), SessionID: sessionID, Role: "user"},
				}
				repo.On("ListBySessionWithCursor", ctx, sessionID, time.Time{}, uuid.UUID{}, 11, true).Return(msgs, nil)
			},
			wantErr: false,
		},
		{
			name: "with cursor and time_desc",
			input: GetMessagesInput{
				SessionID: sessionID,
				Limit:     10,
				Cursor:    "some-valid-cursor", // Use a placeholder cursor
				TimeDesc:  false,
			},
			setup: func(repo *MockSessionRepo) {
				// Expect an error due to invalid cursor format, so no repo call expected
			},
			wantErr: true,
			errMsg:  "base64", // The actual error message is about base64 decoding
		},
		{
			name: "limit=0 retrieves all messages using ListAllMessagesBySession",
			input: GetMessagesInput{
				SessionID: sessionID,
				Limit:     0,
				TimeDesc:  false,
			},
			setup: func(repo *MockSessionRepo) {
				msgs := []model.Message{
					{ID: uuid.New(), SessionID: sessionID, Role: "user"},
					{ID: uuid.New(), SessionID: sessionID, Role: "assistant"},
				}
				repo.On("ListAllMessagesBySession", ctx, sessionID).Return(msgs, nil)
			},
			wantErr: false,
		},
		{
			name: "limit=-1 retrieves all messages using ListAllMessagesBySession",
			input: GetMessagesInput{
				SessionID: sessionID,
				Limit:     -1,
				TimeDesc:  false,
			},
			setup: func(repo *MockSessionRepo) {
				msgs := []model.Message{
					{ID: uuid.New(), SessionID: sessionID, Role: "user"},
				}
				repo.On("ListAllMessagesBySession", ctx, sessionID).Return(msgs, nil)
			},
			wantErr: false,
		},
		{
			name: "ListAllMessagesBySession error handling",
			input: GetMessagesInput{
				SessionID: sessionID,
				Limit:     0,
				TimeDesc:  false,
			},
			setup: func(repo *MockSessionRepo) {
				repo.On("ListAllMessagesBySession", ctx, sessionID).Return(nil, errors.New("database error"))
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &MockSessionRepo{}
			tt.setup(repo)

			logger := zap.NewNop()
			mockAssetRefRepo := &MockAssetReferenceRepo{}
			cfg := &config.Config{
				RabbitMQ: config.MQCfg{
					ExchangeName: config.MQExchangeName{
						SessionMessage: "session.message",
					},
					RoutingKey: config.MQRoutingKey{
						SessionMessageInsert: "session.message.insert",
					},
				},
			}
			// Note: blob is nil in test, so GetMessages will skip DownloadJSON and PresignGet
			service := NewSessionService(repo, mockAssetRefRepo, logger, nil, nil, cfg, nil)

			result, err := service.GetMessages(ctx, tt.input)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, result)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
			} else {
				// Note: In real usage, blob is not nil, so messages will have parts loaded
				// In tests, we just verify the service layer logic without blob operations
				assert.NoError(t, err)
				if result != nil {
					assert.NotNil(t, result.Items)
				}
			}

			repo.AssertExpectations(t)
		})
	}
}

func TestSessionService_GetMessages_SortOrder(t *testing.T) {
	ctx := context.Background()
	sessionID := uuid.New()

	// Create test messages with different timestamps
	now := time.Now()
	// Use fixed UUIDs with predictable lexicographic ordering
	msg1ID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	msg2ID := uuid.MustParse("00000000-0000-0000-0000-000000000002")
	msg3ID := uuid.MustParse("00000000-0000-0000-0000-000000000003")
	msg4ID := uuid.MustParse("00000000-0000-0000-0000-000000000004")

	tests := []struct {
		name          string
		input         GetMessagesInput
		repoMessages  []model.Message // Messages returned from repo (can be in any order)
		expectedOrder []uuid.UUID     // Expected order in output (from old to new)
		setup         func(*MockSessionRepo)
		wantErr       bool
	}{
		{
			name: "messages sorted from old to new when time_desc=false",
			input: GetMessagesInput{
				SessionID: sessionID,
				Limit:     10,
				TimeDesc:  false,
			},
			repoMessages: []model.Message{
				{ID: msg1ID, SessionID: sessionID, Role: "user", CreatedAt: now.Add(-3 * time.Hour)},
				{ID: msg2ID, SessionID: sessionID, Role: "assistant", CreatedAt: now.Add(-2 * time.Hour)},
				{ID: msg3ID, SessionID: sessionID, Role: "user", CreatedAt: now.Add(-1 * time.Hour)},
			},
			expectedOrder: []uuid.UUID{msg1ID, msg2ID, msg3ID},
			setup: func(repo *MockSessionRepo) {
				msgs := []model.Message{
					{ID: msg1ID, SessionID: sessionID, Role: "user", CreatedAt: now.Add(-3 * time.Hour)},
					{ID: msg2ID, SessionID: sessionID, Role: "assistant", CreatedAt: now.Add(-2 * time.Hour)},
					{ID: msg3ID, SessionID: sessionID, Role: "user", CreatedAt: now.Add(-1 * time.Hour)},
				}
				repo.On("ListBySessionWithCursor", ctx, sessionID, time.Time{}, uuid.UUID{}, 11, false).Return(msgs, nil)
			},
			wantErr: false,
		},
		{
			name: "messages sorted from old to new even when time_desc=true (repo returns desc order)",
			input: GetMessagesInput{
				SessionID: sessionID,
				Limit:     10,
				TimeDesc:  true,
			},
			repoMessages: []model.Message{
				{ID: msg3ID, SessionID: sessionID, Role: "user", CreatedAt: now.Add(-1 * time.Hour)},
				{ID: msg2ID, SessionID: sessionID, Role: "assistant", CreatedAt: now.Add(-2 * time.Hour)},
				{ID: msg1ID, SessionID: sessionID, Role: "user", CreatedAt: now.Add(-3 * time.Hour)},
			},
			expectedOrder: []uuid.UUID{msg1ID, msg2ID, msg3ID}, // Still old to new
			setup: func(repo *MockSessionRepo) {
				// Repo returns messages in descending order (newest first)
				msgs := []model.Message{
					{ID: msg3ID, SessionID: sessionID, Role: "user", CreatedAt: now.Add(-1 * time.Hour)},
					{ID: msg2ID, SessionID: sessionID, Role: "assistant", CreatedAt: now.Add(-2 * time.Hour)},
					{ID: msg1ID, SessionID: sessionID, Role: "user", CreatedAt: now.Add(-3 * time.Hour)},
				}
				repo.On("ListBySessionWithCursor", ctx, sessionID, time.Time{}, uuid.UUID{}, 11, true).Return(msgs, nil)
			},
			wantErr: false,
		},
		{
			name: "messages with same timestamp sorted by ID",
			input: GetMessagesInput{
				SessionID: sessionID,
				Limit:     10,
				TimeDesc:  false,
			},
			repoMessages: []model.Message{
				{ID: msg4ID, SessionID: sessionID, Role: "user", CreatedAt: now},
				{ID: msg2ID, SessionID: sessionID, Role: "assistant", CreatedAt: now},
				{ID: msg1ID, SessionID: sessionID, Role: "user", CreatedAt: now},
			},
			// When timestamps are equal, sort by ID (lexicographically)
			expectedOrder: []uuid.UUID{msg1ID, msg2ID, msg4ID}, // Assuming these IDs sort this way lexicographically
			setup: func(repo *MockSessionRepo) {
				msgs := []model.Message{
					{ID: msg4ID, SessionID: sessionID, Role: "user", CreatedAt: now},
					{ID: msg2ID, SessionID: sessionID, Role: "assistant", CreatedAt: now},
					{ID: msg1ID, SessionID: sessionID, Role: "user", CreatedAt: now},
				}
				repo.On("ListBySessionWithCursor", ctx, sessionID, time.Time{}, uuid.UUID{}, 11, false).Return(msgs, nil)
			},
			wantErr: false,
		},
		{
			name: "mixed order from repo gets sorted to old-to-new",
			input: GetMessagesInput{
				SessionID: sessionID,
				Limit:     10,
				TimeDesc:  false,
			},
			repoMessages: []model.Message{
				{ID: msg2ID, SessionID: sessionID, Role: "assistant", CreatedAt: now.Add(-2 * time.Hour)},
				{ID: msg4ID, SessionID: sessionID, Role: "user", CreatedAt: now},
				{ID: msg1ID, SessionID: sessionID, Role: "user", CreatedAt: now.Add(-3 * time.Hour)},
				{ID: msg3ID, SessionID: sessionID, Role: "assistant", CreatedAt: now.Add(-1 * time.Hour)},
			},
			expectedOrder: []uuid.UUID{msg1ID, msg2ID, msg3ID, msg4ID},
			setup: func(repo *MockSessionRepo) {
				// Repo returns messages in random order
				msgs := []model.Message{
					{ID: msg2ID, SessionID: sessionID, Role: "assistant", CreatedAt: now.Add(-2 * time.Hour)},
					{ID: msg4ID, SessionID: sessionID, Role: "user", CreatedAt: now},
					{ID: msg1ID, SessionID: sessionID, Role: "user", CreatedAt: now.Add(-3 * time.Hour)},
					{ID: msg3ID, SessionID: sessionID, Role: "assistant", CreatedAt: now.Add(-1 * time.Hour)},
				}
				repo.On("ListBySessionWithCursor", ctx, sessionID, time.Time{}, uuid.UUID{}, 11, false).Return(msgs, nil)
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &MockSessionRepo{}
			tt.setup(repo)

			logger := zap.NewNop()
			mockAssetRefRepo := &MockAssetReferenceRepo{}
			cfg := &config.Config{
				RabbitMQ: config.MQCfg{
					ExchangeName: config.MQExchangeName{
						SessionMessage: "session.message",
					},
					RoutingKey: config.MQRoutingKey{
						SessionMessageInsert: "session.message.insert",
					},
				},
			}
			service := NewSessionService(repo, mockAssetRefRepo, logger, nil, nil, cfg, nil)

			result, err := service.GetMessages(ctx, tt.input)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, result)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, result)
				assert.NotNil(t, result.Items)

				// Verify the messages are sorted from old to new
				assert.Equal(t, len(tt.expectedOrder), len(result.Items), "Number of messages should match")

				for i, expectedID := range tt.expectedOrder {
					assert.Equal(t, expectedID, result.Items[i].ID,
						"Message at position %d should be %s but got %s", i, expectedID, result.Items[i].ID)
				}

				// Additionally verify that messages are in ascending time order
				for i := 1; i < len(result.Items); i++ {
					prevTime := result.Items[i-1].CreatedAt
					currTime := result.Items[i].CreatedAt
					assert.True(t, prevTime.Before(currTime) || prevTime.Equal(currTime),
						"Messages should be sorted from old to new: message[%d] (%v) should be before or equal to message[%d] (%v)",
						i-1, prevTime, i, currTime)
				}
			}

			repo.AssertExpectations(t)
		})
	}
}
