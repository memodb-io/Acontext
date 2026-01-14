package service

import (
	"archive/zip"
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/pkg/paging"
	"github.com/memodb-io/Acontext/internal/pkg/utils/fileparser"
	"github.com/memodb-io/Acontext/internal/pkg/utils/mime"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"gopkg.in/yaml.v3"
	"gorm.io/datatypes"
)

type MockAgentSkillsRepo struct {
	mock.Mock
}

func (m *MockAgentSkillsRepo) Create(ctx context.Context, as *model.AgentSkills) error {
	args := m.Called(ctx, as)
	if args.Get(0) == nil {
		as.ID = uuid.New()
		return nil
	}
	return args.Error(0)
}

func (m *MockAgentSkillsRepo) GetByID(ctx context.Context, projectID uuid.UUID, id uuid.UUID) (*model.AgentSkills, error) {
	args := m.Called(ctx, projectID, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.AgentSkills), args.Error(1)
}

func (m *MockAgentSkillsRepo) Update(ctx context.Context, as *model.AgentSkills) error {
	args := m.Called(ctx, as)
	return args.Error(0)
}

func (m *MockAgentSkillsRepo) Delete(ctx context.Context, projectID uuid.UUID, id uuid.UUID) error {
	args := m.Called(ctx, projectID, id)
	return args.Error(0)
}

func (m *MockAgentSkillsRepo) ListWithCursor(ctx context.Context, projectID uuid.UUID, userIdentifier string, afterCreatedAt time.Time, afterID uuid.UUID, limit int, timeDesc bool) ([]*model.AgentSkills, error) {
	args := m.Called(ctx, projectID, userIdentifier, afterCreatedAt, afterID, limit, timeDesc)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*model.AgentSkills), args.Error(1)
}

type MockAgentSkillsS3 struct {
	mock.Mock
}

func (m *MockAgentSkillsS3) UploadFileDirect(ctx context.Context, key string, content []byte, contentType string) (*model.Asset, error) {
	args := m.Called(ctx, key, content, contentType)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Asset), args.Error(1)
}

func (m *MockAgentSkillsS3) DeleteObjectsByPrefix(ctx context.Context, prefix string) error {
	args := m.Called(ctx, prefix)
	return args.Error(0)
}

func (m *MockAgentSkillsS3) DownloadFile(ctx context.Context, key string) ([]byte, error) {
	args := m.Called(ctx, key)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]byte), args.Error(1)
}

func (m *MockAgentSkillsS3) PresignGet(ctx context.Context, key string, expire time.Duration) (string, error) {
	args := m.Called(ctx, key, expire)
	return args.String(0), args.Error(1)
}

type testAgentSkillsService struct {
	r  *MockAgentSkillsRepo
	s3 *MockAgentSkillsS3
}

func newTestAgentSkillsService(r *MockAgentSkillsRepo, s3 *MockAgentSkillsS3) AgentSkillsService {
	return &testAgentSkillsService{r: r, s3: s3}
}

func (s *testAgentSkillsService) Create(ctx context.Context, in CreateAgentSkillsInput) (*model.AgentSkills, error) {
	zipFile, err := in.ZipFile.Open()
	if err != nil {
		return nil, err
	}
	defer zipFile.Close()

	zipContent, err := io.ReadAll(zipFile)
	if err != nil {
		return nil, err
	}

	zipReader, err := zip.NewReader(bytes.NewReader(zipContent), int64(len(zipContent)))
	if err != nil {
		return nil, err
	}

	var skillName, skillDescription string
	var skillMetadataFound bool
	var rootPrefix string
	var fileNames []string
	filesToUpload := make([]*zipFileData, 0)

	for _, file := range zipReader.File {
		if file.FileInfo().IsDir() {
			continue
		}

		if isMacOSSystemFile(file.Name) {
			continue
		}

		fileReader, err := file.Open()
		if err != nil {
			return nil, err
		}

		fileContent, err := io.ReadAll(fileReader)
		fileReader.Close()
		if err != nil {
			return nil, err
		}

		fileName := filepath.Base(file.Name)
		if strings.EqualFold(fileName, "SKILL.md") && !skillMetadataFound {
			yamlContent := extractYAMLFrontMatter(fileContent)
			if yamlContent == "" {
				return nil, errors.New("SKILL.md must contain YAML front matter")
			}

			var metadata SkillMetadata
			if err := yaml.Unmarshal([]byte(yamlContent), &metadata); err != nil {
				return nil, err
			}

			skillName = metadata.Name
			skillDescription = metadata.Description
			skillMetadataFound = true

			if skillName == "" {
				return nil, errors.New("name is required in SKILL.md")
			}
			if skillDescription == "" {
				return nil, errors.New("description is required in SKILL.md")
			}
		}

		fileNames = append(fileNames, file.Name)
		filesToUpload = append(filesToUpload, &zipFileData{
			name:    file.Name,
			content: fileContent,
		})
	}

	if !skillMetadataFound {
		return nil, errors.New("SKILL.md file is required in the zip package")
	}

	if len(fileNames) > 0 {
		firstFile := fileNames[0]
		parts := strings.Split(firstFile, "/")
		if len(parts) > 1 && parts[0] != "" {
			outermostDir := parts[0]
			allUnderSameRoot := true
			for _, fileName := range fileNames {
				fileParts := strings.Split(fileName, "/")
				if len(fileParts) == 0 || fileParts[0] != outermostDir {
					allUnderSameRoot = false
					break
				}
			}
			if allUnderSameRoot {
				rootPrefix = outermostDir + "/"
			}
		}
	}

	for _, fileData := range filesToUpload {
		relativePath := fileData.name
		if rootPrefix != "" && strings.HasPrefix(fileData.name, rootPrefix) {
			relativePath = strings.TrimPrefix(fileData.name, rootPrefix)
		}
		fileData.relativePath = relativePath
		fileData.mimeType = mime.DetectMimeType(fileData.content, fileData.name)
	}

	agentSkills := &model.AgentSkills{
		ProjectID:   in.ProjectID,
		UserID:      in.UserID,
		Name:        skillName,
		Description: skillDescription,
		Meta:        in.Meta,
	}

	if err := s.r.Create(ctx, agentSkills); err != nil {
		return nil, err
	}

	dbID := agentSkills.ID
	var uploadSuccess bool

	defer func() {
		if err != nil && dbID != uuid.Nil {
			cleanupCtx := context.Background()
			if uploadSuccess {
				baseS3KeyPrefix := fmt.Sprintf("agent_skills/%s/%s", in.ProjectID.String(), dbID.String())
				s.s3.DeleteObjectsByPrefix(cleanupCtx, baseS3KeyPrefix)
			}
			s.r.Delete(cleanupCtx, in.ProjectID, dbID)
		}
	}()

	sanitizedName := sanitizeS3Key(skillName)
	baseS3Key := fmt.Sprintf("agent_skills/%s/%s/%s", in.ProjectID.String(), dbID.String(), sanitizedName)

	fileIndex := make([]model.FileInfo, len(filesToUpload))
	var baseBucket string

	for i, fileData := range filesToUpload {
		fullS3Key := fmt.Sprintf("%s/%s", baseS3Key, fileData.relativePath)
		asset, uploadErr := s.s3.UploadFileDirect(ctx, fullS3Key, fileData.content, fileData.mimeType)
		if uploadErr != nil {
			err = uploadErr
			return nil, err
		}

		if baseBucket == "" {
			baseBucket = asset.Bucket
		}
		fileIndex[i] = model.FileInfo{
			Path: fileData.relativePath,
			MIME: fileData.mimeType,
		}
	}

	uploadSuccess = true

	baseAsset := &model.Asset{
		Bucket: baseBucket,
		S3Key:  baseS3Key,
		ETag:   "",
		SHA256: "",
		MIME:   "",
		SizeB:  0,
	}

	agentSkills.AssetMeta = datatypes.NewJSONType(*baseAsset)
	agentSkills.FileIndex = datatypes.NewJSONType(fileIndex)

	if err = s.r.Update(ctx, agentSkills); err != nil {
		return nil, err
	}

	return agentSkills, nil
}

func (s *testAgentSkillsService) GetByID(ctx context.Context, projectID uuid.UUID, id uuid.UUID) (*model.AgentSkills, error) {
	return s.r.GetByID(ctx, projectID, id)
}

func (s *testAgentSkillsService) Delete(ctx context.Context, projectID uuid.UUID, id uuid.UUID) error {
	return s.r.Delete(ctx, projectID, id)
}

func (s *testAgentSkillsService) List(ctx context.Context, in ListAgentSkillsInput) (*ListAgentSkillsOutput, error) {
	var afterT time.Time
	var afterID uuid.UUID
	var err error
	if in.Cursor != "" {
		afterT, afterID, err = paging.DecodeCursor(in.Cursor)
		if err != nil {
			return nil, err
		}
	}

	agentSkills, err := s.r.ListWithCursor(ctx, in.ProjectID, in.User, afterT, afterID, in.Limit+1, in.TimeDesc)
	if err != nil {
		return nil, err
	}

	hasMore := len(agentSkills) > in.Limit
	if hasMore {
		agentSkills = agentSkills[:in.Limit]
	}

	items := make([]*AgentSkillsListItem, len(agentSkills))
	for i, skill := range agentSkills {
		items[i] = &AgentSkillsListItem{
			ID:          skill.ID,
			UserID:      skill.UserID,
			Name:        skill.Name,
			Description: skill.Description,
			Meta:        skill.Meta,
			CreatedAt:   skill.CreatedAt,
			UpdatedAt:   skill.UpdatedAt,
		}
	}

	out := &ListAgentSkillsOutput{
		Items:   items,
		HasMore: hasMore,
	}
	if hasMore && len(items) > 0 {
		last := agentSkills[len(agentSkills)-1]
		out.NextCursor = paging.EncodeCursor(last.CreatedAt, last.ID)
	}

	return out, nil
}

func (s *testAgentSkillsService) GetFile(ctx context.Context, agentSkills *model.AgentSkills, filePath string, expire time.Duration) (*GetFileOutput, error) {
	if agentSkills == nil {
		return nil, errors.New("agent_skills is nil")
	}

	fileIndex := agentSkills.FileIndex.Data()
	var fileInfo *model.FileInfo
	for i := range fileIndex {
		if fileIndex[i].Path == filePath {
			fileInfo = &fileIndex[i]
			break
		}
	}
	if fileInfo == nil {
		return nil, errors.New("file path not found in agent_skills")
	}

	fullS3Key := agentSkills.GetFileS3Key(filePath)

	parser := fileparser.NewFileParser()
	fileName := filepath.Base(filePath)
	canParse := parser.CanParseFile(fileName, fileInfo.MIME)

	output := &GetFileOutput{
		Path: fileInfo.Path,
		MIME: fileInfo.MIME,
	}

	if canParse {
		content, err := s.s3.DownloadFile(ctx, fullS3Key)
		if err != nil {
			return nil, err
		}

		fileContent, err := parser.ParseFile(fileName, fileInfo.MIME, content)
		if err != nil {
			return nil, err
		}

		output.Content = fileContent
	} else {
		url, err := s.s3.PresignGet(ctx, fullS3Key, expire)
		if err != nil {
			return nil, err
		}
		output.URL = &url
	}

	return output, nil
}

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

func createTestMultipartFileHeader(filename string, content []byte) *multipart.FileHeader {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	part, _ := writer.CreateFormFile("file", filename)
	part.Write(content)
	writer.Close()

	reader := multipart.NewReader(body, writer.Boundary())
	form, _ := reader.ReadForm(10 << 20)

	return form.File["file"][0]
}

func createTestAgentSkills() *model.AgentSkills {
	projectID := uuid.New()
	agentSkillsID := uuid.New()

	baseAsset := &model.Asset{
		Bucket: "test-bucket",
		S3Key:  "agent_skills/" + projectID.String() + "/" + agentSkillsID.String() + "/test-skill",
		ETag:   "test-etag",
		SHA256: "test-sha256",
		MIME:   "",
		SizeB:  0,
	}

	return &model.AgentSkills{
		ID:          agentSkillsID,
		ProjectID:   projectID,
		Name:        "test-skill",
		Description: "Test description",
		AssetMeta:   datatypes.NewJSONType(*baseAsset),
		FileIndex: datatypes.NewJSONType([]model.FileInfo{
			{Path: "SKILL.md", MIME: "text/markdown"},
			{Path: "file1.json", MIME: "application/json"},
		}),
		Meta:      map[string]interface{}{"version": "1.0"},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

func TestSanitizeS3Key(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "spaces replaced",
			input:    "my skill name",
			expected: "my-skill-name",
		},
		{
			name:     "special chars replaced",
			input:    "skill:with*special?chars",
			expected: "skill-with-special-chars",
		},
		{
			name:     "multiple special chars",
			input:    "skill/with\\many:*?\"<>|chars",
			expected: "skill-with-many-------chars",
		},
		{
			name:     "normal alphanumeric",
			input:    "normal-skill-123",
			expected: "normal-skill-123",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := sanitizeS3Key(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestIsMacOSSystemFile(t *testing.T) {
	tests := []struct {
		name     string
		fileName string
		expected bool
	}{
		{
			name:     "__MACOSX directory",
			fileName: "__MACOSX/file.txt",
			expected: true,
		},
		{
			name:     "resource fork file",
			fileName: "dir/._file.txt",
			expected: true,
		},
		{
			name:     ".DS_Store",
			fileName: "dir/.DS_Store",
			expected: true,
		},
		{
			name:     "normal file",
			fileName: "dir/file.txt",
			expected: false,
		},
		{
			name:     "file starting with underscore",
			fileName: "dir/_file.txt",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isMacOSSystemFile(tt.fileName)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestAgentSkillsService_Create_Success(t *testing.T) {
	ctx := context.Background()
	projectID := uuid.New()

	validZipContent, _ := createTestZipFile(map[string]string{
		"SKILL.md":   "---\nname: test-skill\ndescription: Test description\n---\n",
		"file1.json": `{"key": "value"}`,
		"file2.md":   "# Test",
	})

	tests := []struct {
		name          string
		zipContent    []byte
		meta          map[string]interface{}
		setupMocks    func(*MockAgentSkillsRepo, *MockAgentSkillsS3)
		validateAsset func(*testing.T, *model.AgentSkills)
	}{
		{
			name:       "basic creation",
			zipContent: validZipContent,
			meta:       map[string]interface{}{"version": "1.0"},
			setupMocks: func(repo *MockAgentSkillsRepo, s3 *MockAgentSkillsS3) {
				repo.On("Create", mock.Anything, mock.MatchedBy(func(as *model.AgentSkills) bool {
					return as.Name == "test-skill" && as.Description == "Test description"
				})).Return(nil)

				s3.On("UploadFileDirect", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
					Return(&model.Asset{
						Bucket: "test-bucket",
						S3Key:  "test-key",
						ETag:   "test-etag",
						SHA256: "test-sha256",
						MIME:   "application/json",
						SizeB:  100,
					}, nil)

				repo.On("Update", mock.Anything, mock.MatchedBy(func(as *model.AgentSkills) bool {
					return as.AssetMeta.Data().Bucket == "test-bucket" && len(as.FileIndex.Data()) == 3
				})).Return(nil)
			},
			validateAsset: func(t *testing.T, as *model.AgentSkills) {
				assert.Equal(t, "test-skill", as.Name)
				assert.Equal(t, "Test description", as.Description)
				assert.Equal(t, projectID, as.ProjectID)
				assert.NotEqual(t, uuid.Nil, as.ID)
				assert.Equal(t, 3, len(as.FileIndex.Data()))
				assert.Equal(t, "test-bucket", as.AssetMeta.Data().Bucket)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := &MockAgentSkillsRepo{}
			mockS3 := &MockAgentSkillsS3{}
			tt.setupMocks(mockRepo, mockS3)

			service := newTestAgentSkillsService(mockRepo, mockS3)

			fileHeader := createTestMultipartFileHeader("skills.zip", tt.zipContent)

			result, err := service.Create(ctx, CreateAgentSkillsInput{
				ProjectID: projectID,
				ZipFile:   fileHeader,
				Meta:      tt.meta,
			})

			assert.NoError(t, err)
			assert.NotNil(t, result)
			tt.validateAsset(t, result)

			mockRepo.AssertExpectations(t)
			mockS3.AssertExpectations(t)
		})
	}
}

func TestAgentSkillsService_Create_ValidationFailures(t *testing.T) {
	ctx := context.Background()
	projectID := uuid.New()

	zipWithoutSkill, _ := createTestZipFile(map[string]string{
		"file1.json": `{"key": "value"}`,
	})

	zipWithInvalidYAML, _ := createTestZipFile(map[string]string{
		"SKILL.md":   "---\nname:\n  - invalid\n  - structure\ndescription: test\n---\n",
		"file1.json": `{"key": "value"}`,
	})

	zipWithoutName, _ := createTestZipFile(map[string]string{
		"SKILL.md":   "---\ndescription: Test description\n---\n",
		"file1.json": `{"key": "value"}`,
	})

	zipWithoutDescription, _ := createTestZipFile(map[string]string{
		"SKILL.md":   "---\nname: test-skill\n---\n",
		"file1.json": `{"key": "value"}`,
	})

	tests := []struct {
		name          string
		zipContent    []byte
		expectedError string
	}{
		{
			name:          "missing SKILL.md",
			zipContent:    zipWithoutSkill,
			expectedError: "SKILL.md file is required",
		},
		{
			name:          "invalid YAML",
			zipContent:    zipWithInvalidYAML,
			expectedError: "yaml",
		},
		{
			name:          "missing name",
			zipContent:    zipWithoutName,
			expectedError: "name is required",
		},
		{
			name:          "missing description",
			zipContent:    zipWithoutDescription,
			expectedError: "description is required",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := &MockAgentSkillsRepo{}
			mockS3 := &MockAgentSkillsS3{}

			service := newTestAgentSkillsService(mockRepo, mockS3)

			fileHeader := createTestMultipartFileHeader("skills.zip", tt.zipContent)

			result, err := service.Create(ctx, CreateAgentSkillsInput{
				ProjectID: projectID,
				ZipFile:   fileHeader,
				Meta:      map[string]interface{}{},
			})

			assert.Error(t, err)
			assert.Nil(t, result)
			assert.Contains(t, err.Error(), tt.expectedError)
		})
	}
}

func TestAgentSkillsService_Create_TwoPhaseRollback(t *testing.T) {
	ctx := context.Background()
	projectID := uuid.New()

	validZipContent, _ := createTestZipFile(map[string]string{
		"SKILL.md":   "---\nname: test-skill\ndescription: Test description\n---\n",
		"file1.json": `{"key": "value"}`,
	})

	t.Run("S3 upload fails - DB record deleted", func(t *testing.T) {
		mockRepo := &MockAgentSkillsRepo{}
		mockS3 := &MockAgentSkillsS3{}

		mockRepo.On("Create", mock.Anything, mock.Anything).Run(func(args mock.Arguments) {
			as := args.Get(1).(*model.AgentSkills)
			as.ID = uuid.New()
		}).Return(nil)

		mockS3.On("UploadFileDirect", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
			Return(nil, errors.New("S3 upload failed"))

		mockRepo.On("Delete", mock.Anything, projectID, mock.Anything).Return(nil)

		service := newTestAgentSkillsService(mockRepo, mockS3)
		fileHeader := createTestMultipartFileHeader("skills.zip", validZipContent)

		result, err := service.Create(ctx, CreateAgentSkillsInput{
			ProjectID: projectID,
			ZipFile:   fileHeader,
			Meta:      map[string]interface{}{},
		})

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "S3 upload failed")

		mockRepo.AssertCalled(t, "Delete", mock.Anything, projectID, mock.Anything)
	})

	t.Run("DB update fails - S3 and DB cleaned up", func(t *testing.T) {
		mockRepo := &MockAgentSkillsRepo{}
		mockS3 := &MockAgentSkillsS3{}

		mockRepo.On("Create", mock.Anything, mock.Anything).Run(func(args mock.Arguments) {
			as := args.Get(1).(*model.AgentSkills)
			as.ID = uuid.New()
		}).Return(nil)

		mockS3.On("UploadFileDirect", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
			Return(&model.Asset{
				Bucket: "test-bucket",
				S3Key:  "test-key",
			}, nil)

		mockRepo.On("Update", mock.Anything, mock.Anything).Return(errors.New("DB update failed"))

		mockS3.On("DeleteObjectsByPrefix", mock.Anything, mock.Anything).Return(nil)

		mockRepo.On("Delete", mock.Anything, projectID, mock.Anything).Return(nil)

		service := newTestAgentSkillsService(mockRepo, mockS3)
		fileHeader := createTestMultipartFileHeader("skills.zip", validZipContent)

		result, err := service.Create(ctx, CreateAgentSkillsInput{
			ProjectID: projectID,
			ZipFile:   fileHeader,
			Meta:      map[string]interface{}{},
		})

		assert.Error(t, err)
		assert.Nil(t, result)

		mockS3.AssertCalled(t, "DeleteObjectsByPrefix", mock.Anything, mock.Anything)
		mockRepo.AssertCalled(t, "Delete", mock.Anything, projectID, mock.Anything)
	})
}

func TestAgentSkillsService_Create_MacOSFiltering(t *testing.T) {
	ctx := context.Background()
	projectID := uuid.New()

	zipWithMacOSFiles, _ := createTestZipFile(map[string]string{
		"SKILL.md":             "---\nname: test-skill\ndescription: Test description\n---\n",
		"file1.json":           `{"key": "value"}`,
		"__MACOSX/file1.json":  "garbage",
		"._file2.json":         "resource fork",
		".DS_Store":            "finder metadata",
		"subdir/__MACOSX/file": "nested macos",
	})

	mockRepo := &MockAgentSkillsRepo{}
	mockS3 := &MockAgentSkillsS3{}

	mockRepo.On("Create", mock.Anything, mock.Anything).Return(nil)

	uploadCount := 0
	mockS3.On("UploadFileDirect", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Run(func(args mock.Arguments) {
			uploadCount++
		}).
		Return(&model.Asset{Bucket: "test-bucket", S3Key: "test-key"}, nil)

	mockRepo.On("Update", mock.Anything, mock.Anything).Return(nil)

	service := newTestAgentSkillsService(mockRepo, mockS3)
	fileHeader := createTestMultipartFileHeader("skills.zip", zipWithMacOSFiles)

	result, err := service.Create(ctx, CreateAgentSkillsInput{
		ProjectID: projectID,
		ZipFile:   fileHeader,
		Meta:      map[string]interface{}{},
	})

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, 2, uploadCount, "Should only upload SKILL.md and file1.json")
	assert.Equal(t, 2, len(result.FileIndex.Data()))
}

func TestAgentSkillsService_Create_RootPrefixStripping(t *testing.T) {
	ctx := context.Background()
	projectID := uuid.New()

	zipWithOuterDir, _ := createTestZipFile(map[string]string{
		"outer-dir/SKILL.md":        "---\nname: test-skill\ndescription: Test description\n---\n",
		"outer-dir/file1.json":      `{"key": "value"}`,
		"outer-dir/subdir/file2.md": "# Test",
	})

	mockRepo := &MockAgentSkillsRepo{}
	mockS3 := &MockAgentSkillsS3{}

	mockRepo.On("Create", mock.Anything, mock.Anything).Return(nil)

	var uploadedPaths []string
	mockS3.On("UploadFileDirect", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Run(func(args mock.Arguments) {
			key := args.Get(1).(string)
			uploadedPaths = append(uploadedPaths, key)
		}).
		Return(&model.Asset{Bucket: "test-bucket", S3Key: "test-key"}, nil)

	mockRepo.On("Update", mock.Anything, mock.Anything).Return(nil)

	service := newTestAgentSkillsService(mockRepo, mockS3)
	fileHeader := createTestMultipartFileHeader("skills.zip", zipWithOuterDir)

	result, err := service.Create(ctx, CreateAgentSkillsInput{
		ProjectID: projectID,
		ZipFile:   fileHeader,
		Meta:      map[string]interface{}{},
	})

	assert.NoError(t, err)
	assert.NotNil(t, result)

	fileIndex := result.FileIndex.Data()
	assert.Equal(t, 3, len(fileIndex))
	assert.Equal(t, "SKILL.md", fileIndex[0].Path)
	assert.Equal(t, "file1.json", fileIndex[1].Path)
	assert.Equal(t, "subdir/file2.md", fileIndex[2].Path)
}

func TestAgentSkillsService_GetByID(t *testing.T) {
	ctx := context.Background()
	projectID := uuid.New()
	agentSkillsID := uuid.New()

	tests := []struct {
		name          string
		setupMocks    func(*MockAgentSkillsRepo)
		expectedError bool
	}{
		{
			name: "success",
			setupMocks: func(repo *MockAgentSkillsRepo) {
				repo.On("GetByID", ctx, projectID, agentSkillsID).
					Return(createTestAgentSkills(), nil)
			},
			expectedError: false,
		},
		{
			name: "not found",
			setupMocks: func(repo *MockAgentSkillsRepo) {
				repo.On("GetByID", ctx, projectID, agentSkillsID).
					Return(nil, errors.New("not found"))
			},
			expectedError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := &MockAgentSkillsRepo{}
			mockS3 := &MockAgentSkillsS3{}
			tt.setupMocks(mockRepo)

			service := newTestAgentSkillsService(mockRepo, mockS3)
			result, err := service.GetByID(ctx, projectID, agentSkillsID)

			if tt.expectedError {
				assert.Error(t, err)
				assert.Nil(t, result)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, result)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestAgentSkillsService_Delete(t *testing.T) {
	ctx := context.Background()
	projectID := uuid.New()
	agentSkillsID := uuid.New()

	tests := []struct {
		name          string
		setupMocks    func(*MockAgentSkillsRepo)
		expectedError bool
	}{
		{
			name: "success",
			setupMocks: func(repo *MockAgentSkillsRepo) {
				repo.On("Delete", ctx, projectID, agentSkillsID).Return(nil)
			},
			expectedError: false,
		},
		{
			name: "not found",
			setupMocks: func(repo *MockAgentSkillsRepo) {
				repo.On("Delete", ctx, projectID, agentSkillsID).
					Return(errors.New("not found"))
			},
			expectedError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := &MockAgentSkillsRepo{}
			mockS3 := &MockAgentSkillsS3{}
			tt.setupMocks(mockRepo)

			service := newTestAgentSkillsService(mockRepo, mockS3)
			err := service.Delete(ctx, projectID, agentSkillsID)

			if tt.expectedError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestAgentSkillsService_List(t *testing.T) {
	ctx := context.Background()
	projectID := uuid.New()

	tests := []struct {
		name          string
		setupMocks    func(*MockAgentSkillsRepo)
		expectedError bool
		validateItems func(*testing.T, *ListAgentSkillsOutput)
	}{
		{
			name: "success with items",
			setupMocks: func(repo *MockAgentSkillsRepo) {
				skills := []*model.AgentSkills{createTestAgentSkills(), createTestAgentSkills()}
				repo.On("ListWithCursor", mock.Anything, projectID, "", mock.Anything, mock.Anything, 21, false).
					Return(skills, nil)
			},
			expectedError: false,
			validateItems: func(t *testing.T, output *ListAgentSkillsOutput) {
				assert.Equal(t, 2, len(output.Items))
				assert.False(t, output.HasMore)
			},
		},
		{
			name: "empty result",
			setupMocks: func(repo *MockAgentSkillsRepo) {
				repo.On("ListWithCursor", mock.Anything, projectID, "", mock.Anything, mock.Anything, 21, false).
					Return([]*model.AgentSkills{}, nil)
			},
			expectedError: false,
			validateItems: func(t *testing.T, output *ListAgentSkillsOutput) {
				assert.Equal(t, 0, len(output.Items))
				assert.False(t, output.HasMore)
			},
		},
		{
			name: "error",
			setupMocks: func(repo *MockAgentSkillsRepo) {
				repo.On("ListWithCursor", mock.Anything, projectID, "", mock.Anything, mock.Anything, 21, false).
					Return(nil, errors.New("database error"))
			},
			expectedError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := &MockAgentSkillsRepo{}
			mockS3 := &MockAgentSkillsS3{}
			tt.setupMocks(mockRepo)

			service := newTestAgentSkillsService(mockRepo, mockS3)
			result, err := service.List(ctx, ListAgentSkillsInput{
				ProjectID: projectID,
				Limit:     20,
			})

			if tt.expectedError {
				assert.Error(t, err)
				assert.Nil(t, result)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, result)
				if tt.validateItems != nil {
					tt.validateItems(t, result)
				}
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestAgentSkillsService_GetFile(t *testing.T) {
	ctx := context.Background()
	agentSkills := createTestAgentSkills()

	tests := []struct {
		name          string
		filePath      string
		setupMocks    func(*MockAgentSkillsS3)
		expectedError bool
		validateOut   func(*testing.T, *GetFileOutput)
	}{
		{
			name:     "file with content (parseable)",
			filePath: "file1.json",
			setupMocks: func(s3 *MockAgentSkillsS3) {
				s3.On("DownloadFile", ctx, mock.Anything).
					Return([]byte(`{"key": "value"}`), nil)
			},
			expectedError: false,
			validateOut: func(t *testing.T, out *GetFileOutput) {
				assert.Equal(t, "file1.json", out.Path)
				assert.NotNil(t, out.Content)
			},
		},
		{
			name:          "file not in index",
			filePath:      "nonexistent.txt",
			setupMocks:    func(s3 *MockAgentSkillsS3) {},
			expectedError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := &MockAgentSkillsRepo{}
			mockS3 := &MockAgentSkillsS3{}
			tt.setupMocks(mockS3)

			service := newTestAgentSkillsService(mockRepo, mockS3)
			result, err := service.GetFile(ctx, agentSkills, tt.filePath, 1*time.Hour)

			if tt.expectedError {
				assert.Error(t, err)
				assert.Nil(t, result)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, result)
				if tt.validateOut != nil {
					tt.validateOut(t, result)
				}
			}

			mockS3.AssertExpectations(t)
		})
	}
}
