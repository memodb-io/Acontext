package repo

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"gorm.io/gorm"
)

// Fixed bounds
const (
	maxQueryTimeout = 30 * time.Second
)

// messageObservingRepoImpl implements MessageObservingRepo
type messageObservingRepoImpl struct {
	db *gorm.DB
}

// NewMessageObservingRepo creates a new message observing repository
// Assertion on input
func NewMessageObservingRepo(db *gorm.DB) MessageObservingRepo {
	if db == nil {
		panic("database connection cannot be nil")
	}
	return &messageObservingRepoImpl{db: db}
}

// GetObservingStatus returns the count of messages by status for a session
func (r *messageObservingRepoImpl) GetObservingStatus(
	ctx context.Context,
	sessionID string,
) (*model.MessageObservingStatus, error) {

	// Validate input
	if sessionID == "" {
		return nil, fmt.Errorf("session ID cannot be empty")
	}

	// Parse UUID
	sessionUUID, err := uuid.Parse(sessionID)
	if err != nil {
		return nil, fmt.Errorf("invalid session ID format: %w", err)
	}

	// Fixed timeout bound
	ctx, cancel := context.WithTimeout(ctx, maxQueryTimeout)
	defer cancel()

	// Query result structure
	var result struct {
		Observed  int64
		InProcess int64
		Pending   int64
	}

	// Query messages table using existing session_task_process_status field
	// Map values: success will be observed, running will be in_process, pending will be pending
	err = r.db.WithContext(ctx).
		Model(&model.Message{}).
		Select(`
			COALESCE(SUM(CASE WHEN session_task_process_status = 'success' THEN 1 ELSE 0 END), 0) as observed,
			COALESCE(SUM(CASE WHEN session_task_process_status = 'running' THEN 1 ELSE 0 END), 0) as in_process,
			COALESCE(SUM(CASE WHEN session_task_process_status = 'pending' THEN 1 ELSE 0 END), 0) as pending
		`).
		Where("session_id = ?", sessionUUID).
		Scan(&result).Error

	// Check for errors
	if err != nil {
		return nil, fmt.Errorf("failed to get observing status: %w", err)
	}

	status := &model.MessageObservingStatus{
		Observed:  int(result.Observed),
		InProcess: int(result.InProcess),
		Pending:   int(result.Pending),
		UpdatedAt: time.Now(),
	}

	// Validate result (defensive programming)
	if status.Observed < 0 || status.InProcess < 0 || status.Pending < 0 {
		return nil, fmt.Errorf("invalid status counts: negative values not allowed")
	}

	return status, nil
}
