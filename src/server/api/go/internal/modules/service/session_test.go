package service

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/config"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"go.uber.org/zap"
	"gorm.io/datatypes"
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

func (m *MockSessionRepo) GetDisableTaskTracking(ctx context.Context, sessionID uuid.UUID) (bool, error) {
	args := m.Called(ctx, sessionID)
	return args.Bool(0), args.Error(1)
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

func (m *MockSessionRepo) ListWithCursor(ctx context.Context, projectID uuid.UUID, userIdentifier string, filterByConfigs map[string]interface{}, afterCreatedAt time.Time, afterID uuid.UUID, limit int, timeDesc bool) ([]model.Session, error) {
	args := m.Called(ctx, projectID, userIdentifier, filterByConfigs, afterCreatedAt, afterID, limit, timeDesc)
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

func (m *MockSessionRepo) GetObservingStatus(ctx context.Context, sessionID string) (*model.MessageObservingStatus, error) {
	args := m.Called(ctx, sessionID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.MessageObservingStatus), args.Error(1)
}

func (m *MockSessionRepo) PopGeminiCallIDAndName(ctx context.Context, sessionID uuid.UUID) (string, string, error) {
	args := m.Called(ctx, sessionID)
	return args.String(0), args.String(1), args.Error(2)
}

func (m *MockSessionRepo) GetMessageByID(ctx context.Context, sessionID uuid.UUID, messageID uuid.UUID) (*model.Message, error) {
	args := m.Called(ctx, sessionID, messageID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Message), args.Error(1)
}

func (m *MockSessionRepo) UpdateMessageMeta(ctx context.Context, messageID uuid.UUID, meta datatypes.JSONType[map[string]interface{}]) error {
	args := m.Called(ctx, messageID, meta)
	return args.Error(0)
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

func (m *MockBlobService) UploadFormFile(ctx context.Context, keyPrefix string, fh interface{}) (*model.Asset, error) {
	args := m.Called(ctx, keyPrefix, fh)
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
				ProjectID: projectID,
				Limit:     10,
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
				repo.On("ListWithCursor", ctx, projectID, "", map[string]interface{}(nil), time.Time{}, uuid.UUID{}, 11, false).Return(expectedSessions, nil)
			},
			wantErr: false,
		},
		{
			name: "empty sessions list",
			input: ListSessionsInput{
				ProjectID: projectID,
				Limit:     10,
			},
			setup: func(repo *MockSessionRepo) {
				repo.On("ListWithCursor", ctx, projectID, "", map[string]interface{}(nil), time.Time{}, uuid.UUID{}, 11, false).Return([]model.Session{}, nil)
			},
			wantErr: false,
		},
		{
			name: "list failure",
			input: ListSessionsInput{
				ProjectID: projectID,
				Limit:     10,
			},
			setup: func(repo *MockSessionRepo) {
				repo.On("ListWithCursor", ctx, projectID, "", map[string]interface{}(nil), time.Time{}, uuid.UUID{}, 11, false).Return(nil, errors.New("database error"))
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
				Type: model.PartTypeText,
				Text: "This is a piece of text",
			},
			wantErr: false,
		},
		{
			name: "text part with empty text",
			part: PartIn{
				Type: model.PartTypeText,
				Text: "",
			},
			wantErr: true,
			errMsg:  "text part requires non-empty text field",
		},
		{
			name: "valid tool-call part",
			part: PartIn{
				Type: model.PartTypeToolCall,
				Meta: map[string]interface{}{
					model.MetaKeyName: "calculator", // UNIFIED FORMAT: was "tool_name", now "name"
					model.MetaKeyArguments: map[string]interface{}{
						"expression": "2 + 2",
					},
				},
			},
			wantErr: false,
		},
		{
			name: "tool-call part missing name",
			part: PartIn{
				Type: model.PartTypeToolCall,
				Meta: map[string]interface{}{
					model.MetaKeyArguments: map[string]interface{}{
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
				Type: model.PartTypeToolCall,
				Meta: map[string]interface{}{
					model.MetaKeyName: "calculator", // UNIFIED FORMAT
				},
			},
			wantErr: true,
			errMsg:  "tool-call part requires 'arguments' in meta", // UNIFIED FORMAT
		},
		{
			name: "valid tool-result part",
			part: PartIn{
				Type: model.PartTypeToolResult,
				Meta: map[string]interface{}{
					model.MetaKeyToolCallID: "call_123",
					"result":       "4",
				},
			},
			wantErr: false,
		},
		{
			name: "tool-result part missing tool_call_id",
			part: PartIn{
				Type: model.PartTypeToolResult,
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
				Type: model.PartTypeData,
				Meta: map[string]interface{}{
					model.MetaKeyDataType: "json",
					"content":   `{"key": "value"}`,
				},
			},
			wantErr: false,
		},
		{
			name: "data part missing data_type",
			part: PartIn{
				Type: model.PartTypeData,
				Meta: map[string]interface{}{
					"content": `{"key": "value"}`,
				},
			},
			wantErr: true,
			errMsg:  "data part requires 'data_type' in meta",
		},
		{
			name: "valid thinking part",
			part: PartIn{
				Type: model.PartTypeThinking,
				Text: "Let me reason about this...",
				Meta: map[string]interface{}{
					model.MetaKeySignature: "sig_abc123",
				},
			},
			wantErr: false,
		},
		{
			name: "thinking part without text (valid - no text requirement for thinking)",
			part: PartIn{
				Type: model.PartTypeThinking,
			},
			wantErr: false,
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

// TestSessionService_StoreMessage_GeminiFunctionResponse tests StoreMessage with Gemini function responses
// Focuses on boundary cases for ID and name matching
func TestSessionService_StoreMessage_GeminiFunctionResponse(t *testing.T) {
	ctx := context.Background()
	projectID := uuid.New()
	sessionID := uuid.New()

	tests := []struct {
		name    string
		input   StoreMessageInput
		setup   func(*MockSessionRepo, *MockAssetReferenceRepo)
		wantErr bool
		errMsg  string
		verify  func(*testing.T, *model.Message, *MockSessionRepo)
	}{
		{
			name: "tool-result without ID - successful match by name",
			input: StoreMessageInput{
				ProjectID:   projectID,
				SessionID:   sessionID,
				Role:        model.RoleUser,
				Parts:       []PartIn{{Type: model.PartTypeToolResult, Meta: map[string]interface{}{model.MetaKeyName: "get_weather"}}},
				Format:      model.FormatGemini,
				MessageMeta: map[string]interface{}{model.MsgMetaSourceFormat: "gemini"},
			},
			setup: func(repo *MockSessionRepo, assetRepo *MockAssetReferenceRepo) {
				// Mock Get to return valid session
				repo.On("Get", ctx, mock.MatchedBy(func(s *model.Session) bool {
					return s.ID == sessionID
				})).Return(&model.Session{
					ID:        sessionID,
					ProjectID: projectID,
				}, nil)
				// Mock PopGeminiCallIDAndName to return matching name
				repo.On("PopGeminiCallIDAndName", ctx, sessionID).Return("call_abc123", "get_weather", nil)
				repo.On("CreateMessageWithAssets", ctx, mock.AnythingOfType("*model.Message")).Return(nil)
				repo.On("GetDisableTaskTracking", ctx, sessionID).Return(false, nil)
				assetRepo.On("IncrementAssetRef", ctx, projectID, mock.AnythingOfType("model.Asset")).Return(nil).Once() // parts asset
			},
			wantErr: false,
			verify: func(t *testing.T, msg *model.Message, repo *MockSessionRepo) {
				assert.NotNil(t, msg)
				// Verify that tool_call_id was set
				// Note: parts are stored in S3, so we can't easily verify here
				// But we can verify the mock was called correctly
			},
		},
		{
			name: "tool-result without ID - name mismatch error",
			input: StoreMessageInput{
				ProjectID:   projectID,
				SessionID:   sessionID,
				Role:        model.RoleUser,
				Parts:       []PartIn{{Type: model.PartTypeToolResult, Meta: map[string]interface{}{model.MetaKeyName: "get_weather"}}},
				Format:      model.FormatGemini,
				MessageMeta: map[string]interface{}{model.MsgMetaSourceFormat: "gemini"},
			},
			setup: func(repo *MockSessionRepo, assetRepo *MockAssetReferenceRepo) {
				// Mock Get to return valid session
				repo.On("Get", ctx, mock.MatchedBy(func(s *model.Session) bool {
					return s.ID == sessionID
				})).Return(&model.Session{
					ID:        sessionID,
					ProjectID: projectID,
				}, nil)
				// Mock PopGeminiCallIDAndName to return different name
				repo.On("PopGeminiCallIDAndName", ctx, sessionID).Return("call_abc123", "calculate", nil)
			},
			wantErr: true,
			errMsg:  "function name mismatch",
		},
		{
			name: "tool-result with ID - name and ID match",
			input: StoreMessageInput{
				ProjectID:   projectID,
				SessionID:   sessionID,
				Role:        model.RoleUser,
				Parts:       []PartIn{{Type: model.PartTypeToolResult, Meta: map[string]interface{}{model.MetaKeyName: "get_weather", model.MetaKeyToolCallID: "call_abc123"}}},
				Format:      model.FormatGemini,
				MessageMeta: map[string]interface{}{model.MsgMetaSourceFormat: "gemini"},
			},
			setup: func(repo *MockSessionRepo, assetRepo *MockAssetReferenceRepo) {
				// Mock Get to return valid session
				repo.On("Get", ctx, mock.MatchedBy(func(s *model.Session) bool {
					return s.ID == sessionID
				})).Return(&model.Session{
					ID:        sessionID,
					ProjectID: projectID,
				}, nil)
				// Mock PopGeminiCallIDAndName to return matching name and ID
				repo.On("PopGeminiCallIDAndName", ctx, sessionID).Return("call_abc123", "get_weather", nil)
				repo.On("CreateMessageWithAssets", ctx, mock.AnythingOfType("*model.Message")).Return(nil)
				repo.On("GetDisableTaskTracking", ctx, sessionID).Return(false, nil)
				assetRepo.On("IncrementAssetRef", ctx, projectID, mock.AnythingOfType("model.Asset")).Return(nil).Once()
			},
			wantErr: false,
		},
		{
			name: "tool-result with ID - name matches but ID mismatch",
			input: StoreMessageInput{
				ProjectID:   projectID,
				SessionID:   sessionID,
				Role:        model.RoleUser,
				Parts:       []PartIn{{Type: model.PartTypeToolResult, Meta: map[string]interface{}{model.MetaKeyName: "get_weather", model.MetaKeyToolCallID: "call_wrong"}}},
				Format:      model.FormatGemini,
				MessageMeta: map[string]interface{}{model.MsgMetaSourceFormat: "gemini"},
			},
			setup: func(repo *MockSessionRepo, assetRepo *MockAssetReferenceRepo) {
				// Mock Get to return valid session
				repo.On("Get", ctx, mock.MatchedBy(func(s *model.Session) bool {
					return s.ID == sessionID
				})).Return(&model.Session{
					ID:        sessionID,
					ProjectID: projectID,
				}, nil)
				// Mock PopGeminiCallIDAndName to return matching name but different ID
				repo.On("PopGeminiCallIDAndName", ctx, sessionID).Return("call_abc123", "get_weather", nil)
			},
			wantErr: true,
			errMsg:  "function ID mismatch",
		},
		{
			name: "tool-result with ID - ID matches but name mismatch",
			input: StoreMessageInput{
				ProjectID:   projectID,
				SessionID:   sessionID,
				Role:        model.RoleUser,
				Parts:       []PartIn{{Type: model.PartTypeToolResult, Meta: map[string]interface{}{model.MetaKeyName: "get_weather", model.MetaKeyToolCallID: "call_abc123"}}},
				Format:      model.FormatGemini,
				MessageMeta: map[string]interface{}{model.MsgMetaSourceFormat: "gemini"},
			},
			setup: func(repo *MockSessionRepo, assetRepo *MockAssetReferenceRepo) {
				// Mock Get to return valid session
				repo.On("Get", ctx, mock.MatchedBy(func(s *model.Session) bool {
					return s.ID == sessionID
				})).Return(&model.Session{
					ID:        sessionID,
					ProjectID: projectID,
				}, nil)
				// Mock PopGeminiCallIDAndName to return matching ID but different name
				repo.On("PopGeminiCallIDAndName", ctx, sessionID).Return("call_abc123", "calculate", nil)
			},
			wantErr: true,
			errMsg:  "function name mismatch",
		},
		{
			name: "tool-result missing name",
			input: StoreMessageInput{
				ProjectID:   projectID,
				SessionID:   sessionID,
				Role:        model.RoleUser,
				Parts:       []PartIn{{Type: model.PartTypeToolResult, Meta: map[string]interface{}{}}},
				Format:      model.FormatGemini,
				MessageMeta: map[string]interface{}{model.MsgMetaSourceFormat: "gemini"},
			},
			setup: func(repo *MockSessionRepo, assetRepo *MockAssetReferenceRepo) {
				// Mock Get to return valid session
				repo.On("Get", ctx, mock.MatchedBy(func(s *model.Session) bool {
					return s.ID == sessionID
				})).Return(&model.Session{
					ID:        sessionID,
					ProjectID: projectID,
				}, nil)
			},
			wantErr: true,
			errMsg:  "missing function name",
		},
		{
			name: "tool-result with empty name",
			input: StoreMessageInput{
				ProjectID:   projectID,
				SessionID:   sessionID,
				Role:        model.RoleUser,
				Parts:       []PartIn{{Type: model.PartTypeToolResult, Meta: map[string]interface{}{model.MetaKeyName: ""}}},
				Format:      model.FormatGemini,
				MessageMeta: map[string]interface{}{model.MsgMetaSourceFormat: "gemini"},
			},
			setup: func(repo *MockSessionRepo, assetRepo *MockAssetReferenceRepo) {
				// Mock Get to return valid session
				repo.On("Get", ctx, mock.MatchedBy(func(s *model.Session) bool {
					return s.ID == sessionID
				})).Return(&model.Session{
					ID:        sessionID,
					ProjectID: projectID,
				}, nil)
			},
			wantErr: true,
			errMsg:  "invalid function name",
		},
		{
			name: "tool-result - no available call info",
			input: StoreMessageInput{
				ProjectID:   projectID,
				SessionID:   sessionID,
				Role:        model.RoleUser,
				Parts:       []PartIn{{Type: model.PartTypeToolResult, Meta: map[string]interface{}{model.MetaKeyName: "get_weather"}}},
				Format:      model.FormatGemini,
				MessageMeta: map[string]interface{}{model.MsgMetaSourceFormat: "gemini"},
			},
			setup: func(repo *MockSessionRepo, assetRepo *MockAssetReferenceRepo) {
				// Mock Get to return valid session
				repo.On("Get", ctx, mock.MatchedBy(func(s *model.Session) bool {
					return s.ID == sessionID
				})).Return(&model.Session{
					ID:        sessionID,
					ProjectID: projectID,
				}, nil)
				// Mock PopGeminiCallIDAndName to return error (no available calls)
				repo.On("PopGeminiCallIDAndName", ctx, sessionID).Return("", "", fmt.Errorf("no available Gemini call info in session"))
			},
			wantErr: true,
			errMsg:  "failed to resolve FunctionResponse",
		},
		{
			name: "multiple tool-results - sequential matching",
			input: StoreMessageInput{
				ProjectID: projectID,
				SessionID: sessionID,
				Role:      model.RoleUser,
				Parts: []PartIn{
					{Type: model.PartTypeToolResult, Meta: map[string]interface{}{model.MetaKeyName: "get_weather"}},
					{Type: model.PartTypeToolResult, Meta: map[string]interface{}{model.MetaKeyName: "calculate"}},
				},
				Format:      model.FormatGemini,
				MessageMeta: map[string]interface{}{model.MsgMetaSourceFormat: "gemini"},
			},
			setup: func(repo *MockSessionRepo, assetRepo *MockAssetReferenceRepo) {
				// Mock Get to return valid session
				repo.On("Get", ctx, mock.MatchedBy(func(s *model.Session) bool {
					return s.ID == sessionID
				})).Return(&model.Session{
					ID:        sessionID,
					ProjectID: projectID,
				}, nil)
				// First call
				repo.On("PopGeminiCallIDAndName", ctx, sessionID).Return("call_abc123", "get_weather", nil).Once()
				// Second call
				repo.On("PopGeminiCallIDAndName", ctx, sessionID).Return("call_def456", "calculate", nil).Once()
				repo.On("CreateMessageWithAssets", ctx, mock.AnythingOfType("*model.Message")).Return(nil)
				repo.On("GetDisableTaskTracking", ctx, sessionID).Return(false, nil)
				assetRepo.On("IncrementAssetRef", ctx, projectID, mock.AnythingOfType("model.Asset")).Return(nil).Once()
			},
			wantErr: false,
		},
		{
			name: "multiple tool-results - second name mismatch",
			input: StoreMessageInput{
				ProjectID: projectID,
				SessionID: sessionID,
				Role:      model.RoleUser,
				Parts: []PartIn{
					{Type: model.PartTypeToolResult, Meta: map[string]interface{}{model.MetaKeyName: "get_weather"}},
					{Type: model.PartTypeToolResult, Meta: map[string]interface{}{model.MetaKeyName: "calculate"}},
				},
				Format:      model.FormatGemini,
				MessageMeta: map[string]interface{}{model.MsgMetaSourceFormat: "gemini"},
			},
			setup: func(repo *MockSessionRepo, assetRepo *MockAssetReferenceRepo) {
				// Mock Get to return valid session
				repo.On("Get", ctx, mock.MatchedBy(func(s *model.Session) bool {
					return s.ID == sessionID
				})).Return(&model.Session{
					ID:        sessionID,
					ProjectID: projectID,
				}, nil)
				// First call succeeds
				repo.On("PopGeminiCallIDAndName", ctx, sessionID).Return("call_abc123", "get_weather", nil).Once()
				// Second call has name mismatch
				repo.On("PopGeminiCallIDAndName", ctx, sessionID).Return("call_def456", "wrong_name", nil).Once()
			},
			wantErr: true,
			errMsg:  "function name mismatch",
		},
		{
			name: "tool-result with non-string name",
			input: StoreMessageInput{
				ProjectID:   projectID,
				SessionID:   sessionID,
				Role:        model.RoleUser,
				Parts:       []PartIn{{Type: model.PartTypeToolResult, Meta: map[string]interface{}{model.MetaKeyName: 123}}},
				Format:      model.FormatGemini,
				MessageMeta: map[string]interface{}{model.MsgMetaSourceFormat: "gemini"},
			},
			setup: func(repo *MockSessionRepo, assetRepo *MockAssetReferenceRepo) {
				// Mock Get to return valid session
				repo.On("Get", ctx, mock.MatchedBy(func(s *model.Session) bool {
					return s.ID == sessionID
				})).Return(&model.Session{
					ID:        sessionID,
					ProjectID: projectID,
				}, nil)
			},
			wantErr: true,
			errMsg:  "invalid function name",
		},
		{
			name: "tool-result with non-string tool_call_id",
			input: StoreMessageInput{
				ProjectID:   projectID,
				SessionID:   sessionID,
				Role:        model.RoleUser,
				Parts:       []PartIn{{Type: model.PartTypeToolResult, Meta: map[string]interface{}{model.MetaKeyName: "get_weather", model.MetaKeyToolCallID: 123}}},
				Format:      model.FormatGemini,
				MessageMeta: map[string]interface{}{model.MsgMetaSourceFormat: "gemini"},
			},
			setup: func(repo *MockSessionRepo, assetRepo *MockAssetReferenceRepo) {
				// Mock Get to return valid session
				repo.On("Get", ctx, mock.MatchedBy(func(s *model.Session) bool {
					return s.ID == sessionID
				})).Return(&model.Session{
					ID:        sessionID,
					ProjectID: projectID,
				}, nil)
				repo.On("PopGeminiCallIDAndName", ctx, sessionID).Return("call_abc123", "get_weather", nil)
			},
			wantErr: true,
			errMsg:  "invalid tool_call_id",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &MockSessionRepo{}
			mockAssetRefRepo := &MockAssetReferenceRepo{}
			tt.setup(repo, mockAssetRefRepo)

			logger := zap.NewNop()
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

			// For StoreMessage tests, we need to test ID resolution logic
			// Since S3Deps is a concrete type, we'll skip S3 operations in these tests
			// by testing only the ID resolution part before S3 upload
			// In a real scenario, S3 would be required, but for unit testing ID resolution,
			// we can test the logic separately

			// Note: StoreMessage requires S3, so we'll test ID resolution errors only
			// For successful cases, we'd need a real S3 mock or integration test
			// For now, we'll test error cases which happen before S3 upload
			var service SessionService
			if tt.wantErr {
				// For error cases, we can use nil S3 since errors happen before S3 upload
				service = NewSessionService(repo, mockAssetRefRepo, logger, nil, nil, cfg, nil)
			} else {
				// For success cases, we need to skip this test or use integration test
				// For now, we'll mark these as skipped or use a workaround
				t.Skip("Skipping test that requires S3 mock - use integration test instead")
				return
			}

			result, err := service.StoreMessage(ctx, tt.input)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, result)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, result)
				if tt.verify != nil {
					tt.verify(t, result, repo)
				}
			}

			repo.AssertExpectations(t)
			mockAssetRefRepo.AssertExpectations(t)
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
					{ID: uuid.New(), SessionID: sessionID, Role: model.RoleUser},
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
					{ID: uuid.New(), SessionID: sessionID, Role: model.RoleUser},
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
					{ID: uuid.New(), SessionID: sessionID, Role: model.RoleUser},
					{ID: uuid.New(), SessionID: sessionID, Role: model.RoleAssistant},
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
					{ID: uuid.New(), SessionID: sessionID, Role: model.RoleUser},
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
				{ID: msg1ID, SessionID: sessionID, Role: model.RoleUser, CreatedAt: now.Add(-3 * time.Hour)},
				{ID: msg2ID, SessionID: sessionID, Role: model.RoleAssistant, CreatedAt: now.Add(-2 * time.Hour)},
				{ID: msg3ID, SessionID: sessionID, Role: model.RoleUser, CreatedAt: now.Add(-1 * time.Hour)},
			},
			expectedOrder: []uuid.UUID{msg1ID, msg2ID, msg3ID},
			setup: func(repo *MockSessionRepo) {
				msgs := []model.Message{
					{ID: msg1ID, SessionID: sessionID, Role: model.RoleUser, CreatedAt: now.Add(-3 * time.Hour)},
					{ID: msg2ID, SessionID: sessionID, Role: model.RoleAssistant, CreatedAt: now.Add(-2 * time.Hour)},
					{ID: msg3ID, SessionID: sessionID, Role: model.RoleUser, CreatedAt: now.Add(-1 * time.Hour)},
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
				{ID: msg3ID, SessionID: sessionID, Role: model.RoleUser, CreatedAt: now.Add(-1 * time.Hour)},
				{ID: msg2ID, SessionID: sessionID, Role: model.RoleAssistant, CreatedAt: now.Add(-2 * time.Hour)},
				{ID: msg1ID, SessionID: sessionID, Role: model.RoleUser, CreatedAt: now.Add(-3 * time.Hour)},
			},
			expectedOrder: []uuid.UUID{msg1ID, msg2ID, msg3ID}, // Still old to new
			setup: func(repo *MockSessionRepo) {
				// Repo returns messages in descending order (newest first)
				msgs := []model.Message{
					{ID: msg3ID, SessionID: sessionID, Role: model.RoleUser, CreatedAt: now.Add(-1 * time.Hour)},
					{ID: msg2ID, SessionID: sessionID, Role: model.RoleAssistant, CreatedAt: now.Add(-2 * time.Hour)},
					{ID: msg1ID, SessionID: sessionID, Role: model.RoleUser, CreatedAt: now.Add(-3 * time.Hour)},
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
				{ID: msg4ID, SessionID: sessionID, Role: model.RoleUser, CreatedAt: now},
				{ID: msg2ID, SessionID: sessionID, Role: model.RoleAssistant, CreatedAt: now},
				{ID: msg1ID, SessionID: sessionID, Role: model.RoleUser, CreatedAt: now},
			},
			// When timestamps are equal, sort by ID (lexicographically)
			expectedOrder: []uuid.UUID{msg1ID, msg2ID, msg4ID}, // Assuming these IDs sort this way lexicographically
			setup: func(repo *MockSessionRepo) {
				msgs := []model.Message{
					{ID: msg4ID, SessionID: sessionID, Role: model.RoleUser, CreatedAt: now},
					{ID: msg2ID, SessionID: sessionID, Role: model.RoleAssistant, CreatedAt: now},
					{ID: msg1ID, SessionID: sessionID, Role: model.RoleUser, CreatedAt: now},
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
				{ID: msg2ID, SessionID: sessionID, Role: model.RoleAssistant, CreatedAt: now.Add(-2 * time.Hour)},
				{ID: msg4ID, SessionID: sessionID, Role: model.RoleUser, CreatedAt: now},
				{ID: msg1ID, SessionID: sessionID, Role: model.RoleUser, CreatedAt: now.Add(-3 * time.Hour)},
				{ID: msg3ID, SessionID: sessionID, Role: model.RoleAssistant, CreatedAt: now.Add(-1 * time.Hour)},
			},
			expectedOrder: []uuid.UUID{msg1ID, msg2ID, msg3ID, msg4ID},
			setup: func(repo *MockSessionRepo) {
				// Repo returns messages in random order
				msgs := []model.Message{
					{ID: msg2ID, SessionID: sessionID, Role: model.RoleAssistant, CreatedAt: now.Add(-2 * time.Hour)},
					{ID: msg4ID, SessionID: sessionID, Role: model.RoleUser, CreatedAt: now},
					{ID: msg1ID, SessionID: sessionID, Role: model.RoleUser, CreatedAt: now.Add(-3 * time.Hour)},
					{ID: msg3ID, SessionID: sessionID, Role: model.RoleAssistant, CreatedAt: now.Add(-1 * time.Hour)},
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
