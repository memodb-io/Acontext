package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/config"
	mq "github.com/memodb-io/Acontext/internal/infra/queue"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/repo"
	"github.com/memodb-io/Acontext/internal/pkg/paging"
	"go.uber.org/zap"
)

type SpaceService interface {
	Create(ctx context.Context, m *model.Space) error
	Delete(ctx context.Context, projectID uuid.UUID, spaceID uuid.UUID) error
	UpdateByID(ctx context.Context, m *model.Space) error
	GetByID(ctx context.Context, m *model.Space) (*model.Space, error)
	List(ctx context.Context, in ListSpacesInput) (*ListSpacesOutput, error)
	ListExperienceConfirmations(ctx context.Context, in ListExperienceConfirmationsInput) (*ListExperienceConfirmationsOutput, error)
	ConfirmExperience(ctx context.Context, spaceID uuid.UUID, experienceID uuid.UUID, save bool) (*model.ExperienceConfirmation, error)
}

type spaceService struct {
	r         repo.SpaceRepo
	publisher *mq.Publisher
	cfg       *config.Config
	log       *zap.Logger
}

func NewSpaceService(r repo.SpaceRepo, publisher *mq.Publisher, cfg *config.Config, log *zap.Logger) SpaceService {
	return &spaceService{
		r:         r,
		publisher: publisher,
		cfg:       cfg,
		log:       log,
	}
}

func (s *spaceService) Create(ctx context.Context, m *model.Space) error {
	return s.r.Create(ctx, m)
}

func (s *spaceService) Delete(ctx context.Context, projectID uuid.UUID, spaceID uuid.UUID) error {
	if len(spaceID) == 0 {
		return errors.New("space id is empty")
	}
	return s.r.Delete(ctx, &model.Space{ID: spaceID, ProjectID: projectID})
}

func (s *spaceService) UpdateByID(ctx context.Context, m *model.Space) error {
	if len(m.ID) == 0 {
		return errors.New("space id is empty")
	}
	return s.r.Update(ctx, m)
}

func (s *spaceService) GetByID(ctx context.Context, m *model.Space) (*model.Space, error) {
	if len(m.ID) == 0 {
		return nil, errors.New("space id is empty")
	}
	return s.r.Get(ctx, m)
}

type ListSpacesInput struct {
	ProjectID uuid.UUID `json:"project_id"`
	Limit     int       `json:"limit"`
	Cursor    string    `json:"cursor"`
	TimeDesc  bool      `json:"time_desc"`
}

type ListSpacesOutput struct {
	Items      []model.Space `json:"items"`
	NextCursor string        `json:"next_cursor,omitempty"`
	HasMore    bool          `json:"has_more"`
}

func (s *spaceService) List(ctx context.Context, in ListSpacesInput) (*ListSpacesOutput, error) {
	// Parse cursor (createdAt, id); an empty cursor indicates starting from the latest
	var afterT time.Time
	var afterID uuid.UUID
	var err error
	if in.Cursor != "" {
		afterT, afterID, err = paging.DecodeCursor(in.Cursor)
		if err != nil {
			return nil, err
		}
	}

	// Query limit+1 is used to determine has_more
	spaces, err := s.r.ListWithCursor(ctx, in.ProjectID, afterT, afterID, in.Limit+1, in.TimeDesc)
	if err != nil {
		return nil, err
	}

	out := &ListSpacesOutput{
		Items:   spaces,
		HasMore: false,
	}
	if len(spaces) > in.Limit {
		out.HasMore = true
		out.Items = spaces[:in.Limit]
		last := out.Items[len(out.Items)-1]
		out.NextCursor = paging.EncodeCursor(last.CreatedAt, last.ID)
	}

	return out, nil
}

type ListExperienceConfirmationsInput struct {
	SpaceID  uuid.UUID `json:"space_id"`
	Limit    int       `json:"limit"`
	Cursor   string    `json:"cursor"`
	TimeDesc bool      `json:"time_desc"`
}

type ListExperienceConfirmationsOutput struct {
	Items      []model.ExperienceConfirmation `json:"items"`
	NextCursor string                         `json:"next_cursor,omitempty"`
	HasMore    bool                           `json:"has_more"`
}

func (s *spaceService) ListExperienceConfirmations(ctx context.Context, in ListExperienceConfirmationsInput) (*ListExperienceConfirmationsOutput, error) {
	// Parse cursor (createdAt, id); an empty cursor indicates starting from the latest
	var afterT time.Time
	var afterID uuid.UUID
	var err error
	if in.Cursor != "" {
		afterT, afterID, err = paging.DecodeCursor(in.Cursor)
		if err != nil {
			return nil, err
		}
	}

	// Query limit+1 is used to determine has_more
	confirmations, err := s.r.ListExperienceConfirmationsWithCursor(ctx, in.SpaceID, afterT, afterID, in.Limit+1, in.TimeDesc)
	if err != nil {
		return nil, err
	}

	out := &ListExperienceConfirmationsOutput{
		Items:   confirmations,
		HasMore: false,
	}
	if len(confirmations) > in.Limit {
		out.HasMore = true
		out.Items = confirmations[:in.Limit]
		last := out.Items[len(out.Items)-1]
		out.NextCursor = paging.EncodeCursor(last.CreatedAt, last.ID)
	}

	return out, nil
}

func (s *spaceService) ConfirmExperience(ctx context.Context, spaceID uuid.UUID, experienceID uuid.UUID, save bool) (*model.ExperienceConfirmation, error) {
	if save {
		// Get the data from this row first
		confirmation, err := s.r.GetExperienceConfirmation(ctx, spaceID, experienceID)
		if err != nil {
			return nil, err
		}

		// Parse experience_data to check type
		experienceData := confirmation.ExperienceData
		if expType, ok := experienceData["type"].(string); ok && expType == "sop" {
			// Get space to retrieve project_id
			space, err := s.r.Get(ctx, &model.Space{ID: spaceID})
			if err != nil {
				return nil, fmt.Errorf("failed to get space: %w", err)
			}

			// Extract data field
			dataField, ok := experienceData["data"]
			if !ok {
				return nil, errors.New("experience_data missing 'data' field")
			}

			// Create SOPComplete message
			taskID := uuid.Nil
			if confirmation.TaskID != nil {
				taskID = *confirmation.TaskID
			}
			sopComplete := map[string]interface{}{
				"project_id": space.ProjectID,
				"space_id":   spaceID,
				"task_id":    taskID,
				"sop_data":   dataField,
			}

			// Publish to MQ
			if s.publisher != nil {
				exchangeName := "space.task"
				routingKey := "space.task.sop.complete"

				if err := s.publisher.PublishJSON(ctx, exchangeName, routingKey, sopComplete); err != nil {
					s.log.Error("failed to publish SOPComplete message", zap.Error(err))
					return nil, fmt.Errorf("failed to publish message: %w", err)
				}
			}
		}

		// Delete the row
		if err := s.r.DeleteExperienceConfirmation(ctx, spaceID, experienceID); err != nil {
			return nil, err
		}

		return confirmation, nil
	} else {
		// Just delete the row
		if err := s.r.DeleteExperienceConfirmation(ctx, spaceID, experienceID); err != nil {
			return nil, err
		}
		return nil, nil
	}
}
