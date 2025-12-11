package repo

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/infra/blob"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type SessionRepo interface {
	Create(ctx context.Context, s *model.Session) error
	Delete(ctx context.Context, projectID uuid.UUID, sessionID uuid.UUID) error
	Update(ctx context.Context, s *model.Session) error
	Get(ctx context.Context, s *model.Session) (*model.Session, error)
	GetDisableTaskTracking(ctx context.Context, sessionID uuid.UUID) (bool, error)
	ListWithCursor(ctx context.Context, projectID uuid.UUID, spaceID *uuid.UUID, notConnected bool, afterCreatedAt time.Time, afterID uuid.UUID, limit int, timeDesc bool) ([]model.Session, error)
	CreateMessageWithAssets(ctx context.Context, msg *model.Message) error
	ListBySessionWithCursor(ctx context.Context, sessionID uuid.UUID, afterCreatedAt time.Time, afterID uuid.UUID, limit int, timeDesc bool) ([]model.Message, error)
	ListAllMessagesBySession(ctx context.Context, sessionID uuid.UUID) ([]model.Message, error)
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

func (r *sessionRepo) ListWithCursor(ctx context.Context, projectID uuid.UUID, spaceID *uuid.UUID, notConnected bool, afterCreatedAt time.Time, afterID uuid.UUID, limit int, timeDesc bool) ([]model.Session, error) {
	q := r.db.WithContext(ctx).Where("project_id = ?", projectID)

	if notConnected {
		q = q.Where("space_id IS NULL")
	} else if spaceID != nil {
		q = q.Where("space_id = ?", spaceID)
	}

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
