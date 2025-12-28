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
	ProjectID   uuid.UUID
	Name        string
	Description string
	ZipFile     *multipart.FileHeader
	Meta        map[string]interface{}
}

func (s *agentSkillsService) Create(ctx context.Context, in CreateAgentSkillsInput) (*model.AgentSkills, error) {
	// Validate name is not empty
	if in.Name == "" {
		return nil, errors.New("name is required")
	}

	// Check if name already exists in project
	existing, err := s.r.GetByName(ctx, in.ProjectID, in.Name)
	if err == nil && existing != nil {
		return nil, fmt.Errorf("agent_skills with name '%s' already exists in project", in.Name)
	}

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

	// Create agent_skills record first to get ID
	agentSkills := &model.AgentSkills{
		ProjectID:   in.ProjectID,
		Name:        in.Name,
		Description: in.Description,
		Meta:        in.Meta,
		FileIndex:   datatypes.NewJSONType([]string{}),
	}

	if err := s.r.Create(ctx, agentSkills); err != nil {
		return nil, fmt.Errorf("create agent_skills record: %w", err)
	}

	// Base S3 key prefix for extracted files
	baseS3Key := fmt.Sprintf("agent_skills/%s/%s/extracted", in.ProjectID.String(), agentSkills.ID.String())

	// Process zip files
	fileIndex := make([]string, 0)
	var baseBucket string

	for _, file := range zipReader.File {
		// Skip directories
		if file.FileInfo().IsDir() {
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

		// Determine content type
		contentType := "application/octet-stream"
		if ext := filepath.Ext(file.Name); ext != "" {
			switch strings.ToLower(ext) {
			case ".json":
				contentType = "application/json"
			case ".txt":
				contentType = "text/plain"
			case ".md":
				contentType = "text/markdown"
			}
		}

		// Upload to S3 with exact path structure
		fullS3Key := fmt.Sprintf("%s/%s", baseS3Key, file.Name)
		asset, err := s.s3.UploadFileDirect(ctx, fullS3Key, fileContent, contentType)
		if err != nil {
			return nil, fmt.Errorf("upload file to S3: %w", err)
		}

		// Store bucket from first file (all files use same bucket)
		if baseBucket == "" {
			baseBucket = asset.Bucket
		}

		// Add to file index (relative path)
		fileIndex = append(fileIndex, file.Name)
	}

	// Create base AssetMeta pointing to the extracted/ directory
	// Note: We create a placeholder Asset for the base directory
	// The S3Key points to the extracted/ directory, but we don't actually upload a file there
	baseAsset := &model.Asset{
		Bucket: baseBucket,
		S3Key:  baseS3Key,
		ETag:   "", // No ETag for directory
		SHA256: "", // No SHA256 for directory
		MIME:   "", // No MIME for directory
		SizeB:  0,  // No size for directory
	}

	// Update agent_skills with AssetMeta and FileIndex
	agentSkills.AssetMeta = datatypes.NewJSONType(*baseAsset)
	agentSkills.FileIndex = datatypes.NewJSONType(fileIndex)
	if err := s.r.Update(ctx, agentSkills); err != nil {
		return nil, fmt.Errorf("update agent_skills with AssetMeta and FileIndex: %w", err)
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
	for _, path := range fileIndex {
		if path == filePath {
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
