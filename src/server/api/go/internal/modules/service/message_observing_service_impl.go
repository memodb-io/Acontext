package service

import (
	"context"
	"fmt"

	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/repo"
)

// messageObservingServiceImpl implements MessageObservingService
type messageObservingServiceImpl struct {
	repo repo.MessageObservingRepo
}

// NewMessageObservingService creates a new message observing service
func NewMessageObservingService(repo repo.MessageObservingRepo) MessageObservingService {
	if repo == nil {
		panic("message observing repository cannot be nil")
	}
	return &messageObservingServiceImpl{repo: repo}
}

// GetSessionObservingStatus retrieves observing status for a specific session
func (s *messageObservingServiceImpl) GetSessionObservingStatus(
	ctx context.Context,
	sessionID string,
) (*model.MessageObservingStatus, error) {

	// Validate session ID
	if sessionID == "" {
		return nil, fmt.Errorf("session ID is required")
	}

	// Validate context
	if ctx == nil {
		return nil, fmt.Errorf("context cannot be nil")
	}

	// Call repository
	status, err := s.repo.GetObservingStatus(ctx, sessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get session observing status: %w", err)
	}

	// Validate returned status
	if status == nil {
		return nil, fmt.Errorf("repository returned nil status")
	}

	// Optional: Additional business logic could go here
	// For example: logging, metrics, caching, etc.

	return status, nil
}
