package handler

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/bytedance/sonic"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockBlockService is a mock implementation of BlockService
type MockBlockService struct {
	mock.Mock
}

// Unified interface methods

func (m *MockBlockService) Create(ctx context.Context, b *model.Block) error {
	args := m.Called(ctx, b)
	return args.Error(0)
}

func (m *MockBlockService) Delete(ctx context.Context, spaceID uuid.UUID, blockID uuid.UUID) error {
	args := m.Called(ctx, spaceID, blockID)
	return args.Error(0)
}

func (m *MockBlockService) GetBlockProperties(ctx context.Context, blockID uuid.UUID) (*model.Block, error) {
	args := m.Called(ctx, blockID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Block), args.Error(1)
}

func (m *MockBlockService) UpdateBlockProperties(ctx context.Context, b *model.Block) error {
	args := m.Called(ctx, b)
	return args.Error(0)
}

func (m *MockBlockService) List(ctx context.Context, spaceID uuid.UUID, blockType string, parentID *uuid.UUID) ([]model.Block, error) {
	args := m.Called(ctx, spaceID, blockType, parentID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]model.Block), args.Error(1)
}

func (m *MockBlockService) Move(ctx context.Context, blockID uuid.UUID, newParentID *uuid.UUID, targetSort *int64) error {
	args := m.Called(ctx, blockID, newParentID, targetSort)
	return args.Error(0)
}

func (m *MockBlockService) UpdateSort(ctx context.Context, blockID uuid.UUID, sort int64) error {
	args := m.Called(ctx, blockID, sort)
	return args.Error(0)
}

func setupRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	return gin.New()
}

func TestBlockHandler_CreateBlock_Page(t *testing.T) {
	spaceID := uuid.New()

	tests := []struct {
		name           string
		spaceIDParam   string
		requestBody    CreateBlockReq
		setup          func(*MockBlockService)
		expectedStatus int
		expectedError  bool
	}{
		{
			name:         "successful page creation",
			spaceIDParam: spaceID.String(),
			requestBody: CreateBlockReq{
				Type:  model.BlockTypePage,
				Title: "Test Page",
				Props: map[string]any{"color": "red"},
			},
			setup: func(svc *MockBlockService) {
				svc.On("Create", mock.Anything, mock.MatchedBy(func(b *model.Block) bool {
					return b.SpaceID == spaceID && b.Title == "Test Page" && b.Type == model.BlockTypePage
				})).Return(nil)
			},
			expectedStatus: http.StatusCreated,
			expectedError:  false,
		},
		{
			name:         "invalid space ID",
			spaceIDParam: "invalid-uuid",
			requestBody: CreateBlockReq{
				Type:  model.BlockTypePage,
				Title: "Test Page",
			},
			setup:          func(svc *MockBlockService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name:         "title contains path separator",
			spaceIDParam: spaceID.String(),
			requestBody: CreateBlockReq{
				Type:  model.BlockTypePage,
				Title: "path/to/page",
			},
			setup:          func(svc *MockBlockService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name:         "service layer error",
			spaceIDParam: spaceID.String(),
			requestBody: CreateBlockReq{
				Type:  model.BlockTypePage,
				Title: "Test Page",
			},
			setup: func(svc *MockBlockService) {
				svc.On("Create", mock.Anything, mock.Anything).Return(errors.New("database error"))
			},
			expectedStatus: http.StatusInternalServerError,
			expectedError:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := &MockBlockService{}
			tt.setup(mockService)

			handler := NewBlockHandler(mockService)
			router := setupRouter()
			router.POST("/space/:space_id/block", handler.CreateBlock)

			body, _ := sonic.Marshal(tt.requestBody)
			req := httptest.NewRequest("POST", "/space/"+tt.spaceIDParam+"/block", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			mockService.AssertExpectations(t)
		})
	}
}

func TestBlockHandler_DeleteBlock_Page(t *testing.T) {
	spaceID := uuid.New()
	pageID := uuid.New()

	tests := []struct {
		name           string
		spaceIDParam   string
		blockIDParam   string
		setup          func(*MockBlockService)
		expectedStatus int
	}{
		{
			name:         "successful page deletion",
			spaceIDParam: spaceID.String(),
			blockIDParam: pageID.String(),
			setup: func(svc *MockBlockService) {
				svc.On("Delete", mock.Anything, spaceID, pageID).Return(nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "invalid space ID",
			spaceIDParam:   "invalid-uuid",
			blockIDParam:   pageID.String(),
			setup:          func(svc *MockBlockService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "invalid block ID",
			spaceIDParam:   spaceID.String(),
			blockIDParam:   "invalid-uuid",
			setup:          func(svc *MockBlockService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:         "service layer error",
			spaceIDParam: spaceID.String(),
			blockIDParam: pageID.String(),
			setup: func(svc *MockBlockService) {
				svc.On("Delete", mock.Anything, spaceID, pageID).Return(errors.New("deletion failed"))
			},
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := &MockBlockService{}
			tt.setup(mockService)

			handler := NewBlockHandler(mockService)
			router := setupRouter()
			router.DELETE("/space/:space_id/block/:block_id", handler.DeleteBlock)

			req := httptest.NewRequest("DELETE", "/space/"+tt.spaceIDParam+"/block/"+tt.blockIDParam, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			mockService.AssertExpectations(t)
		})
	}
}

func TestBlockHandler_CreateBlock_Text(t *testing.T) {
	spaceID := uuid.New()
	parentID := uuid.New()

	tests := []struct {
		name           string
		spaceIDParam   string
		requestBody    CreateBlockReq
		setup          func(*MockBlockService)
		expectedStatus int
	}{
		{
			name:         "successful text block creation",
			spaceIDParam: spaceID.String(),
			requestBody: CreateBlockReq{
				ParentID: &parentID,
				Type:     "text",
				Title:    "test block",
				Props:    map[string]any{"content": "Hello World"},
			},
			setup: func(svc *MockBlockService) {
				svc.On("Create", mock.Anything, mock.MatchedBy(func(b *model.Block) bool {
					return b.SpaceID == spaceID && b.Type == "text" && b.Title == "test block"
				})).Return(nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:         "invalid block type",
			spaceIDParam: spaceID.String(),
			requestBody: CreateBlockReq{
				ParentID: &parentID,
				Type:     "invalid-type",
				Title:    "test block",
			},
			setup:          func(svc *MockBlockService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:         "title contains path separator",
			spaceIDParam: spaceID.String(),
			requestBody: CreateBlockReq{
				ParentID: &parentID,
				Type:     "text",
				Title:    "path/to/block",
			},
			setup:          func(svc *MockBlockService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:         "service layer error",
			spaceIDParam: spaceID.String(),
			requestBody: CreateBlockReq{
				ParentID: &parentID,
				Type:     "text",
				Title:    "test block",
			},
			setup: func(svc *MockBlockService) {
				svc.On("Create", mock.Anything, mock.Anything).Return(errors.New("creation failed"))
			},
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := &MockBlockService{}
			tt.setup(mockService)

			handler := NewBlockHandler(mockService)
			router := setupRouter()
			router.POST("/space/:space_id/block", handler.CreateBlock)

			body, _ := sonic.Marshal(tt.requestBody)
			req := httptest.NewRequest("POST", "/space/"+tt.spaceIDParam+"/block", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			mockService.AssertExpectations(t)
		})
	}
}

func TestBlockHandler_CreateBlock_Folder(t *testing.T) {
	spaceID := uuid.New()
	parentID := uuid.New()

	tests := []struct {
		name           string
		spaceIDParam   string
		requestBody    CreateBlockReq
		setup          func(*MockBlockService)
		expectedStatus int
		expectedError  bool
	}{
		{
			name:         "successful folder creation",
			spaceIDParam: spaceID.String(),
			requestBody: CreateBlockReq{
				Type:  model.BlockTypeFolder,
				Title: "Test Folder",
				Props: map[string]any{"description": "test folder"},
			},
			setup: func(svc *MockBlockService) {
				svc.On("Create", mock.Anything, mock.MatchedBy(func(b *model.Block) bool {
					return b.SpaceID == spaceID && b.Title == "Test Folder" && b.Type == model.BlockTypeFolder
				})).Return(nil)
			},
			expectedStatus: http.StatusCreated,
			expectedError:  false,
		},
		{
			name:         "folder creation with parent",
			spaceIDParam: spaceID.String(),
			requestBody: CreateBlockReq{
				Type:     model.BlockTypeFolder,
				ParentID: &parentID,
				Title:    "Subfolder",
			},
			setup: func(svc *MockBlockService) {
				svc.On("Create", mock.Anything, mock.MatchedBy(func(b *model.Block) bool {
					return b.SpaceID == spaceID && b.ParentID != nil && *b.ParentID == parentID
				})).Return(nil)
			},
			expectedStatus: http.StatusCreated,
			expectedError:  false,
		},
		{
			name:         "invalid space ID",
			spaceIDParam: "invalid-uuid",
			requestBody: CreateBlockReq{
				Type:  model.BlockTypeFolder,
				Title: "Test Folder",
			},
			setup:          func(svc *MockBlockService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name:         "title contains path separator",
			spaceIDParam: spaceID.String(),
			requestBody: CreateBlockReq{
				Type:  model.BlockTypeFolder,
				Title: "folder/subfolder",
			},
			setup:          func(svc *MockBlockService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name:         "service layer error",
			spaceIDParam: spaceID.String(),
			requestBody: CreateBlockReq{
				Type:  model.BlockTypeFolder,
				Title: "Test Folder",
			},
			setup: func(svc *MockBlockService) {
				svc.On("Create", mock.Anything, mock.Anything).Return(errors.New("database error"))
			},
			expectedStatus: http.StatusInternalServerError,
			expectedError:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := &MockBlockService{}
			tt.setup(mockService)

			handler := NewBlockHandler(mockService)
			router := setupRouter()
			router.POST("/space/:space_id/block", handler.CreateBlock)

			body, _ := sonic.Marshal(tt.requestBody)
			req := httptest.NewRequest("POST", "/space/"+tt.spaceIDParam+"/block", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			mockService.AssertExpectations(t)
		})
	}
}

func TestBlockHandler_DeleteBlock_Folder(t *testing.T) {
	spaceID := uuid.New()
	folderID := uuid.New()

	tests := []struct {
		name           string
		spaceIDParam   string
		blockIDParam   string
		setup          func(*MockBlockService)
		expectedStatus int
	}{
		{
			name:         "successful folder deletion",
			spaceIDParam: spaceID.String(),
			blockIDParam: folderID.String(),
			setup: func(svc *MockBlockService) {
				svc.On("Delete", mock.Anything, spaceID, folderID).Return(nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "invalid space ID",
			spaceIDParam:   "invalid-uuid",
			blockIDParam:   folderID.String(),
			setup:          func(svc *MockBlockService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "invalid folder ID",
			spaceIDParam:   spaceID.String(),
			blockIDParam:   "invalid-uuid",
			setup:          func(svc *MockBlockService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:         "service layer error",
			spaceIDParam: spaceID.String(),
			blockIDParam: folderID.String(),
			setup: func(svc *MockBlockService) {
				svc.On("Delete", mock.Anything, spaceID, folderID).Return(errors.New("deletion failed"))
			},
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := &MockBlockService{}
			tt.setup(mockService)

			handler := NewBlockHandler(mockService)
			router := setupRouter()
			router.DELETE("/space/:space_id/block/:block_id", handler.DeleteBlock)

			req := httptest.NewRequest("DELETE", "/space/"+tt.spaceIDParam+"/block/"+tt.blockIDParam, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			mockService.AssertExpectations(t)
		})
	}
}

func TestBlockHandler_ListBlocks_Folders(t *testing.T) {
	spaceID := uuid.New()
	parentID := uuid.New()

	tests := []struct {
		name           string
		spaceIDParam   string
		queryParam     string
		setup          func(*MockBlockService)
		expectedStatus int
	}{
		{
			name:         "list top-level folders",
			spaceIDParam: spaceID.String(),
			queryParam:   "?type=folder",
			setup: func(svc *MockBlockService) {
				svc.On("List", mock.Anything, spaceID, model.BlockTypeFolder, (*uuid.UUID)(nil)).Return([]model.Block{}, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:         "list folders with parent filter",
			spaceIDParam: spaceID.String(),
			queryParam:   "?type=folder&parent_id=" + parentID.String(),
			setup: func(svc *MockBlockService) {
				svc.On("List", mock.Anything, spaceID, model.BlockTypeFolder, &parentID).Return([]model.Block{}, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "invalid space ID",
			spaceIDParam:   "invalid-uuid",
			queryParam:     "?type=folder",
			setup:          func(svc *MockBlockService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:         "service layer error",
			spaceIDParam: spaceID.String(),
			queryParam:   "?type=folder",
			setup: func(svc *MockBlockService) {
				svc.On("List", mock.Anything, spaceID, model.BlockTypeFolder, (*uuid.UUID)(nil)).Return(nil, errors.New("database error"))
			},
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := &MockBlockService{}
			tt.setup(mockService)

			handler := NewBlockHandler(mockService)
			router := setupRouter()
			router.GET("/space/:space_id/block", handler.ListBlocks)

			req := httptest.NewRequest("GET", "/space/"+tt.spaceIDParam+"/block"+tt.queryParam, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			mockService.AssertExpectations(t)
		})
	}
}

func TestBlockHandler_UpdateBlockProperties(t *testing.T) {
	blockID := uuid.New()

	type UpdateBlockPropertiesReq struct {
		Title string         `json:"title"`
		Props map[string]any `json:"props"`
	}

	tests := []struct {
		name           string
		blockIDParam   string
		requestBody    UpdateBlockPropertiesReq
		setup          func(*MockBlockService)
		expectedStatus int
	}{
		{
			name:         "successful update",
			blockIDParam: blockID.String(),
			requestBody: UpdateBlockPropertiesReq{
				Title: "Updated Title",
				Props: map[string]any{"color": "blue"},
			},
			setup: func(svc *MockBlockService) {
				svc.On("UpdateBlockProperties", mock.Anything, mock.MatchedBy(func(b *model.Block) bool {
					return b.ID == blockID && b.Title == "Updated Title"
				})).Return(nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "invalid block ID",
			blockIDParam:   "invalid-uuid",
			requestBody:    UpdateBlockPropertiesReq{Title: "Updated Title"},
			setup:          func(svc *MockBlockService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:         "title contains path separator",
			blockIDParam: blockID.String(),
			requestBody: UpdateBlockPropertiesReq{
				Title: "path/to/block",
			},
			setup:          func(svc *MockBlockService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:         "service layer error",
			blockIDParam: blockID.String(),
			requestBody: UpdateBlockPropertiesReq{
				Title: "Updated Title",
			},
			setup: func(svc *MockBlockService) {
				svc.On("UpdateBlockProperties", mock.Anything, mock.Anything).Return(errors.New("update failed"))
			},
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := &MockBlockService{}
			tt.setup(mockService)

			handler := NewBlockHandler(mockService)
			router := setupRouter()
			router.PUT("/space/:space_id/block/:block_id/properties", handler.UpdateBlockProperties)

			body, _ := sonic.Marshal(tt.requestBody)
			req := httptest.NewRequest("PUT", "/space/"+uuid.New().String()+"/block/"+tt.blockIDParam+"/properties", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			mockService.AssertExpectations(t)
		})
	}
}
