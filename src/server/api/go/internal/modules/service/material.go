package service

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/memodb-io/Acontext/internal/config"
	"github.com/memodb-io/Acontext/internal/infra/blob"
	"github.com/redis/go-redis/v9"
)

var ErrMaterialNotFound = errors.New("material token not found or expired")

// MaterialMeta is the JSON value stored in Redis for each material token.
type MaterialMeta struct {
	S3Key    string `json:"s3_key"`
	UserKEK  string `json:"user_kek,omitempty"` // base64-encoded, empty for non-encrypted
	MIMEType string `json:"mime_type,omitempty"`
	FileName string `json:"file_name,omitempty"`
}

// MaterialService creates and serves material URLs backed by Redis tokens.
type MaterialService interface {
	// CreateMaterialURL generates a token, stores metadata in Redis, and returns a full URL + expiry.
	CreateMaterialURL(ctx context.Context, s3Key string, userKEK string, expire time.Duration, mimeType string, fileName string) (url string, expireAt time.Time, err error)
	// ServeMaterial looks up a token, downloads from S3, decrypts if needed, and returns content.
	ServeMaterial(ctx context.Context, token string) (content []byte, mimeType string, fileName string, err error)
}

type materialService struct {
	redis *redis.Client
	s3    *blob.S3Deps
	cfg   *config.Config
}

func NewMaterialService(redis *redis.Client, s3 *blob.S3Deps, cfg *config.Config) MaterialService {
	return &materialService{redis: redis, s3: s3, cfg: cfg}
}

const redisKeyPrefixMaterial = "material:"

func (m *materialService) CreateMaterialURL(ctx context.Context, s3Key string, userKEK string, expire time.Duration, mimeType string, fileName string) (string, time.Time, error) {
	// Generate 32 random bytes → 64-char hex token
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return "", time.Time{}, fmt.Errorf("generate token: %w", err)
	}
	token := hex.EncodeToString(tokenBytes)

	meta := MaterialMeta{
		S3Key:    s3Key,
		UserKEK:  userKEK,
		MIMEType: mimeType,
		FileName: fileName,
	}

	data, err := json.Marshal(meta)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("marshal material meta: %w", err)
	}

	redisKey := redisKeyPrefixMaterial + token
	if err := m.redis.Set(ctx, redisKey, data, expire).Err(); err != nil {
		return "", time.Time{}, fmt.Errorf("store material token in Redis: %w", err)
	}

	expireAt := time.Now().Add(expire)
	url := m.buildURL(token)
	return url, expireAt, nil
}

func (m *materialService) ServeMaterial(ctx context.Context, token string) ([]byte, string, string, error) {
	redisKey := redisKeyPrefixMaterial + token

	val, err := m.redis.Get(ctx, redisKey).Bytes()
	if err != nil {
		if err == redis.Nil {
			return nil, "", "", ErrMaterialNotFound
		}
		return nil, "", "", fmt.Errorf("get material token from Redis: %w", err)
	}

	var meta MaterialMeta
	if err := json.Unmarshal(val, &meta); err != nil {
		return nil, "", "", fmt.Errorf("unmarshal material meta: %w", err)
	}

	// Decode userKEK if present
	var userKEK []byte
	if meta.UserKEK != "" {
		decoded, err := base64.StdEncoding.DecodeString(meta.UserKEK)
		if err != nil {
			return nil, "", "", fmt.Errorf("decode user KEK: %w", err)
		}
		userKEK = decoded
	}

	content, err := m.s3.DownloadFile(ctx, meta.S3Key, userKEK)
	if err != nil {
		return nil, "", "", fmt.Errorf("download file from S3: %w", err)
	}

	return content, meta.MIMEType, meta.FileName, nil
}

func (m *materialService) buildURL(token string) string {
	base := m.cfg.App.ExternalURL
	if base == "" {
		host := m.cfg.App.Host
		if host == "" {
			host = "localhost"
		}
		base = fmt.Sprintf("http://%s:%d", host, m.cfg.App.Port)
	}
	return fmt.Sprintf("%s/api/v1/material/%s", base, token)
}
