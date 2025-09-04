package service

import (
	"context"
	"errors"
	"fmt"
	"mime/multipart"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/config"
	"github.com/memodb-io/Acontext/internal/infra/blob"
	mq "github.com/memodb-io/Acontext/internal/infra/queue"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/repo"
	"github.com/memodb-io/Acontext/internal/pkg/types"
	amqp "github.com/rabbitmq/amqp091-go"
	"go.uber.org/zap"
	"gorm.io/datatypes"
)

type SessionService interface {
	Create(ctx context.Context, ss *model.Session) error
	Delete(ctx context.Context, projectID uuid.UUID, sessionID uuid.UUID) error
	UpdateByID(ctx context.Context, ss *model.Session) error
	GetByID(ctx context.Context, ss *model.Session) (*model.Session, error)
	SendMessage(ctx context.Context, in SendMessageInput) (*model.Message, error)
}

type sessionService struct {
	r    repo.SessionRepo
	log  *zap.Logger
	blob *blob.S3Deps
	mq   *amqp.Connection
	cfg  *config.Config
}

func NewSessionService(r repo.SessionRepo, log *zap.Logger, blob *blob.S3Deps, mq *amqp.Connection, cfg *config.Config) SessionService {
	return &sessionService{
		r:    r,
		log:  log,
		blob: blob,
		mq:   mq,
		cfg:  cfg,
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

type SendMessageInput struct {
	ProjectID uuid.UUID
	SessionID uuid.UUID
	Role      string
	Parts     []types.PartIn
	Files     map[string]*multipart.FileHeader
}

type SendMQPublishJSON struct {
	ProjectID uuid.UUID `json:"project_id"`
	SessionID uuid.UUID `json:"session_id"`
	MessageID uuid.UUID `json:"message_id"`
}

func (s *sessionService) SendMessage(ctx context.Context, in SendMessageInput) (*model.Message, error) {
	parts := make([]model.Part, 0, len(in.Parts))
	assetMap := make(map[int]*model.Asset)

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

			// 上传到 S3
			umeta, err := s.blob.UploadFormFile(ctx, fh)
			if err != nil {
				return nil, fmt.Errorf("upload %s failed: %w", p.FileField, err)
			}

			a := &model.Asset{
				Bucket: umeta.Bucket,
				S3Key:  umeta.Key,
				ETag:   umeta.ETag,
				SHA256: umeta.SHA256,
				MIME:   umeta.MIME,
				SizeB:  umeta.SizeB,
			}

			assetMap[idx] = a

			part.Filename = fh.Filename
			part.MIME = umeta.MIME
			part.SizeB = &umeta.SizeB
		}

		if p.Text != "" {
			part.Text = p.Text
		}

		parts = append(parts, part)

	}

	msg := model.Message{
		SessionID: in.SessionID,
		Role:      in.Role,
		Parts:     datatypes.NewJSONType(parts),
	}

	if err := s.r.CreateMessageWithAssets(ctx, &msg, assetMap); err != nil {
		return nil, err
	}

	if s.mq != nil {
		p, err := mq.NewPublisher(s.mq, s.log)
		if err != nil {
			return nil, fmt.Errorf("create session message publisher: %w", err)
		}
		if err := p.PublishJSON(ctx, s.cfg.RabbitMQ.ExchangeName.SessionMessage, s.cfg.RabbitMQ.RoutingKey.SessionMessageInsert, SendMQPublishJSON{
			ProjectID: in.ProjectID,
			SessionID: in.SessionID,
			MessageID: msg.ID,
		}); err != nil {
			return nil, fmt.Errorf("publish session message: %w", err)
		}
	}

	return &msg, nil
}
