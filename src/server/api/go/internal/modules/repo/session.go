package repo

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/infra/blob"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"go.uber.org/zap"
	"gorm.io/datatypes"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	// MaxForkableMessages is the maximum number of messages allowed for synchronous fork
	MaxForkableMessages = 5000
)

// ErrSessionTooLarge is returned when a session exceeds MaxForkableMessages.
var ErrSessionTooLarge = errors.New("session exceeds maximum forkable size")

type SessionRepo interface {
	Create(ctx context.Context, s *model.Session) error
	Delete(ctx context.Context, projectID uuid.UUID, sessionID uuid.UUID) error
	Update(ctx context.Context, s *model.Session) error
	Get(ctx context.Context, s *model.Session) (*model.Session, error)
	GetDisableTaskTracking(ctx context.Context, sessionID uuid.UUID) (bool, error)
	ListWithCursor(ctx context.Context, projectID uuid.UUID, userIdentifier string, filterByConfigs map[string]interface{}, afterCreatedAt time.Time, afterID uuid.UUID, limit int, timeDesc bool) ([]model.Session, error)
	CreateMessageWithAssets(ctx context.Context, msg *model.Message) error
	ListBySessionWithCursor(ctx context.Context, sessionID uuid.UUID, afterCreatedAt time.Time, afterID uuid.UUID, limit int, timeDesc bool) ([]model.Message, error)
	ListAllMessagesBySession(ctx context.Context, sessionID uuid.UUID) ([]model.Message, error)
	GetObservingStatus(ctx context.Context, sessionID string) (*model.MessageObservingStatus, error)
	PopGeminiCallIDAndName(ctx context.Context, sessionID uuid.UUID) (string, string, error)
	GetMessageByID(ctx context.Context, sessionID uuid.UUID, messageID uuid.UUID) (*model.Message, error)
	UpdateMessageMeta(ctx context.Context, messageID uuid.UUID, meta datatypes.JSONType[map[string]interface{}]) error
	ForkSession(ctx context.Context, sessionID uuid.UUID) (*ForkSessionResult, error)
}

// ForkSessionResult contains the result of a fork operation
type ForkSessionResult struct {
	OldSessionID uuid.UUID
	NewSessionID uuid.UUID
}

type sessionRepo struct {
	db                 *gorm.DB
	assetReferenceRepo AssetReferenceRepo
	s3                 *blob.S3Deps
	log                *zap.Logger
}

func NewSessionRepo(db *gorm.DB, assetReferenceRepo AssetReferenceRepo, s3 *blob.S3Deps, log *zap.Logger) SessionRepo {
	return &sessionRepo{
		db:                 db,
		assetReferenceRepo: assetReferenceRepo,
		s3:                 s3,
		log:                log,
	}
}

func (r *sessionRepo) Create(ctx context.Context, s *model.Session) error {
	return r.db.WithContext(ctx).Create(s).Error
}

func (r *sessionRepo) Delete(ctx context.Context, projectID uuid.UUID, sessionID uuid.UUID) error {
	// Use transaction to ensure atomicity: query messages, delete session, and decrement asset references
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Verify session exists and belongs to project
		var session model.Session
		if err := tx.Where("id = ? AND project_id = ?", sessionID, projectID).First(&session).Error; err != nil {
			return err
		}

		// Query all messages in transaction before deletion
		var messages []model.Message
		if err := tx.Where("session_id = ?", sessionID).Find(&messages).Error; err != nil {
			return fmt.Errorf("query messages: %w", err)
		}

		// Collect all assets from messages
		assets := make([]model.Asset, 0)
		for _, msg := range messages {
			// Extract PartsAssetMeta (the asset that stores the parts JSON)
			partsAssetMeta := msg.PartsAssetMeta.Data()
			if partsAssetMeta.SHA256 != "" {
				assets = append(assets, partsAssetMeta)
			}

			// Download and parse parts to extract assets from individual parts
			if r.s3 != nil && partsAssetMeta.S3Key != "" {
				parts := []model.Part{}
				if err := r.s3.DownloadJSON(ctx, partsAssetMeta.S3Key, &parts); err != nil {
					// Log error but continue with other messages
					r.log.Warn("failed to download parts", zap.Error(err), zap.String("s3_key", partsAssetMeta.S3Key))
					continue
				}

				// Extract assets from parts
				for _, part := range parts {
					if part.Asset != nil && part.Asset.SHA256 != "" {
						assets = append(assets, *part.Asset)
					}
				}
			}
		}

		// Delete the session (messages will be automatically deleted by CASCADE)
		if err := tx.Delete(&session).Error; err != nil {
			return fmt.Errorf("delete session: %w", err)
		}

		// Note: BatchDecrementAssetRefs uses its own DB connection and may involve S3 operations
		// The database operations within BatchDecrementAssetRefs will not be part of this transaction,
		// but the session and messages deletion will be atomic
		if len(assets) > 0 {
			if err := r.assetReferenceRepo.BatchDecrementAssetRefs(ctx, projectID, assets); err != nil {
				return fmt.Errorf("decrement asset references: %w", err)
			}
		}

		return nil
	})
}

func (r *sessionRepo) Update(ctx context.Context, s *model.Session) error {
	return r.db.WithContext(ctx).Where(&model.Session{ID: s.ID}).Updates(s).Error
}

func (r *sessionRepo) Get(ctx context.Context, s *model.Session) (*model.Session, error) {
	return s, r.db.WithContext(ctx).Where(&model.Session{ID: s.ID}).First(s).Error
}

func (r *sessionRepo) GetDisableTaskTracking(ctx context.Context, sessionID uuid.UUID) (bool, error) {
	var result struct {
		DisableTaskTracking bool
	}
	err := r.db.WithContext(ctx).Model(&model.Session{}).
		Select("disable_task_tracking").
		Where("id = ?", sessionID).
		First(&result).Error
	return result.DisableTaskTracking, err
}

func (r *sessionRepo) ListWithCursor(ctx context.Context, projectID uuid.UUID, userIdentifier string, filterByConfigs map[string]interface{}, afterCreatedAt time.Time, afterID uuid.UUID, limit int, timeDesc bool) ([]model.Session, error) {
	q := r.db.WithContext(ctx).Where("sessions.project_id = ?", projectID)

	// Filter by user identifier if provided
	if userIdentifier != "" {
		q = q.Joins("JOIN users ON users.id = sessions.user_id").
			Where("users.identifier = ?", userIdentifier)
	}

	// Apply configs filter if provided (non-nil and non-empty)
	// Uses PostgreSQL JSONB containment operator @> for efficient filtering
	if filterByConfigs != nil && len(filterByConfigs) > 0 {
		// CRITICAL: Use parameterized query to prevent SQL injection
		jsonBytes, err := json.Marshal(filterByConfigs)
		if err != nil {
			return nil, fmt.Errorf("marshal filter_by_configs: %w", err)
		}
		q = q.Where("sessions.configs @> ?", string(jsonBytes))
	}

	// Apply cursor-based pagination filter if cursor is provided
	if !afterCreatedAt.IsZero() && afterID != uuid.Nil {
		// Determine comparison operator based on sort direction
		comparisonOp := ">"
		if timeDesc {
			comparisonOp = "<"
		}
		q = q.Where(
			"(sessions.created_at "+comparisonOp+" ?) OR (sessions.created_at = ? AND sessions.id "+comparisonOp+" ?)",
			afterCreatedAt, afterCreatedAt, afterID,
		)
	}

	// Apply ordering based on sort direction
	orderBy := "sessions.created_at ASC, sessions.id ASC"
	if timeDesc {
		orderBy = "sessions.created_at DESC, sessions.id DESC"
	}

	var sessions []model.Session
	return sessions, q.Order(orderBy).Limit(limit).Find(&sessions).Error
}

func (r *sessionRepo) CreateMessageWithAssets(ctx context.Context, msg *model.Message) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// First get the message parent id in session
		parent := model.Message{}
		if err := tx.Where(&model.Message{SessionID: msg.SessionID}).Order("created_at desc").Limit(1).Find(&parent).Error; err == nil {
			if parent.ID != uuid.Nil {
				msg.ParentID = &parent.ID
			}
		}

		// Create message
		if err := tx.Create(msg).Error; err != nil {
			return err
		}

		return nil
	})
}

func (r *sessionRepo) ListBySessionWithCursor(ctx context.Context, sessionID uuid.UUID, afterCreatedAt time.Time, afterID uuid.UUID, limit int, timeDesc bool) ([]model.Message, error) {
	q := r.db.WithContext(ctx).Where("session_id = ?", sessionID)

	// Apply cursor-based pagination filter if cursor is provided
	if !afterCreatedAt.IsZero() && afterID != uuid.Nil {
		// Determine comparison operator based on sort direction
		comparisonOp := ">"
		if timeDesc {
			comparisonOp = "<"
		}
		q = q.Where(
			"(created_at "+comparisonOp+" ?) OR (created_at = ? AND id "+comparisonOp+" ?)",
			afterCreatedAt, afterCreatedAt, afterID,
		)
	}

	// Apply ordering based on sort direction
	orderBy := "created_at ASC, id ASC"
	if timeDesc {
		orderBy = "created_at DESC, id DESC"
	}

	var items []model.Message
	return items, q.Order(orderBy).Limit(limit).Find(&items).Error
}

func (r *sessionRepo) ListAllMessagesBySession(ctx context.Context, sessionID uuid.UUID) ([]model.Message, error) {
	var messages []model.Message
	err := r.db.WithContext(ctx).Where("session_id = ?", sessionID).Find(&messages).Error
	return messages, err
}

// GetObservingStatus returns the count of messages by status for a session
// Maps session_task_process_status values to observing status
func (r *sessionRepo) GetObservingStatus(
	ctx context.Context,
	sessionID string,
) (*model.MessageObservingStatus, error) {

	if sessionID == "" {
		return nil, fmt.Errorf("session ID cannot be empty")
	}

	sessionUUID, err := uuid.Parse(sessionID)
	if err != nil {
		return nil, fmt.Errorf("invalid session ID format: %w", err)
	}

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	var result struct {
		Observed  int64
		InProcess int64
		Pending   int64
	}

	err = r.db.WithContext(ctx).
		Model(&model.Message{}).
		Select(`
			COALESCE(SUM(CASE WHEN session_task_process_status = 'success' THEN 1 ELSE 0 END), 0) as observed,
			COALESCE(SUM(CASE WHEN session_task_process_status = 'running' THEN 1 ELSE 0 END), 0) as in_process,
			COALESCE(SUM(CASE WHEN session_task_process_status = 'pending' THEN 1 ELSE 0 END), 0) as pending
		`).
		Where("session_id = ?", sessionUUID).
		Scan(&result).Error

	if err != nil {
		return nil, fmt.Errorf("failed to get observing status: %w", err)
	}

	status := &model.MessageObservingStatus{
		Observed:  int(result.Observed),
		InProcess: int(result.InProcess),
		Pending:   int(result.Pending),
		UpdatedAt: time.Now(),
	}

	if status.Observed < 0 || status.InProcess < 0 || status.Pending < 0 {
		return nil, fmt.Errorf("invalid status counts: negative values not allowed")
	}

	return status, nil
}

// PopGeminiCallIDAndName pops the first call {id, name} pair from the earliest message in the session that has call info.
// Uses row-level locking to ensure thread safety. Returns the popped ID, name, or an error if none available.
// This method is used to match FunctionResponse with FunctionCall by name first, then handle ID validation/assignment.
func (r *sessionRepo) PopGeminiCallIDAndName(ctx context.Context, sessionID uuid.UUID) (string, string, error) {
	var poppedID string
	var poppedName string

	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Find the earliest message with call IDs, using row-level locking
		var msg model.Message
		keyPath := fmt.Sprintf("meta->>'%s'", model.GeminiCallInfoKey)
		arrayPath := fmt.Sprintf("meta->'%s'", model.GeminiCallInfoKey)

		err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("session_id = ?", sessionID).
			Where(keyPath + " IS NOT NULL").
			Where(fmt.Sprintf("jsonb_array_length(%s) > 0", arrayPath)).
			Order("created_at ASC, id ASC").
			Limit(1).
			First(&msg).Error

		if err != nil {
			if err == gorm.ErrRecordNotFound {
				return fmt.Errorf("no available Gemini call info in session")
			}
			return fmt.Errorf("failed to query message with call info: %w", err)
		}

		// Get current meta
		meta := msg.Meta.Data()
		if meta == nil {
			return fmt.Errorf("message meta is nil")
		}

		// Get the call info array (contains {id, name} objects)
		callsRaw, exists := meta[model.GeminiCallInfoKey]
		if !exists {
			return fmt.Errorf("call info key not found in message meta")
		}

		// Convert to []interface{} (array of {id, name} objects)
		callsInterface, ok := callsRaw.([]interface{})
		if !ok {
			// Try to unmarshal if it's a JSON string
			var calls []map[string]interface{}
			if callsBytes, err := json.Marshal(callsRaw); err == nil {
				if err := json.Unmarshal(callsBytes, &calls); err == nil {
					if len(calls) == 0 {
						return fmt.Errorf("call info array is empty")
					}
					// Pop first call
					firstCall := calls[0]
					if id, ok := firstCall["id"].(string); ok {
						poppedID = id
					} else {
						return fmt.Errorf("call ID is not a string")
					}
					if name, ok := firstCall["name"].(string); ok {
						poppedName = name
					} else {
						return fmt.Errorf("call name is not a string")
					}
					calls = calls[1:]

					// Update or delete the key
					if len(calls) == 0 {
						delete(meta, model.GeminiCallInfoKey)
					} else {
						meta[model.GeminiCallInfoKey] = calls
					}

					// Update the message
					return tx.Model(&msg).Update("meta", datatypes.NewJSONType(meta)).Error
				}
			}
			return fmt.Errorf("invalid call info format in message meta")
		}

		if len(callsInterface) == 0 {
			return fmt.Errorf("call info array is empty")
		}

		// Pop the first call object
		firstCallRaw, ok := callsInterface[0].(map[string]interface{})
		if !ok {
			return fmt.Errorf("call info is not an object")
		}

		// Extract ID and name
		if id, ok := firstCallRaw["id"].(string); ok {
			poppedID = id
		} else {
			return fmt.Errorf("call ID is not a string")
		}
		if name, ok := firstCallRaw["name"].(string); ok {
			poppedName = name
		} else {
			return fmt.Errorf("call name is not a string")
		}

		// Remove first element
		remainingCalls := callsInterface[1:]

		// Update or delete the key
		if len(remainingCalls) == 0 {
			delete(meta, model.GeminiCallInfoKey)
		} else {
			meta[model.GeminiCallInfoKey] = remainingCalls
		}

		// Update the message
		return tx.Model(&msg).Update("meta", datatypes.NewJSONType(meta)).Error
	})

	if err != nil {
		return "", "", err
	}

	return poppedID, poppedName, nil
}

// GetMessageByID retrieves a message by ID, verifying it belongs to the specified session.
// Returns gorm.ErrRecordNotFound if the message doesn't exist or doesn't belong to the session.
func (r *sessionRepo) GetMessageByID(ctx context.Context, sessionID uuid.UUID, messageID uuid.UUID) (*model.Message, error) {
	var msg model.Message
	err := r.db.WithContext(ctx).
		Where("id = ? AND session_id = ?", messageID, sessionID).
		First(&msg).Error
	if err != nil {
		return nil, err
	}
	return &msg, nil
}

// UpdateMessageMeta updates the meta field of a message.
func (r *sessionRepo) UpdateMessageMeta(ctx context.Context, messageID uuid.UUID, meta datatypes.JSONType[map[string]interface{}]) error {
	return r.db.WithContext(ctx).
		Model(&model.Message{}).
		Where("id = ?", messageID).
		Update("meta", meta).Error
}

// ForkSession creates a complete copy of a session with all its messages and tasks.
// Uses SELECT FOR UPDATE to lock the session during the fork operation.
// Returns ForkSessionResult containing old and new session IDs.
//
// The operation is split into two phases to keep the lock window small:
//  1. Transaction: lock session, create new session/messages/tasks, increment partsAsset refs.
//  2. Post-transaction: download S3 parts to discover per-part assets, increment those refs.
func (r *sessionRepo) ForkSession(ctx context.Context, sessionID uuid.UUID) (*ForkSessionResult, error) {
	var result ForkSessionResult
	result.OldSessionID = sessionID

	// partsAssets collects the parts-envelope assets; populated inside the transaction.
	var partsAssets []model.Asset
	var projectID uuid.UUID

	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Get original session with row-level lock to prevent concurrent modifications
		var originalSession model.Session
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ?", sessionID).
			First(&originalSession).Error; err != nil {
			return fmt.Errorf("failed to get session: %w", err)
		}
		projectID = originalSession.ProjectID

		// Get all messages from original session (ordered by created_at to preserve parent relationships)
		var originalMessages []model.Message
		if err := tx.Where("session_id = ?", sessionID).
			Order("created_at ASC, id ASC").
			Find(&originalMessages).Error; err != nil {
			return fmt.Errorf("failed to get messages: %w", err)
		}

		// Check session size limit (inside transaction after SELECT FOR UPDATE to prevent race conditions)
		if len(originalMessages) > MaxForkableMessages {
			return fmt.Errorf("%w (%d messages)", ErrSessionTooLarge, len(originalMessages))
		}

		// Create new session with copied configs
		newSession := model.Session{
			ProjectID:           originalSession.ProjectID,
			UserID:              originalSession.UserID,
			DisableTaskTracking: originalSession.DisableTaskTracking,
			Configs:             originalSession.Configs,
		}
		if err := tx.Create(&newSession).Error; err != nil {
			return fmt.Errorf("failed to create new session: %w", err)
		}
		result.NewSessionID = newSession.ID

		// Pre-assign new IDs so we can build the parent-ID mapping before inserting.
		oldToNewMessageID := make(map[uuid.UUID]uuid.UUID, len(originalMessages))
		for _, oldMsg := range originalMessages {
			oldToNewMessageID[oldMsg.ID] = uuid.New()
		}

		// Build the new messages slice with remapped parent IDs.
		newMessages := make([]model.Message, 0, len(originalMessages))
		for _, oldMsg := range originalMessages {
			newMsg := model.Message{
				ID:                       oldToNewMessageID[oldMsg.ID],
				SessionID:                newSession.ID,
				Role:                     oldMsg.Role,
				PartsAssetMeta:           oldMsg.PartsAssetMeta,
				Meta:                     oldMsg.Meta,
				SessionTaskProcessStatus: "pending",
				TaskID:                   nil,
			}

			if oldMsg.ParentID != nil {
				if newParentID, ok := oldToNewMessageID[*oldMsg.ParentID]; ok {
					newMsg.ParentID = &newParentID
				} else {
					r.log.Warn("message has parent_id not found in mapping",
						zap.String("message_id", oldMsg.ID.String()),
						zap.String("parent_id", oldMsg.ParentID.String()))
				}
			}

			newMessages = append(newMessages, newMsg)

			// Collect parts-envelope assets for reference counting.
			partsAsset := oldMsg.PartsAssetMeta.Data()
			if partsAsset.SHA256 != "" {
				partsAssets = append(partsAssets, partsAsset)
			}
		}

		// Batch insert all messages in one go instead of one INSERT per row.
		if len(newMessages) > 0 {
			if err := tx.CreateInBatches(newMessages, 100).Error; err != nil {
				return fmt.Errorf("failed to create messages: %w", err)
			}
		}

		// Copy tasks
		var originalTasks []model.Task
		if err := tx.Where("session_id = ?", sessionID).
			Order("\"order\" ASC").
			Find(&originalTasks).Error; err != nil {
			return fmt.Errorf("failed to get tasks: %w", err)
		}

		if len(originalTasks) > 0 {
			newTasks := make([]model.Task, 0, len(originalTasks))
			for _, oldTask := range originalTasks {
				newTasks = append(newTasks, model.Task{
					SessionID:  newSession.ID,
					ProjectID:  oldTask.ProjectID,
					Order:      oldTask.Order,
					Data:       oldTask.Data,
					Status:     oldTask.Status,
					IsPlanning: oldTask.IsPlanning,
				})
			}
			if err := tx.CreateInBatches(newTasks, 100).Error; err != nil {
				return fmt.Errorf("failed to create tasks: %w", err)
			}
		}

		// Increment refs for parts-envelope assets using tx so this is atomic
		// with the session/message creation above.
		if len(partsAssets) > 0 {
			txAssetRepo := NewAssetReferenceRepo(tx, r.s3)
			if err := txAssetRepo.BatchIncrementAssetRefs(ctx, projectID, partsAssets); err != nil {
				return fmt.Errorf("failed to increment asset references: %w", err)
			}
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	// Phase 2 (post-transaction): download S3 parts to discover per-part assets and
	// increment their refs. This is done outside the transaction to avoid holding the
	// session lock during N network round-trips.
	if r.s3 != nil && len(partsAssets) > 0 {
		var partLevelAssets []model.Asset
		for _, partsAsset := range partsAssets {
			if partsAsset.S3Key == "" {
				continue
			}
			parts := []model.Part{}
			if err := r.s3.DownloadJSON(ctx, partsAsset.S3Key, &parts); err != nil {
				r.log.Warn("failed to download parts for asset extraction",
					zap.Error(err), zap.String("s3_key", partsAsset.S3Key))
				continue
			}
			for _, part := range parts {
				if part.Asset != nil && part.Asset.SHA256 != "" {
					partLevelAssets = append(partLevelAssets, *part.Asset)
				}
			}
		}
		if len(partLevelAssets) > 0 {
			if err := r.assetReferenceRepo.BatchIncrementAssetRefs(ctx, projectID, partLevelAssets); err != nil {
				return nil, fmt.Errorf("failed to increment part-level asset references: %w", err)
			}
		}
	}

	return &result, nil
}
