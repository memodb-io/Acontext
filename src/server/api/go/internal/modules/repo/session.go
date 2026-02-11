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

// Custom error types for better error handling
var (
	ErrSessionNotFound   = errors.New("session not found")
	ErrSessionTooLarge   = errors.New("session too large to fork")
	ErrS3OperationFailed = errors.New("S3 operation failed")
)

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
	ForkSession(ctx context.Context, projectID uuid.UUID, sessionID uuid.UUID) (*model.ForkSessionOutput, error)
}

type sessionRepo struct {
	db                 *gorm.DB
	assetReferenceRepo AssetReferenceRepo
	s3                 *blob.S3Deps
	log                *zap.Logger
}

const (
	// Batch size for inserting messages
	messageBatchSize = 100
	// Fork size limits
	maxForkMessages = 5000
	maxForkAssets   = 1000
)

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

// ---------------------------------------------------------------------------
// Fork Session Implementation
// ---------------------------------------------------------------------------

// validateForkSize checks if the session size is within fork limits
func (r *sessionRepo) validateForkSize(ctx context.Context, sessionID uuid.UUID) error {
	// Count messages
	var messageCount int64
	if err := r.db.WithContext(ctx).Model(&model.Message{}).
		Where("session_id = ?", sessionID).Count(&messageCount).Error; err != nil {
		return fmt.Errorf("count messages: %w", err)
	}

	if messageCount > maxForkMessages {
		return fmt.Errorf("%w: %d messages (max %d)", ErrSessionTooLarge, messageCount, maxForkMessages)
	}

	// Count unique assets by fetching all messages and extracting assets
	var messages []model.Message
	if err := r.db.WithContext(ctx).
		Where("session_id = ?", sessionID).
		Find(&messages).Error; err != nil {
		return fmt.Errorf("fetch messages for asset count: %w", err)
	}

	// Use map to track unique assets
	uniqueAssets := make(map[string]bool)
	for _, msg := range messages {
		// Extract PartsAssetMeta
		partsAssetMeta := msg.PartsAssetMeta.Data()
		if partsAssetMeta.SHA256 != "" {
			uniqueAssets[partsAssetMeta.SHA256] = true
		}

		// Download and parse parts to extract assets from individual parts
		if r.s3 != nil && partsAssetMeta.S3Key != "" {
			parts := []model.Part{}
			if err := r.s3.DownloadJSON(ctx, partsAssetMeta.S3Key, &parts); err != nil {
				// Log error but continue
				r.log.Warn("failed to download parts for asset count",
					zap.Error(err),
					zap.String("s3_key", partsAssetMeta.S3Key))
				continue
			}

			for _, part := range parts {
				if part.Asset != nil && part.Asset.SHA256 != "" {
					uniqueAssets[part.Asset.SHA256] = true
				}
			}
		}
	}

	assetCount := len(uniqueAssets)
	if assetCount > maxForkAssets {
		return fmt.Errorf("%w: %d assets (max %d)", ErrSessionTooLarge, assetCount, maxForkAssets)
	}

	return nil
}

// copyMessagePartsS3 copies S3 parts files from old messages to new messages
func (r *sessionRepo) copyMessagePartsS3(ctx context.Context, projectID uuid.UUID, oldMessages []model.Message, messageIDMap map[uuid.UUID]uuid.UUID) error {
	if r.s3 == nil {
		return fmt.Errorf("S3 client not configured")
	}

	for _, oldMsg := range oldMessages {
		newMsgID, ok := messageIDMap[oldMsg.ID]
		if !ok {
			continue
		}

		partsAssetMeta := oldMsg.PartsAssetMeta.Data()
		if partsAssetMeta.S3Key == "" {
			continue
		}

		// Construct new S3 key for the forked message
		newS3Key := fmt.Sprintf("parts/%s/%s.json", projectID.String(), newMsgID.String())

		// Use S3 CopyObject (server-side copy, no download)
		if err := r.s3.CopyObject(ctx, partsAssetMeta.S3Key, newS3Key); err != nil {
			return fmt.Errorf("%w: copy S3 parts %s -> %s: %w", ErrS3OperationFailed, partsAssetMeta.S3Key, newS3Key, err)
		}

		r.log.Debug("copied S3 parts",
			zap.String("old_key", partsAssetMeta.S3Key),
			zap.String("new_key", newS3Key))
	}

	return nil
}

// MessageTaskMapping stores the task_id for each message during copy
type MessageTaskMapping struct {
	oldMessageID uuid.UUID
	newMessageID uuid.UUID
	oldTaskID    *uuid.UUID
}

// copyMessages copies messages with ID mapping and parent relationship preservation
// Returns: messageIDMap, oldMessages, messageTaskMappings, error
func (r *sessionRepo) copyMessages(ctx context.Context, tx *gorm.DB, oldSessionID uuid.UUID, newSessionID uuid.UUID, projectID uuid.UUID) (map[uuid.UUID]uuid.UUID, []model.Message, []MessageTaskMapping, error) {
	// Fetch all messages ordered by created_at
	var oldMessages []model.Message
	if err := tx.Where("session_id = ?", oldSessionID).
		Order("created_at ASC, id ASC").
		Find(&oldMessages).Error; err != nil {
		return nil, nil, nil, fmt.Errorf("fetch messages: %w", err)
	}

	if len(oldMessages) == 0 {
		return make(map[uuid.UUID]uuid.UUID), []model.Message{}, []MessageTaskMapping{}, nil
	}

	// Build old->new message ID map and track task associations
	messageIDMap := make(map[uuid.UUID]uuid.UUID)
	messageTaskMappings := make([]MessageTaskMapping, 0, len(oldMessages))

	for _, oldMsg := range oldMessages {
		newMsgID := uuid.New()
		messageIDMap[oldMsg.ID] = newMsgID

		// Track task_id for later mapping
		messageTaskMappings = append(messageTaskMappings, MessageTaskMapping{
			oldMessageID: oldMsg.ID,
			newMessageID: newMsgID,
			oldTaskID:    oldMsg.TaskID,
		})
	}

	// Prepare new messages with mapped IDs
	newMessages := make([]model.Message, 0, len(oldMessages))
	for _, oldMsg := range oldMessages {
		newMsg := model.Message{
			ID:                       messageIDMap[oldMsg.ID],
			SessionID:                newSessionID,
			Role:                     oldMsg.Role,
			Meta:                     oldMsg.Meta,
			SessionTaskProcessStatus: oldMsg.SessionTaskProcessStatus,
			PartsAssetMeta:           oldMsg.PartsAssetMeta,
			TaskID:                   nil, // Will be updated after tasks are copied
			CreatedAt:                time.Now(),
			UpdatedAt:                time.Now(),
		}

		// Map parent_id if exists
		if oldMsg.ParentID != nil {
			if newParentID, ok := messageIDMap[*oldMsg.ParentID]; ok {
				newMsg.ParentID = &newParentID
			}
		}

		// Update PartsAssetMeta with new S3 key
		partsAssetMeta := newMsg.PartsAssetMeta.Data()
		if partsAssetMeta.S3Key != "" {
			partsAssetMeta.S3Key = fmt.Sprintf("parts/%s/%s.json", projectID.String(), newMsg.ID.String())
			newMsg.PartsAssetMeta = datatypes.NewJSONType(partsAssetMeta)
		}

		newMessages = append(newMessages, newMsg)
	}

	// Batch insert messages to avoid parameter limits
	for i := 0; i < len(newMessages); i += messageBatchSize {
		end := i + messageBatchSize
		if end > len(newMessages) {
			end = len(newMessages)
		}
		batch := newMessages[i:end]

		if err := tx.Create(&batch).Error; err != nil {
			return nil, nil, nil, fmt.Errorf("insert message batch: %w", err)
		}
	}

	return messageIDMap, oldMessages, messageTaskMappings, nil
}

// copyMessagesWithIDMap copies messages using a pre-generated ID map (for use with S3 copy done before transaction)
// Returns: messageCount, messageTaskMappings, error
func (r *sessionRepo) copyMessagesWithIDMap(ctx context.Context, tx *gorm.DB, oldSessionID uuid.UUID, newSessionID uuid.UUID, projectID uuid.UUID, messageIDMap map[uuid.UUID]uuid.UUID) (int, []MessageTaskMapping, error) {
	// Fetch all messages ordered by created_at
	var oldMessages []model.Message
	if err := tx.Where("session_id = ?", oldSessionID).
		Order("created_at ASC, id ASC").
		Find(&oldMessages).Error; err != nil {
		return 0, nil, fmt.Errorf("fetch messages: %w", err)
	}

	if len(oldMessages) == 0 {
		return 0, []MessageTaskMapping{}, nil
	}

	// Track task associations
	messageTaskMappings := make([]MessageTaskMapping, 0, len(oldMessages))
	for _, oldMsg := range oldMessages {
		messageTaskMappings = append(messageTaskMappings, MessageTaskMapping{
			oldMessageID: oldMsg.ID,
			newMessageID: messageIDMap[oldMsg.ID],
			oldTaskID:    oldMsg.TaskID,
		})
	}

	// Prepare new messages with mapped IDs
	newMessages := make([]model.Message, 0, len(oldMessages))
	for _, oldMsg := range oldMessages {
		newMsg := model.Message{
			ID:                       messageIDMap[oldMsg.ID],
			SessionID:                newSessionID,
			Role:                     oldMsg.Role,
			Meta:                     oldMsg.Meta,
			SessionTaskProcessStatus: oldMsg.SessionTaskProcessStatus,
			PartsAssetMeta:           oldMsg.PartsAssetMeta,
			TaskID:                   nil, // Will be updated after tasks are copied
			CreatedAt:                time.Now(),
			UpdatedAt:                time.Now(),
		}

		// Map parent_id if exists
		if oldMsg.ParentID != nil {
			if newParentID, ok := messageIDMap[*oldMsg.ParentID]; ok {
				newMsg.ParentID = &newParentID
			}
		}

		// Update PartsAssetMeta with new S3 key
		partsAssetMeta := newMsg.PartsAssetMeta.Data()
		if partsAssetMeta.S3Key != "" {
			partsAssetMeta.S3Key = fmt.Sprintf("parts/%s/%s.json", projectID.String(), newMsg.ID.String())
			newMsg.PartsAssetMeta = datatypes.NewJSONType(partsAssetMeta)
		}

		newMessages = append(newMessages, newMsg)
	}

	// Batch insert messages to avoid parameter limits
	for i := 0; i < len(newMessages); i += messageBatchSize {
		end := i + messageBatchSize
		if end > len(newMessages) {
			end = len(newMessages)
		}
		batch := newMessages[i:end]

		if err := tx.Create(&batch).Error; err != nil {
			return 0, nil, fmt.Errorf("insert message batch: %w", err)
		}
	}

	return len(oldMessages), messageTaskMappings, nil
}

// copyTasks copies tasks with ID mapping and updates message references
func (r *sessionRepo) copyTasks(ctx context.Context, tx *gorm.DB, oldSessionID uuid.UUID, newSessionID uuid.UUID, projectID uuid.UUID, messageTaskMappings []MessageTaskMapping) (int, error) {
	// Fetch all tasks ordered by order
	var oldTasks []model.Task
	if err := tx.Where("session_id = ?", oldSessionID).
		Order("\"order\" ASC").
		Find(&oldTasks).Error; err != nil {
		return 0, fmt.Errorf("fetch tasks: %w", err)
	}

	if len(oldTasks) == 0 {
		return 0, nil
	}

	// Build old->new task ID map
	taskIDMap := make(map[uuid.UUID]uuid.UUID)
	for _, oldTask := range oldTasks {
		taskIDMap[oldTask.ID] = uuid.New()
	}

	// Create new tasks
	newTasks := make([]model.Task, 0, len(oldTasks))
	for _, oldTask := range oldTasks {
		newTask := model.Task{
			ID:         taskIDMap[oldTask.ID],
			SessionID:  newSessionID,
			ProjectID:  projectID,
			Order:      oldTask.Order,
			Data:       oldTask.Data,
			Status:     oldTask.Status,
			IsPlanning: oldTask.IsPlanning,
			CreatedAt:  time.Now(),
			UpdatedAt:  time.Now(),
		}
		newTasks = append(newTasks, newTask)
	}

	// Insert tasks
	if err := tx.Create(&newTasks).Error; err != nil {
		return 0, fmt.Errorf("insert tasks: %w", err)
	}

	// Update message.task_id references using the tracked mappings
	for _, mapping := range messageTaskMappings {
		if mapping.oldTaskID != nil {
			if newTaskID, ok := taskIDMap[*mapping.oldTaskID]; ok {
				if err := tx.Model(&model.Message{}).
					Where("id = ?", mapping.newMessageID).
					Update("task_id", newTaskID).Error; err != nil {
					return 0, fmt.Errorf("update message task_id: %w", err)
				}
			}
		}
	}

	return len(newTasks), nil
}

// incrementAssetRefsForMessages extracts and increments asset references
func (r *sessionRepo) incrementAssetRefsForMessages(ctx context.Context, projectID uuid.UUID, messages []model.Message) (int, error) {
	// Extract all assets from messages
	assets := make([]model.Asset, 0)
	for _, msg := range messages {
		// Extract PartsAssetMeta
		partsAssetMeta := msg.PartsAssetMeta.Data()
		if partsAssetMeta.SHA256 != "" {
			assets = append(assets, partsAssetMeta)
		}

		// Download and parse parts to extract assets from individual parts
		if r.s3 != nil && partsAssetMeta.S3Key != "" {
			parts := []model.Part{}
			if err := r.s3.DownloadJSON(ctx, partsAssetMeta.S3Key, &parts); err != nil {
				r.log.Warn("failed to download parts for asset increment",
					zap.Error(err),
					zap.String("s3_key", partsAssetMeta.S3Key))
				continue
			}

			for _, part := range parts {
				if part.Asset != nil && part.Asset.SHA256 != "" {
					assets = append(assets, *part.Asset)
				}
			}
		}
	}

	if len(assets) == 0 {
		return 0, nil
	}

	// Batch increment asset references
	if err := r.assetReferenceRepo.BatchIncrementAssetRefs(ctx, projectID, assets); err != nil {
		return 0, fmt.Errorf("batch increment asset refs: %w", err)
	}

	return len(assets), nil
}

// ForkSession creates a complete copy of a session
func (r *sessionRepo) ForkSession(ctx context.Context, projectID uuid.UUID, sessionID uuid.UUID) (*model.ForkSessionOutput, error) {
	// Validate size first
	if err := r.validateForkSize(ctx, sessionID); err != nil {
		return nil, err
	}

	// Fetch original session
	var originalSession model.Session
	if err := r.db.WithContext(ctx).
		Where("id = ? AND project_id = ?", sessionID, projectID).
		First(&originalSession).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("%w: session_id=%s", ErrSessionNotFound, sessionID.String())
		}
		return nil, err
	}

	// Fetch old messages to prepare for S3 copy (before transaction)
	var oldMessages []model.Message
	if err := r.db.WithContext(ctx).
		Where("session_id = ?", sessionID).
		Order("created_at ASC, id ASC").
		Find(&oldMessages).Error; err != nil {
		return nil, fmt.Errorf("fetch messages for S3 copy: %w", err)
	}

	// Prepare message ID map for S3 copy (before transaction)
	messageIDMap := make(map[uuid.UUID]uuid.UUID)
	for _, oldMsg := range oldMessages {
		messageIDMap[oldMsg.ID] = uuid.New()
	}

	// Copy S3 parts BEFORE transaction (as per design doc)
	// This prevents holding transaction open during slow S3 operations
	if len(oldMessages) > 0 {
		if err := r.copyMessagePartsS3(ctx, projectID, oldMessages, messageIDMap); err != nil {
			return nil, err // Error already wrapped with ErrS3OperationFailed
		}
	}

	// Start transaction for DB operations only
	var result *model.ForkSessionOutput
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Create new session with copied fields
		newSession := model.Session{
			ID:                  uuid.New(),
			ProjectID:           originalSession.ProjectID,
			UserID:              originalSession.UserID,
			DisableTaskTracking: originalSession.DisableTaskTracking,
			Configs:             originalSession.Configs,
			CreatedAt:           time.Now(),
			UpdatedAt:           time.Now(),
		}

		if err := tx.Create(&newSession).Error; err != nil {
			return fmt.Errorf("create new session: %w", err)
		}

		// Copy messages using pre-generated ID map
		messageCount, messageTaskMappings, err := r.copyMessagesWithIDMap(ctx, tx, originalSession.ID, newSession.ID, projectID, messageIDMap)
		if err != nil {
			return err
		}

		// Copy tasks and update message task_id references
		taskCount, err := r.copyTasks(ctx, tx, originalSession.ID, newSession.ID, projectID, messageTaskMappings)
		if err != nil {
			return err
		}

		// Increment asset references (inside transaction for atomicity)
		assetCount, err := r.incrementAssetRefsForMessages(ctx, projectID, oldMessages)
		if err != nil {
			return err
		}

		r.log.Info("session forked successfully",
			zap.String("old_session_id", originalSession.ID.String()),
			zap.String("new_session_id", newSession.ID.String()),
			zap.Int("messages_copied", messageCount),
			zap.Int("tasks_copied", taskCount),
			zap.Int("assets_incremented", assetCount))

		result = &model.ForkSessionOutput{
			OldSessionID: originalSession.ID,
			NewSessionID: newSession.ID,
			MessageCount: messageCount,
			TaskCount:    taskCount,
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return result, nil
}
