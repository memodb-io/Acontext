package service

import (
	"context"
	"encoding/base64"
	"encoding/binary"
	"errors"
	"fmt"
	"mime/multipart"
	"sort"
	"time"

	"github.com/bytedance/sonic"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/config"
	"github.com/memodb-io/Acontext/internal/infra/blob"
	"github.com/memodb-io/Acontext/internal/infra/crypto"
	mq "github.com/memodb-io/Acontext/internal/infra/queue"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/repo"
	"github.com/memodb-io/Acontext/internal/pkg/editor"
	"github.com/memodb-io/Acontext/internal/pkg/paging"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type SessionService interface {
	Create(ctx context.Context, ss *model.Session) error
	Delete(ctx context.Context, projectID uuid.UUID, sessionID uuid.UUID, userKEK []byte) error
	UpdateByID(ctx context.Context, ss *model.Session) error
	GetByID(ctx context.Context, ss *model.Session) (*model.Session, error)
	List(ctx context.Context, in ListSessionsInput) (*ListSessionsOutput, error)
	StoreMessage(ctx context.Context, in StoreMessageInput) (*model.Message, error)
	GetMessages(ctx context.Context, in GetMessagesInput) (*GetMessagesOutput, error)
	GetAllMessages(ctx context.Context, projectID uuid.UUID, sessionID uuid.UUID, userKEK []byte) ([]model.Message, error)
	GetSessionObservingStatus(ctx context.Context, sessionID string) (*model.MessageObservingStatus, error)
	PatchMessageMeta(ctx context.Context, projectID uuid.UUID, sessionID uuid.UUID, messageID uuid.UUID, patchMeta map[string]interface{}) (map[string]interface{}, error)
	PatchConfigs(ctx context.Context, projectID uuid.UUID, sessionID uuid.UUID, patchConfigs map[string]interface{}) (map[string]interface{}, error)
	CopySession(ctx context.Context, in CopySessionInput) (*CopySessionOutput, error)
	DownloadAsset(ctx context.Context, s3Key string, userKEK []byte) ([]byte, error)
}

type CopySessionInput struct {
	ProjectID uuid.UUID
	SessionID uuid.UUID
	UserKEK   []byte
}

type CopySessionOutput struct {
	OldSessionID uuid.UUID `json:"old_session_id"`
	NewSessionID uuid.UUID `json:"new_session_id"`
}

type sessionService struct {
	sessionRepo        repo.SessionRepo
	sessionEventRepo   repo.SessionEventRepo
	assetReferenceRepo repo.AssetReferenceRepo
	assetRefBuffer     repo.AssetRefBuffer
	log                *zap.Logger
	s3                 *blob.S3Deps
	publisher          *mq.Publisher
	cfg                *config.Config
	redis              *redis.Client
	materialSvc        MaterialService
}

const (
	// Redis key prefix for message parts cache
	redisKeyPrefixParts = "message:parts:"
	// Default TTL for message parts cache (1 hour)
	defaultPartsCacheTTL = time.Hour

	// Cache framing prefix bytes to distinguish encrypted vs plaintext cached data
	cachePrefixPlaintext byte = 0x00
	cachePrefixEncrypted byte = 0x01
)

func NewSessionService(sessionRepo repo.SessionRepo, sessionEventRepo repo.SessionEventRepo, assetReferenceRepo repo.AssetReferenceRepo, assetRefBuffer repo.AssetRefBuffer, log *zap.Logger, s3 *blob.S3Deps, publisher *mq.Publisher, cfg *config.Config, redis *redis.Client, materialSvc MaterialService) SessionService {
	return &sessionService{
		sessionRepo:        sessionRepo,
		sessionEventRepo:   sessionEventRepo,
		assetReferenceRepo: assetReferenceRepo,
		assetRefBuffer:     assetRefBuffer,
		log:                log,
		s3:                 s3,
		publisher:          publisher,
		cfg:                cfg,
		redis:              redis,
		materialSvc:        materialSvc,
	}
}

func (s *sessionService) Create(ctx context.Context, ss *model.Session) error {
	return s.sessionRepo.Create(ctx, ss)
}

func (s *sessionService) Delete(ctx context.Context, projectID uuid.UUID, sessionID uuid.UUID, userKEK []byte) error {
	if len(sessionID) == 0 {
		return errors.New("space id is empty")
	}

	if err := s.sessionRepo.Delete(ctx, projectID, sessionID, userKEK); err != nil {
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
	ProjectID       uuid.UUID              `json:"project_id"`
	User            string                 `json:"user"`
	FilterByConfigs map[string]interface{} `json:"filter_by_configs"` // Filter by configs JSONB containment
	Limit           int                    `json:"limit"`
	Cursor          string                 `json:"cursor"`
	TimeDesc        bool                   `json:"time_desc"`
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
	sessions, err := s.sessionRepo.ListWithCursor(ctx, in.ProjectID, in.User, in.FilterByConfigs, afterT, afterID, in.Limit+1, in.TimeDesc)
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

type StoreMessageInput struct {
	ProjectID   uuid.UUID
	SessionID   uuid.UUID
	ParentID    *uuid.UUID
	Role        string
	Parts       []PartIn
	Format      model.MessageFormat    // Message format (acontext, openai, anthropic, gemini)
	MessageMeta map[string]interface{} // Message-level metadata (e.g., name, source_format)
	Files       map[string]*multipart.FileHeader
	UserKEK     []byte // optional: for envelope encryption
}

type StoreMQPublishJSON struct {
	ProjectID uuid.UUID `json:"project_id"`
	SessionID uuid.UUID `json:"session_id"`
	MessageID uuid.UUID `json:"message_id"`
	UserKEK   string    `json:"user_kek,omitempty"` // base64-encoded user KEK for envelope encryption
}

type PartIn struct {
	Type      string                 `json:"type" validate:"required,oneof=text image audio video file tool-call tool-result data thinking redacted_thinking"` // "text" | "image" | ...
	Text      string                 `json:"text,omitempty"`                                                                                                   // Text sharding
	FileField string                 `json:"file_field,omitempty"`                                                                                             // File field name in the form
	Meta      map[string]interface{} `json:"meta,omitempty"`                                                                                                   // [Optional] metadata
}

func (p *PartIn) Validate() error {
	validate := validator.New()

	// Basic field validation (struct tag oneof must remain a string literal -- Go limitation)
	if err := validate.Struct(p); err != nil {
		return err
	}

	// Validate required fields based on type (using model constants)
	switch p.Type {
	case model.PartTypeText:
		if p.Text == "" {
			return errors.New("text part requires non-empty text field")
		}
	case model.PartTypeThinking:
		if p.Text == "" {
			return errors.New("thinking part requires non-empty text field")
		}
	case model.PartTypeToolCall:
		if p.Meta == nil {
			return errors.New("tool-call part requires meta field")
		}
		if _, ok := p.Meta[model.MetaKeyName]; !ok {
			return errors.New("tool-call part requires 'name' in meta")
		}
		if _, ok := p.Meta[model.MetaKeyArguments]; !ok {
			return errors.New("tool-call part requires 'arguments' in meta")
		}
	case model.PartTypeToolResult:
		if p.Meta == nil {
			return errors.New("tool-result part requires meta field")
		}
		if _, ok := p.Meta[model.MetaKeyToolCallID]; !ok {
			return errors.New("tool-result part requires 'tool_call_id' in meta")
		}
	case model.PartTypeData:
		if p.Meta == nil {
			return errors.New("data part requires meta field")
		}
		if _, ok := p.Meta[model.MetaKeyDataType]; !ok {
			return errors.New("data part requires 'data_type' in meta")
		}
	}

	return nil
}

// validateAndResolveGeminiToolResult validates and resolves tool-result parts for Gemini format.
// Strategy:
// 1. Pop stored call (id, name) pair
// 2. Validate function name match
// 3. If response has ID: validate it matches the popped call ID
// 4. If response has no ID: copy from popped call
func (s *sessionService) validateAndResolveGeminiToolResult(ctx context.Context, sessionID uuid.UUID, partIn *PartIn, idx int) error {
	if partIn.Meta == nil {
		partIn.Meta = make(map[string]interface{})
	}

	// Get function name from response
	responseName, hasName := partIn.Meta[model.MetaKeyName]
	if !hasName {
		return fmt.Errorf("tool-result part[%d] missing function name", idx)
	}
	responseNameStr, ok := responseName.(string)
	if !ok || responseNameStr == "" {
		return fmt.Errorf("tool-result part[%d] has invalid function name", idx)
	}

	// Pop the next stored call (id, name) pair (always pop to validate and consume call info)
	poppedID, poppedName, err := s.sessionRepo.PopGeminiCallIDAndName(ctx, sessionID)
	if err != nil {
		return fmt.Errorf("failed to resolve FunctionResponse for part[%d]: %w", idx, err)
	}

	// Validate name match - name must match
	if poppedName != responseNameStr {
		return fmt.Errorf("function name mismatch for part[%d]: response name '%s' does not match call name '%s'", idx, responseNameStr, poppedName)
	}

	// Handle ID: if response has ID, validate it matches; if not, copy from call
	responseID, hasID := partIn.Meta[model.MetaKeyToolCallID]
	if hasID {
		// ID exists: validate it matches the popped call ID
		responseIDStr, ok := responseID.(string)
		if !ok || responseIDStr == "" {
			return fmt.Errorf("tool-result part[%d] has invalid tool_call_id", idx)
		}
		if responseIDStr != poppedID {
			return fmt.Errorf("function ID mismatch for part[%d]: response ID '%s' does not match call ID '%s'", idx, responseIDStr, poppedID)
		}
		// ID matches, no need to update
	} else {
		// ID missing: copy from popped call
		partIn.Meta[model.MetaKeyToolCallID] = poppedID
	}

	return nil
}

func (s *sessionService) StoreMessage(ctx context.Context, in StoreMessageInput) (*model.Message, error) {
	// Validate session exists and belongs to project before performing expensive operations
	session, err := s.sessionRepo.Get(ctx, &model.Session{ID: in.SessionID})
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("session not found")
		}
		return nil, fmt.Errorf("failed to get session: %w", err)
	}

	// Verify session belongs to the project
	if session.ProjectID != in.ProjectID {
		return nil, fmt.Errorf("session does not belong to project")
	}

	if in.ParentID != nil {
		parent, err := s.sessionRepo.GetMessageByIDAnySession(ctx, *in.ParentID)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, fmt.Errorf("%w: %s", ErrParentMessageNotFound, in.ParentID.String())
			}
			return nil, fmt.Errorf("failed to get parent message: %w", err)
		}
		if parent.SessionID != in.SessionID {
			return nil, fmt.Errorf(
				"%w: parent_id=%s session_id=%s",
				ErrParentMessageWrongSession,
				in.ParentID.String(),
				in.SessionID.String(),
			)
		}
	}

	parts := make([]model.Part, 0, len(in.Parts))
	var uploadedAssets []model.Asset
	var pendingUploads []*blob.PreparedUpload

	for idx := range in.Parts {
		partIn := &in.Parts[idx] // Use pointer to avoid repeated indexing and allow modifications

		// For Gemini format tool-result parts, always validate against stored call info (before file uploads)
		// This ensures validation happens before file uploads to avoid orphaned assets
		if in.Format == model.FormatGemini && partIn.Type == model.PartTypeToolResult {
			if err := s.validateAndResolveGeminiToolResult(ctx, in.SessionID, partIn, idx); err != nil {
				return nil, err
			}
		}

		part := model.Part{
			Type: partIn.Type,
			Meta: partIn.Meta,
		}

		if partIn.FileField != "" {
			fh, ok := in.Files[partIn.FileField]
			if !ok || fh == nil {
				return nil, fmt.Errorf("parts[%d]: missing uploaded file %s", idx, partIn.FileField)
			}

			// Pre-compute asset metadata without S3 calls
			prepared, err := s.s3.PrepareFormFileAsset("assets/"+in.ProjectID.String(), fh)
			if err != nil {
				return nil, fmt.Errorf("prepare %s failed: %w", partIn.FileField, err)
			}

			pendingUploads = append(pendingUploads, prepared)
			uploadedAssets = append(uploadedAssets, prepared.Asset)
			part.Asset = &prepared.Asset
			part.Filename = fh.Filename
		}

		if partIn.Text != "" {
			part.Text = partIn.Text
		}

		parts = append(parts, part)
	}

	// Pre-compute parts JSON asset metadata without S3 calls
	partsAssetPrepared, err := s.s3.PrepareJSONAsset("parts/"+in.ProjectID.String(), parts)
	if err != nil {
		return nil, fmt.Errorf("prepare parts asset failed: %w", err)
	}

	pendingUploads = append(pendingUploads, partsAssetPrepared)
	partsAsset := partsAssetPrepared.Asset
	uploadedAssets = append(uploadedAssets, partsAsset)

	// Cache parts data in Redis before responding (uses pre-computed SHA256)
	if s.redis != nil {
		if err := s.cachePartsInRedis(ctx, in.ProjectID.String(), partsAsset.SHA256, parts, in.UserKEK); err != nil {
			s.log.Warn("failed to cache parts in Redis", zap.String("sha256", partsAsset.SHA256), zap.Error(err))
		}
	}

	// Upload all assets to S3 asynchronously — not on the request critical path.
	// Since S3 keys are content-addressed (SHA256), uploads are idempotent.
	go func() {
		bgCtx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
		defer cancel()
		for _, p := range pendingUploads {
			if err := s.s3.UploadPrepared(bgCtx, p, in.UserKEK); err != nil {
				s.log.Error("async S3 upload failed",
					zap.String("s3_key", p.Asset.S3Key),
					zap.String("sha256", p.Asset.SHA256),
					zap.Error(err))
			}
		}
	}()

	// Buffer asset reference increments in Redis for coalesced DB flush.
	if err := s.assetRefBuffer.Enqueue(ctx, in.ProjectID, uploadedAssets); err != nil {
		s.log.Error("failed to enqueue asset ref increments",
			zap.String("project_id", in.ProjectID.String()), zap.Error(err))
	}

	// Prepare message metadata
	messageMeta := in.MessageMeta
	if messageMeta == nil {
		messageMeta = make(map[string]interface{})
	}

	msg := model.Message{
		SessionID:      in.SessionID,
		ParentID:       in.ParentID,
		Role:           in.Role,
		Meta:           datatypes.NewJSONType(messageMeta), // Store message-level metadata
		PartsAssetMeta: datatypes.NewJSONType(partsAsset),
		Parts:          parts,
	}

	// Check if task tracking is disabled for this session
	disableTaskTracking, err := s.sessionRepo.GetDisableTaskTracking(ctx, in.SessionID)
	if err != nil {
		s.log.Error("failed to get disable_task_tracking for session", zap.Error(err))
	} else if disableTaskTracking {
		msg.SessionTaskProcessStatus = model.MessageStatusDisableTracking
	}

	if err := s.sessionRepo.CreateMessageWithAssets(ctx, &msg); err != nil {
		return nil, err
	}

	if !disableTaskTracking && s.publisher != nil {
		mqMsg := StoreMQPublishJSON{
			ProjectID: in.ProjectID,
			SessionID: in.SessionID,
			MessageID: msg.ID,
		}
		// TODO: UserKEK is transmitted in plaintext over RabbitMQ. Current deployment
		// assumes a trusted internal network. Consider encrypting the MQ payload or
		// using a short-lived Redis token to avoid persisting key material in the broker.
		if in.UserKEK != nil {
			mqMsg.UserKEK = base64.StdEncoding.EncodeToString(in.UserKEK)
		}
		if err := s.publisher.PublishJSON(ctx, s.cfg.RabbitMQ.ExchangeName.SessionMessage, s.cfg.RabbitMQ.RoutingKey.SessionMessageInsert, mqMsg); err != nil {
			s.log.Error("publish session message", zap.Error(err))
		}
	}

	return &msg, nil
}

type GetMessagesInput struct {
	ProjectID                     uuid.UUID               `json:"project_id"`
	SessionID                     uuid.UUID               `json:"session_id"`
	LeafID                        *uuid.UUID              `json:"leaf_id,omitempty"`
	Limit                         int                     `json:"limit"`
	Cursor                        string                  `json:"cursor"`
	WithAssetPublicURL            bool                    `json:"with_public_url"`
	AssetExpire                   time.Duration           `json:"asset_expire"`
	TimeDesc                      bool                    `json:"time_desc"`
	WithEvents                    bool                    `json:"with_events"`
	EditStrategies                []editor.StrategyConfig `json:"edit_strategies,omitempty"`
	PinEditingStrategiesAtMessage string                  `json:"pin_editing_strategies_at_message,omitempty"`
	UserKEK                       []byte                  `json:"-"` // optional: for envelope encryption (decrypting parts)
}

type PublicURL struct {
	URL      string    `json:"url"`
	ExpireAt time.Time `json:"expire_at"`
}

type GetMessagesOutput struct {
	Items           []model.Message      `json:"items"`
	Events          []model.SessionEvent `json:"events,omitempty"`
	NextCursor      string               `json:"next_cursor,omitempty"`
	HasMore         bool                 `json:"has_more"`
	PublicURLs      map[string]PublicURL `json:"public_urls,omitempty"` // file_name -> url
	EditAtMessageID string               `json:"edit_at_message_id,omitempty"`
}

func latestLeafMessageID(messages []model.Message) (uuid.UUID, int, bool) {
	if len(messages) == 0 {
		return uuid.Nil, 0, false
	}

	hasChild := make(map[uuid.UUID]struct{}, len(messages))
	for _, msg := range messages {
		if msg.ParentID != nil {
			hasChild[*msg.ParentID] = struct{}{}
		}
	}

	var latest model.Message
	found := false
	leafCount := 0
	for _, msg := range messages {
		if _, ok := hasChild[msg.ID]; ok {
			continue
		}
		leafCount++
		if !found || msg.CreatedAt.After(latest.CreatedAt) || (msg.CreatedAt.Equal(latest.CreatedAt) && msg.ID.String() > latest.ID.String()) {
			latest = msg
			found = true
		}
	}

	if !found {
		return uuid.Nil, leafCount, false
	}

	return latest.ID, leafCount, true
}

func windowMessagesForRead(messages []model.Message, limit int, cursor string, timeDesc bool) ([]model.Message, error) {
	if limit <= 0 {
		return messages, nil
	}

	ordered := make([]model.Message, len(messages))
	copy(ordered, messages)

	if timeDesc {
		for i, j := 0, len(ordered)-1; i < j; i, j = i+1, j-1 {
			ordered[i], ordered[j] = ordered[j], ordered[i]
		}
	}

	if cursor != "" {
		afterT, afterID, err := paging.DecodeCursor(cursor)
		if err != nil {
			return nil, err
		}

		start := 0
		for start < len(ordered) {
			msg := ordered[start]
			if timeDesc {
				if msg.CreatedAt.Before(afterT) || (msg.CreatedAt.Equal(afterT) && msg.ID.String() < afterID.String()) {
					break
				}
			} else {
				if msg.CreatedAt.After(afterT) || (msg.CreatedAt.Equal(afterT) && msg.ID.String() > afterID.String()) {
					break
				}
			}
			start++
		}

		if start >= len(ordered) {
			return []model.Message{}, nil
		}
		ordered = ordered[start:]
	}

	if len(ordered) > limit+1 {
		ordered = ordered[:limit+1]
	}

	return ordered, nil
}

func (s *sessionService) GetMessages(ctx context.Context, in GetMessagesInput) (*GetMessagesOutput, error) {
	// Verify session exists and belongs to project
	session, err := s.sessionRepo.Get(ctx, &model.Session{ID: in.SessionID})
	if err != nil {
		return nil, fmt.Errorf("session not found")
	}
	if session.ProjectID != in.ProjectID {
		return nil, fmt.Errorf("session not found")
	}

	var msgs []model.Message
	applyLeafWindow := false

	if in.LeafID != nil {
		// TODO: Deduplicate this validation with the handler-side check without removing service-level defense.
		if in.Limit > 0 || in.Cursor != "" || in.TimeDesc {
			return nil, fmt.Errorf("leaf_id cannot be combined with limit, cursor, or time_desc")
		}
		msgs, err = s.sessionRepo.ListMessageBranchPath(ctx, in.SessionID, *in.LeafID)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, fmt.Errorf("leaf message not found")
			}
			return nil, err
		}
	} else {
		allMessages, err := s.sessionRepo.ListAllMessagesBySession(ctx, in.SessionID)
		if err != nil {
			return nil, err
		}

		if len(allMessages) > 0 {
			latestLeafID, leafCount, ok := latestLeafMessageID(allMessages)
			if !ok {
				return nil, fmt.Errorf("no leaf message found in session")
			}

			if leafCount == 1 {
				if in.Limit <= 0 {
					msgs = allMessages
				} else {
					var afterT time.Time
					var afterID uuid.UUID
					if in.Cursor != "" {
						afterT, afterID, err = paging.DecodeCursor(in.Cursor)
						if err != nil {
							return nil, err
						}
					}

					msgs, err = s.sessionRepo.ListBySessionWithCursor(ctx, in.SessionID, afterT, afterID, in.Limit+1, in.TimeDesc)
					if err != nil {
						return nil, err
					}
				}
			} else {
				msgs, err = s.sessionRepo.ListMessageBranchPath(ctx, in.SessionID, latestLeafID)
				if err != nil {
					return nil, err
				}
				applyLeafWindow = true
			}
		}
	}

	if applyLeafWindow {
		msgs, err = windowMessagesForRead(msgs, in.Limit, in.Cursor, in.TimeDesc)
		if err != nil {
			return nil, err
		}
	}

	// Load parts for each message, filtering out those with failed loads
	n := 0
	for i, m := range msgs {
		meta := m.PartsAssetMeta.Data()
		parts, ok := s.loadPartsForMessage(ctx, in.ProjectID.String(), meta, in.UserKEK)
		if !ok {
			continue // Drop messages with failed parts loading
		}
		msgs[i].Parts = parts
		msgs[n] = msgs[i]
		n++
	}
	msgs = msgs[:n]

	// Always sort messages from old to new (ascending by created_at)
	// regardless of the in.TimeDesc parameter used for cursor pagination
	sort.Slice(msgs, func(i, j int) bool {
		if msgs[i].CreatedAt.Equal(msgs[j].CreatedAt) {
			return msgs[i].ID.String() < msgs[j].ID.String()
		}
		return msgs[i].CreatedAt.Before(msgs[j].CreatedAt)
	})

	// Build output with pagination info
	out := &GetMessagesOutput{
		Items:   msgs,
		HasMore: false,
	}
	if in.Limit > 0 && len(msgs) > in.Limit {
		out.HasMore = true
		out.Items = msgs[:in.Limit]
		last := out.Items[len(out.Items)-1]
		out.NextCursor = paging.EncodeCursor(last.CreatedAt, last.ID)
	}

	// Fetch events if requested
	if in.WithEvents && len(out.Items) > 0 {
		first := out.Items[0].CreatedAt
		last := out.Items[len(out.Items)-1].CreatedAt
		minTime, maxTime := first, last
		if first.After(last) {
			minTime, maxTime = last, first
		}
		events, err := s.sessionEventRepo.ListBySessionInTimeWindow(ctx, in.SessionID, minTime, maxTime)
		if err != nil {
			return nil, fmt.Errorf("failed to fetch events: %w", err)
		}
		out.Events = events
	}

	// Apply edit strategies if provided (before format conversion)
	if len(in.EditStrategies) > 0 {
		result, err := editor.ApplyStrategiesWithPin(out.Items, in.EditStrategies, in.PinEditingStrategiesAtMessage)
		if err != nil {
			return nil, fmt.Errorf("failed to apply edit strategies: %w", err)
		}
		out.Items = result.Messages
		out.EditAtMessageID = result.EditAtMessageID
	} else if len(out.Items) > 0 {
		// No strategies, but still set EditAtMessageID to the last message
		out.EditAtMessageID = out.Items[len(out.Items)-1].ID.String()
	}

	// Generate material URLs for assets if requested (works for both encrypted and non-encrypted)
	if in.WithAssetPublicURL && s.materialSvc != nil {
		out.PublicURLs = make(map[string]PublicURL)
		// Encode userKEK to base64 for material service
		var userKEKB64 string
		if in.UserKEK != nil {
			userKEKB64 = base64.StdEncoding.EncodeToString(in.UserKEK)
		}
		for _, m := range out.Items {
			for _, p := range m.Parts {
				if p.Asset == nil {
					continue
				}
				url, expireAt, err := s.materialSvc.CreateMaterialURL(ctx, p.Asset.S3Key, userKEKB64, in.AssetExpire, p.Asset.MIME, p.Filename)
				if err != nil {
					return nil, fmt.Errorf("create material url for asset %s: %w", p.Asset.S3Key, err)
				}
				out.PublicURLs[p.Asset.SHA256] = PublicURL{
					URL:      url,
					ExpireAt: expireAt,
				}
			}
		}
	}

	return out, nil
}

// DownloadAsset downloads and decrypts an asset from S3 by its key.
func (s *sessionService) DownloadAsset(ctx context.Context, s3Key string, userKEK []byte) ([]byte, error) {
	if s.s3 == nil {
		return nil, errors.New("S3 not configured")
	}
	return s.s3.DownloadFile(ctx, s3Key, userKEK)
}

// cachePartsInRedis stores message parts in Redis with a fixed TTL.
// When userKEK is provided, the serialized JSON is encrypted before caching.
// Format: prefix_byte | payload
//   - 0x00 | json_data (plaintext)
//   - 0x01 | wrappedDEK_len (2 bytes BE) | wrappedDEK | ciphertext (encrypted)
func (s *sessionService) cachePartsInRedis(ctx context.Context, projectID string, sha256 string, parts []model.Part, userKEK []byte) error {
	if s.redis == nil {
		return errors.New("redis client is not available")
	}

	// Serialize parts to JSON
	jsonData, err := sonic.Marshal(parts)
	if err != nil {
		return fmt.Errorf("marshal parts to JSON: %w", err)
	}

	var cacheData []byte
	if userKEK != nil {
		// Encrypt the JSON data
		ciphertext, encMeta, err := crypto.EncryptData(userKEK, jsonData)
		if err != nil {
			return fmt.Errorf("encrypt parts for cache: %w", err)
		}
		wrappedDEK := []byte(encMeta.UserWrappedDEK)
		// Frame: 0x01 | wrappedDEK_len (2 bytes BE) | wrappedDEK | ciphertext
		cacheData = make([]byte, 1+2+len(wrappedDEK)+len(ciphertext))
		cacheData[0] = cachePrefixEncrypted
		binary.BigEndian.PutUint16(cacheData[1:3], uint16(len(wrappedDEK)))
		copy(cacheData[3:3+len(wrappedDEK)], wrappedDEK)
		copy(cacheData[3+len(wrappedDEK):], ciphertext)
	} else {
		// Frame: 0x00 | json_data
		cacheData = make([]byte, 1+len(jsonData))
		cacheData[0] = cachePrefixPlaintext
		copy(cacheData[1:], jsonData)
	}

	// Use project ID + SHA256 as Redis key for project-scoped content-based caching
	redisKey := redisKeyPrefixParts + projectID + ":" + sha256

	// Store in Redis with fixed TTL
	if err := s.redis.Set(ctx, redisKey, cacheData, defaultPartsCacheTTL).Err(); err != nil {
		return fmt.Errorf("set Redis key %s: %w", redisKey, err)
	}

	return nil
}

// getPartsFromRedis retrieves message parts from Redis cache.
// When userKEK is provided and the cached data is encrypted, it decrypts before unmarshalling.
// Returns (nil, redis.Nil) on cache miss, which is a normal condition.
func (s *sessionService) getPartsFromRedis(ctx context.Context, projectID string, sha256 string, userKEK []byte) ([]model.Part, error) {
	if s.redis == nil {
		return nil, errors.New("redis client is not available")
	}

	redisKey := redisKeyPrefixParts + projectID + ":" + sha256

	// Get from Redis
	val, err := s.redis.Get(ctx, redisKey).Bytes()
	if err != nil {
		// redis.Nil means key doesn't exist (cache miss), which is normal
		if err == redis.Nil {
			return nil, redis.Nil
		}
		// Other errors are actual Redis errors
		return nil, fmt.Errorf("get Redis key %s: %w", redisKey, err)
	}

	if len(val) == 0 {
		return nil, fmt.Errorf("empty cached data for key %s", redisKey)
	}

	var jsonData []byte
	switch val[0] {
	case cachePrefixPlaintext:
		// Plaintext: strip prefix byte
		jsonData = val[1:]
	case cachePrefixEncrypted:
		// Encrypted: 0x01 | wrappedDEK_len (2 bytes BE) | wrappedDEK | ciphertext
		if userKEK == nil {
			return nil, fmt.Errorf("encrypted cache entry but no user KEK provided")
		}
		if len(val) < 3 {
			return nil, fmt.Errorf("malformed encrypted cache entry: too short")
		}
		wrappedDEKLen := int(binary.BigEndian.Uint16(val[1:3]))
		if len(val) < 3+wrappedDEKLen {
			return nil, fmt.Errorf("malformed encrypted cache entry: wrappedDEK length exceeds data")
		}
		wrappedDEK := string(val[3 : 3+wrappedDEKLen])
		ciphertext := val[3+wrappedDEKLen:]
		encMeta := &crypto.EncryptedMeta{
			Algo:           "AES-256-GCM",
			UserWrappedDEK: wrappedDEK,
		}
		jsonData, err = crypto.DecryptData(userKEK, ciphertext, encMeta)
		if err != nil {
			return nil, fmt.Errorf("decrypt cached parts: %w", err)
		}
	default:
		// Legacy cache entry without prefix byte — treat as raw plaintext JSON
		jsonData = val
	}

	// Deserialize JSON to parts
	var parts []model.Part
	if err := sonic.Unmarshal(jsonData, &parts); err != nil {
		return nil, fmt.Errorf("unmarshal parts from JSON: %w", err)
	}

	return parts, nil
}

// loadPartsForMessage loads parts from cache/S3. Returns (parts, ok) where
// ok=false means a load failure (the message should be skipped), and ok=true
// with an empty slice means the message legitimately has no content parts.
// userKEK is the optional user key-encryption-key for decrypting envelope-encrypted parts.
func (s *sessionService) loadPartsForMessage(ctx context.Context, projectID string, meta model.Asset, userKEK []byte) ([]model.Part, bool) {
	parts := []model.Part{}
	cacheHit := false

	// Try to get parts from Redis cache first, fallback to S3 if not found
	if s.redis != nil {
		if cachedParts, err := s.getPartsFromRedis(ctx, projectID, meta.SHA256, userKEK); err == nil {
			parts = cachedParts
			cacheHit = true
		} else if err != redis.Nil {
			// Log actual Redis errors (not cache misses)
			s.log.Warn("failed to get parts from Redis", zap.String("sha256", meta.SHA256), zap.Error(err))
		}
	}

	// If cache miss, download from S3
	if !cacheHit && s.s3 != nil {
		if err := s.s3.DownloadJSON(ctx, meta.S3Key, &parts, userKEK); err != nil {
			s.log.Warn("failed to download parts from S3", zap.String("sha256", meta.SHA256), zap.Error(err))
			return nil, false
		}
		// Cache the parts in Redis after successful S3 download
		if s.redis != nil {
			if err := s.cachePartsInRedis(ctx, projectID, meta.SHA256, parts, userKEK); err != nil {
				// Log error but don't fail the request if Redis caching fails
				s.log.Warn("failed to cache parts in Redis", zap.String("sha256", meta.SHA256), zap.Error(err))
			}
		}
	}

	return parts, true
}

// GetAllMessages retrieves all messages for a session and loads their parts
func (s *sessionService) GetAllMessages(ctx context.Context, projectID uuid.UUID, sessionID uuid.UUID, userKEK []byte) ([]model.Message, error) {
	// Get all messages from repository
	msgs, err := s.sessionRepo.ListAllMessagesBySession(ctx, sessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to list messages: %w", err)
	}

	// Load parts for each message, filtering out those with failed loads
	n := 0
	for i, m := range msgs {
		meta := m.PartsAssetMeta.Data()
		parts, ok := s.loadPartsForMessage(ctx, projectID.String(), meta, userKEK)
		if !ok {
			continue
		}
		msgs[i].Parts = parts
		msgs[n] = msgs[i]
		n++
	}
	msgs = msgs[:n]

	// Sort messages from old to new (ascending by created_at)
	sort.Slice(msgs, func(i, j int) bool {
		if msgs[i].CreatedAt.Equal(msgs[j].CreatedAt) {
			return msgs[i].ID.String() < msgs[j].ID.String()
		}
		return msgs[i].CreatedAt.Before(msgs[j].CreatedAt)
	})

	return msgs, nil
}

// GetSessionObservingStatus retrieves observing status for a specific session
func (s *sessionService) GetSessionObservingStatus(
	ctx context.Context,
	sessionID string,
) (*model.MessageObservingStatus, error) {

	if sessionID == "" {
		return nil, fmt.Errorf("session ID is required")
	}

	if ctx == nil {
		return nil, fmt.Errorf("context cannot be nil")
	}

	status, err := s.sessionRepo.GetObservingStatus(ctx, sessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get session observing status: %w", err)
	}

	if status == nil {
		return nil, fmt.Errorf("repository returned nil status")
	}

	return status, nil
}

// PatchMessageMeta updates message metadata using patch semantics.
// Only updates keys present in patchMeta. Use nil value to delete a key.
// Returns the updated user meta (only user-provided metadata, not system fields).
func (s *sessionService) PatchMessageMeta(
	ctx context.Context,
	projectID uuid.UUID,
	sessionID uuid.UUID,
	messageID uuid.UUID,
	patchMeta map[string]interface{},
) (map[string]interface{}, error) {
	// Verify session exists and belongs to project
	session, err := s.sessionRepo.Get(ctx, &model.Session{ID: sessionID})
	if err != nil {
		return nil, fmt.Errorf("session not found")
	}
	if session.ProjectID != projectID {
		return nil, fmt.Errorf("session not found")
	}

	// Get the message (also verifies it belongs to the session)
	msg, err := s.sessionRepo.GetMessageByID(ctx, sessionID, messageID)
	if err != nil {
		return nil, fmt.Errorf("message not found")
	}

	// Get existing meta
	existingMeta := msg.Meta.Data()
	if existingMeta == nil {
		existingMeta = make(map[string]interface{})
	}

	// Extract existing user meta
	var userMeta map[string]interface{}
	if um, ok := existingMeta[model.UserMetaKey].(map[string]interface{}); ok {
		userMeta = um
	} else {
		userMeta = make(map[string]interface{})
	}

	// Apply patch: merge new keys, delete keys with nil value
	for k, v := range patchMeta {
		if v == nil {
			delete(userMeta, k) // null value = delete key
		} else {
			userMeta[k] = v // add or update key
		}
	}

	// Update the __user_meta__ field
	existingMeta[model.UserMetaKey] = userMeta

	// Save to database
	if err := s.sessionRepo.UpdateMessageMeta(ctx, messageID, datatypes.NewJSONType(existingMeta)); err != nil {
		return nil, fmt.Errorf("failed to update message meta: %w", err)
	}

	return userMeta, nil
}

// PatchConfigs updates session configs using patch semantics.
// Only updates keys present in patchConfigs. Use nil value to delete a key.
// Returns the updated configs.
func (s *sessionService) PatchConfigs(
	ctx context.Context,
	projectID uuid.UUID,
	sessionID uuid.UUID,
	patchConfigs map[string]interface{},
) (map[string]interface{}, error) {
	// Verify session exists and belongs to project
	session, err := s.sessionRepo.Get(ctx, &model.Session{ID: sessionID})
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("session not found")
		}
		return nil, fmt.Errorf("failed to get session: %w", err)
	}
	if session.ProjectID != projectID {
		return nil, fmt.Errorf("session not found")
	}

	// Get existing configs
	existingConfigs := make(map[string]interface{})
	if session.Configs != nil {
		for k, v := range session.Configs {
			existingConfigs[k] = v
		}
	}

	// Apply patch: merge new keys, delete keys with nil value
	for k, v := range patchConfigs {
		if v == nil {
			delete(existingConfigs, k) // null value = delete key
		} else {
			existingConfigs[k] = v // add or update key
		}
	}

	// Save to database
	if err := s.sessionRepo.Update(ctx, &model.Session{
		ID:      sessionID,
		Configs: datatypes.JSONMap(existingConfigs),
	}); err != nil {
		return nil, fmt.Errorf("failed to update session configs: %w", err)
	}

	return existingConfigs, nil
}

// CopySession creates a complete copy of a session with all its messages and tasks.
// Returns CopySessionOutput containing old and new session IDs.
func (s *sessionService) CopySession(ctx context.Context, in CopySessionInput) (*CopySessionOutput, error) {
	// Verify session exists and belongs to project
	session, err := s.sessionRepo.Get(ctx, &model.Session{ID: in.SessionID})
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrSessionNotFound
		}
		return nil, fmt.Errorf("failed to get session: %w", err)
	}
	if session.ProjectID != in.ProjectID {
		return nil, ErrSessionNotFound
	}

	// Perform copy operation (size limit check is done atomically inside the transaction)
	result, err := s.sessionRepo.CopySession(ctx, in.SessionID, in.UserKEK)
	if err != nil {
		// Check for size limit error
		if errors.Is(err, repo.ErrSessionTooLarge) {
			return nil, fmt.Errorf("%w: %v", ErrSessionTooLarge, err)
		}
		return nil, fmt.Errorf("%w: %v", ErrCopyFailed, err)
	}

	return &CopySessionOutput{
		OldSessionID: result.OldSessionID,
		NewSessionID: result.NewSessionID,
	}, nil
}
