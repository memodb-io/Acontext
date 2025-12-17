package repo

import (
	"context"

	"github.com/memodb-io/Acontext/internal/modules/model"
)

// MessageObservingRepo defines the contract for message observing operations
type MessageObservingRepo interface {
	// GetObservingStatus returns the count of messages by status for a session
	GetObservingStatus(ctx context.Context, sessionID string) (*model.MessageObservingStatus, error)
}
