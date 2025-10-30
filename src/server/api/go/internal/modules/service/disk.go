package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/infra/blob"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/repo"
)

type DiskService interface {
	Create(ctx context.Context, projectID uuid.UUID) (*model.Disk, error)
	Delete(ctx context.Context, projectID uuid.UUID, diskID uuid.UUID) error
	List(ctx context.Context, projectID uuid.UUID) ([]*model.Disk, error)
}

type diskService struct {
	r  repo.DiskRepo
	s3 *blob.S3Deps
}

func NewDiskService(r repo.DiskRepo, s3 *blob.S3Deps) DiskService {
	return &diskService{r: r, s3: s3}
}

func (s *diskService) Create(ctx context.Context, projectID uuid.UUID) (*model.Disk, error) {
	disk := &model.Disk{
		ProjectID: projectID,
	}

	if err := s.r.Create(ctx, disk); err != nil {
		return nil, fmt.Errorf("create disk record: %w", err)
	}

	return disk, nil
}

func (s *diskService) Delete(ctx context.Context, projectID uuid.UUID, diskID uuid.UUID) error {
	if len(diskID) == 0 {
		return errors.New("disk id is empty")
	}
	return s.r.Delete(ctx, projectID, diskID)
}

func (s *diskService) List(ctx context.Context, projectID uuid.UUID) ([]*model.Disk, error) {
	return s.r.List(ctx, projectID)
}
