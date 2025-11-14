package service

import (
	"context"
	"errors"
	"fmt"
	"mime/multipart"
	"sort"
	"time"

	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/config"
	"github.com/memodb-io/Acontext/internal/infra/blob"
	mq "github.com/memodb-io/Acontext/internal/infra/queue"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/repo"
	"github.com/memodb-io/Acontext/internal/pkg/paging"
	"go.uber.org/zap"
	"gorm.io/datatypes"
)

type SessionService interface {
	Create(ctx context.Context, ss *model.Session) error
	Delete(ctx context.Context, projectID uuid.UUID, sessionID uuid.UUID) error
	UpdateByID(ctx context.Context, ss *model.Session) error
	GetByID(ctx context.Context, ss *model.Session) (*model.Session, error)
	List(ctx context.Context, in ListSessionsInput) (*ListSessionsOutput, error)
	SendMessage(ctx context.Context, in SendMessageInput) (*model.Message, error)
	GetMessages(ctx context.Context, in GetMessagesInput) (*GetMessagesOutput, error)
}

type sessionService struct {
	sessionRepo        repo.SessionRepo
	assetReferenceRepo repo.AssetReferenceRepo
	log                *zap.Logger
	s3                 *blob.S3Deps
	publisher          *mq.Publisher
	cfg                *config.Config
}

func NewSessionService(sessionRepo repo.SessionRepo, assetReferenceRepo repo.AssetReferenceRepo, log *zap.Logger, s3 *blob.S3Deps, publisher *mq.Publisher, cfg *config.Config) SessionService {
	return &sessionService{
		sessionRepo:        sessionRepo,
		assetReferenceRepo: assetReferenceRepo,
		log:                log,
		s3:                 s3,
		publisher:          publisher,
		cfg:                cfg,
	}
}

func (s *sessionService) Create(ctx context.Context, ss *model.Session) error {
	return s.sessionRepo.Create(ctx, ss)
}

func (s *sessionService) Delete(ctx context.Context, projectID uuid.UUID, sessionID uuid.UUID) error {
	if len(sessionID) == 0 {
		return errors.New("space id is empty")
	}

	if err := s.sessionRepo.Delete(ctx, projectID, sessionID); err != nil {
		return fmt.Errorf("delete session: %w", err)
	}

	return nil
}

func (s *sessionService) UpdateByID(ctx context.Context, ss *model.Session) error {
	return s.sessionRepo.Update(ctx, ss)
}

func (s *sessionService) GetByID(ctx context.Context, ss *model.Session) (*model.Session, error) {
	if len(ss.ID) == 0 {
		return nil, errors.New("space id is empty")
	}
	return s.sessionRepo.Get(ctx, ss)
}

type ListSessionsInput struct {
	ProjectID    uuid.UUID  `json:"project_id"`
	SpaceID      *uuid.UUID `json:"space_id,omitempty"`
	NotConnected bool       `json:"not_connected"`
	Limit        int        `json:"limit"`
	Cursor       string     `json:"cursor"`
	TimeDesc     bool       `json:"time_desc"`
}

type ListSessionsOutput struct {
	Items      []model.Session `json:"items"`
	NextCursor string          `json:"next_cursor,omitempty"`
	HasMore    bool            `json:"has_more"`
}

func (s *sessionService) List(ctx context.Context, in ListSessionsInput) (*ListSessionsOutput, error) {
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
	sessions, err := s.sessionRepo.ListWithCursor(ctx, in.ProjectID, in.SpaceID, in.NotConnected, afterT, afterID, in.Limit+1, in.TimeDesc)
	if err != nil {
		return nil, err
	}

	out := &ListSessionsOutput{
		Items:   sessions,
		HasMore: false,
	}
	if len(sessions) > in.Limit {
		out.HasMore = true
		out.Items = sessions[:in.Limit]
		last := out.Items[len(out.Items)-1]
		out.NextCursor = paging.EncodeCursor(last.CreatedAt, last.ID)
	}

	return out, nil
}

type SendMessageInput struct {
	ProjectID   uuid.UUID
	SessionID   uuid.UUID
	Role        string
	Parts       []PartIn
	MessageMeta map[string]interface{} // Message-level metadata (e.g., name, source_format)
	Files       map[string]*multipart.FileHeader
}

type SendMQPublishJSON struct {
	ProjectID uuid.UUID `json:"project_id"`
	SessionID uuid.UUID `json:"session_id"`
	MessageID uuid.UUID `json:"message_id"`
}

type PartIn struct {
	Type      string                 `json:"type" validate:"required,oneof=text image audio video file tool-call tool-result data"` // "text" | "image" | ...
	Text      string                 `json:"text,omitempty"`                                                                        // Text sharding
	FileField string                 `json:"file_field,omitempty"`                                                                  // File field name in the form
	Meta      map[string]interface{} `json:"meta,omitempty"`                                                                        // [Optional] metadata
}

func (p *PartIn) Validate() error {
	validate := validator.New()

	// Basic field validation
	if err := validate.Struct(p); err != nil {
		return err
	}

	// Validate required fields based on different types
	switch p.Type {
	case "text":
		if p.Text == "" {
			return errors.New("text part requires non-empty text field")
		}
	case "tool-call":
		// UNIFIED FORMAT: only "tool-call" is accepted (no more "tool-use")
		if p.Meta == nil {
			return errors.New("tool-call part requires meta field")
		}
		// Unified format requires 'name' field
		if _, hasName := p.Meta["name"]; !hasName {
			return errors.New("tool-call part requires 'name' in meta")
		}
		// Unified format requires 'arguments' field
		if _, hasArguments := p.Meta["arguments"]; !hasArguments {
			return errors.New("tool-call part requires 'arguments' in meta")
		}
	case "tool-result":
		if p.Meta == nil {
			return errors.New("tool-result part requires meta field")
		}
		// Unified format requires 'tool_call_id'
		if _, hasToolCallID := p.Meta["tool_call_id"]; !hasToolCallID {
			return errors.New("tool-result part requires 'tool_call_id' in meta")
		}
	case "data":
		if p.Meta == nil {
			return errors.New("data part requires meta field")
		}
		if _, ok := p.Meta["data_type"]; !ok {
			return errors.New("data part requires 'data_type' in meta")
		}
	}

	return nil
}

func (s *sessionService) SendMessage(ctx context.Context, in SendMessageInput) (*model.Message, error) {
	parts := make([]model.Part, 0, len(in.Parts))

	for idx, p := range in.Parts {
		part := model.Part{
			Type: p.Type,
			Meta: p.Meta,
		}

		if p.FileField != "" {
			fh, ok := in.Files[p.FileField]
			if !ok || fh == nil {
				return nil, fmt.Errorf("parts[%d]: missing uploaded file %s", idx, p.FileField)
			}

			// upload asset to S3
			asset, err := s.s3.UploadFormFile(ctx, "assets/"+in.ProjectID.String(), fh)
			if err != nil {
				return nil, fmt.Errorf("upload %s failed: %w", p.FileField, err)
			}

			if err := s.assetReferenceRepo.IncrementAssetRef(ctx, in.ProjectID, *asset); err != nil {
				return nil, fmt.Errorf("increment asset reference: %w", err)
			}

			part.Asset = asset
			part.Filename = fh.Filename
		}

		if p.Text != "" {
			part.Text = p.Text
		}

		parts = append(parts, part)
	}

	// upload parts to S3 as JSON file
	asset, err := s.s3.UploadJSON(ctx, "parts/"+in.ProjectID.String(), parts)
	if err != nil {
		return nil, fmt.Errorf("upload parts to S3 failed: %w", err)
	}

	if err := s.assetReferenceRepo.IncrementAssetRef(ctx, in.ProjectID, *asset); err != nil {
		return nil, fmt.Errorf("increment asset reference: %w", err)
	}

	// Prepare message metadata
	messageMeta := in.MessageMeta
	if messageMeta == nil {
		messageMeta = make(map[string]interface{})
	}

	msg := model.Message{
		SessionID:      in.SessionID,
		Role:           in.Role,
		Meta:           datatypes.NewJSONType(messageMeta), // Store message-level metadata
		PartsAssetMeta: datatypes.NewJSONType(*asset),
		Parts:          parts,
	}

	if err := s.sessionRepo.CreateMessageWithAssets(ctx, &msg); err != nil {
		return nil, err
	}

	if s.publisher != nil {
		if err := s.publisher.PublishJSON(ctx, s.cfg.RabbitMQ.ExchangeName.SessionMessage, s.cfg.RabbitMQ.RoutingKey.SessionMessageInsert, SendMQPublishJSON{
			ProjectID: in.ProjectID,
			SessionID: in.SessionID,
			MessageID: msg.ID,
		}); err != nil {
			s.log.Error("publish session message", zap.Error(err))
		}
	}

	return &msg, nil
}

type GetMessagesInput struct {
	SessionID          uuid.UUID     `json:"session_id"`
	Limit              int           `json:"limit"`
	Cursor             string        `json:"cursor"`
	WithAssetPublicURL bool          `json:"with_public_url"`
	AssetExpire        time.Duration `json:"asset_expire"`
	TimeDesc           bool          `json:"time_desc"`
}

type PublicURL struct {
	URL      string    `json:"url"`
	ExpireAt time.Time `json:"expire_at"`
}

type GetMessagesOutput struct {
	Items      []model.Message      `json:"items"`
	NextCursor string               `json:"next_cursor,omitempty"`
	HasMore    bool                 `json:"has_more"`
	PublicURLs map[string]PublicURL `json:"public_urls,omitempty"` // file_name -> url
}

func (s *sessionService) GetMessages(ctx context.Context, in GetMessagesInput) (*GetMessagesOutput, error) {
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
	msgs, err := s.sessionRepo.ListBySessionWithCursor(ctx, in.SessionID, afterT, afterID, in.Limit+1, in.TimeDesc)
	if err != nil {
		return nil, err
	}

	for i, m := range msgs {
		meta := m.PartsAssetMeta.Data()

		// Only download parts if blob service is available
		if s.s3 != nil {
			parts := []model.Part{}
			if err := s.s3.DownloadJSON(ctx, meta.S3Key, &parts); err != nil {
				continue
			}
			msgs[i].Parts = parts
		}
	}

	// Always sort messages from old to new (ascending by created_at)
	// regardless of the in.TimeDesc parameter used for cursor pagination
	sort.Slice(msgs, func(i, j int) bool {
		if msgs[i].CreatedAt.Equal(msgs[j].CreatedAt) {
			return msgs[i].ID.String() < msgs[j].ID.String()
		}
		return msgs[i].CreatedAt.Before(msgs[j].CreatedAt)
	})

	out := &GetMessagesOutput{
		Items:   msgs,
		HasMore: false,
	}
	if len(msgs) > in.Limit {
		out.HasMore = true
		out.Items = msgs[:in.Limit]
		last := out.Items[len(out.Items)-1]
		out.NextCursor = paging.EncodeCursor(last.CreatedAt, last.ID)
	}

	if in.WithAssetPublicURL && s.s3 != nil {
		out.PublicURLs = make(map[string]PublicURL)
		for _, m := range out.Items {
			for _, p := range m.Parts {
				if p.Asset == nil {
					continue
				}
				url, err := s.s3.PresignGet(ctx, p.Asset.S3Key, in.AssetExpire)
				if err != nil {
					return nil, fmt.Errorf("get presigned url for asset %s: %w", p.Asset.S3Key, err)
				}
				out.PublicURLs[p.Asset.SHA256] = PublicURL{
					URL:      url,
					ExpireAt: time.Now().Add(in.AssetExpire),
				}
			}
		}
	}

	return out, nil
}
