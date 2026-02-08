package service

import (
	"archive/zip"
	"bytes"
	"context"
	"errors"
	"mime/multipart"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/pkg/utils/fileparser"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"gorm.io/datatypes"
)

// ── Mock: AgentSkillsRepo ──

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

// ── Mock: DiskService ──

type MockDiskService struct {
	mock.Mock
}

func (m *MockDiskService) Create(ctx context.Context, projectID uuid.UUID, userID *uuid.UUID) (*model.Disk, error) {
	args := m.Called(ctx, projectID, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Disk), args.Error(1)
}

func (m *MockDiskService) Delete(ctx context.Context, projectID uuid.UUID, diskID uuid.UUID) error {
	args := m.Called(ctx, projectID, diskID)
	return args.Error(0)
}

func (m *MockDiskService) List(ctx context.Context, in ListDisksInput) (*ListDisksOutput, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*ListDisksOutput), args.Error(1)
}

// ── Mock: ArtifactService ──

type MockArtifactService struct {
	mock.Mock
}

func (m *MockArtifactService) Create(ctx context.Context, in CreateArtifactInput) (*model.Artifact, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Artifact), args.Error(1)
}

func (m *MockArtifactService) CreateFromBytes(ctx context.Context, in CreateArtifactFromBytesInput) (*model.Artifact, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Artifact), args.Error(1)
}

func (m *MockArtifactService) DeleteByPath(ctx context.Context, projectID uuid.UUID, diskID uuid.UUID, path string, filename string) error {
	args := m.Called(ctx, projectID, diskID, path, filename)
	return args.Error(0)
}

func (m *MockArtifactService) GetByPath(ctx context.Context, diskID uuid.UUID, path string, filename string) (*model.Artifact, error) {
	args := m.Called(ctx, diskID, path, filename)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Artifact), args.Error(1)
}

func (m *MockArtifactService) GetPresignedURL(ctx context.Context, artifact *model.Artifact, expire time.Duration) (string, error) {
	args := m.Called(ctx, artifact, expire)
	return args.String(0), args.Error(1)
}

func (m *MockArtifactService) GetFileContent(ctx context.Context, artifact *model.Artifact) (*fileparser.FileContent, error) {
	args := m.Called(ctx, artifact)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*fileparser.FileContent), args.Error(1)
}

func (m *MockArtifactService) UpdateArtifactMetaByPath(ctx context.Context, diskID uuid.UUID, path string, filename string, userMeta map[string]interface{}) (*model.Artifact, error) {
	args := m.Called(ctx, diskID, path, filename, userMeta)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Artifact), args.Error(1)
}

func (m *MockArtifactService) ListByPath(ctx context.Context, diskID uuid.UUID, path string) ([]*model.Artifact, error) {
	args := m.Called(ctx, diskID, path)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*model.Artifact), args.Error(1)
}

func (m *MockArtifactService) GetAllPaths(ctx context.Context, diskID uuid.UUID) ([]string, error) {
	args := m.Called(ctx, diskID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]string), args.Error(1)
}

func (m *MockArtifactService) GrepArtifacts(ctx context.Context, projectID uuid.UUID, diskID uuid.UUID, pattern string, limit int) ([]*model.Artifact, error) {
	args := m.Called(ctx, projectID, diskID, pattern, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*model.Artifact), args.Error(1)
}

func (m *MockArtifactService) GlobArtifacts(ctx context.Context, projectID uuid.UUID, diskID uuid.UUID, pattern string, limit int) ([]*model.Artifact, error) {
	args := m.Called(ctx, projectID, diskID, pattern, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*model.Artifact), args.Error(1)
}

// ── Helpers ──

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

func makeArtifact(diskID uuid.UUID, path, filename, mime, s3Key string) *model.Artifact {
	return &model.Artifact{
		ID:       uuid.New(),
		DiskID:   diskID,
		Path:     path,
		Filename: filename,
		AssetMeta: datatypes.NewJSONType(model.Asset{
			Bucket: "test-bucket",
			S3Key:  s3Key,
			MIME:   mime,
		}),
	}
}

func createTestAgentSkills() *model.AgentSkills {
	return &model.AgentSkills{
		ID:          uuid.New(),
		ProjectID:   uuid.New(),
		DiskID:      uuid.New(),
		Name:        "test-skill",
		Description: "Test description",
		FileIndex: []model.FileInfo{
			{Path: "SKILL.md", MIME: "text/markdown"},
			{Path: "file1.json", MIME: "application/json"},
		},
		Meta:      map[string]interface{}{"version": "1.0"},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

func newService(repo *MockAgentSkillsRepo, diskSvc *MockDiskService, artifactSvc *MockArtifactService) AgentSkillsService {
	return NewAgentSkillsService(repo, diskSvc, artifactSvc)
}

// testMocks bundles the three mocks used by every agentSkillsService test.
type testMocks struct {
	repo     *MockAgentSkillsRepo
	disk     *MockDiskService
	artifact *MockArtifactService
}

func newTestMocks() testMocks {
	return testMocks{
		repo:     &MockAgentSkillsRepo{},
		disk:     &MockDiskService{},
		artifact: &MockArtifactService{},
	}
}

func (m testMocks) service() AgentSkillsService {
	return newService(m.repo, m.disk, m.artifact)
}

// ── Path helper tests ──

func TestSplitSkillPath(t *testing.T) {
	tests := []struct {
		name         string
		input        string
		expectedDir  string
		expectedFile string
	}{
		{"root file", "SKILL.md", "/", "SKILL.md"},
		{"nested file", "a/b/c/file.txt", "/a/b/c/", "file.txt"},
		{"single dir", "scripts/main.py", "/scripts/", "main.py"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dir, file := splitSkillPath(tt.input)
			assert.Equal(t, tt.expectedDir, dir)
			assert.Equal(t, tt.expectedFile, file)
		})
	}
}

func TestJoinSkillPath(t *testing.T) {
	tests := []struct {
		name     string
		path     string
		filename string
		expected string
	}{
		{"root", "/", "SKILL.md", "SKILL.md"},
		{"nested", "/scripts/", "main.py", "scripts/main.py"},
		{"deep", "/a/b/c/", "file.txt", "a/b/c/file.txt"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := joinSkillPath(tt.path, tt.filename)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestSplitJoinRoundtrip(t *testing.T) {
	paths := []string{"SKILL.md", "scripts/main.py", "a/b/c/file.txt", "file.json"}
	for _, p := range paths {
		dir, file := splitSkillPath(p)
		result := joinSkillPath(dir, file)
		assert.Equal(t, p, result, "roundtrip failed for path: %s", p)
	}
}

func TestSanitizeS3Key(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{"spaces replaced", "my skill name", "my-skill-name"},
		{"special chars replaced", "skill:with*special?chars", "skill-with-special-chars"},
		{"multiple special chars", "skill/with\\many:*?\"<>|chars", "skill-with-many-------chars"},
		{"normal alphanumeric", "normal-skill-123", "normal-skill-123"},
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
		{"__MACOSX directory", "__MACOSX/file.txt", true},
		{"resource fork file", "dir/._file.txt", true},
		{".DS_Store", "dir/.DS_Store", true},
		{"normal file", "dir/file.txt", false},
		{"file starting with underscore", "dir/_file.txt", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isMacOSSystemFile(tt.fileName)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// ── Service: Create tests ──

func TestAgentSkillsService_Create_Success(t *testing.T) {
	ctx := context.Background()
	projectID := uuid.New()
	diskID := uuid.New()

	validZipContent, _ := createTestZipFile(map[string]string{
		"SKILL.md":   "---\nname: test-skill\ndescription: Test description\n---\n",
		"file1.json": `{"key": "value"}`,
		"file2.md":   "# Test",
	})

	t.Run("basic creation", func(t *testing.T) {
		m := newTestMocks()

		m.disk.On("Create", mock.Anything, projectID, mock.Anything).
			Return(&model.Disk{ID: diskID, ProjectID: projectID}, nil)

		m.artifact.On("CreateFromBytes", mock.Anything, mock.MatchedBy(func(in CreateArtifactFromBytesInput) bool {
			return in.Filename == "SKILL.md"
		})).Return(makeArtifact(diskID, "/", "SKILL.md", "text/markdown", "disks/hash1"), nil)

		m.artifact.On("CreateFromBytes", mock.Anything, mock.MatchedBy(func(in CreateArtifactFromBytesInput) bool {
			return in.Filename == "file1.json"
		})).Return(makeArtifact(diskID, "/", "file1.json", "application/json", "disks/hash2"), nil)

		m.artifact.On("CreateFromBytes", mock.Anything, mock.MatchedBy(func(in CreateArtifactFromBytesInput) bool {
			return in.Filename == "file2.md"
		})).Return(makeArtifact(diskID, "/", "file2.md", "text/markdown", "disks/hash3"), nil)

		m.repo.On("Create", mock.Anything, mock.MatchedBy(func(as *model.AgentSkills) bool {
			return as.Name == "test-skill" && as.Description == "Test description" && as.DiskID == diskID
		})).Return(nil)

		fileHeader := createTestMultipartFileHeader("skills.zip", validZipContent)
		result, err := m.service().Create(ctx, CreateAgentSkillsInput{
			ProjectID: projectID,
			ZipFile:   fileHeader,
			Meta:      map[string]interface{}{"version": "1.0"},
		})

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, "test-skill", result.Name)
		assert.Equal(t, "Test description", result.Description)
		assert.Equal(t, diskID, result.DiskID)
		assert.Len(t, result.FileIndex, 3)
		assert.NotNil(t, result.FileIndex)

		m.repo.AssertExpectations(t)
		m.disk.AssertExpectations(t)
		m.artifact.AssertExpectations(t)
	})
}

func TestAgentSkillsService_Create_FileIndexIsArrayNotNull(t *testing.T) {
	ctx := context.Background()
	projectID := uuid.New()
	diskID := uuid.New()

	zipContent, _ := createTestZipFile(map[string]string{
		"SKILL.md": "---\nname: test-skill\ndescription: Test description\n---\n",
	})

	m := newTestMocks()
	m.disk.On("Create", mock.Anything, projectID, mock.Anything).
		Return(&model.Disk{ID: diskID, ProjectID: projectID}, nil)
	m.artifact.On("CreateFromBytes", mock.Anything, mock.Anything).
		Return(makeArtifact(diskID, "/", "SKILL.md", "text/markdown", "disks/hash"), nil)
	m.repo.On("Create", mock.Anything, mock.Anything).Return(nil)

	fileHeader := createTestMultipartFileHeader("skills.zip", zipContent)
	result, err := m.service().Create(ctx, CreateAgentSkillsInput{
		ProjectID: projectID,
		ZipFile:   fileHeader,
	})

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.NotNil(t, result.FileIndex) // must be [] not null
	assert.Len(t, result.FileIndex, 1)
	assert.Equal(t, "SKILL.md", result.FileIndex[0].Path)
}

func TestAgentSkillsService_Create_NameSanitization(t *testing.T) {
	ctx := context.Background()
	projectID := uuid.New()
	diskID := uuid.New()

	zipContent, _ := createTestZipFile(map[string]string{
		"SKILL.md": "---\nname: my special:skill\ndescription: Test description\n---\n",
	})

	m := newTestMocks()
	m.disk.On("Create", mock.Anything, projectID, mock.Anything).
		Return(&model.Disk{ID: diskID, ProjectID: projectID}, nil)
	m.artifact.On("CreateFromBytes", mock.Anything, mock.Anything).
		Return(makeArtifact(diskID, "/", "SKILL.md", "text/markdown", "disks/hash"), nil)
	m.repo.On("Create", mock.Anything, mock.MatchedBy(func(as *model.AgentSkills) bool {
		return as.Name == "my-special-skill"
	})).Return(nil)

	fileHeader := createTestMultipartFileHeader("skills.zip", zipContent)
	result, err := m.service().Create(ctx, CreateAgentSkillsInput{
		ProjectID: projectID,
		ZipFile:   fileHeader,
	})

	assert.NoError(t, err)
	assert.Equal(t, "my-special-skill", result.Name)
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
		{"missing SKILL.md", zipWithoutSkill, "SKILL.md file is required"},
		{"invalid YAML", zipWithInvalidYAML, "yaml"},
		{"missing name", zipWithoutName, "name is required"},
		{"missing description", zipWithoutDescription, "description is required"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := newTestMocks()
			fileHeader := createTestMultipartFileHeader("skills.zip", tt.zipContent)

			result, err := m.service().Create(ctx, CreateAgentSkillsInput{
				ProjectID: projectID,
				ZipFile:   fileHeader,
				Meta:      map[string]interface{}{},
			})

			assert.Error(t, err)
			assert.Nil(t, result)
			assert.Contains(t, err.Error(), tt.expectedError)
			m.disk.AssertNotCalled(t, "Create")
		})
	}
}

func TestAgentSkillsService_Create_FailureMidUpload(t *testing.T) {
	ctx := context.Background()
	projectID := uuid.New()
	diskID := uuid.New()

	zipContent, _ := createTestZipFile(map[string]string{
		"SKILL.md":   "---\nname: test-skill\ndescription: Test description\n---\n",
		"file1.json": `{"key": "value"}`,
	})

	m := newTestMocks()
	m.disk.On("Create", mock.Anything, projectID, mock.Anything).
		Return(&model.Disk{ID: diskID, ProjectID: projectID}, nil)
	m.artifact.On("CreateFromBytes", mock.Anything, mock.Anything).
		Return(nil, errors.New("S3 upload failed"))
	m.disk.On("Delete", mock.Anything, projectID, diskID).Return(nil)

	fileHeader := createTestMultipartFileHeader("skills.zip", zipContent)
	result, err := m.service().Create(ctx, CreateAgentSkillsInput{
		ProjectID: projectID,
		ZipFile:   fileHeader,
	})

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "S3 upload failed")
	m.disk.AssertCalled(t, "Delete", mock.Anything, projectID, diskID)
	m.repo.AssertNotCalled(t, "Create")
}

func TestAgentSkillsService_Create_FailureOnDBInsert(t *testing.T) {
	ctx := context.Background()
	projectID := uuid.New()
	diskID := uuid.New()

	zipContent, _ := createTestZipFile(map[string]string{
		"SKILL.md": "---\nname: test-skill\ndescription: Test description\n---\n",
	})

	m := newTestMocks()
	m.disk.On("Create", mock.Anything, projectID, mock.Anything).
		Return(&model.Disk{ID: diskID, ProjectID: projectID}, nil)
	m.artifact.On("CreateFromBytes", mock.Anything, mock.Anything).
		Return(makeArtifact(diskID, "/", "SKILL.md", "text/markdown", "disks/hash"), nil)
	m.repo.On("Create", mock.Anything, mock.Anything).Return(errors.New("DB insert failed"))
	m.disk.On("Delete", mock.Anything, projectID, diskID).Return(nil)

	fileHeader := createTestMultipartFileHeader("skills.zip", zipContent)
	result, err := m.service().Create(ctx, CreateAgentSkillsInput{
		ProjectID: projectID,
		ZipFile:   fileHeader,
	})

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "DB insert failed")
	m.disk.AssertCalled(t, "Delete", mock.Anything, projectID, diskID)
}

func TestAgentSkillsService_Create_MacOSFiltering(t *testing.T) {
	ctx := context.Background()
	projectID := uuid.New()
	diskID := uuid.New()

	zipWithMacOSFiles, _ := createTestZipFile(map[string]string{
		"SKILL.md":             "---\nname: test-skill\ndescription: Test description\n---\n",
		"file1.json":           `{"key": "value"}`,
		"__MACOSX/file1.json":  "garbage",
		"._file2.json":         "resource fork",
		".DS_Store":            "finder metadata",
		"subdir/__MACOSX/file": "nested macos",
	})

	m := newTestMocks()
	m.disk.On("Create", mock.Anything, projectID, mock.Anything).
		Return(&model.Disk{ID: diskID, ProjectID: projectID}, nil)

	artifactCount := 0
	m.artifact.On("CreateFromBytes", mock.Anything, mock.MatchedBy(func(in CreateArtifactFromBytesInput) bool {
		return in.DiskID == diskID
	})).Run(func(args mock.Arguments) {
		artifactCount++
	}).Return(makeArtifact(diskID, "/", "file", "application/octet-stream", "disks/hash"), nil)

	m.repo.On("Create", mock.Anything, mock.Anything).Return(nil)

	fileHeader := createTestMultipartFileHeader("skills.zip", zipWithMacOSFiles)
	result, err := m.service().Create(ctx, CreateAgentSkillsInput{
		ProjectID: projectID,
		ZipFile:   fileHeader,
	})

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, 2, artifactCount, "Should only create artifacts for SKILL.md and file1.json")
	assert.Len(t, result.FileIndex, 2)
}

func TestAgentSkillsService_Create_RootPrefixStripping(t *testing.T) {
	ctx := context.Background()
	projectID := uuid.New()
	diskID := uuid.New()

	zipWithOuterDir, _ := createTestZipFile(map[string]string{
		"outer-dir/SKILL.md":        "---\nname: test-skill\ndescription: Test description\n---\n",
		"outer-dir/file1.json":      `{"key": "value"}`,
		"outer-dir/subdir/file2.md": "# Test",
	})

	m := newTestMocks()
	m.disk.On("Create", mock.Anything, projectID, mock.Anything).
		Return(&model.Disk{ID: diskID, ProjectID: projectID}, nil)

	m.artifact.On("CreateFromBytes", mock.Anything, mock.MatchedBy(func(in CreateArtifactFromBytesInput) bool {
		return in.Filename == "SKILL.md"
	})).Return(makeArtifact(diskID, "/", "SKILL.md", "text/markdown", "disks/hash1"), nil)

	m.artifact.On("CreateFromBytes", mock.Anything, mock.MatchedBy(func(in CreateArtifactFromBytesInput) bool {
		return in.Filename == "file1.json"
	})).Return(makeArtifact(diskID, "/", "file1.json", "application/json", "disks/hash2"), nil)

	m.artifact.On("CreateFromBytes", mock.Anything, mock.MatchedBy(func(in CreateArtifactFromBytesInput) bool {
		return in.Filename == "file2.md"
	})).Return(makeArtifact(diskID, "/subdir/", "file2.md", "text/markdown", "disks/hash3"), nil)

	m.repo.On("Create", mock.Anything, mock.Anything).Return(nil)

	fileHeader := createTestMultipartFileHeader("skills.zip", zipWithOuterDir)
	result, err := m.service().Create(ctx, CreateAgentSkillsInput{
		ProjectID: projectID,
		ZipFile:   fileHeader,
	})

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Len(t, result.FileIndex, 3)

	var paths []string
	for _, fi := range result.FileIndex {
		paths = append(paths, fi.Path)
	}
	assert.ElementsMatch(t, []string{"SKILL.md", "file1.json", "subdir/file2.md"}, paths)
}

// ── Service: GetByID tests ──

func TestAgentSkillsService_GetByID(t *testing.T) {
	ctx := context.Background()
	projectID := uuid.New()
	agentSkillsID := uuid.New()
	diskID := uuid.New()

	t.Run("success", func(t *testing.T) {
		m := newTestMocks()
		skill := &model.AgentSkills{ID: agentSkillsID, ProjectID: projectID, DiskID: diskID, Name: "test-skill"}
		m.repo.On("GetByID", ctx, projectID, agentSkillsID).Return(skill, nil)
		m.artifact.On("ListByPath", ctx, diskID, "").Return([]*model.Artifact{
			makeArtifact(diskID, "/", "SKILL.md", "text/markdown", "disks/hash1"),
			makeArtifact(diskID, "/scripts/", "main.py", "text/x-python", "disks/hash2"),
		}, nil)

		result, err := m.service().GetByID(ctx, projectID, agentSkillsID)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.NotNil(t, result.FileIndex)
		assert.Len(t, result.FileIndex, 2)
		assert.Equal(t, "SKILL.md", result.FileIndex[0].Path)
		assert.Equal(t, "scripts/main.py", result.FileIndex[1].Path)
	})

	t.Run("empty file index is not nil", func(t *testing.T) {
		m := newTestMocks()
		skill := &model.AgentSkills{ID: agentSkillsID, ProjectID: projectID, DiskID: diskID, Name: "empty-skill"}
		m.repo.On("GetByID", ctx, projectID, agentSkillsID).Return(skill, nil)
		m.artifact.On("ListByPath", ctx, diskID, "").Return([]*model.Artifact{}, nil)

		result, err := m.service().GetByID(ctx, projectID, agentSkillsID)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.NotNil(t, result.FileIndex, "FileIndex should be [] not nil")
		assert.Empty(t, result.FileIndex)
	})

	t.Run("not found", func(t *testing.T) {
		m := newTestMocks()
		m.repo.On("GetByID", ctx, projectID, agentSkillsID).Return(nil, errors.New("not found"))

		result, err := m.service().GetByID(ctx, projectID, agentSkillsID)

		assert.Error(t, err)
		assert.Nil(t, result)
	})
}

// ── Service: Delete tests ──

func TestAgentSkillsService_Delete(t *testing.T) {
	ctx := context.Background()
	projectID := uuid.New()
	agentSkillsID := uuid.New()
	diskID := uuid.New()

	t.Run("success - skill deleted first, then disk", func(t *testing.T) {
		m := newTestMocks()
		skill := &model.AgentSkills{ID: agentSkillsID, ProjectID: projectID, DiskID: diskID}
		m.repo.On("GetByID", ctx, projectID, agentSkillsID).Return(skill, nil)
		m.repo.On("Delete", ctx, projectID, agentSkillsID).Return(nil)
		m.disk.On("Delete", ctx, projectID, diskID).Return(nil)

		err := m.service().Delete(ctx, projectID, agentSkillsID)

		assert.NoError(t, err)
		m.repo.AssertCalled(t, "Delete", ctx, projectID, agentSkillsID)
		m.disk.AssertCalled(t, "Delete", ctx, projectID, diskID)
	})

	t.Run("not found", func(t *testing.T) {
		m := newTestMocks()
		m.repo.On("GetByID", ctx, projectID, agentSkillsID).Return(nil, errors.New("not found"))

		err := m.service().Delete(ctx, projectID, agentSkillsID)

		assert.Error(t, err)
		m.repo.AssertNotCalled(t, "Delete")
		m.disk.AssertNotCalled(t, "Delete")
	})
}

// ── Service: List tests ──

func TestAgentSkillsService_List(t *testing.T) {
	ctx := context.Background()
	projectID := uuid.New()

	t.Run("success with items", func(t *testing.T) {
		m := newTestMocks()
		skills := []*model.AgentSkills{createTestAgentSkills(), createTestAgentSkills()}
		m.repo.On("ListWithCursor", mock.Anything, projectID, "", mock.Anything, mock.Anything, 21, false).
			Return(skills, nil)

		result, err := m.service().List(ctx, ListAgentSkillsInput{ProjectID: projectID, Limit: 20})

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Len(t, result.Items, 2)
		assert.False(t, result.HasMore)
	})

	t.Run("empty result", func(t *testing.T) {
		m := newTestMocks()
		m.repo.On("ListWithCursor", mock.Anything, projectID, "", mock.Anything, mock.Anything, 21, false).
			Return([]*model.AgentSkills{}, nil)

		result, err := m.service().List(ctx, ListAgentSkillsInput{ProjectID: projectID, Limit: 20})

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Empty(t, result.Items)
		assert.False(t, result.HasMore)
	})

	t.Run("error", func(t *testing.T) {
		m := newTestMocks()
		m.repo.On("ListWithCursor", mock.Anything, projectID, "", mock.Anything, mock.Anything, 21, false).
			Return(nil, errors.New("database error"))

		result, err := m.service().List(ctx, ListAgentSkillsInput{ProjectID: projectID, Limit: 20})

		assert.Error(t, err)
		assert.Nil(t, result)
	})
}

// ── Service: GetFile tests ──

func TestAgentSkillsService_GetFile(t *testing.T) {
	ctx := context.Background()
	projectID := uuid.New()
	skillID := uuid.New()
	diskID := uuid.New()

	skill := &model.AgentSkills{
		ID:        skillID,
		ProjectID: projectID,
		DiskID:    diskID,
		Name:      "test-skill",
	}

	t.Run("file with content (parseable)", func(t *testing.T) {
		m := newTestMocks()
		m.repo.On("GetByID", ctx, projectID, skillID).Return(skill, nil)

		artifact := makeArtifact(diskID, "/", "file1.json", "application/json", "disks/hash")
		m.artifact.On("GetByPath", ctx, diskID, "/", "file1.json").Return(artifact, nil)
		m.artifact.On("GetFileContent", ctx, artifact).Return(&fileparser.FileContent{Raw: `{"key": "value"}`}, nil)

		result, err := m.service().GetFile(ctx, projectID, skillID, "file1.json", time.Hour)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, "file1.json", result.Path)
		assert.NotNil(t, result.Content)
	})

	t.Run("file with presigned URL (binary)", func(t *testing.T) {
		m := newTestMocks()
		m.repo.On("GetByID", ctx, projectID, skillID).Return(skill, nil)

		artifact := makeArtifact(diskID, "/", "image.png", "image/png", "disks/hash")
		m.artifact.On("GetByPath", ctx, diskID, "/", "image.png").Return(artifact, nil)
		m.artifact.On("GetPresignedURL", ctx, artifact, time.Hour).Return("https://s3.example.com/url", nil)

		result, err := m.service().GetFile(ctx, projectID, skillID, "image.png", time.Hour)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, "image.png", result.Path)
		assert.NotNil(t, result.URL)
		assert.Equal(t, "https://s3.example.com/url", *result.URL)
	})

	t.Run("nested path resolves correctly", func(t *testing.T) {
		m := newTestMocks()
		m.repo.On("GetByID", ctx, projectID, skillID).Return(skill, nil)

		artifact := makeArtifact(diskID, "/scripts/sub/", "file.py", "text/x-python", "disks/hash")
		m.artifact.On("GetByPath", ctx, diskID, "/scripts/sub/", "file.py").Return(artifact, nil)
		m.artifact.On("GetFileContent", ctx, artifact).Return(&fileparser.FileContent{Raw: "print('hello')"}, nil)

		result, err := m.service().GetFile(ctx, projectID, skillID, "scripts/sub/file.py", time.Hour)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, "scripts/sub/file.py", result.Path)
	})

	t.Run("skill not found", func(t *testing.T) {
		m := newTestMocks()
		m.repo.On("GetByID", ctx, projectID, skillID).Return(nil, errors.New("not found"))

		result, err := m.service().GetFile(ctx, projectID, skillID, "file1.json", time.Hour)

		assert.Error(t, err)
		assert.Nil(t, result)
	})

	t.Run("file not found in artifacts", func(t *testing.T) {
		m := newTestMocks()
		m.repo.On("GetByID", ctx, projectID, skillID).Return(skill, nil)
		m.artifact.On("GetByPath", ctx, diskID, "/", "nonexistent.txt").
			Return(nil, errors.New("not found"))

		result, err := m.service().GetFile(ctx, projectID, skillID, "nonexistent.txt", time.Hour)

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "not found")
	})
}

// ── Service: ListFiles tests ──

func TestAgentSkillsService_ListFiles(t *testing.T) {
	ctx := context.Background()
	projectID := uuid.New()
	agentSkillsID := uuid.New()
	diskID := uuid.New()

	t.Run("returns files with pre-joined paths, S3 keys, and skill metadata", func(t *testing.T) {
		m := newTestMocks()
		skill := &model.AgentSkills{
			ID: agentSkillsID, ProjectID: projectID, DiskID: diskID,
			Name: "test-skill", Description: "Test description",
		}
		m.repo.On("GetByID", ctx, projectID, agentSkillsID).Return(skill, nil)
		m.artifact.On("ListByPath", ctx, diskID, "").Return([]*model.Artifact{
			makeArtifact(diskID, "/", "SKILL.md", "text/markdown", "disks/hash1"),
			makeArtifact(diskID, "/scripts/", "main.py", "text/x-python", "disks/hash2"),
		}, nil)

		result, err := m.service().ListFiles(ctx, projectID, agentSkillsID)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, "test-skill", result.Name)
		assert.Equal(t, "Test description", result.Description)
		assert.Len(t, result.Files, 2)
		assert.Equal(t, "SKILL.md", result.Files[0].Path)
		assert.Equal(t, "text/markdown", result.Files[0].MIME)
		assert.Equal(t, "disks/hash1", result.Files[0].S3Key)
		assert.Equal(t, "scripts/main.py", result.Files[1].Path)
		assert.Equal(t, "text/x-python", result.Files[1].MIME)
		assert.Equal(t, "disks/hash2", result.Files[1].S3Key)
	})

	t.Run("skill not found", func(t *testing.T) {
		m := newTestMocks()
		m.repo.On("GetByID", ctx, projectID, agentSkillsID).Return(nil, errors.New("not found"))

		result, err := m.service().ListFiles(ctx, projectID, agentSkillsID)

		assert.Error(t, err)
		assert.Nil(t, result)
	})
}

// ── Create + Delete in same test (workspace rule) ──

func TestAgentSkillsService_CreateAndDelete(t *testing.T) {
	ctx := context.Background()
	projectID := uuid.New()
	diskID := uuid.New()

	zipContent, _ := createTestZipFile(map[string]string{
		"SKILL.md": "---\nname: test-skill\ndescription: Test description\n---\n",
	})

	m := newTestMocks()

	// Create
	m.disk.On("Create", mock.Anything, projectID, mock.Anything).
		Return(&model.Disk{ID: diskID, ProjectID: projectID}, nil)
	m.artifact.On("CreateFromBytes", mock.Anything, mock.Anything).
		Return(makeArtifact(diskID, "/", "SKILL.md", "text/markdown", "disks/hash"), nil)

	var createdSkillID uuid.UUID
	m.repo.On("Create", mock.Anything, mock.Anything).Run(func(args mock.Arguments) {
		as := args.Get(1).(*model.AgentSkills)
		as.ID = uuid.New()
		createdSkillID = as.ID
	}).Return(nil)

	svc := m.service()
	fileHeader := createTestMultipartFileHeader("skills.zip", zipContent)

	result, err := svc.Create(ctx, CreateAgentSkillsInput{
		ProjectID: projectID,
		ZipFile:   fileHeader,
	})
	assert.NoError(t, err)
	assert.NotNil(t, result)

	// Delete
	m.repo.On("GetByID", ctx, projectID, createdSkillID).Return(&model.AgentSkills{
		ID: createdSkillID, ProjectID: projectID, DiskID: diskID,
	}, nil)
	m.repo.On("Delete", ctx, projectID, createdSkillID).Return(nil)
	m.disk.On("Delete", ctx, projectID, diskID).Return(nil)

	err = svc.Delete(ctx, projectID, createdSkillID)
	assert.NoError(t, err)

	m.repo.AssertExpectations(t)
	m.disk.AssertExpectations(t)
	m.artifact.AssertExpectations(t)
}
