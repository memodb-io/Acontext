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
	"time"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/infra/blob"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/repo"
	"github.com/memodb-io/Acontext/internal/pkg/paging"
	"github.com/memodb-io/Acontext/internal/pkg/utils/mime"
	"gopkg.in/yaml.v3"
	"gorm.io/datatypes"
)

type AgentSkillsService interface {
	Create(ctx context.Context, in CreateAgentSkillsInput) (*model.AgentSkills, error)
	GetByID(ctx context.Context, projectID uuid.UUID, id uuid.UUID) (*model.AgentSkills, error)
	GetByName(ctx context.Context, projectID uuid.UUID, name string) (*model.AgentSkills, error)
	Update(ctx context.Context, in UpdateAgentSkillsInput) (*model.AgentSkills, error)
	Delete(ctx context.Context, projectID uuid.UUID, id uuid.UUID) error
	List(ctx context.Context, in ListAgentSkillsInput) (*ListAgentSkillsOutput, error)
	GetPresignedURL(ctx context.Context, agentSkills *model.AgentSkills, filePath string, expire time.Duration) (string, error)
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
	ZipFile   *multipart.FileHeader
	Meta      map[string]interface{}
}

// SkillMetadata represents the YAML structure in SKILL.md
type SkillMetadata struct {
	Name        string `yaml:"name"`
	Description string `yaml:"description"`
}

// extractYAMLFrontMatter extracts YAML front matter from a markdown file.
// It looks for content between the first two "---" markers.
// If no front matter is found, it returns the entire content (for backward compatibility with pure YAML files).
func extractYAMLFrontMatter(content []byte) string {
	contentStr := string(content)
	lines := strings.Split(contentStr, "\n")

	// Find first ---
	firstDashIndex := -1
	for i, line := range lines {
		if strings.TrimSpace(line) == "---" {
			firstDashIndex = i
			break
		}
	}

	// If no first --- found, return entire content (pure YAML file)
	if firstDashIndex == -1 {
		return contentStr
	}

	// Find second ---
	secondDashIndex := -1
	for i := firstDashIndex + 1; i < len(lines); i++ {
		if strings.TrimSpace(lines[i]) == "---" {
			secondDashIndex = i
			break
		}
	}

	// If no second --- found, return entire content (for backward compatibility)
	if secondDashIndex == -1 {
		return contentStr
	}

	// Extract content between the two --- markers
	yamlLines := lines[firstDashIndex+1 : secondDashIndex]
	return strings.Join(yamlLines, "\n")
}

func (s *agentSkillsService) Create(ctx context.Context, in CreateAgentSkillsInput) (*model.AgentSkills, error) {
	// Open zip file
	zipFile, err := in.ZipFile.Open()
	if err != nil {
		return nil, fmt.Errorf("open zip file: %w", err)
	}
	defer zipFile.Close()

	// Read zip file content into memory (needed for zip.NewReader which requires io.ReaderAt)
	zipContent, err := io.ReadAll(zipFile)
	if err != nil {
		return nil, fmt.Errorf("read zip file: %w", err)
	}

	// Create bytes.Reader which implements io.ReaderAt
	zipReaderAt := bytes.NewReader(zipContent)

	// Open zip archive
	zipReader, err := zip.NewReader(zipReaderAt, int64(len(zipContent)))
	if err != nil {
		return nil, fmt.Errorf("open zip archive: %w", err)
	}

	// Parse SKILL.md to extract name and description (required)
	var skillName string
	var skillDescription string
	var skillMetadataFound bool
	for _, file := range zipReader.File {
		// Skip directories
		if file.FileInfo().IsDir() {
			continue
		}
		// Check if file is SKILL.md (case-insensitive)
		fileName := filepath.Base(file.Name)
		if strings.EqualFold(fileName, "SKILL.md") {
			fileReader, err := file.Open()
			if err != nil {
				return nil, fmt.Errorf("open SKILL.md: %w", err)
			}
			fileContent, err := io.ReadAll(fileReader)
			fileReader.Close()
			if err != nil {
				return nil, fmt.Errorf("read SKILL.md: %w", err)
			}
			// Extract YAML front matter (content between --- markers)
			yamlContent := extractYAMLFrontMatter(fileContent)
			if yamlContent == "" {
				return nil, errors.New("SKILL.md must contain YAML front matter (between --- markers)")
			}
			// Parse YAML
			var metadata SkillMetadata
			if err := yaml.Unmarshal([]byte(yamlContent), &metadata); err != nil {
				return nil, fmt.Errorf("parse SKILL.md YAML: %w", err)
			}
			skillName = metadata.Name
			skillDescription = metadata.Description
			skillMetadataFound = true
			break
		}
	}

	// SKILL.md is required
	if !skillMetadataFound {
		return nil, errors.New("SKILL.md file is required in the zip package (case-insensitive)")
	}

	// Validate name and description are not empty
	if skillName == "" {
		return nil, errors.New("name is required in SKILL.md")
	}
	if skillDescription == "" {
		return nil, errors.New("description is required in SKILL.md")
	}

	// Check if name already exists in project, if so, delete the existing one (override)
	existing, err := s.r.GetByName(ctx, in.ProjectID, skillName)
	if err == nil && existing != nil {
		// Delete existing agent_skills (this will also delete S3 files)
		if err := s.Delete(ctx, in.ProjectID, existing.ID); err != nil {
			return nil, fmt.Errorf("delete existing agent_skills: %w", err)
		}
	}

	// Generate temporary UUID for S3 key (will be used as DB ID later)
	tempID := uuid.New()

	// Sanitize skillName for S3 key (replace spaces and special chars with hyphens)
	sanitizedName := strings.ReplaceAll(skillName, " ", "-")
	sanitizedName = strings.ReplaceAll(sanitizedName, "/", "-")
	sanitizedName = strings.ReplaceAll(sanitizedName, "\\", "-")
	// Remove any other potentially problematic characters for S3 keys
	sanitizedName = strings.ReplaceAll(sanitizedName, ":", "-")
	sanitizedName = strings.ReplaceAll(sanitizedName, "*", "-")
	sanitizedName = strings.ReplaceAll(sanitizedName, "?", "-")
	sanitizedName = strings.ReplaceAll(sanitizedName, "\"", "-")
	sanitizedName = strings.ReplaceAll(sanitizedName, "<", "-")
	sanitizedName = strings.ReplaceAll(sanitizedName, ">", "-")
	sanitizedName = strings.ReplaceAll(sanitizedName, "|", "-")

	// Base S3 key prefix: agent_skills/{project_id}/{agent_skills_id}/{skillName}
	// skillName is included in the path, so FileIndex doesn't need to repeat it
	baseS3Key := fmt.Sprintf("agent_skills/%s/%s/%s", in.ProjectID.String(), tempID.String(), sanitizedName)

	// Detect the root directory prefix in zip package (regardless of its name)
	// The outer directory name doesn't matter - skillName from SKILL.md will be used as S3 root
	// Example: zip has "random-name/SKILL.md", skillName is "pdf"
	// -> S3 path: agent_skills/{project_id}/{id}/pdf/SKILL.md
	// -> FileIndex stores "SKILL.md" (not "random-name/SKILL.md")
	var rootPrefix string
	var fileNames []string
	for _, file := range zipReader.File {
		if file.FileInfo().IsDir() {
			continue
		}
		// Skip macOS-specific files when detecting root prefix
		// __MACOSX is parallel to the main structure, not nested inside
		if strings.Contains(file.Name, "__MACOSX/") ||
			strings.Contains(file.Name, "__MACOSX\\") ||
			strings.HasPrefix(filepath.Base(file.Name), "._") ||
			filepath.Base(file.Name) == ".DS_Store" {
			continue
		}
		fileNames = append(fileNames, file.Name)
	}

	// Find common root prefix (the outermost directory only, name doesn't matter)
	// We always strip the outermost directory and use skillName as S3 root
	// Example: zip has "random-name/SKILL.md", skillName is "pdf"
	// -> Strip "random-name/", use skillName "pdf" in baseS3Key
	// -> Final S3 path: agent_skills/{project_id}/{id}/pdf/SKILL.md
	// Example: zip has "pdf/subdir/file.txt", skillName is "pdf"
	// -> Strip "pdf/", use skillName "pdf" in baseS3Key
	// -> Final S3 path: agent_skills/{project_id}/{id}/pdf/subdir/file.txt
	if len(fileNames) > 0 {
		// Extract the outermost directory (first path segment) from the first file
		// Split by "/" and take the first non-empty segment
		firstFile := fileNames[0]
		parts := strings.Split(firstFile, "/")
		if len(parts) > 1 && parts[0] != "" {
			outermostDir := parts[0]
			// Check if all files are under this outermost directory
			allUnderSameRoot := true
			for _, fileName := range fileNames {
				fileParts := strings.Split(fileName, "/")
				if len(fileParts) == 0 || fileParts[0] != outermostDir {
					allUnderSameRoot = false
					break
				}
			}
			// Strip the outermost directory prefix regardless of its name
			// skillName will be used as the root directory in S3
			if allUnderSameRoot {
				rootPrefix = outermostDir + "/"
			}
		}
	}

	// Process zip files and upload to S3 first
	fileIndex := make([]model.FileInfo, 0)
	var baseBucket string

	for _, file := range zipReader.File {
		// Skip directories
		if file.FileInfo().IsDir() {
			continue
		}

		// Skip macOS-specific files and directories
		// __MACOSX contains macOS metadata (resource forks, extended attributes)
		// ._* files are resource fork files
		// .DS_Store is macOS Finder metadata
		// These are parallel to the main structure, not nested inside
		if strings.Contains(file.Name, "__MACOSX/") ||
			strings.Contains(file.Name, "__MACOSX\\") ||
			strings.HasPrefix(filepath.Base(file.Name), "._") ||
			filepath.Base(file.Name) == ".DS_Store" {
			continue
		}

		// Read file content
		fileReader, err := file.Open()
		if err != nil {
			return nil, fmt.Errorf("open file in zip: %w", err)
		}

		fileContent, err := io.ReadAll(fileReader)
		fileReader.Close()
		if err != nil {
			return nil, fmt.Errorf("read file in zip: %w", err)
		}

		// Detect MIME type from file content, with extension-based refinement for text files
		contentType := mime.DetectMimeType(fileContent, file.Name)

		// Upload to S3: baseS3Key/{relativePath}
		// Strip the zip package's outer directory and use skillName as root
		// Example: zip has "random-name/SKILL.md", skillName is "pdf"
		// S3 path: agent_skills/{project_id}/{id}/pdf/SKILL.md
		relativePath := file.Name
		if rootPrefix != "" && strings.HasPrefix(file.Name, rootPrefix) {
			relativePath = strings.TrimPrefix(file.Name, rootPrefix)
		}
		fullS3Key := fmt.Sprintf("%s/%s", baseS3Key, relativePath)
		asset, err := s.s3.UploadFileDirect(ctx, fullS3Key, fileContent, contentType)
		if err != nil {
			return nil, fmt.Errorf("upload file to S3: %w", err)
		}

		// Store bucket from first file (all files use same bucket)
		if baseBucket == "" {
			baseBucket = asset.Bucket
		}

		// Add to file index: relative path and MIME type from skillName root
		// Example: if zip has "random-name/SKILL.md", FileIndex stores {"path": "SKILL.md", "mime": "text/markdown"}
		fileIndex = append(fileIndex, model.FileInfo{
			Path: relativePath,
			MIME: contentType,
		})
	}

	// Create base AssetMeta pointing to the base directory
	// Note: We create a placeholder Asset for the base directory
	// The S3Key points to the base directory, but we don't actually upload a file there
	baseAsset := &model.Asset{
		Bucket: baseBucket,
		S3Key:  baseS3Key,
		ETag:   "", // No ETag for directory
		SHA256: "", // No SHA256 for directory
		MIME:   "", // No MIME for directory
		SizeB:  0,  // No size for directory
	}

	// After S3 upload succeeds, create database record with the same UUID
	agentSkills := &model.AgentSkills{
		ID:          tempID, // Use the same UUID as S3 key
		ProjectID:   in.ProjectID,
		Name:        skillName,
		Description: skillDescription,
		Meta:        in.Meta,
		AssetMeta:   datatypes.NewJSONType(*baseAsset),
		FileIndex:   datatypes.NewJSONType(fileIndex),
	}

	if err := s.r.Create(ctx, agentSkills); err != nil {
		// If DB creation fails, S3 files are already uploaded
		// They can be cleaned up later or retried
		return nil, fmt.Errorf("create agent_skills record: %w", err)
	}

	return agentSkills, nil
}

func (s *agentSkillsService) GetByID(ctx context.Context, projectID uuid.UUID, id uuid.UUID) (*model.AgentSkills, error) {
	return s.r.GetByID(ctx, projectID, id)
}

func (s *agentSkillsService) GetByName(ctx context.Context, projectID uuid.UUID, name string) (*model.AgentSkills, error) {
	return s.r.GetByName(ctx, projectID, name)
}

type UpdateAgentSkillsInput struct {
	ProjectID   uuid.UUID
	ID          uuid.UUID
	Name        *string
	Description *string
	Meta        map[string]interface{}
}

func (s *agentSkillsService) Update(ctx context.Context, in UpdateAgentSkillsInput) (*model.AgentSkills, error) {
	// Get existing record
	agentSkills, err := s.r.GetByID(ctx, in.ProjectID, in.ID)
	if err != nil {
		return nil, err
	}

	// Update fields if provided
	if in.Name != nil {
		// Check if new name conflicts with existing name
		if *in.Name != agentSkills.Name {
			existing, err := s.r.GetByName(ctx, in.ProjectID, *in.Name)
			if err == nil && existing != nil && existing.ID != in.ID {
				return nil, fmt.Errorf("agent_skills with name '%s' already exists in project", *in.Name)
			}
		}
		agentSkills.Name = *in.Name
	}

	if in.Description != nil {
		agentSkills.Description = *in.Description
	}

	if in.Meta != nil {
		agentSkills.Meta = in.Meta
	}

	if err := s.r.Update(ctx, agentSkills); err != nil {
		return nil, fmt.Errorf("update agent_skills: %w", err)
	}

	return agentSkills, nil
}

func (s *agentSkillsService) Delete(ctx context.Context, projectID uuid.UUID, id uuid.UUID) error {
	return s.r.Delete(ctx, projectID, id)
}

type ListAgentSkillsInput struct {
	ProjectID uuid.UUID
	Limit     int
	Cursor    string
	TimeDesc  bool
}

type ListAgentSkillsOutput struct {
	Items      []*model.AgentSkills `json:"items"`
	NextCursor string               `json:"next_cursor,omitempty"`
	HasMore    bool                 `json:"has_more"`
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
	agentSkills, err := s.r.ListWithCursor(ctx, in.ProjectID, afterT, afterID, in.Limit+1, in.TimeDesc)
	if err != nil {
		return nil, err
	}

	out := &ListAgentSkillsOutput{
		Items:   agentSkills,
		HasMore: false,
	}
	if len(agentSkills) > in.Limit {
		out.HasMore = true
		out.Items = agentSkills[:in.Limit]
		last := out.Items[len(out.Items)-1]
		out.NextCursor = paging.EncodeCursor(last.CreatedAt, last.ID)
	}

	return out, nil
}

func (s *agentSkillsService) GetPresignedURL(ctx context.Context, agentSkills *model.AgentSkills, filePath string, expire time.Duration) (string, error) {
	if agentSkills == nil {
		return "", errors.New("agent_skills is nil")
	}

	// Find file in file index
	fileIndex := agentSkills.FileIndex.Data()
	var found bool
	for _, fileInfo := range fileIndex {
		if fileInfo.Path == filePath {
			found = true
			break
		}
	}
	if !found {
		return "", fmt.Errorf("file path '%s' not found in agent_skills", filePath)
	}

	// Get full S3 key by combining base AssetMeta S3Key with relative path
	fullS3Key := agentSkills.GetFileS3Key(filePath)
	return s.s3.PresignGet(ctx, fullS3Key, expire)
}
