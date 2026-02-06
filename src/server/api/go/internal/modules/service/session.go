package service

import (
	"context"
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
	Delete(ctx context.Context, projectID uuid.UUID, sessionID uuid.UUID) error
	UpdateByID(ctx context.Context, ss *model.Session) error
	GetByID(ctx context.Context, ss *model.Session) (*model.Session, error)
	List(ctx context.Context, in ListSessionsInput) (*ListSessionsOutput, error)
	StoreMessage(ctx context.Context, in StoreMessageInput) (*model.Message, error)
	GetMessages(ctx context.Context, in GetMessagesInput) (*GetMessagesOutput, error)
	GetAllMessages(ctx context.Context, sessionID uuid.UUID) ([]model.Message, error)
	GetSessionObservingStatus(ctx context.Context, sessionID string) (*model.MessageObservingStatus, error)
	PatchMessageMeta(ctx context.Context, projectID uuid.UUID, sessionID uuid.UUID, messageID uuid.UUID, patchMeta map[string]interface{}) (map[string]interface{}, error)
	PatchConfigs(ctx context.Context, projectID uuid.UUID, sessionID uuid.UUID, patchConfigs map[string]interface{}) (map[string]interface{}, error)
}

type sessionService struct {
	sessionRepo        repo.SessionRepo
	assetReferenceRepo repo.AssetReferenceRepo
	log                *zap.Logger
	s3                 *blob.S3Deps
	publisher          *mq.Publisher
	cfg                *config.Config
	redis              *redis.Client
}

const (
	// Redis key prefix for message parts cache
	redisKeyPrefixParts = "message:parts:"
	// Default TTL for message parts cache (1 hour)
	defaultPartsCacheTTL = time.Hour
)

func NewSessionService(sessionRepo repo.SessionRepo, assetReferenceRepo repo.AssetReferenceRepo, log *zap.Logger, s3 *blob.S3Deps, publisher *mq.Publisher, cfg *config.Config, redis *redis.Client) SessionService {
	return &sessionService{
		sessionRepo:        sessionRepo,
		assetReferenceRepo: assetReferenceRepo,
		log:                log,
		s3:                 s3,
		publisher:          publisher,
		cfg:                cfg,
		redis:              redis,
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
	Role        string
	Parts       []PartIn
	Format      model.MessageFormat    // Message format (acontext, openai, anthropic, gemini)
	MessageMeta map[string]interface{} // Message-level metadata (e.g., name, source_format)
	Files       map[string]*multipart.FileHeader
}

type StoreMQPublishJSON struct {
	ProjectID uuid.UUID `json:"project_id"`
	SessionID uuid.UUID `json:"session_id"`
	MessageID uuid.UUID `json:"message_id"`
}

type PartIn struct {
	Type      string                 `json:"type" validate:"required,oneof=text image audio video file tool-call tool-result data thinking"` // "text" | "image" | ...
	Text      string                 `json:"text,omitempty"`                                                                        // Text sharding
	FileField string                 `json:"file_field,omitempty"`                                                                  // File field name in the form
	Meta      map[string]interface{} `json:"meta,omitempty"`                                                                        // [Optional] metadata
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

	parts := make([]model.Part, 0, len(in.Parts))

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

			// upload asset to S3
			asset, err := s.s3.UploadFormFile(ctx, "assets/"+in.ProjectID.String(), fh)
			if err != nil {
				return nil, fmt.Errorf("upload %s failed: %w", partIn.FileField, err)
			}

			if err := s.assetReferenceRepo.IncrementAssetRef(ctx, in.ProjectID, *asset); err != nil {
				return nil, fmt.Errorf("increment asset reference: %w", err)
			}

			part.Asset = asset
			part.Filename = fh.Filename
		}

		if partIn.Text != "" {
			part.Text = partIn.Text
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

	// Cache parts data in Redis after successful S3 upload
	if s.redis != nil {
		if err := s.cachePartsInRedis(ctx, asset.SHA256, parts); err != nil {
			// Log error but don't fail the request if Redis caching fails
			s.log.Warn("failed to cache parts in Redis", zap.String("sha256", asset.SHA256), zap.Error(err))
		}
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

	// Check if task tracking is disabled for this session
	disableTaskTracking, err := s.sessionRepo.GetDisableTaskTracking(ctx, in.SessionID)
	if err != nil {
		s.log.Error("failed to get disable_task_tracking for session", zap.Error(err))
		// Continue without publishing, but don't fail the request
	} else if s.publisher != nil && !disableTaskTracking {
		// Only publish to MQ if task tracking is enabled
		if err := s.publisher.PublishJSON(ctx, s.cfg.RabbitMQ.ExchangeName.SessionMessage, s.cfg.RabbitMQ.RoutingKey.SessionMessageInsert, StoreMQPublishJSON{
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
	SessionID                     uuid.UUID               `json:"session_id"`
	Limit                         int                     `json:"limit"`
	Cursor                        string                  `json:"cursor"`
	WithAssetPublicURL            bool                    `json:"with_public_url"`
	AssetExpire                   time.Duration           `json:"asset_expire"`
	TimeDesc                      bool                    `json:"time_desc"`
	EditStrategies                []editor.StrategyConfig `json:"edit_strategies,omitempty"`
	PinEditingStrategiesAtMessage string                  `json:"pin_editing_strategies_at_message,omitempty"`
}

type PublicURL struct {
	URL      string    `json:"url"`
	ExpireAt time.Time `json:"expire_at"`
}

type GetMessagesOutput struct {
	Items           []model.Message      `json:"items"`
	NextCursor      string               `json:"next_cursor,omitempty"`
	HasMore         bool                 `json:"has_more"`
	PublicURLs      map[string]PublicURL `json:"public_urls,omitempty"` // file_name -> url
	EditAtMessageID string               `json:"edit_at_message_id,omitempty"`
}

func (s *sessionService) GetMessages(ctx context.Context, in GetMessagesInput) (*GetMessagesOutput, error) {
	var msgs []model.Message
	var err error

	// Retrieve messages based on limit
	if in.Limit <= 0 {
		// If limit <= 0, retrieve all messages
		msgs, err = s.sessionRepo.ListAllMessagesBySession(ctx, in.SessionID)
		if err != nil {
			return nil, err
		}
	} else {
		// Parse cursor (createdAt, id); an empty cursor indicates starting from the latest
		var afterT time.Time
		var afterID uuid.UUID
		if in.Cursor != "" {
			afterT, afterID, err = paging.DecodeCursor(in.Cursor)
			if err != nil {
				return nil, err
			}
		}

		// Query limit+1 is used to determine has_more
		msgs, err = s.sessionRepo.ListBySessionWithCursor(ctx, in.SessionID, afterT, afterID, in.Limit+1, in.TimeDesc)
		if err != nil {
			return nil, err
		}
	}

	// Load parts for each message
	for i, m := range msgs {
		meta := m.PartsAssetMeta.Data()
		parts := s.loadPartsForMessage(ctx, meta)
		if len(parts) == 0 {
			continue // Skip messages with failed parts loading
		}
		msgs[i].Parts = parts
	}

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

	// Generate presigned URLs for assets if requested
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

// cachePartsInRedis stores message parts in Redis with a fixed TTL
func (s *sessionService) cachePartsInRedis(ctx context.Context, sha256 string, parts []model.Part) error {
	if s.redis == nil {
		return errors.New("redis client is not available")
	}

	// Serialize parts to JSON
	jsonData, err := sonic.Marshal(parts)
	if err != nil {
		return fmt.Errorf("marshal parts to JSON: %w", err)
	}

	// Use SHA256 as part of Redis key for content-based caching
	redisKey := redisKeyPrefixParts + sha256

	// Store in Redis with fixed TTL
	if err := s.redis.Set(ctx, redisKey, jsonData, defaultPartsCacheTTL).Err(); err != nil {
		return fmt.Errorf("set Redis key %s: %w", redisKey, err)
	}

	return nil
}

// getPartsFromRedis retrieves message parts from Redis cache
// Returns (nil, redis.Nil) on cache miss, which is a normal condition
func (s *sessionService) getPartsFromRedis(ctx context.Context, sha256 string) ([]model.Part, error) {
	if s.redis == nil {
		return nil, errors.New("redis client is not available")
	}

	redisKey := redisKeyPrefixParts + sha256

	// Get from Redis
	val, err := s.redis.Get(ctx, redisKey).Result()
	if err != nil {
		// redis.Nil means key doesn't exist (cache miss), which is normal
		if err == redis.Nil {
			return nil, redis.Nil
		}
		// Other errors are actual Redis errors
		return nil, fmt.Errorf("get Redis key %s: %w", redisKey, err)
	}

	// Deserialize JSON to parts
	var parts []model.Part
	if err := sonic.Unmarshal([]byte(val), &parts); err != nil {
		return nil, fmt.Errorf("unmarshal parts from JSON: %w", err)
	}

	return parts, nil
}

// loadPartsForMessage loads parts for a message from cache or S3
// Returns the loaded parts, or empty slice if loading fails
func (s *sessionService) loadPartsForMessage(ctx context.Context, meta model.Asset) []model.Part {
	parts := []model.Part{}
	cacheHit := false

	// Try to get parts from Redis cache first, fallback to S3 if not found
	if s.redis != nil {
		if cachedParts, err := s.getPartsFromRedis(ctx, meta.SHA256); err == nil {
			parts = cachedParts
			cacheHit = true
		} else if err != redis.Nil {
			// Log actual Redis errors (not cache misses)
			s.log.Warn("failed to get parts from Redis", zap.String("sha256", meta.SHA256), zap.Error(err))
		}
	}

	// If cache miss, download from S3
	if !cacheHit && s.s3 != nil {
		if err := s.s3.DownloadJSON(ctx, meta.S3Key, &parts); err != nil {
			s.log.Warn("failed to download parts from S3", zap.String("sha256", meta.SHA256), zap.Error(err))
			return parts // Return empty parts on S3 download failure
		}
		// Cache the parts in Redis after successful S3 download
		if s.redis != nil {
			if err := s.cachePartsInRedis(ctx, meta.SHA256, parts); err != nil {
				// Log error but don't fail the request if Redis caching fails
				s.log.Warn("failed to cache parts in Redis", zap.String("sha256", meta.SHA256), zap.Error(err))
			}
		}
	}

	return parts
}

// GetAllMessages retrieves all messages for a session and loads their parts
func (s *sessionService) GetAllMessages(ctx context.Context, sessionID uuid.UUID) ([]model.Message, error) {
	// Get all messages from repository
	msgs, err := s.sessionRepo.ListAllMessagesBySession(ctx, sessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to list messages: %w", err)
	}

	// Load parts for each message
	for i, m := range msgs {
		meta := m.PartsAssetMeta.Data()
		msgs[i].Parts = s.loadPartsForMessage(ctx, meta)
	}

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
