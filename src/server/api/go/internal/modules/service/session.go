package service

import (
	"context"
	"errors"
	"fmt"
	"mime/multipart"
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
	List(ctx context.Context, projectID uuid.UUID, spaceID *uuid.UUID, notConnected bool) ([]model.Session, error)
	SendMessage(ctx context.Context, in SendMessageInput) (*model.Message, error)
	GetMessages(ctx context.Context, in GetMessagesInput) (*GetMessagesOutput, error)
}

type sessionService struct {
	r         repo.SessionRepo
	log       *zap.Logger
	blob      *blob.S3Deps
	publisher *mq.Publisher
	cfg       *config.Config
}

func NewSessionService(r repo.SessionRepo, log *zap.Logger, blob *blob.S3Deps, publisher *mq.Publisher, cfg *config.Config) SessionService {
	return &sessionService{
		r:         r,
		log:       log,
		blob:      blob,
		publisher: publisher,
		cfg:       cfg,
	}
}

func (s *sessionService) Create(ctx context.Context, ss *model.Session) error {
	return s.r.Create(ctx, ss)
}

func (s *sessionService) Delete(ctx context.Context, projectID uuid.UUID, sessionID uuid.UUID) error {
	if len(sessionID) == 0 {
		return errors.New("space id is empty")
	}
	return s.r.Delete(ctx, &model.Session{ID: sessionID, ProjectID: projectID})
}

func (s *sessionService) UpdateByID(ctx context.Context, ss *model.Session) error {
	return s.r.Update(ctx, ss)
}

func (s *sessionService) GetByID(ctx context.Context, ss *model.Session) (*model.Session, error) {
	if len(ss.ID) == 0 {
		return nil, errors.New("space id is empty")
	}
	return s.r.Get(ctx, ss)
}

func (s *sessionService) List(ctx context.Context, projectID uuid.UUID, spaceID *uuid.UUID, notConnected bool) ([]model.Session, error) {
	return s.r.List(ctx, projectID, spaceID, notConnected)
}

type SendMessageInput struct {
	ProjectID uuid.UUID
	SessionID uuid.UUID
	Role      string
	Parts     []PartIn
	Files     map[string]*multipart.FileHeader
}

type SendMQPublishJSON struct {
	ProjectID uuid.UUID `json:"project_id"`
	SessionID uuid.UUID `json:"session_id"`
	MessageID uuid.UUID `json:"message_id"`
}

type PartIn struct {
	Type      string                 `json:"type" validate:"required,oneof=text image audio video file tool-call tool-use tool-result data"` // "text" | "image" | ...
	Text      string                 `json:"text,omitempty"`                                                                                 // Text sharding
	FileField string                 `json:"file_field,omitempty"`                                                                           // File field name in the form
	Meta      map[string]interface{} `json:"meta,omitempty"`                                                                                 // [Optional] metadata
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
	case "tool-call", "tool-use":
		if p.Meta == nil {
			return errors.New("tool-call/tool-use part requires meta field")
		}
		// tool-call uses 'tool_name', tool-use uses 'name'
		if _, hasToolName := p.Meta["tool_name"]; !hasToolName {
			if _, hasName := p.Meta["name"]; !hasName {
				return errors.New("tool-call/tool-use part requires 'tool_name' or 'name' in meta")
			}
		}
		// tool-call uses 'arguments', tool-use uses 'input'
		if _, hasArguments := p.Meta["arguments"]; !hasArguments {
			if _, hasInput := p.Meta["input"]; !hasInput {
				return errors.New("tool-call/tool-use part requires 'arguments' or 'input' in meta")
			}
		}
	case "tool-result":
		if p.Meta == nil {
			return errors.New("tool-result part requires meta field")
		}
		// OpenAI uses 'tool_call_id', Anthropic uses 'tool_use_id'
		if _, hasToolCallID := p.Meta["tool_call_id"]; !hasToolCallID {
			if _, hasToolUseID := p.Meta["tool_use_id"]; !hasToolUseID {
				return errors.New("tool-result part requires 'tool_call_id' or 'tool_use_id' in meta")
			}
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
			umeta, err := s.blob.UploadFormFile(ctx, "assets/"+in.ProjectID.String(), fh)
			if err != nil {
				return nil, fmt.Errorf("upload %s failed: %w", p.FileField, err)
			}

			asset := &model.Asset{
				Bucket: umeta.Bucket,
				S3Key:  umeta.Key,
				ETag:   umeta.ETag,
				SHA256: umeta.SHA256,
				MIME:   umeta.MIME,
				SizeB:  umeta.SizeB,
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
	partsUmeta, err := s.blob.UploadJSON(ctx, "parts/"+in.ProjectID.String(), parts)
	if err != nil {
		return nil, fmt.Errorf("upload parts to S3 failed: %w", err)
	}

	msg := model.Message{
		SessionID: in.SessionID,
		Role:      in.Role,
		PartsMeta: datatypes.NewJSONType(model.Asset{
			Bucket: partsUmeta.Bucket,
			S3Key:  partsUmeta.Key,
			ETag:   partsUmeta.ETag,
			SHA256: partsUmeta.SHA256,
			MIME:   partsUmeta.MIME,
			SizeB:  partsUmeta.SizeB,
		}),
		Parts: parts,
	}

	if err := s.r.CreateMessageWithAssets(ctx, &msg); err != nil {
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
	msgs, err := s.r.ListBySessionWithCursor(ctx, in.SessionID, afterT, afterID, in.Limit+1)
	if err != nil {
		return nil, err
	}

	for i, m := range msgs {
		meta := m.PartsMeta.Data()

		parts := []model.Part{}
		if err := s.blob.DownloadJSON(ctx, meta.S3Key, &parts); err != nil {
			continue
		}

		msgs[i].Parts = parts
	}

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

	if in.WithAssetPublicURL {
		out.PublicURLs = make(map[string]PublicURL)
		for _, m := range out.Items {
			for _, p := range m.Parts {
				if p.Asset == nil {
					continue
				}
				url, err := s.blob.PresignGet(ctx, p.Asset.S3Key, in.AssetExpire)
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
