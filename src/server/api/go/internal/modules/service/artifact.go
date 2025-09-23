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

type ArtifactService interface {
	Create(ctx context.Context, projectID uuid.UUID) (*model.Artifact, error)
	Delete(ctx context.Context, projectID uuid.UUID, artifactID uuid.UUID) error
}

type artifactService struct {
	r  repo.ArtifactRepo
	s3 *blob.S3Deps
}

func NewArtifactService(r repo.ArtifactRepo, s3 *blob.S3Deps) ArtifactService {
	return &artifactService{r: r, s3: s3}
}

func (s *artifactService) Create(ctx context.Context, projectID uuid.UUID) (*model.Artifact, error) {
	artifact := &model.Artifact{
		ID:        uuid.New(),
		ProjectID: projectID,
	}

	if err := s.r.Create(ctx, artifact); err != nil {
		return nil, fmt.Errorf("create artifact record: %w", err)
	}

	return artifact, nil
}

func (s *artifactService) Delete(ctx context.Context, projectID uuid.UUID, artifactID uuid.UUID) error {
	if len(artifactID) == 0 {
		return errors.New("artifact id is empty")
	}
	return s.r.Delete(ctx, projectID, artifactID)
}
