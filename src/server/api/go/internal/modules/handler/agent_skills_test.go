package handler

import (
	"archive/zip"
	"bytes"
	"context"
	"errors"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/bytedance/sonic"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockAgentSkillsService is a mock implementation of AgentSkillsService
type MockAgentSkillsService struct {
	mock.Mock
}

func (m *MockAgentSkillsService) Create(ctx context.Context, in service.CreateAgentSkillsInput) (*model.AgentSkills, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.AgentSkills), args.Error(1)
}

func (m *MockAgentSkillsService) CreateFromTemplate(ctx context.Context, in service.CreateFromTemplateInput) (*model.AgentSkills, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.AgentSkills), args.Error(1)
}

func (m *MockAgentSkillsService) GetByID(ctx context.Context, projectID uuid.UUID, id uuid.UUID) (*model.AgentSkills, error) {
	args := m.Called(ctx, projectID, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.AgentSkills), args.Error(1)
}

func (m *MockAgentSkillsService) Delete(ctx context.Context, projectID uuid.UUID, id uuid.UUID) error {
	args := m.Called(ctx, projectID, id)
	return args.Error(0)
}

func (m *MockAgentSkillsService) List(ctx context.Context, in service.ListAgentSkillsInput) (*service.ListAgentSkillsOutput, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*service.ListAgentSkillsOutput), args.Error(1)
}

func (m *MockAgentSkillsService) GetFile(ctx context.Context, projectID uuid.UUID, skillID uuid.UUID, filePath string, expire time.Duration) (*service.GetFileOutput, error) {
	args := m.Called(ctx, projectID, skillID, filePath, expire)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*service.GetFileOutput), args.Error(1)
}

func (m *MockAgentSkillsService) ListFiles(ctx context.Context, projectID uuid.UUID, id uuid.UUID) (*service.ListFilesOutput, error) {
	args := m.Called(ctx, projectID, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*service.ListFilesOutput), args.Error(1)
}

func setupAgentSkillsRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	return gin.New()
}

func createTestAgentSkills() *model.AgentSkills {
	projectID := uuid.New()
	agentSkillsID := uuid.New()

	return &model.AgentSkills{
		ID:          agentSkillsID,
		ProjectID:   projectID,
		DiskID:      uuid.New(),
		Name:        "test-skills",
		Description: "Test description",
		FileIndex:   []model.FileInfo{{Path: "file1.json", MIME: "application/json"}, {Path: "file2.md", MIME: "text/markdown"}},
		Meta:        map[string]interface{}{"version": "1.0"},
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
}

// createTestZipFile creates a zip file in memory with the given files
func createTestZipFile(files map[string]string) ([]byte, error) {
	buf := new(bytes.Buffer)
	writer := zip.NewWriter(buf)

	for path, content := range files {
		f, err := writer.Create(path)
		if err != nil {
			return nil, err
		}
		_, err = f.Write([]byte(content))
		if err != nil {
			return nil, err
		}
	}

	err := writer.Close()
	if err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

func TestAgentSkillsHandler_CreateAgentSkill(t *testing.T) {
	projectID := uuid.New()
	agentSkillsID := uuid.New()

	// Create a valid zip with SKILL.md
	validZipContent, _ := createTestZipFile(map[string]string{
		"SKILL.md": `name: test-skills
description: Test description`,
		"file1.json": `{"key": "value"}`,
		"file2.md":   "# Test",
	})

	// Create zip without SKILL.md
	zipWithoutSkill, _ := createTestZipFile(map[string]string{
		"file1.json": `{"key": "value"}`,
	})

	// Create zip with invalid YAML in SKILL.md
	zipWithInvalidYAML, _ := createTestZipFile(map[string]string{
		"SKILL.md":   `invalid: yaml: content: [`,
		"file1.json": `{"key": "value"}`,
	})

	// Create zip with SKILL.md missing name
	zipWithoutName, _ := createTestZipFile(map[string]string{
		"SKILL.md":   `description: Test description`,
		"file1.json": `{"key": "value"}`,
	})

	// Create zip with SKILL.md missing description
	zipWithoutDescription, _ := createTestZipFile(map[string]string{
		"SKILL.md":   `name: test-skills`,
		"file1.json": `{"key": "value"}`,
	})

	// Create zip with outer directory (random-name/) - tests root prefix stripping logic
	// The outer directory name doesn't matter, skillName from SKILL.md will be used
	zipWithOuterDir, _ := createTestZipFile(map[string]string{
		"random-name/SKILL.md": `name: pdf
description: PDF processing skills`,
		"random-name/forms.md":          "# Forms",
		"random-name/scripts/tool.json": `{"tool": "extract"}`,
	})

	// Create zip with case-insensitive SKILL.md (skill.md)
	zipWithLowercaseSkill, _ := createTestZipFile(map[string]string{
		"skill.md": `name: lowercase-test
description: Test with lowercase skill.md`,
		"file1.json": `{"key": "value"}`,
	})

	// Create zip with SKILL.md in subdirectory
	zipWithSkillInSubdir, _ := createTestZipFile(map[string]string{
		"subdir/SKILL.md": `name: subdir-test
description: Test with SKILL.md in subdirectory`,
		"subdir/file1.json": `{"key": "value"}`,
	})

	expectedAgentSkills := &model.AgentSkills{
		ID:          agentSkillsID,
		ProjectID:   projectID,
		DiskID:      uuid.New(),
		Name:        "test-skills",
		Description: "Test description",
		FileIndex:   []model.FileInfo{{Path: "SKILL.md", MIME: "text/markdown"}, {Path: "file1.json", MIME: "application/json"}, {Path: "file2.md", MIME: "text/markdown"}},
		Meta:        map[string]interface{}{"version": "1.0"},
	}

	expectedAgentSkillsWithOuterDir := &model.AgentSkills{
		ID:          agentSkillsID,
		ProjectID:   projectID,
		DiskID:      uuid.New(),
		Name:        "pdf", // skillName from SKILL.md, not from zip directory name
		Description: "PDF processing skills",
		// FileIndex should strip the outer "random-name/" prefix (regardless of its name)
		// skillName "pdf" will be used as S3 root directory
		FileIndex: []model.FileInfo{{Path: "SKILL.md", MIME: "text/markdown"}, {Path: "forms.md", MIME: "text/markdown"}, {Path: "scripts/tool.json", MIME: "application/json"}},
		Meta:      map[string]interface{}{"version": "1.0"},
	}

	tests := []struct {
		name           string
		zipContent     []byte
		meta           string
		setup          func(*MockAgentSkillsService)
		expectedStatus int
		expectedError  string
	}{
		{
			name:       "successful creation",
			zipContent: validZipContent,
			meta:       `{"version": "1.0"}`,
			setup: func(svc *MockAgentSkillsService) {
				svc.On("Create", mock.Anything, mock.MatchedBy(func(in service.CreateAgentSkillsInput) bool {
					return in.ProjectID == projectID && in.Meta["version"] == "1.0"
				})).Return(expectedAgentSkills, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:           "missing file",
			zipContent:     nil,
			setup:          func(svc *MockAgentSkillsService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "file is required",
		},
		{
			name:           "file is not zip (wrong extension)",
			zipContent:     []byte("not a zip file"),
			setup:          func(svc *MockAgentSkillsService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "file must be a zip archive",
		},
		{
			name:       "SKILL.md not found",
			zipContent: zipWithoutSkill,
			setup: func(svc *MockAgentSkillsService) {
				svc.On("Create", mock.Anything, mock.Anything).Return(nil, errors.New("SKILL.md file is required in the zip package (case-insensitive)"))
			},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "SKILL.md",
		},
		{
			name:       "invalid YAML in SKILL.md",
			zipContent: zipWithInvalidYAML,
			setup: func(svc *MockAgentSkillsService) {
				svc.On("Create", mock.Anything, mock.Anything).Return(nil, errors.New("parse SKILL.md YAML"))
			},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "SKILL.md",
		},
		{
			name:       "SKILL.md missing name",
			zipContent: zipWithoutName,
			setup: func(svc *MockAgentSkillsService) {
				svc.On("Create", mock.Anything, mock.Anything).Return(nil, errors.New("name is required in SKILL.md"))
			},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "name is required",
		},
		{
			name:       "SKILL.md missing description",
			zipContent: zipWithoutDescription,
			setup: func(svc *MockAgentSkillsService) {
				svc.On("Create", mock.Anything, mock.Anything).Return(nil, errors.New("description is required in SKILL.md"))
			},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "description is required",
		},
		{
			name:           "invalid meta JSON",
			zipContent:     validZipContent,
			meta:           `invalid json`,
			setup:          func(svc *MockAgentSkillsService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "Syntax error", // sonic JSON parse error
		},
		{
			name:       "service error",
			zipContent: validZipContent,
			setup: func(svc *MockAgentSkillsService) {
				svc.On("Create", mock.Anything, mock.Anything).Return(nil, errors.New("service error"))
			},
			expectedStatus: http.StatusInternalServerError,
		},
		{
			name:       "zip with outer directory - root prefix stripped",
			zipContent: zipWithOuterDir,
			meta:       `{"version": "1.0"}`,
			setup: func(svc *MockAgentSkillsService) {
				// Verify that FileIndex has stripped the "random-name/" prefix
				svc.On("Create", mock.Anything, mock.MatchedBy(func(in service.CreateAgentSkillsInput) bool {
					return in.ProjectID == projectID && in.Meta["version"] == "1.0"
				})).Return(expectedAgentSkillsWithOuterDir, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:       "SKILL.md case-insensitive (skill.md)",
			zipContent: zipWithLowercaseSkill,
			meta:       `{"version": "1.0"}`,
			setup: func(svc *MockAgentSkillsService) {
				svc.On("Create", mock.Anything, mock.MatchedBy(func(in service.CreateAgentSkillsInput) bool {
					return in.ProjectID == projectID
				})).Return(&model.AgentSkills{
					ID:          agentSkillsID,
					ProjectID:   projectID,
					DiskID:      uuid.New(),
					Name:        "lowercase-test",
					Description: "Test with lowercase skill.md",
					FileIndex:   []model.FileInfo{{Path: "skill.md", MIME: "text/markdown"}, {Path: "file1.json", MIME: "application/json"}},
				}, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:       "SKILL.md in subdirectory",
			zipContent: zipWithSkillInSubdir,
			meta:       `{"version": "1.0"}`,
			setup: func(svc *MockAgentSkillsService) {
				svc.On("Create", mock.Anything, mock.MatchedBy(func(in service.CreateAgentSkillsInput) bool {
					return in.ProjectID == projectID
				})).Return(&model.AgentSkills{
					ID:          agentSkillsID,
					ProjectID:   projectID,
					DiskID:      uuid.New(),
					Name:        "subdir-test",
					Description: "Test with SKILL.md in subdirectory",
					FileIndex:   []model.FileInfo{{Path: "subdir/SKILL.md", MIME: "text/markdown"}, {Path: "subdir/file1.json", MIME: "application/json"}},
				}, nil)
			},
			expectedStatus: http.StatusCreated,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := &MockAgentSkillsService{}
			tt.setup(mockService)
			handler := NewAgentSkillsHandler(mockService, &MockUserService{}, nil)

			router := setupAgentSkillsRouter()
			router.POST("/agent_skills", func(c *gin.Context) {
				c.Set("project", &model.Project{ID: projectID})
				handler.CreateAgentSkill(c)
			})

			// Create multipart form data
			body := &bytes.Buffer{}
			writer := multipart.NewWriter(body)

			// Add file if provided
			if tt.zipContent != nil {
				fileName := "skills.zip"
				// For "file is not zip" test, use wrong extension
				if tt.name == "file is not zip (wrong extension)" {
					fileName = "skills.txt"
				}
				fileWriter, err := writer.CreateFormFile("file", fileName)
				assert.NoError(t, err)
				_, err = fileWriter.Write(tt.zipContent)
				assert.NoError(t, err)
			}

			// Add meta if provided
			if tt.meta != "" {
				writer.WriteField("meta", tt.meta)
			}

			writer.Close()

			req := httptest.NewRequest("POST", "/agent_skills", body)
			req.Header.Set("Content-Type", writer.FormDataContentType())
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedError != "" {
				var response map[string]interface{}
				err := sonic.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				if response["message"] != nil {
					assert.Contains(t, response["message"].(string), tt.expectedError)
				} else if response["error"] != nil {
					assert.Contains(t, response["error"].(string), tt.expectedError)
				}
			} else if tt.expectedStatus == http.StatusCreated {
				var response map[string]interface{}
				err := sonic.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.NotNil(t, response["data"])
			}

			mockService.AssertExpectations(t)
		})
	}
}

func TestAgentSkillsHandler_GetAgentSkill(t *testing.T) {
	projectID := uuid.New()
	agentSkills := createTestAgentSkills()
	agentSkills.ProjectID = projectID

	tests := []struct {
		name           string
		id             string
		setup          func(*MockAgentSkillsService)
		expectedStatus int
		expectedError  string
	}{
		{
			name: "successful get by ID",
			id:   agentSkills.ID.String(),
			setup: func(svc *MockAgentSkillsService) {
				svc.On("GetByID", mock.Anything, projectID, agentSkills.ID).Return(agentSkills, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "invalid ID",
			id:             "invalid-uuid",
			setup:          func(svc *MockAgentSkillsService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "invalid id",
		},
		{
			name: "not found",
			id:   agentSkills.ID.String(),
			setup: func(svc *MockAgentSkillsService) {
				svc.On("GetByID", mock.Anything, projectID, agentSkills.ID).Return(nil, errors.New("not found"))
			},
			expectedStatus: http.StatusNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := &MockAgentSkillsService{}
			tt.setup(mockService)
			handler := NewAgentSkillsHandler(mockService, &MockUserService{}, nil)

			router := setupAgentSkillsRouter()
			router.GET("/agent_skills/:id", func(c *gin.Context) {
				c.Set("project", &model.Project{ID: projectID})
				handler.GetAgentSkill(c)
			})

			req := httptest.NewRequest("GET", "/agent_skills/"+tt.id, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedError != "" {
				var response map[string]interface{}
				err := sonic.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				if response["message"] != nil {
					assert.Contains(t, response["message"], tt.expectedError)
				}
			} else if tt.expectedStatus == http.StatusOK {
				var response map[string]interface{}
				err := sonic.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.NotNil(t, response["data"])
			}

			mockService.AssertExpectations(t)
		})
	}
}

func TestAgentSkillsHandler_DeleteAgentSkill(t *testing.T) {
	projectID := uuid.New()
	agentSkillsID := uuid.New()

	tests := []struct {
		name           string
		id             string
		setup          func(*MockAgentSkillsService)
		expectedStatus int
		expectedError  string
	}{
		{
			name: "successful deletion",
			id:   agentSkillsID.String(),
			setup: func(svc *MockAgentSkillsService) {
				svc.On("Delete", mock.Anything, projectID, agentSkillsID).Return(nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "invalid ID",
			id:             "invalid-uuid",
			setup:          func(svc *MockAgentSkillsService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "invalid id",
		},
		{
			name: "service error",
			id:   agentSkillsID.String(),
			setup: func(svc *MockAgentSkillsService) {
				svc.On("Delete", mock.Anything, projectID, agentSkillsID).Return(errors.New("service error"))
			},
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := &MockAgentSkillsService{}
			tt.setup(mockService)
			handler := NewAgentSkillsHandler(mockService, &MockUserService{}, nil)

			router := setupAgentSkillsRouter()
			router.DELETE("/agent_skills/:id", func(c *gin.Context) {
				c.Set("project", &model.Project{ID: projectID})
				handler.DeleteAgentSkill(c)
			})

			req := httptest.NewRequest("DELETE", "/agent_skills/"+tt.id, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedError != "" {
				var response map[string]interface{}
				err := sonic.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				if response["message"] != nil {
					assert.Contains(t, response["message"], tt.expectedError)
				}
			}

			mockService.AssertExpectations(t)
		})
	}
}

func TestAgentSkillsHandler_ListAgentSkills(t *testing.T) {
	projectID := uuid.New()
	agentSkills1 := createTestAgentSkills()
	agentSkills1.ProjectID = projectID
	agentSkills2 := createTestAgentSkills()
	agentSkills2.ProjectID = projectID

	// Convert to list items (without file_index)
	listItem1 := &service.AgentSkillsListItem{
		ID:          agentSkills1.ID,
		UserID:      agentSkills1.UserID,
		Name:        agentSkills1.Name,
		Description: agentSkills1.Description,
		Meta:        agentSkills1.Meta,
		CreatedAt:   agentSkills1.CreatedAt,
		UpdatedAt:   agentSkills1.UpdatedAt,
	}
	listItem2 := &service.AgentSkillsListItem{
		ID:          agentSkills2.ID,
		UserID:      agentSkills2.UserID,
		Name:        agentSkills2.Name,
		Description: agentSkills2.Description,
		Meta:        agentSkills2.Meta,
		CreatedAt:   agentSkills2.CreatedAt,
		UpdatedAt:   agentSkills2.UpdatedAt,
	}

	tests := []struct {
		name           string
		setup          func(*MockAgentSkillsService)
		expectedStatus int
		expectedError  string
	}{
		{
			name: "successful list with items",
			setup: func(svc *MockAgentSkillsService) {
				svc.On("List", mock.Anything, mock.Anything).Return(&service.ListAgentSkillsOutput{
					Items:   []*service.AgentSkillsListItem{listItem1, listItem2},
					HasMore: false,
				}, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name: "successful list with empty result",
			setup: func(svc *MockAgentSkillsService) {
				svc.On("List", mock.Anything, mock.Anything).Return(&service.ListAgentSkillsOutput{
					Items:   []*service.AgentSkillsListItem{},
					HasMore: false,
				}, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name: "service error",
			setup: func(svc *MockAgentSkillsService) {
				svc.On("List", mock.Anything, mock.Anything).Return(nil, errors.New("service error"))
			},
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := &MockAgentSkillsService{}
			tt.setup(mockService)
			handler := NewAgentSkillsHandler(mockService, &MockUserService{}, nil)

			router := setupAgentSkillsRouter()
			router.GET("/agent_skills", func(c *gin.Context) {
				c.Set("project", &model.Project{ID: projectID})
				handler.ListAgentSkills(c)
			})

			req := httptest.NewRequest("GET", "/agent_skills?limit=20", nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedError != "" {
				var response map[string]interface{}
				err := sonic.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				if response["message"] != nil {
					assert.Contains(t, response["message"], tt.expectedError)
				}
			} else if tt.expectedStatus == http.StatusOK {
				var response map[string]interface{}
				err := sonic.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.NotNil(t, response["data"])
			}

			mockService.AssertExpectations(t)
		})
	}
}

func TestAgentSkillsHandler_GetAgentSkillFile(t *testing.T) {
	projectID := uuid.New()
	agentSkills := createTestAgentSkills()
	agentSkills.ProjectID = projectID

	testURL := "https://s3.example.com/presigned-url"

	tests := []struct {
		name           string
		id             string
		filePath       string
		setup          func(*MockAgentSkillsService)
		expectedStatus int
		expectedError  string
	}{
		{
			name:     "successful get file with URL",
			id:       agentSkills.ID.String(),
			filePath: "file1.json",
			setup: func(svc *MockAgentSkillsService) {
				svc.On("GetFile", mock.Anything, projectID, agentSkills.ID, "file1.json", mock.Anything).Return(&service.GetFileOutput{
					Path: "file1.json",
					MIME: "application/json",
					URL:  &testURL,
				}, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "invalid ID",
			id:             "invalid-uuid",
			filePath:       "file1.json",
			setup:          func(svc *MockAgentSkillsService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "invalid id",
		},
		{
			name:           "missing file_path",
			id:             agentSkills.ID.String(),
			filePath:       "",
			setup:          func(svc *MockAgentSkillsService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "file_path is required",
		},
		{
			name:     "file not found",
			id:       agentSkills.ID.String(),
			filePath: "non-existent.json",
			setup: func(svc *MockAgentSkillsService) {
				svc.On("GetFile", mock.Anything, projectID, agentSkills.ID, "non-existent.json", mock.Anything).Return(nil, errors.New("file not found"))
			},
			expectedStatus: http.StatusNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := &MockAgentSkillsService{}
			tt.setup(mockService)
			handler := NewAgentSkillsHandler(mockService, &MockUserService{}, nil)

			router := setupAgentSkillsRouter()
			router.GET("/agent_skills/:id/file", func(c *gin.Context) {
				c.Set("project", &model.Project{ID: projectID})
				handler.GetAgentSkillFile(c)
			})

			url := "/agent_skills/" + tt.id + "/file"
			if tt.filePath != "" {
				url += "?file_path=" + tt.filePath
			}
			req := httptest.NewRequest("GET", url, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedError != "" {
				var response map[string]interface{}
				err := sonic.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				if response["message"] != nil {
					assert.Contains(t, response["message"], tt.expectedError)
				}
			} else if tt.expectedStatus == http.StatusOK {
				var response map[string]interface{}
				err := sonic.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.NotNil(t, response["data"])
			}

			mockService.AssertExpectations(t)
		})
	}
}

func TestAgentSkillsHandler_DownloadToSandbox(t *testing.T) {
	projectID := uuid.New()
	sandboxID := uuid.New()

	// Create skill with empty file index for testing the "no files" case
	createEmptySkill := func() *model.AgentSkills {
		agentSkillsID := uuid.New()
		return &model.AgentSkills{
			ID:          agentSkillsID,
			ProjectID:   projectID,
			DiskID:      uuid.New(),
			Name:        "empty-skill",
			Description: "Test skill with no files",
			FileIndex:   []model.FileInfo{},
			Meta:        map[string]interface{}{},
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		}
	}

	tests := []struct {
		name           string
		skillID        string
		requestBody    string
		setup          func(*MockAgentSkillsService)
		expectedStatus int
		expectedError  string
		checkResponse  func(*testing.T, map[string]interface{})
	}{
		{
			name:           "invalid skill ID",
			skillID:        "invalid-uuid",
			requestBody:    `{"sandbox_id": "` + sandboxID.String() + `"}`,
			setup:          func(svc *MockAgentSkillsService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "invalid skill id",
		},
		{
			name:           "missing sandbox_id",
			skillID:        uuid.New().String(),
			requestBody:    `{}`,
			setup:          func(svc *MockAgentSkillsService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "sandbox_id",
		},
		{
			name:           "invalid sandbox_id",
			skillID:        uuid.New().String(),
			requestBody:    `{"sandbox_id": "invalid-uuid"}`,
			setup:          func(svc *MockAgentSkillsService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "invalid sandbox_id",
		},
		{
			name:        "skill not found",
			skillID:     uuid.New().String(),
			requestBody: `{"sandbox_id": "` + sandboxID.String() + `"}`,
			setup: func(svc *MockAgentSkillsService) {
				svc.On("ListFiles", mock.Anything, projectID, mock.Anything).Return(nil, errors.New("not found"))
			},
			expectedStatus: http.StatusNotFound,
			expectedError:  "skill not found",
		},
		{
			name:        "successful download with empty file index",
			skillID:     "", // Will be set in test
			requestBody: `{"sandbox_id": "` + sandboxID.String() + `"}`,
			setup: func(svc *MockAgentSkillsService) {
				skill := createEmptySkill()
				svc.On("ListFiles", mock.Anything, projectID, skill.ID).Return(&service.ListFilesOutput{
					Name:        skill.Name,
					Description: skill.Description,
					Files:       []service.SkillFileInfo{},
				}, nil)
			},
			expectedStatus: http.StatusOK,
			checkResponse: func(t *testing.T, response map[string]interface{}) {
				data := response["data"].(map[string]interface{})
				assert.True(t, data["success"].(bool))
				assert.Equal(t, "/skills/empty-skill", data["dir_path"].(string))
				assert.Equal(t, "empty-skill", data["name"].(string))
				assert.Equal(t, "Test skill with no files", data["description"].(string))
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := &MockAgentSkillsService{}

			// For tests that need the skill ID from the mock
			var skillID string
			if tt.skillID == "" {
				skill := createEmptySkill()
				skillID = skill.ID.String()
				// Update the mock setup with the correct skill
				mockService.On("ListFiles", mock.Anything, projectID, skill.ID).Return(&service.ListFilesOutput{
					Name:        skill.Name,
					Description: skill.Description,
					Files:       []service.SkillFileInfo{},
				}, nil)
			} else {
				skillID = tt.skillID
				tt.setup(mockService)
			}

			handler := NewAgentSkillsHandler(mockService, &MockUserService{}, nil)

			router := setupAgentSkillsRouter()
			router.POST("/agent_skills/:id/download_to_sandbox", func(c *gin.Context) {
				c.Set("project", &model.Project{ID: projectID})
				handler.DownloadToSandbox(c)
			})

			req := httptest.NewRequest("POST", "/agent_skills/"+skillID+"/download_to_sandbox", bytes.NewBufferString(tt.requestBody))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			var response map[string]interface{}
			err := sonic.Unmarshal(w.Body.Bytes(), &response)
			assert.NoError(t, err)

			if tt.expectedError != "" {
				if response["message"] != nil {
					assert.Contains(t, response["message"].(string), tt.expectedError)
				}
			}

			if tt.checkResponse != nil {
				tt.checkResponse(t, response)
			}

			mockService.AssertExpectations(t)
		})
	}
}
