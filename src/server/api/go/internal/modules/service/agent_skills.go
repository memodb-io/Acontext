package service

import (
	"archive/zip"
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	stdpath "path"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/repo"
	"github.com/memodb-io/Acontext/internal/pkg/paging"
	"github.com/memodb-io/Acontext/internal/pkg/utils/fileparser"
	"golang.org/x/sync/errgroup"
	"gopkg.in/yaml.v3"
)

type AgentSkillsService interface {
	Create(ctx context.Context, in CreateAgentSkillsInput) (*model.AgentSkills, error)
	CreateFromTemplate(ctx context.Context, in CreateFromTemplateInput) (*model.AgentSkills, error)
	GetByID(ctx context.Context, projectID uuid.UUID, id uuid.UUID) (*model.AgentSkills, error)
	Delete(ctx context.Context, projectID uuid.UUID, id uuid.UUID) error
	List(ctx context.Context, in ListAgentSkillsInput) (*ListAgentSkillsOutput, error)
	GetFile(ctx context.Context, projectID uuid.UUID, skillID uuid.UUID, filePath string, expire time.Duration) (*GetFileOutput, error)
	ListFiles(ctx context.Context, projectID uuid.UUID, id uuid.UUID) (*ListFilesOutput, error)
}

type agentSkillsService struct {
	r           repo.AgentSkillsRepo
	diskSvc     DiskService
	artifactSvc ArtifactService
}

func NewAgentSkillsService(r repo.AgentSkillsRepo, diskSvc DiskService, artifactSvc ArtifactService) AgentSkillsService {
	return &agentSkillsService{
		r:           r,
		diskSvc:     diskSvc,
		artifactSvc: artifactSvc,
	}
}

type CreateAgentSkillsInput struct {
	ProjectID uuid.UUID
	UserID    *uuid.UUID
	ZipFile   *multipart.FileHeader
	Meta      map[string]interface{}
}

type CreateFromTemplateInput struct {
	ProjectID uuid.UUID
	UserID    *uuid.UUID
	Content   []byte                 // raw SKILL.md content read from embedded FS
	Meta      map[string]interface{} // nil for default skills
}

// SkillMetadata represents the YAML structure in SKILL.md
type SkillMetadata struct {
	Name        string `yaml:"name"`
	Description string `yaml:"description"`
}

// SkillFileInfo represents a file in a skill's disk, with S3 key for sandbox download.
type SkillFileInfo struct {
	Path  string // Joined skill-relative path, e.g. "scripts/main.py" (from joinSkillPath)
	MIME  string // MIME type from artifact's AssetMeta
	S3Key string // S3 key from artifact's AssetMeta (for sandbox upload)
}

// ListFilesOutput contains skill metadata and the list of files with S3 keys.
// Combines skill name/description with file list to avoid double-querying.
type ListFilesOutput struct {
	Name        string          // Skill name (sanitized, used for sandbox path)
	Description string          // Skill description
	Files       []SkillFileInfo // File list with S3 keys
}

// splitSkillPath converts a skill-relative file path into Artifact (Path, Filename) tuple.
// Uses "path" package (always '/'), NOT "path/filepath" (OS-dependent separator).
func splitSkillPath(relativePath string) (dir, filename string) {
	d := stdpath.Dir(relativePath)
	f := stdpath.Base(relativePath)
	if d == "." {
		return "/", f
	}
	return "/" + d + "/", f
}

// joinSkillPath reconstructs a skill-relative file path from Artifact (Path, Filename).
func joinSkillPath(artifactPath, filename string) string {
	if artifactPath == "/" {
		return filename
	}
	return strings.TrimPrefix(artifactPath, "/") + filename
}

// artifactsToFileIndex converts a slice of Artifacts into a FileInfo slice.
// Always returns a non-nil slice (avoids JSON "file_index": null).
func artifactsToFileIndex(artifacts []*model.Artifact) []model.FileInfo {
	out := make([]model.FileInfo, len(artifacts))
	for i, a := range artifacts {
		out[i] = model.FileInfo{
			Path: joinSkillPath(a.Path, a.Filename),
			MIME: a.AssetMeta.Data().MIME,
		}
	}
	return out
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
}

func (s *agentSkillsService) Create(ctx context.Context, in CreateAgentSkillsInput) (*model.AgentSkills, error) {
	// ── Phase 1: ZIP parsing (pre-Disk, no cleanup needed on failure) ──

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

	// Detect root prefix for stripping
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
	}

	// Sanitize skill name for DB storage and sandbox paths
	sanitizedName := sanitizeS3Key(skillName)

	// ── Phase 2: Disk + Artifact uploads (cleanup required on failure) ──

	disk, err := s.diskSvc.Create(ctx, in.ProjectID, in.UserID)
	if err != nil {
		return nil, fmt.Errorf("create disk: %w", err)
	}

	success := false
	defer func() {
		if !success {
			s.diskSvc.Delete(context.Background(), in.ProjectID, disk.ID)
		}
	}()

	g, gctx := errgroup.WithContext(ctx)
	g.SetLimit(10)

	artifacts := make([]*model.Artifact, len(filesToUpload))

	for i, fileData := range filesToUpload {
		i, fileData := i, fileData
		g.Go(func() error {
			dir, fname := splitSkillPath(fileData.relativePath)
			artifact, err := s.artifactSvc.CreateFromBytes(gctx, CreateArtifactFromBytesInput{
				ProjectID: in.ProjectID,
				DiskID:    disk.ID,
				Path:      dir,
				Filename:  fname,
				Content:   fileData.content,
			})
			if err != nil {
				return fmt.Errorf("create artifact for %s: %w", fileData.relativePath, err)
			}
			artifacts[i] = artifact
			return nil
		})
	}

	if err = g.Wait(); err != nil {
		return nil, err
	}

	// ── Phase 3: DB record + response ──

	agentSkills := &model.AgentSkills{
		ProjectID:   in.ProjectID,
		UserID:      in.UserID,
		Name:        sanitizedName,
		Description: skillDescription,
		DiskID:      disk.ID,
		Meta:        in.Meta,
	}

	if err := s.r.Create(ctx, agentSkills); err != nil {
		return nil, fmt.Errorf("create agent_skills record: %w", err)
	}

	agentSkills.FileIndex = artifactsToFileIndex(artifacts)
	success = true
	return agentSkills, nil
}

func (s *agentSkillsService) CreateFromTemplate(ctx context.Context, in CreateFromTemplateInput) (*model.AgentSkills, error) {
	// Parse YAML front-matter
	yamlContent := extractYAMLFrontMatter(in.Content)
	var metadata SkillMetadata
	if err := yaml.Unmarshal([]byte(yamlContent), &metadata); err != nil {
		return nil, fmt.Errorf("parse template SKILL.md YAML: %w", err)
	}

	if metadata.Name == "" {
		return nil, errors.New("name is required in template SKILL.md")
	}
	if metadata.Description == "" {
		return nil, errors.New("description is required in template SKILL.md")
	}

	sanitizedName := sanitizeS3Key(metadata.Name)

	// Create Disk
	disk, err := s.diskSvc.Create(ctx, in.ProjectID, in.UserID)
	if err != nil {
		return nil, fmt.Errorf("create disk: %w", err)
	}

	success := false
	defer func() {
		if !success {
			s.diskSvc.Delete(context.Background(), in.ProjectID, disk.ID)
		}
	}()

	// Create single Artifact
	artifact, err := s.artifactSvc.CreateFromBytes(ctx, CreateArtifactFromBytesInput{
		ProjectID: in.ProjectID,
		DiskID:    disk.ID,
		Path:      "/",
		Filename:  "SKILL.md",
		Content:   in.Content,
	})
	if err != nil {
		return nil, fmt.Errorf("create artifact for template SKILL.md: %w", err)
	}

	// Create DB record
	agentSkills := &model.AgentSkills{
		ProjectID:   in.ProjectID,
		UserID:      in.UserID,
		Name:        sanitizedName,
		Description: metadata.Description,
		DiskID:      disk.ID,
		Meta:        in.Meta,
	}

	if err := s.r.Create(ctx, agentSkills); err != nil {
		return nil, fmt.Errorf("create agent_skills record: %w", err)
	}

	agentSkills.FileIndex = artifactsToFileIndex([]*model.Artifact{artifact})
	success = true
	return agentSkills, nil
}

func (s *agentSkillsService) GetByID(ctx context.Context, projectID uuid.UUID, id uuid.UUID) (*model.AgentSkills, error) {
	skill, err := s.r.GetByID(ctx, projectID, id)
	if err != nil {
		return nil, err
	}

	artifacts, err := s.artifactSvc.ListByPath(ctx, skill.DiskID, "")
	if err != nil {
		return nil, fmt.Errorf("list artifacts for skill: %w", err)
	}

	skill.FileIndex = artifactsToFileIndex(artifacts)
	return skill, nil
}

func (s *agentSkillsService) Delete(ctx context.Context, projectID uuid.UUID, id uuid.UUID) error {
	skill, err := s.r.GetByID(ctx, projectID, id)
	if err != nil {
		return err
	}

	if err := s.r.Delete(ctx, projectID, id); err != nil {
		return fmt.Errorf("delete agent_skills record: %w", err)
	}

	if err := s.diskSvc.Delete(ctx, projectID, skill.DiskID); err != nil {
		return fmt.Errorf("delete disk: %w", err)
	}

	return nil
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

func (s *agentSkillsService) GetFile(ctx context.Context, projectID uuid.UUID, skillID uuid.UUID, filePath string, expire time.Duration) (*GetFileOutput, error) {
	// Fetch skill record directly (no FileIndex population needed — just need DiskID)
	skill, err := s.r.GetByID(ctx, projectID, skillID)
	if err != nil {
		return nil, err
	}

	// Split filePath into Artifact (Path, Filename) using path helpers
	dir, fname := splitSkillPath(filePath)

	// Get artifact by path
	artifact, err := s.artifactSvc.GetByPath(ctx, skill.DiskID, dir, fname)
	if err != nil {
		return nil, fmt.Errorf("file path '%s' not found in agent_skills: %w", filePath, err)
	}

	mimeType := artifact.AssetMeta.Data().MIME

	parser := fileparser.NewFileParser()
	canParse := parser.CanParseFile(fname, mimeType)

	output := &GetFileOutput{
		Path: filePath,
		MIME: mimeType,
	}

	if canParse {
		// Download and parse file content via ArtifactService
		fileContent, err := s.artifactSvc.GetFileContent(ctx, artifact)
		if err != nil {
			return nil, fmt.Errorf("failed to get file content: %w", err)
		}
		output.Content = fileContent
	} else {
		// Generate presigned URL for non-text files via ArtifactService
		url, err := s.artifactSvc.GetPresignedURL(ctx, artifact, expire)
		if err != nil {
			return nil, fmt.Errorf("failed to generate presigned URL: %w", err)
		}
		output.URL = &url
	}

	return output, nil
}

func (s *agentSkillsService) ListFiles(ctx context.Context, projectID uuid.UUID, id uuid.UUID) (*ListFilesOutput, error) {
	// Get skill for DiskID + name/description (no FileIndex population)
	skill, err := s.r.GetByID(ctx, projectID, id)
	if err != nil {
		return nil, err
	}

	// List all artifacts
	artifacts, err := s.artifactSvc.ListByPath(ctx, skill.DiskID, "")
	if err != nil {
		return nil, fmt.Errorf("list artifacts for skill: %w", err)
	}

	files := make([]SkillFileInfo, len(artifacts))
	for i, a := range artifacts {
		asset := a.AssetMeta.Data()
		files[i] = SkillFileInfo{
			Path:  joinSkillPath(a.Path, a.Filename),
			MIME:  asset.MIME,
			S3Key: asset.S3Key,
		}
	}

	return &ListFilesOutput{
		Name:        skill.Name,
		Description: skill.Description,
		Files:       files,
	}, nil
}
