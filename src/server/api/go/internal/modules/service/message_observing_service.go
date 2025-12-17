package service

import (
	"context"

	"github.com/memodb-io/Acontext/internal/modules/model"
)

// MessageObservingService handles business logic for message observing status
type MessageObservingService interface {
	// GetSessionObservingStatus retrieves observing status for a specific session
	GetSessionObservingStatus(ctx context.Context, sessionID string) (*model.MessageObservingStatus, error)
}
