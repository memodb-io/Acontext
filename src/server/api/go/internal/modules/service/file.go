package service

import (
	"context"
	"errors"
	"fmt"
	"mime/multipart"
	"time"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/infra/blob"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/repo"
	"gorm.io/datatypes"
)

// FileMetadata centrally manages file-related metadata
type FileMetadata struct {
	Path     string `json:"path"`
	Filename string `json:"filename"`
	MIME     string `json:"mime"`
	SizeB    int64  `json:"size_b"`
	Bucket   string `json:"bucket"`
	S3Key    string `json:"s3_key"`
	ETag     string `json:"etag"`
	SHA256   string `json:"sha256"`
}

// ToAsset converts to Asset model
func (fm *FileMetadata) ToAsset() model.Asset {
	return model.Asset{
		Bucket: fm.Bucket,
		S3Key:  fm.S3Key,
		ETag:   fm.ETag,
		SHA256: fm.SHA256,
		MIME:   fm.MIME,
		SizeB:  fm.SizeB,
	}
}

// ToSystemMeta converts to system metadata
func (fm *FileMetadata) ToSystemMeta() map[string]interface{} {
	return map[string]interface{}{
		"path":     fm.Path,
		"filename": fm.Filename,
		"mime":     fm.MIME,
		"size":     fm.SizeB,
	}
}

// NewFileMetadataFromUpload creates FileMetadata from the uploaded file
func NewFileMetadataFromUpload(path string, fileHeader *multipart.FileHeader, uploadedMeta *blob.UploadedMeta) *FileMetadata {
	return &FileMetadata{
		Path:     path,
		Filename: fileHeader.Filename,
		MIME:     uploadedMeta.MIME,
		SizeB:    uploadedMeta.SizeB,
		Bucket:   uploadedMeta.Bucket,
		S3Key:    uploadedMeta.Key,
		ETag:     uploadedMeta.ETag,
		SHA256:   uploadedMeta.SHA256,
	}
}

type FileService interface {
	Create(ctx context.Context, artifactID uuid.UUID, path string, filename string, fileHeader *multipart.FileHeader, userMeta map[string]interface{}) (*model.File, error)
	Delete(ctx context.Context, artifactID uuid.UUID, fileID uuid.UUID) error
	DeleteByPath(ctx context.Context, artifactID uuid.UUID, path string, filename string) error
	GetByID(ctx context.Context, artifactID uuid.UUID, fileID uuid.UUID) (*model.File, error)
	GetByPath(ctx context.Context, artifactID uuid.UUID, path string, filename string) (*model.File, error)
	GetPresignedURL(ctx context.Context, artifactID uuid.UUID, fileID uuid.UUID, expire time.Duration) (string, error)
	GetPresignedURLByPath(ctx context.Context, artifactID uuid.UUID, path string, filename string, expire time.Duration) (string, error)
	UpdateFile(ctx context.Context, artifactID uuid.UUID, fileID uuid.UUID, fileHeader *multipart.FileHeader, newPath *string, newFilename *string) (*model.File, error)
	UpdateFileByPath(ctx context.Context, artifactID uuid.UUID, path string, filename string, fileHeader *multipart.FileHeader, newPath *string, newFilename *string) (*model.File, error)
	ListByPath(ctx context.Context, artifactID uuid.UUID, path string) ([]*model.File, error)
	GetAllPaths(ctx context.Context, artifactID uuid.UUID) ([]string, error)
	GetByArtifactID(ctx context.Context, artifactID uuid.UUID) ([]*model.File, error)
}

type fileService struct {
	r  repo.FileRepo
	s3 *blob.S3Deps
}

func NewFileService(r repo.FileRepo, s3 *blob.S3Deps) FileService {
	return &fileService{r: r, s3: s3}
}

func (s *fileService) Create(ctx context.Context, artifactID uuid.UUID, path string, filename string, fileHeader *multipart.FileHeader, userMeta map[string]interface{}) (*model.File, error) {
	// Check if file with same path and filename already exists in the same artifact
	exists, err := s.r.ExistsByPathAndFilename(ctx, artifactID, path, filename, nil)
	if err != nil {
		return nil, fmt.Errorf("check file existence: %w", err)
	}
	if exists {
		return nil, fmt.Errorf("file '%s' already exists in path '%s'", filename, path)
	}

	// Generate S3 key
	s3Key := fmt.Sprintf("artifacts/%s/%s", artifactID.String(), filename)

	uploadedMeta, err := s.s3.UploadFormFile(ctx, s3Key, fileHeader)
	if err != nil {
		return nil, fmt.Errorf("upload file to S3: %w", err)
	}

	fileMeta := NewFileMetadataFromUpload(path, fileHeader, uploadedMeta)

	// Create file record with separated metadata
	meta := map[string]interface{}{
		model.FileInfoKey: fileMeta.ToSystemMeta(),
	}

	for k, v := range userMeta {
		meta[k] = v
	}

	file := &model.File{
		ID:         uuid.New(),
		ArtifactID: artifactID,
		Path:       path,
		Filename:   filename,
		Meta:       meta,
		AssetMeta:  datatypes.NewJSONType(fileMeta.ToAsset()),
	}

	if err := s.r.Create(ctx, file); err != nil {
		return nil, fmt.Errorf("create file record: %w", err)
	}

	return file, nil
}

func (s *fileService) Delete(ctx context.Context, artifactID uuid.UUID, fileID uuid.UUID) error {
	if len(fileID) == 0 {
		return errors.New("file id is empty")
	}
	return s.r.Delete(ctx, artifactID, fileID)
}

func (s *fileService) DeleteByPath(ctx context.Context, artifactID uuid.UUID, path string, filename string) error {
	if path == "" || filename == "" {
		return errors.New("path and filename are required")
	}
	return s.r.DeleteByPath(ctx, artifactID, path, filename)
}

func (s *fileService) GetByID(ctx context.Context, artifactID uuid.UUID, fileID uuid.UUID) (*model.File, error) {
	if len(fileID) == 0 {
		return nil, errors.New("file id is empty")
	}
	return s.r.GetByID(ctx, artifactID, fileID)
}

func (s *fileService) GetByPath(ctx context.Context, artifactID uuid.UUID, path string, filename string) (*model.File, error) {
	if path == "" || filename == "" {
		return nil, errors.New("path and filename are required")
	}
	return s.r.GetByPath(ctx, artifactID, path, filename)
}

func (s *fileService) GetPresignedURL(ctx context.Context, artifactID uuid.UUID, fileID uuid.UUID, expire time.Duration) (string, error) {
	file, err := s.GetByID(ctx, artifactID, fileID)
	if err != nil {
		return "", err
	}

	assetData := file.AssetMeta.Data()
	if assetData.S3Key == "" {
		return "", errors.New("file has no S3 key")
	}

	return s.s3.PresignGet(ctx, assetData.S3Key, expire)
}

func (s *fileService) GetPresignedURLByPath(ctx context.Context, artifactID uuid.UUID, path string, filename string, expire time.Duration) (string, error) {
	file, err := s.GetByPath(ctx, artifactID, path, filename)
	if err != nil {
		return "", err
	}

	assetData := file.AssetMeta.Data()
	if assetData.S3Key == "" {
		return "", errors.New("file has no S3 key")
	}

	return s.s3.PresignGet(ctx, assetData.S3Key, expire)
}

func (s *fileService) UpdateFile(ctx context.Context, artifactID uuid.UUID, fileID uuid.UUID, fileHeader *multipart.FileHeader, newPath *string, newFilename *string) (*model.File, error) {
	// Get existing file
	file, err := s.GetByID(ctx, artifactID, fileID)
	if err != nil {
		return nil, err
	}

	// Determine the target path and filename
	var path, filename string
	if newPath != nil && *newPath != "" {
		path = *newPath
	} else {
		path = file.Path
	}

	if newFilename != nil && *newFilename != "" {
		filename = *newFilename
	} else {
		filename = file.Filename
	}

	// Check if file with same path and filename already exists for another file in the same artifact
	exists, err := s.r.ExistsByPathAndFilename(ctx, artifactID, path, filename, &fileID)
	if err != nil {
		return nil, fmt.Errorf("check file existence: %w", err)
	}
	if exists {
		return nil, fmt.Errorf("file '%s' already exists in path '%s'", filename, path)
	}

	// Generate new S3 key
	s3Key := fmt.Sprintf("artifacts/%s/%s", artifactID.String(), filename)

	uploadedMeta, err := s.s3.UploadFormFile(ctx, s3Key, fileHeader)
	if err != nil {
		return nil, fmt.Errorf("upload file to S3: %w", err)
	}

	fileMeta := NewFileMetadataFromUpload(path, fileHeader, uploadedMeta)

	// Update file record
	file.Path = path
	file.Filename = filename
	file.AssetMeta = datatypes.NewJSONType(fileMeta.ToAsset())

	// Update system meta with new file info
	systemMeta, ok := file.Meta[model.FileInfoKey].(map[string]interface{})
	if !ok {
		systemMeta = make(map[string]interface{})
		file.Meta[model.FileInfoKey] = systemMeta
	}

	// Update system metadata
	for k, v := range fileMeta.ToSystemMeta() {
		systemMeta[k] = v
	}

	if err := s.r.Update(ctx, file); err != nil {
		return nil, fmt.Errorf("update file record: %w", err)
	}

	return file, nil
}

func (s *fileService) UpdateFileByPath(ctx context.Context, artifactID uuid.UUID, path string, filename string, fileHeader *multipart.FileHeader, newPath *string, newFilename *string) (*model.File, error) {
	// Get existing file
	file, err := s.GetByPath(ctx, artifactID, path, filename)
	if err != nil {
		return nil, err
	}

	// Determine the target path and filename
	var targetPath, targetFilename string
	if newPath != nil && *newPath != "" {
		targetPath = *newPath
	} else {
		targetPath = file.Path
	}

	if newFilename != nil && *newFilename != "" {
		targetFilename = *newFilename
	} else {
		targetFilename = file.Filename
	}

	// Check if file with same path and filename already exists for another file in the same artifact
	exists, err := s.r.ExistsByPathAndFilename(ctx, artifactID, targetPath, targetFilename, &file.ID)
	if err != nil {
		return nil, fmt.Errorf("check file existence: %w", err)
	}
	if exists {
		return nil, fmt.Errorf("file '%s' already exists in path '%s'", targetFilename, targetPath)
	}

	// Generate new S3 key
	s3Key := fmt.Sprintf("artifacts/%s/%s", artifactID.String(), targetFilename)

	uploadedMeta, err := s.s3.UploadFormFile(ctx, s3Key, fileHeader)
	if err != nil {
		return nil, fmt.Errorf("upload file to S3: %w", err)
	}

	fileMeta := NewFileMetadataFromUpload(targetPath, fileHeader, uploadedMeta)

	// Update file record
	file.Path = targetPath
	file.Filename = targetFilename
	file.AssetMeta = datatypes.NewJSONType(fileMeta.ToAsset())

	// Update system meta with new file info
	systemMeta, ok := file.Meta[model.FileInfoKey].(map[string]interface{})
	if !ok {
		systemMeta = make(map[string]interface{})
		file.Meta[model.FileInfoKey] = systemMeta
	}

	// Update system metadata
	for k, v := range fileMeta.ToSystemMeta() {
		systemMeta[k] = v
	}

	if err := s.r.Update(ctx, file); err != nil {
		return nil, fmt.Errorf("update file record: %w", err)
	}

	return file, nil
}

func (s *fileService) ListByPath(ctx context.Context, artifactID uuid.UUID, path string) ([]*model.File, error) {
	return s.r.ListByPath(ctx, artifactID, path)
}

func (s *fileService) GetAllPaths(ctx context.Context, artifactID uuid.UUID) ([]string, error) {
	return s.r.GetAllPaths(ctx, artifactID)
}

func (s *fileService) GetByArtifactID(ctx context.Context, artifactID uuid.UUID) ([]*model.File, error) {
	return s.r.GetByArtifactID(ctx, artifactID)
}
