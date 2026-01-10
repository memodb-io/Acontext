package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"time"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/infra/blob"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/repo"
	"github.com/memodb-io/Acontext/internal/pkg/utils/fileparser"
	"gorm.io/datatypes"
)

type ArtifactService interface {
	Create(ctx context.Context, in CreateArtifactInput) (*model.Artifact, error)
	DeleteByPath(ctx context.Context, projectID uuid.UUID, diskID uuid.UUID, path string, filename string) error
	GetByPath(ctx context.Context, diskID uuid.UUID, path string, filename string) (*model.Artifact, error)
	GetPresignedURL(ctx context.Context, artifact *model.Artifact, expire time.Duration) (string, error)
	GetFileContent(ctx context.Context, artifact *model.Artifact) (*fileparser.FileContent, error)
	UpdateArtifactMetaByPath(ctx context.Context, diskID uuid.UUID, path string, filename string, userMeta map[string]interface{}) (*model.Artifact, error)
	ListByPath(ctx context.Context, diskID uuid.UUID, path string) ([]*model.Artifact, error)
	GetAllPaths(ctx context.Context, diskID uuid.UUID) ([]string, error)
	GrepArtifacts(ctx context.Context, projectID uuid.UUID, diskID uuid.UUID, pattern string, limit int) ([]*model.Artifact, error)
	GlobArtifacts(ctx context.Context, projectID uuid.UUID, diskID uuid.UUID, pattern string, limit int) ([]*model.Artifact, error)
}

type artifactService struct {
	r  repo.ArtifactRepo
	s3 *blob.S3Deps
}

func NewArtifactService(r repo.ArtifactRepo, s3 *blob.S3Deps) ArtifactService {
	return &artifactService{r: r, s3: s3}
}

type CreateArtifactInput struct {
	ProjectID  uuid.UUID
	DiskID     uuid.UUID
	Path       string
	Filename   string
	FileHeader *multipart.FileHeader
	UserMeta   map[string]interface{}
}

func (s *artifactService) Create(ctx context.Context, in CreateArtifactInput) (*model.Artifact, error) {
	// Check if artifact with same path and filename already exists in the same disk
	exists, err := s.r.ExistsByPathAndFilename(ctx, in.DiskID, in.Path, in.Filename, nil)
	if err != nil {
		return nil, fmt.Errorf("check artifact existence: %w", err)
	}
	if exists {
		if err := s.r.DeleteByPath(ctx, in.ProjectID, in.DiskID, in.Path, in.Filename); err != nil {
			return nil, fmt.Errorf("upsert existing artifact: %w", err)
		}
	}

	asset, err := s.s3.UploadFormFile(ctx, "disks/"+in.ProjectID.String(), in.FileHeader)
	if err != nil {
		return nil, fmt.Errorf("upload file to S3: %w", err)
	}

	// Extract and store text content for text-searchable files
	// This enables grep search functionality
	parser := fileparser.NewFileParser()
	var textContent string
	if parser.CanParseFile(in.FileHeader.Filename, asset.MIME) {
		// Read file content to extract text
		file, err := in.FileHeader.Open()
		if err == nil {
			content, readErr := io.ReadAll(file)
			file.Close()
			if readErr == nil {
				fileContent, parseErr := parser.ParseFile(in.FileHeader.Filename, asset.MIME, content)
				if parseErr == nil && fileContent != nil {
					textContent = fileContent.Raw
				}
			}
		}
	}
	asset.Content = textContent

	// Build artifact metadata
	meta := map[string]interface{}{
		model.ArtifactInfoKey: map[string]interface{}{
			"path":     in.Path,
			"filename": in.FileHeader.Filename,
			"mime":     asset.MIME,
			"size":     asset.SizeB,
		},
	}
	for k, v := range in.UserMeta {
		meta[k] = v
	}

	artifact := &model.Artifact{
		DiskID:    in.DiskID,
		Path:      in.Path,
		Filename:  in.Filename,
		Meta:      meta,
		AssetMeta: datatypes.NewJSONType(*asset),
	}

	if err := s.r.Create(ctx, in.ProjectID, artifact); err != nil {
		return nil, fmt.Errorf("create artifact record: %w", err)
	}

	return artifact, nil
}

func (s *artifactService) DeleteByPath(ctx context.Context, projectID uuid.UUID, diskID uuid.UUID, path string, filename string) error {
	if path == "" || filename == "" {
		return errors.New("path and filename are required")
	}
	return s.r.DeleteByPath(ctx, projectID, diskID, path, filename)
}

func (s *artifactService) GetByPath(ctx context.Context, diskID uuid.UUID, path string, filename string) (*model.Artifact, error) {
	if path == "" || filename == "" {
		return nil, errors.New("path and filename are required")
	}
	return s.r.GetByPath(ctx, diskID, path, filename)
}

func (s *artifactService) GetPresignedURL(ctx context.Context, artifact *model.Artifact, expire time.Duration) (string, error) {
	if artifact == nil {
		return "", errors.New("artifact is nil")
	}

	assetData := artifact.AssetMeta.Data()
	if assetData.S3Key == "" {
		return "", errors.New("artifact has no S3 key")
	}

	return s.s3.PresignGet(ctx, assetData.S3Key, expire)
}

func (s *artifactService) GetFileContent(ctx context.Context, artifact *model.Artifact) (*fileparser.FileContent, error) {
	if artifact == nil {
		return nil, errors.New("artifact is nil")
	}

	assetData := artifact.AssetMeta.Data()
	if assetData.S3Key == "" {
		return nil, errors.New("artifact has no S3 key")
	}

	// Check if file type is parsable before downloading
	parser := fileparser.NewFileParser()
	if !parser.CanParseFile(artifact.Filename, assetData.MIME) {
		return nil, fmt.Errorf("unsupported file type: %s (mime: %s)", artifact.Filename, assetData.MIME)
	}

	// Download file content from S3
	content, err := s.s3.DownloadFile(ctx, assetData.S3Key)
	if err != nil {
		return nil, fmt.Errorf("failed to download file content: %w", err)
	}

	// Parse file content
	fileContent, err := parser.ParseFile(artifact.Filename, assetData.MIME, content)
	if err != nil {
		return nil, fmt.Errorf("failed to parse file content: %w", err)
	}

	return fileContent, nil
}

func (s *artifactService) UpdateArtifactMetaByPath(ctx context.Context, diskID uuid.UUID, path string, filename string, userMeta map[string]interface{}) (*model.Artifact, error) {
	// Get existing artifact
	artifact, err := s.GetByPath(ctx, diskID, path, filename)
	if err != nil {
		return nil, err
	}

	// Validate that user meta doesn't contain system reserved keys
	reservedKeys := model.Artifact{}.GetReservedKeys()
	for _, reservedKey := range reservedKeys {
		if _, exists := userMeta[reservedKey]; exists {
			return nil, fmt.Errorf("reserved key '%s' is not allowed in user meta", reservedKey)
		}
	}

	// Get current system meta
	systemMeta, ok := artifact.Meta[model.ArtifactInfoKey].(map[string]interface{})
	if !ok {
		systemMeta = make(map[string]interface{})
	}

	// Create new meta combining system meta and user meta
	newMeta := make(map[string]interface{})
	newMeta[model.ArtifactInfoKey] = systemMeta
	for k, v := range userMeta {
		newMeta[k] = v
	}

	// Update artifact meta
	artifact.Meta = newMeta

	if err := s.r.Update(ctx, artifact); err != nil {
		return nil, fmt.Errorf("update artifact meta: %w", err)
	}

	return artifact, nil
}

func (s *artifactService) ListByPath(ctx context.Context, diskID uuid.UUID, path string) ([]*model.Artifact, error) {
	return s.r.ListByPath(ctx, diskID, path)
}

func (s *artifactService) GetAllPaths(ctx context.Context, diskID uuid.UUID) ([]string, error) {
	return s.r.GetAllPaths(ctx, diskID)
}

func (s *artifactService) GrepArtifacts(ctx context.Context, projectID uuid.UUID, diskID uuid.UUID, pattern string, limit int) ([]*model.Artifact, error) {
	// Set default limit if not provided
	if limit <= 0 {
		limit = 100
	}
	// Cap at 1000 results
	if limit > 1000 {
		limit = 1000
	}

	return s.r.GrepArtifacts(ctx, diskID, pattern, limit)
}

func (s *artifactService) GlobArtifacts(ctx context.Context, projectID uuid.UUID, diskID uuid.UUID, pattern string, limit int) ([]*model.Artifact, error) {
	// Set default limit if not provided
	if limit <= 0 {
		limit = 100
	}
	// Cap at 1000 results
	if limit > 1000 {
		limit = 1000
	}

	return s.r.GlobArtifacts(ctx, diskID, pattern, limit)
}
