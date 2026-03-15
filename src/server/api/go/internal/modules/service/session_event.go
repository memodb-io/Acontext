package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/repo"
	"github.com/memodb-io/Acontext/internal/pkg/paging"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type SessionEventService interface {
	AddEvent(ctx context.Context, in AddEventInput) (*model.SessionEvent, error)
	ListEvents(ctx context.Context, in ListEventsInput) (*ListEventsOutput, error)
}

type AddEventInput struct {
	ProjectID uuid.UUID
	SessionID uuid.UUID
	Type      string
	Data      json.RawMessage
}

type ListEventsInput struct {
	ProjectID uuid.UUID
	SessionID uuid.UUID
	Limit     int
	Cursor    string
	TimeDesc  bool
}

type ListEventsOutput struct {
	Items      []model.SessionEvent `json:"items"`
	NextCursor string               `json:"next_cursor,omitempty"`
	HasMore    bool                 `json:"has_more"`
}

type sessionEventService struct {
	sessionRepo      repo.SessionRepo
	sessionEventRepo repo.SessionEventRepo
}

func NewSessionEventService(sessionRepo repo.SessionRepo, sessionEventRepo repo.SessionEventRepo) SessionEventService {
	return &sessionEventService{
		sessionRepo:      sessionRepo,
		sessionEventRepo: sessionEventRepo,
	}
}

func (s *sessionEventService) AddEvent(ctx context.Context, in AddEventInput) (*model.SessionEvent, error) {
	// Validate type
	if in.Type == "" {
		return nil, fmt.Errorf("type is required")
	}

	// Validate data is a valid JSON object
	if in.Data == nil {
		return nil, fmt.Errorf("data is required")
	}
	var dataObj map[string]interface{}
	if err := json.Unmarshal(in.Data, &dataObj); err != nil {
		return nil, fmt.Errorf("data must be a valid JSON object")
	}

	// Verify session exists and belongs to project
	session, err := s.sessionRepo.Get(ctx, &model.Session{ID: in.SessionID})
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("session not found")
		}
		return nil, fmt.Errorf("failed to get session: %w", err)
	}
	if session.ProjectID != in.ProjectID {
		return nil, fmt.Errorf("session not found")
	}

	event := &model.SessionEvent{
		SessionID: in.SessionID,
		ProjectID: in.ProjectID,
		Type:      in.Type,
		Data:      datatypes.JSON(in.Data),
	}

	if err := s.sessionEventRepo.Create(ctx, event); err != nil {
		return nil, fmt.Errorf("failed to create event: %w", err)
	}

	return event, nil
}

func (s *sessionEventService) ListEvents(ctx context.Context, in ListEventsInput) (*ListEventsOutput, error) {
	session, err := s.sessionRepo.Get(ctx, &model.Session{ID: in.SessionID})
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("session not found")
		}
		return nil, fmt.Errorf("failed to get session: %w", err)
	}
	if session.ProjectID != in.ProjectID {
		return nil, fmt.Errorf("session not found")
	}

	var afterT time.Time
	var afterID uuid.UUID
	if in.Cursor != "" {
		afterT, afterID, err = paging.DecodeCursor(in.Cursor)
		if err != nil {
			return nil, err
		}
	}

	events, err := s.sessionEventRepo.ListBySessionWithCursor(ctx, in.SessionID, afterT, afterID, in.Limit+1, in.TimeDesc)
	if err != nil {
		return nil, err
	}

	out := &ListEventsOutput{
		Items:   events,
		HasMore: false,
	}
	if len(events) > in.Limit {
		out.HasMore = true
		out.Items = events[:in.Limit]
		last := out.Items[len(out.Items)-1]
		out.NextCursor = paging.EncodeCursor(last.CreatedAt, last.ID)
	}

	return out, nil
}
