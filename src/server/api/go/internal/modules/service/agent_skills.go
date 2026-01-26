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
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/infra/blob"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/repo"
	"github.com/memodb-io/Acontext/internal/pkg/paging"
	"github.com/memodb-io/Acontext/internal/pkg/utils/fileparser"
	"github.com/memodb-io/Acontext/internal/pkg/utils/mime"
	"golang.org/x/sync/errgroup"
	"gopkg.in/yaml.v3"
	"gorm.io/datatypes"
)

type AgentSkillsService interface {
	Create(ctx context.Context, in CreateAgentSkillsInput) (*model.AgentSkills, error)
	GetByID(ctx context.Context, projectID uuid.UUID, id uuid.UUID) (*model.AgentSkills, error)
	Delete(ctx context.Context, projectID uuid.UUID, id uuid.UUID) error
	List(ctx context.Context, in ListAgentSkillsInput) (*ListAgentSkillsOutput, error)
	GetFile(ctx context.Context, agentSkills *model.AgentSkills, filePath string, expire time.Duration) (*GetFileOutput, error)
}

type agentSkillsService struct {
	r  repo.AgentSkillsRepo
	s3 *blob.S3Deps
}

func NewAgentSkillsService(r repo.AgentSkillsRepo, s3 *blob.S3Deps) AgentSkillsService {
	return &agentSkillsService{
		r:  r,
		s3: s3,
	}
}

type CreateAgentSkillsInput struct {
	ProjectID uuid.UUID
	UserID    *uuid.UUID
	ZipFile   *multipart.FileHeader
	Meta      map[string]interface{}
}

// SkillMetadata represents the YAML structure in SKILL.md
type SkillMetadata struct {
	Name        string `yaml:"name"`
	Description string `yaml:"description"`
}

func extractYAMLFrontMatter(content []byte) string {
	contentStr := string(content)
	lines := strings.Split(contentStr, "\n")

	firstDashIndex := -1
	for i, line := range lines {
		if strings.TrimSpace(line) == "---" {
			firstDashIndex = i
			break
		}
	}

	if firstDashIndex == -1 {
		return contentStr
	}

	secondDashIndex := -1
	for i := firstDashIndex + 1; i < len(lines); i++ {
		if strings.TrimSpace(lines[i]) == "---" {
			secondDashIndex = i
			break
		}
	}

	if secondDashIndex == -1 {
		return contentStr
	}

	yamlLines := lines[firstDashIndex+1 : secondDashIndex]
	return strings.Join(yamlLines, "\n")
}

func sanitizeS3Key(name string) string {
	return strings.Map(func(r rune) rune {
		switch r {
		case ' ', '/', '\\', ':', '*', '?', '"', '<', '>', '|':
			return '-'
		default:
			return r
		}
	}, name)
}

func isMacOSSystemFile(fileName string) bool {
	return strings.Contains(fileName, "__MACOSX/") ||
		strings.Contains(fileName, "__MACOSX\\") ||
		strings.HasPrefix(filepath.Base(fileName), "._") ||
		filepath.Base(fileName) == ".DS_Store"
}

type zipFileData struct {
	name         string
	content      []byte
	relativePath string
	mimeType     string
}

func (s *agentSkillsService) Create(ctx context.Context, in CreateAgentSkillsInput) (*model.AgentSkills, error) {
	zipFile, err := in.ZipFile.Open()
	if err != nil {
		return nil, fmt.Errorf("open zip file: %w", err)
	}
	defer zipFile.Close()

	zipContent, err := io.ReadAll(zipFile)
	if err != nil {
		return nil, fmt.Errorf("read zip file: %w", err)
	}

	zipReader, err := zip.NewReader(bytes.NewReader(zipContent), int64(len(zipContent)))
	if err != nil {
		return nil, fmt.Errorf("open zip archive: %w", err)
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
			return nil, fmt.Errorf("open file in zip: %w", err)
		}

		fileContent, err := io.ReadAll(fileReader)
		fileReader.Close()
		if err != nil {
			return nil, fmt.Errorf("read file in zip: %w", err)
		}

		fileName := filepath.Base(file.Name)
		if strings.EqualFold(fileName, "SKILL.md") && !skillMetadataFound {
			yamlContent := extractYAMLFrontMatter(fileContent)
			if yamlContent == "" {
				return nil, errors.New("SKILL.md must contain YAML front matter")
			}

			var metadata SkillMetadata
			if err := yaml.Unmarshal([]byte(yamlContent), &metadata); err != nil {
				return nil, fmt.Errorf("parse SKILL.md YAML: %w", err)
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

	// Sanitize skill name for both DB storage and S3 path
	sanitizedName := sanitizeS3Key(skillName)

	agentSkills := &model.AgentSkills{
		ProjectID:   in.ProjectID,
		UserID:      in.UserID,
		Name:        sanitizedName,
		Description: skillDescription,
		Meta:        in.Meta,
	}

	if err := s.r.Create(ctx, agentSkills); err != nil {
		return nil, fmt.Errorf("create agent_skills record: %w", err)
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

	baseS3Key := fmt.Sprintf("agent_skills/%s/%s/%s", in.ProjectID.String(), dbID.String(), sanitizedName)

	fileIndex := make([]model.FileInfo, len(filesToUpload))
	var baseBucket string
	var mu sync.Mutex

	g, gctx := errgroup.WithContext(ctx)
	g.SetLimit(10)

	for i, fileData := range filesToUpload {
		i, fileData := i, fileData
		g.Go(func() error {
			fullS3Key := fmt.Sprintf("%s/%s", baseS3Key, fileData.relativePath)
			asset, err := s.s3.UploadFileDirect(gctx, fullS3Key, fileData.content, fileData.mimeType)
			if err != nil {
				return fmt.Errorf("upload file to S3: %w", err)
			}

			mu.Lock()
			if baseBucket == "" {
				baseBucket = asset.Bucket
			}
			fileIndex[i] = model.FileInfo{
				Path: fileData.relativePath,
				MIME: fileData.mimeType,
			}
			mu.Unlock()

			return nil
		})
	}

	if err = g.Wait(); err != nil {
		return nil, err
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
		return nil, fmt.Errorf("update agent_skills record: %w", err)
	}

	return agentSkills, nil
}

func (s *agentSkillsService) GetByID(ctx context.Context, projectID uuid.UUID, id uuid.UUID) (*model.AgentSkills, error) {
	return s.r.GetByID(ctx, projectID, id)
}

func (s *agentSkillsService) Delete(ctx context.Context, projectID uuid.UUID, id uuid.UUID) error {
	return s.r.Delete(ctx, projectID, id)
}

type ListAgentSkillsInput struct {
	ProjectID uuid.UUID
	User      string
	Limit     int
	Cursor    string
	TimeDesc  bool
}

// AgentSkillsListItem is a lightweight representation of AgentSkills for list responses.
// It excludes file_index to reduce response payload size.
type AgentSkillsListItem struct {
	ID          uuid.UUID              `json:"id"`
	UserID      *uuid.UUID             `json:"user_id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Meta        map[string]interface{} `json:"meta"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
}

type ListAgentSkillsOutput struct {
	Items      []*AgentSkillsListItem `json:"items"`
	NextCursor string                 `json:"next_cursor,omitempty"`
	HasMore    bool                   `json:"has_more"`
}

func (s *agentSkillsService) List(ctx context.Context, in ListAgentSkillsInput) (*ListAgentSkillsOutput, error) {
	// Parse cursor
	var afterT time.Time
	var afterID uuid.UUID
	var err error
	if in.Cursor != "" {
		afterT, afterID, err = paging.DecodeCursor(in.Cursor)
		if err != nil {
			return nil, err
		}
	}

	// Query limit+1 to determine has_more
	agentSkills, err := s.r.ListWithCursor(ctx, in.ProjectID, in.User, afterT, afterID, in.Limit+1, in.TimeDesc)
	if err != nil {
		return nil, err
	}

	// Determine pagination
	hasMore := len(agentSkills) > in.Limit
	if hasMore {
		agentSkills = agentSkills[:in.Limit]
	}

	// Convert to lightweight list items (excludes file_index)
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

// GetFileOutput represents the response for getting a file from a skill.
// It contains either parsed content (for text files) or a presigned URL (for binary files).
type GetFileOutput struct {
	Path    string                  `json:"path"`
	MIME    string                  `json:"mime"`
	Content *fileparser.FileContent `json:"content,omitempty"` // Present if file is text-based and parseable
	URL     *string                 `json:"url,omitempty"`     // Present if file is not text-based or not parseable
}

func (s *agentSkillsService) GetFile(ctx context.Context, agentSkills *model.AgentSkills, filePath string, expire time.Duration) (*GetFileOutput, error) {
	if agentSkills == nil {
		return nil, errors.New("agent_skills is nil")
	}

	// Find file in file index
	fileIndex := agentSkills.FileIndex.Data()
	var fileInfo *model.FileInfo
	for i := range fileIndex {
		if fileIndex[i].Path == filePath {
			fileInfo = &fileIndex[i]
			break
		}
	}
	if fileInfo == nil {
		return nil, fmt.Errorf("file path '%s' not found in agent_skills", filePath)
	}

	// Get full S3 key
	fullS3Key := agentSkills.GetFileS3Key(filePath)

	// Check if file type is parseable
	parser := fileparser.NewFileParser()
	filename := filepath.Base(filePath)
	canParse := parser.CanParseFile(filename, fileInfo.MIME)

	output := &GetFileOutput{
		Path: fileInfo.Path,
		MIME: fileInfo.MIME,
	}

	if canParse {
		// Download and parse file content
		content, err := s.s3.DownloadFile(ctx, fullS3Key)
		if err != nil {
			return nil, fmt.Errorf("failed to download file content: %w", err)
		}

		fileContent, err := parser.ParseFile(filename, fileInfo.MIME, content)
		if err != nil {
			return nil, fmt.Errorf("failed to parse file content: %w", err)
		}

		output.Content = fileContent
	} else {
		// Generate presigned URL for non-text files
		url, err := s.s3.PresignGet(ctx, fullS3Key, expire)
		if err != nil {
			return nil, fmt.Errorf("failed to generate presigned URL: %w", err)
		}
		output.URL = &url
	}

	return output, nil
}
