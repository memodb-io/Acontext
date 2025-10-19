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

func (m *MockBlockService) CreatePage(ctx context.Context, b *model.Block) error {
	args := m.Called(ctx, b)
	return args.Error(0)
}

func (m *MockBlockService) DeletePage(ctx context.Context, spaceID uuid.UUID, pageID uuid.UUID) error {
	args := m.Called(ctx, spaceID, pageID)
	return args.Error(0)
}

func (m *MockBlockService) GetPageProperties(ctx context.Context, pageID uuid.UUID) (*model.Block, error) {
	args := m.Called(ctx, pageID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Block), args.Error(1)
}

func (m *MockBlockService) UpdatePageProperties(ctx context.Context, b *model.Block) error {
	args := m.Called(ctx, b)
	return args.Error(0)
}

func (m *MockBlockService) ListPageChildren(ctx context.Context, pageID uuid.UUID) ([]model.Block, error) {
	args := m.Called(ctx, pageID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]model.Block), args.Error(1)
}

func (m *MockBlockService) ListPages(ctx context.Context, spaceID uuid.UUID, parentID *uuid.UUID) ([]model.Block, error) {
	args := m.Called(ctx, spaceID, parentID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]model.Block), args.Error(1)
}

func (m *MockBlockService) ListBlocks(ctx context.Context, spaceID uuid.UUID, parentID uuid.UUID) ([]model.Block, error) {
	args := m.Called(ctx, spaceID, parentID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]model.Block), args.Error(1)
}

func (m *MockBlockService) MovePage(ctx context.Context, pageID uuid.UUID, newParentID *uuid.UUID, targetSort *int64) error {
	args := m.Called(ctx, pageID, newParentID, targetSort)
	return args.Error(0)
}

func (m *MockBlockService) UpdatePageSort(ctx context.Context, pageID uuid.UUID, sort int64) error {
	args := m.Called(ctx, pageID, sort)
	return args.Error(0)
}

func (m *MockBlockService) CreateBlock(ctx context.Context, b *model.Block) error {
	args := m.Called(ctx, b)
	return args.Error(0)
}

func (m *MockBlockService) DeleteBlock(ctx context.Context, spaceID uuid.UUID, blockID uuid.UUID) error {
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

func (m *MockBlockService) ListBlockChildren(ctx context.Context, blockID uuid.UUID) ([]model.Block, error) {
	args := m.Called(ctx, blockID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]model.Block), args.Error(1)
}

func (m *MockBlockService) MoveBlock(ctx context.Context, blockID uuid.UUID, newParentID uuid.UUID, targetSort *int64) error {
	args := m.Called(ctx, blockID, newParentID, targetSort)
	return args.Error(0)
}

func (m *MockBlockService) UpdateBlockSort(ctx context.Context, blockID uuid.UUID, sort int64) error {
	args := m.Called(ctx, blockID, sort)
	return args.Error(0)
}

// Folder-related mock methods

func (m *MockBlockService) CreateFolder(ctx context.Context, b *model.Block) error {
	args := m.Called(ctx, b)
	return args.Error(0)
}

func (m *MockBlockService) DeleteFolder(ctx context.Context, spaceID uuid.UUID, folderID uuid.UUID) error {
	args := m.Called(ctx, spaceID, folderID)
	return args.Error(0)
}

func (m *MockBlockService) GetFolderProperties(ctx context.Context, folderID uuid.UUID) (*model.Block, error) {
	args := m.Called(ctx, folderID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Block), args.Error(1)
}

func (m *MockBlockService) UpdateFolderProperties(ctx context.Context, b *model.Block) error {
	args := m.Called(ctx, b)
	return args.Error(0)
}

func (m *MockBlockService) ListFolders(ctx context.Context, spaceID uuid.UUID, parentID *uuid.UUID) ([]model.Block, error) {
	args := m.Called(ctx, spaceID, parentID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]model.Block), args.Error(1)
}

func (m *MockBlockService) MoveFolder(ctx context.Context, folderID uuid.UUID, newParentID *uuid.UUID, targetSort *int64) error {
	args := m.Called(ctx, folderID, newParentID, targetSort)
	return args.Error(0)
}

func (m *MockBlockService) UpdateFolderSort(ctx context.Context, folderID uuid.UUID, sort int64) error {
	args := m.Called(ctx, folderID, sort)
	return args.Error(0)
}

func setupRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	return gin.New()
}

func TestBlockHandler_CreatePage(t *testing.T) {
	spaceID := uuid.New()

	tests := []struct {
		name           string
		spaceIDParam   string
		requestBody    CreatePageReq
		setup          func(*MockBlockService)
		expectedStatus int
		expectedError  bool
	}{
		{
			name:         "successful page creation",
			spaceIDParam: spaceID.String(),
			requestBody: CreatePageReq{
				Title: "Test Page",
				Props: map[string]any{"color": "red"},
			},
			setup: func(svc *MockBlockService) {
				svc.On("CreatePage", mock.Anything, mock.MatchedBy(func(b *model.Block) bool {
					return b.SpaceID == spaceID && b.Title == "Test Page" && b.Type == model.BlockTypePage
				})).Return(nil)
			},
			expectedStatus: http.StatusCreated,
			expectedError:  false,
		},
		{
			name:         "invalid space ID",
			spaceIDParam: "invalid-uuid",
			requestBody: CreatePageReq{
				Title: "Test Page",
			},
			setup:          func(svc *MockBlockService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name:         "service layer error",
			spaceIDParam: spaceID.String(),
			requestBody: CreatePageReq{
				Title: "Test Page",
			},
			setup: func(svc *MockBlockService) {
				svc.On("CreatePage", mock.Anything, mock.Anything).Return(errors.New("database error"))
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
			router.POST("/space/:space_id/page", handler.CreatePage)

			body, _ := sonic.Marshal(tt.requestBody)
			req := httptest.NewRequest("POST", "/space/"+tt.spaceIDParam+"/page", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			mockService.AssertExpectations(t)
		})
	}
}

func TestBlockHandler_DeletePage(t *testing.T) {
	spaceID := uuid.New()
	pageID := uuid.New()

	tests := []struct {
		name           string
		spaceIDParam   string
		pageIDParam    string
		setup          func(*MockBlockService)
		expectedStatus int
	}{
		{
			name:         "successful page deletion",
			spaceIDParam: spaceID.String(),
			pageIDParam:  pageID.String(),
			setup: func(svc *MockBlockService) {
				svc.On("DeletePage", mock.Anything, spaceID, pageID).Return(nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "invalid space ID",
			spaceIDParam:   "invalid-uuid",
			pageIDParam:    pageID.String(),
			setup:          func(svc *MockBlockService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "invalid page ID",
			spaceIDParam:   spaceID.String(),
			pageIDParam:    "invalid-uuid",
			setup:          func(svc *MockBlockService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:         "service layer error",
			spaceIDParam: spaceID.String(),
			pageIDParam:  pageID.String(),
			setup: func(svc *MockBlockService) {
				svc.On("DeletePage", mock.Anything, spaceID, pageID).Return(errors.New("deletion failed"))
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
			router.DELETE("/space/:space_id/page/:page_id", handler.DeletePage)

			req := httptest.NewRequest("DELETE", "/space/"+tt.spaceIDParam+"/page/"+tt.pageIDParam, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			mockService.AssertExpectations(t)
		})
	}
}

func TestBlockHandler_CreateBlock(t *testing.T) {
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
			name:         "successful block creation",
			spaceIDParam: spaceID.String(),
			requestBody: CreateBlockReq{
				ParentID: parentID,
				Type:     "text",
				Title:    "test block",
				Props:    map[string]any{"content": "Hello World"},
			},
			setup: func(svc *MockBlockService) {
				svc.On("CreateBlock", mock.Anything, mock.MatchedBy(func(b *model.Block) bool {
					return b.SpaceID == spaceID && b.Type == "text" && b.Title == "test block"
				})).Return(nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:         "invalid block type",
			spaceIDParam: spaceID.String(),
			requestBody: CreateBlockReq{
				ParentID: parentID,
				Type:     "invalid-type",
				Title:    "test block",
			},
			setup:          func(svc *MockBlockService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:         "service layer error",
			spaceIDParam: spaceID.String(),
			requestBody: CreateBlockReq{
				ParentID: parentID,
				Type:     "text",
				Title:    "test block",
			},
			setup: func(svc *MockBlockService) {
				svc.On("CreateBlock", mock.Anything, mock.Anything).Return(errors.New("creation failed"))
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

// Folder handler tests

func TestBlockHandler_CreateFolder(t *testing.T) {
	spaceID := uuid.New()
	parentID := uuid.New()

	tests := []struct {
		name           string
		spaceIDParam   string
		requestBody    CreateFolderReq
		setup          func(*MockBlockService)
		expectedStatus int
		expectedError  bool
	}{
		{
			name:         "successful folder creation",
			spaceIDParam: spaceID.String(),
			requestBody: CreateFolderReq{
				Title: "Test Folder",
				Props: map[string]any{"description": "test folder"},
			},
			setup: func(svc *MockBlockService) {
				svc.On("CreateFolder", mock.Anything, mock.MatchedBy(func(b *model.Block) bool {
					return b.SpaceID == spaceID && b.Title == "Test Folder" && b.Type == model.BlockTypeFolder
				})).Return(nil)
			},
			expectedStatus: http.StatusCreated,
			expectedError:  false,
		},
		{
			name:         "folder creation with parent",
			spaceIDParam: spaceID.String(),
			requestBody: CreateFolderReq{
				ParentID: &parentID,
				Title:    "Subfolder",
			},
			setup: func(svc *MockBlockService) {
				svc.On("CreateFolder", mock.Anything, mock.MatchedBy(func(b *model.Block) bool {
					return b.SpaceID == spaceID && b.ParentID != nil && *b.ParentID == parentID
				})).Return(nil)
			},
			expectedStatus: http.StatusCreated,
			expectedError:  false,
		},
		{
			name:         "invalid space ID",
			spaceIDParam: "invalid-uuid",
			requestBody: CreateFolderReq{
				Title: "Test Folder",
			},
			setup:          func(svc *MockBlockService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name:         "service layer error",
			spaceIDParam: spaceID.String(),
			requestBody: CreateFolderReq{
				Title: "Test Folder",
			},
			setup: func(svc *MockBlockService) {
				svc.On("CreateFolder", mock.Anything, mock.Anything).Return(errors.New("database error"))
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
			router.POST("/space/:space_id/folder", handler.CreateFolder)

			body, _ := sonic.Marshal(tt.requestBody)
			req := httptest.NewRequest("POST", "/space/"+tt.spaceIDParam+"/folder", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			mockService.AssertExpectations(t)
		})
	}
}

func TestBlockHandler_DeleteFolder(t *testing.T) {
	spaceID := uuid.New()
	folderID := uuid.New()

	tests := []struct {
		name           string
		spaceIDParam   string
		folderIDParam  string
		setup          func(*MockBlockService)
		expectedStatus int
	}{
		{
			name:          "successful folder deletion",
			spaceIDParam:  spaceID.String(),
			folderIDParam: folderID.String(),
			setup: func(svc *MockBlockService) {
				svc.On("DeleteFolder", mock.Anything, spaceID, folderID).Return(nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "invalid space ID",
			spaceIDParam:   "invalid-uuid",
			folderIDParam:  folderID.String(),
			setup:          func(svc *MockBlockService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "invalid folder ID",
			spaceIDParam:   spaceID.String(),
			folderIDParam:  "invalid-uuid",
			setup:          func(svc *MockBlockService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:          "service layer error",
			spaceIDParam:  spaceID.String(),
			folderIDParam: folderID.String(),
			setup: func(svc *MockBlockService) {
				svc.On("DeleteFolder", mock.Anything, spaceID, folderID).Return(errors.New("deletion failed"))
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
			router.DELETE("/space/:space_id/folder/:folder_id", handler.DeleteFolder)

			req := httptest.NewRequest("DELETE", "/space/"+tt.spaceIDParam+"/folder/"+tt.folderIDParam, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			mockService.AssertExpectations(t)
		})
	}
}

func TestBlockHandler_ListFolders(t *testing.T) {
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
			queryParam:   "",
			setup: func(svc *MockBlockService) {
				svc.On("ListFolders", mock.Anything, spaceID, (*uuid.UUID)(nil)).Return([]model.Block{}, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:         "list folders with parent filter",
			spaceIDParam: spaceID.String(),
			queryParam:   "?parent_id=" + parentID.String(),
			setup: func(svc *MockBlockService) {
				svc.On("ListFolders", mock.Anything, spaceID, &parentID).Return([]model.Block{}, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "invalid space ID",
			spaceIDParam:   "invalid-uuid",
			queryParam:     "",
			setup:          func(svc *MockBlockService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:         "service layer error",
			spaceIDParam: spaceID.String(),
			queryParam:   "",
			setup: func(svc *MockBlockService) {
				svc.On("ListFolders", mock.Anything, spaceID, (*uuid.UUID)(nil)).Return(nil, errors.New("database error"))
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
			router.GET("/space/:space_id/folder", handler.ListFolders)

			req := httptest.NewRequest("GET", "/space/"+tt.spaceIDParam+"/folder"+tt.queryParam, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			mockService.AssertExpectations(t)
		})
	}
}
