package blob

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/url"
	"path/filepath"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsCfg "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/feature/s3/manager"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	s3types "github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/bytedance/sonic"
	"github.com/memodb-io/Acontext/internal/config"
	encryptionpkg "github.com/memodb-io/Acontext/internal/infra/crypto"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/pkg/utils/mime"
	"go.opentelemetry.io/contrib/instrumentation/github.com/aws/aws-sdk-go-v2/otelaws"
	"go.opentelemetry.io/otel"
)

type S3Deps struct {
	Client    *s3.Client
	Uploader  *manager.Uploader
	Presigner *s3.PresignClient
	Bucket    string
	SSE       *s3types.ServerSideEncryption
	EncSvc    *encryptionpkg.EncryptionService
}

func NewS3(ctx context.Context, cfg *config.Config, encSvc *encryptionpkg.EncryptionService) (*S3Deps, error) {
	loadOpts := []func(*awsCfg.LoadOptions) error{
		awsCfg.WithRegion(cfg.S3.Region),
	}
	if cfg.S3.AccessKey != "" && cfg.S3.SecretKey != "" {
		loadOpts = append(loadOpts, awsCfg.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(cfg.S3.AccessKey, cfg.S3.SecretKey, ""),
		))
	}

	acfg, err := awsCfg.LoadDefaultConfig(ctx, loadOpts...)
	if err != nil {
		return nil, err
	}

	// Add OpenTelemetry middleware if tracer provider is set
	// This should be called after telemetry.SetupTracing() to ensure tracer provider is set
	if otel.GetTracerProvider() != nil {
		otelaws.AppendMiddlewares(&acfg.APIOptions)
	}

	// Helper function to normalize endpoint URL
	normalizeEndpoint := func(endpoint string) string {
		ep := strings.TrimSpace(endpoint)
		if ep == "" {
			return ""
		}
		if !strings.HasPrefix(ep, "http://") && !strings.HasPrefix(ep, "https://") {
			ep = "https://" + ep
		}
		return ep
	}

	// Use InternalEndpoint for S3 operations if available, otherwise fall back to Endpoint
	internalEp := cfg.S3.InternalEndpoint
	if internalEp == "" {
		internalEp = cfg.S3.Endpoint
	}
	internalEp = normalizeEndpoint(internalEp)

	// S3 client options for internal operations
	s3InternalOpts := func(o *s3.Options) {
		if internalEp != "" {
			if u, uerr := url.Parse(internalEp); uerr == nil {
				o.BaseEndpoint = aws.String(u.String())
			}
		}
		o.UsePathStyle = cfg.S3.UsePathStyle
	}

	// Create client and uploader using internal endpoint
	client := s3.NewFromConfig(acfg, s3InternalOpts)
	uploader := manager.NewUploader(client)

	// Create presigner using public endpoint for external access
	publicEp := normalizeEndpoint(cfg.S3.Endpoint)
	s3PublicOpts := func(o *s3.Options) {
		if publicEp != "" {
			if u, uerr := url.Parse(publicEp); uerr == nil {
				o.BaseEndpoint = aws.String(u.String())
			}
		}
		o.UsePathStyle = cfg.S3.UsePathStyle
	}
	presignerClient := s3.NewFromConfig(acfg, s3PublicOpts)
	presigner := s3.NewPresignClient(presignerClient)

	var sse *s3types.ServerSideEncryption
	if cfg.S3.SSE != "" {
		v := s3types.ServerSideEncryption(cfg.S3.SSE)
		sse = &v
	}

	if cfg.S3.Bucket == "" {
		return nil, errors.New("s3 bucket is empty")
	}
	if _, err := client.HeadBucket(ctx, &s3.HeadBucketInput{
		Bucket: aws.String(cfg.S3.Bucket),
	}); err != nil {
		return nil, fmt.Errorf("connect to s3 bucket %s: %w", cfg.S3.Bucket, err)
	}

	return &S3Deps{
		Client:    client,
		Uploader:  uploader,
		Presigner: presigner,
		Bucket:    cfg.S3.Bucket,
		SSE:       sse,
		EncSvc:    encSvc,
	}, nil
}

// Generate a pre-signed PUT URL (recommended for direct uploading of large files)
func (s *S3Deps) PresignPut(ctx context.Context, key, contentType string, expire time.Duration) (string, error) {
	params := &s3.PutObjectInput{
		Bucket:      &s.Bucket,
		Key:         &key,
		ContentType: &contentType,
	}
	if s.SSE != nil {
		params.ServerSideEncryption = *s.SSE
	}
	ps, err := s.Presigner.PresignPutObject(ctx, params, func(po *s3.PresignOptions) {
		po.Expires = expire
	})
	if err != nil {
		return "", err
	}
	return ps.URL, nil
}

// Generate a pre-signed GET URL
func (s *S3Deps) PresignGet(ctx context.Context, key string, expire time.Duration) (string, error) {
	if key == "" {
		return "", errors.New("key is empty")
	}
	ps, err := s.Presigner.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: &s.Bucket,
		Key:    &key,
	}, func(po *s3.PresignOptions) {
		po.Expires = expire
	})
	if err != nil {
		return "", err
	}
	return ps.URL, nil
}

// Add helper function to clean ETag
func cleanETag(etag string) string {
	if etag == "" {
		return etag
	}
	// Remove surrounding quotes that AWS includes in ETag responses
	return strings.Trim(etag, `"`)
}

// EncryptionEnabled returns true if both the EncryptionService is available and enabled.
// Safe to call on nil receiver.
func (u *S3Deps) EncryptionEnabled() bool {
	return u != nil && u.EncSvc != nil && u.EncSvc.Enabled()
}

// encryptAndMergeMetadata encrypts content if encryption is enabled and a userKEK is provided.
// Returns the (possibly encrypted) content and updated metadata map.
func (u *S3Deps) encryptAndMergeMetadata(content []byte, userKEK []byte, metadata map[string]string) ([]byte, map[string]string, error) {
	if !u.EncryptionEnabled() || userKEK == nil {
		return content, metadata, nil
	}
	ciphertext, encMeta, err := u.EncSvc.EncryptData(content, userKEK)
	if err != nil {
		return nil, nil, fmt.Errorf("encrypt data: %w", err)
	}
	// Merge encryption metadata into the existing metadata map
	for k, v := range encMeta.MetadataToMap() {
		metadata[k] = v
	}
	return ciphertext, metadata, nil
}

// uploadWithDedup performs content-addressed deduplicated upload.
// It searches for existing objects under keyPrefix that contain the given sumHex in the key.
// If found, returns its metadata; otherwise uploads the new content using date + sumHex + ext as key.
// userKEK is optional; when non-nil and encryption is enabled, the data is encrypted before upload.
func (u *S3Deps) uploadWithDedup(
	ctx context.Context,
	keyPrefix string,
	sumHex string,
	contentType string,
	ext string,
	size int64,
	body io.Reader,
	metadata map[string]string,
	userKEK []byte,
) (*model.Asset, error) {
	// Check for existing object with pagination support
	listInput := &s3.ListObjectsV2Input{
		Bucket: &u.Bucket,
		Prefix: &keyPrefix,
	}

	var continuationToken *string
	for {
		listInput.ContinuationToken = continuationToken
		result, err := u.Client.ListObjectsV2(ctx, listInput)
		if err != nil {
			break
		}

		if result.Contents != nil {
			for _, obj := range result.Contents {
				if obj.Key != nil && strings.Contains(*obj.Key, sumHex) {
					if headResult, herr := u.Client.HeadObject(ctx, &s3.HeadObjectInput{
						Bucket: &u.Bucket,
						Key:    obj.Key,
					}); herr == nil {
						return &model.Asset{
							Bucket: u.Bucket,
							S3Key:  *obj.Key,
							ETag:   cleanETag(*headResult.ETag),
							SHA256: sumHex,
							MIME:   contentType,
							SizeB:  aws.ToInt64(headResult.ContentLength),
						}, nil
					}
				}
			}
		}

		// Check if there are more pages
		if !aws.ToBool(result.IsTruncated) {
			break
		}
		continuationToken = result.NextContinuationToken
	}

	// No existing file found, upload new file with date prefix
	datePrefix := time.Now().UTC().Format("2006/01/02")
	key := fmt.Sprintf("%s/%s/%s%s", keyPrefix, datePrefix, sumHex, ext)

	// Read body into bytes for potential encryption
	var bodyBuf bytes.Buffer
	if _, err := io.Copy(&bodyBuf, body); err != nil {
		return nil, fmt.Errorf("read body: %w", err)
	}
	uploadBytes := bodyBuf.Bytes()

	// Encrypt if enabled
	var encErr error
	uploadBytes, metadata, encErr = u.encryptAndMergeMetadata(uploadBytes, userKEK, metadata)
	if encErr != nil {
		return nil, encErr
	}

	input := &s3.PutObjectInput{
		Bucket:      aws.String(u.Bucket),
		Key:         aws.String(key),
		Body:        bytes.NewReader(uploadBytes),
		ContentType: aws.String(contentType),
		Metadata:    metadata,
	}
	if u.SSE != nil {
		input.ServerSideEncryption = *u.SSE
	}

	out, err := u.Uploader.Upload(ctx, input)
	if err != nil {
		return nil, err
	}

	return &model.Asset{
		Bucket: u.Bucket,
		S3Key:  key,
		ETag:   cleanETag(*out.ETag),
		SHA256: sumHex,
		MIME:   contentType,
		SizeB:  size, // original plaintext size
	}, nil
}

// UploadFormFile uploads a file to S3 with automatic deduplication.
// userKEK is optional; when non-nil and encryption is enabled, the data is encrypted before upload.
func (u *S3Deps) UploadFormFile(ctx context.Context, keyPrefix string, fh *multipart.FileHeader, userKEK []byte) (*model.Asset, error) {
	file, err := fh.Open()
	if err != nil {
		return nil, err
	}
	defer file.Close()

	// Read file content into memory
	var buf bytes.Buffer
	if _, err := io.Copy(&buf, file); err != nil {
		return nil, err
	}
	fileContent := buf.Bytes()

	// Calculate SHA256 of the file content
	h := sha256.New()
	h.Write(fileContent)
	sumHex := hex.EncodeToString(h.Sum(nil))

	ext := strings.ToLower(filepath.Ext(fh.Filename))

	// Detect MIME type from file content, with extension-based refinement for text files
	contentType := mime.DetectMimeType(fileContent, fh.Filename)

	return u.uploadWithDedup(
		ctx,
		keyPrefix,
		sumHex,
		contentType,
		ext,
		int64(len(fileContent)),
		bytes.NewReader(fileContent),
		map[string]string{
			"sha256": sumHex,
			"name":   fh.Filename,
		},
		userKEK,
	)
}

// UploadBytes uploads raw bytes to S3 with automatic deduplication.
// userKEK is optional; when non-nil and encryption is enabled, the data is encrypted before upload.
func (u *S3Deps) UploadBytes(ctx context.Context, keyPrefix string, filename string, content []byte, userKEK []byte) (*model.Asset, error) {
	// Calculate SHA256 of the content
	h := sha256.New()
	h.Write(content)
	sumHex := hex.EncodeToString(h.Sum(nil))

	ext := strings.ToLower(filepath.Ext(filename))

	// Detect MIME type from content, with extension-based refinement for text files
	contentType := mime.DetectMimeType(content, filename)

	return u.uploadWithDedup(
		ctx,
		keyPrefix,
		sumHex,
		contentType,
		ext,
		int64(len(content)),
		bytes.NewReader(content),
		map[string]string{
			"sha256": sumHex,
			"name":   filename,
		},
		userKEK,
	)
}

// UploadJSON uploads JSON data to S3 and returns metadata.
// userKEK is optional; when non-nil and encryption is enabled, the data is encrypted before upload.
func (u *S3Deps) UploadJSON(ctx context.Context, keyPrefix string, data interface{}, userKEK []byte) (*model.Asset, error) {
	// Serialize data to JSON
	jsonData, err := sonic.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("marshal json: %w", err)
	}

	// Calculate SHA256 of the JSON data
	h := sha256.New()
	h.Write(jsonData)
	sumHex := hex.EncodeToString(h.Sum(nil))

	return u.uploadWithDedup(
		ctx,
		keyPrefix,
		sumHex,
		"application/json",
		".json",
		int64(len(jsonData)),
		bytes.NewReader(jsonData),
		map[string]string{
			"sha256": sumHex,
		},
		userKEK,
	)
}

// UploadFileDirect uploads a file directly to S3 at the specified key (no deduplication).
// userKEK is optional; when non-nil and encryption is enabled, the data is encrypted before upload.
func (u *S3Deps) UploadFileDirect(ctx context.Context, key string, content []byte, contentType string, userKEK []byte) (*model.Asset, error) {
	if key == "" {
		return nil, errors.New("key is empty")
	}

	// Calculate SHA256
	h := sha256.New()
	h.Write(content)
	sumHex := hex.EncodeToString(h.Sum(nil))

	metadata := map[string]string{
		"sha256": sumHex,
	}

	uploadBytes := content
	var encErr error
	uploadBytes, metadata, encErr = u.encryptAndMergeMetadata(uploadBytes, userKEK, metadata)
	if encErr != nil {
		return nil, encErr
	}

	input := &s3.PutObjectInput{
		Bucket:      aws.String(u.Bucket),
		Key:         aws.String(key),
		Body:        bytes.NewReader(uploadBytes),
		ContentType: aws.String(contentType),
		Metadata:    metadata,
	}
	if u.SSE != nil {
		input.ServerSideEncryption = *u.SSE
	}

	out, err := u.Uploader.Upload(ctx, input)
	if err != nil {
		return nil, err
	}

	return &model.Asset{
		Bucket: u.Bucket,
		S3Key:  key,
		ETag:   cleanETag(*out.ETag),
		SHA256: sumHex,
		MIME:   contentType,
		SizeB:  int64(len(content)), // original plaintext size
	}, nil
}

// decryptIfNeeded checks S3 object metadata for encryption markers and decrypts if needed.
// Uses admin KEK for decryption (server-side operations always use admin KEK).
// Returns the original data for non-encrypted objects (backward compatibility).
func (u *S3Deps) decryptIfNeeded(data []byte, metadata map[string]string) ([]byte, error) {
	encMeta := encryptionpkg.MetadataFromMap(metadata)
	if encMeta == nil {
		// Not encrypted, return as-is
		return data, nil
	}
	if u.EncSvc == nil || !u.EncSvc.Enabled() {
		return nil, errors.New("encrypted object but encryption service not enabled")
	}
	return u.EncSvc.DecryptWithAdminKEK(data, encMeta)
}

// downloadRaw downloads the raw bytes and metadata from S3 without any decryption.
func (u *S3Deps) downloadRaw(ctx context.Context, key string) ([]byte, map[string]string, error) {
	if key == "" {
		return nil, nil, errors.New("key is empty")
	}
	result, err := u.Client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: &u.Bucket,
		Key:    &key,
	})
	if err != nil {
		return nil, nil, fmt.Errorf("get object from S3: %w", err)
	}
	defer result.Body.Close()

	var buf bytes.Buffer
	if _, err = buf.ReadFrom(result.Body); err != nil {
		return nil, nil, fmt.Errorf("read response body: %w", err)
	}

	metadata := make(map[string]string)
	if result.Metadata != nil {
		metadata = result.Metadata
	}
	return buf.Bytes(), metadata, nil
}

// DownloadJSON downloads JSON data from S3, auto-decrypts if encrypted, and unmarshals.
func (u *S3Deps) DownloadJSON(ctx context.Context, key string, target interface{}) error {
	data, metadata, err := u.downloadRaw(ctx, key)
	if err != nil {
		return err
	}

	data, err = u.decryptIfNeeded(data, metadata)
	if err != nil {
		return fmt.Errorf("decrypt: %w", err)
	}

	if err := sonic.Unmarshal(data, target); err != nil {
		return fmt.Errorf("unmarshal json: %w", err)
	}
	return nil
}

// DownloadFile downloads file content from S3, auto-decrypts if encrypted, returns plaintext.
func (u *S3Deps) DownloadFile(ctx context.Context, key string) ([]byte, error) {
	data, metadata, err := u.downloadRaw(ctx, key)
	if err != nil {
		return nil, err
	}
	return u.decryptIfNeeded(data, metadata)
}

// DeleteObject deletes an object from S3
func (u *S3Deps) DeleteObject(ctx context.Context, key string) error {
	if key == "" {
		return errors.New("key is empty")
	}

	_, err := u.Client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: &u.Bucket,
		Key:    &key,
	})
	if err != nil {
		return fmt.Errorf("delete object from S3: %w", err)
	}

	return nil
}

// DeleteObjects deletes multiple objects from S3
func (u *S3Deps) DeleteObjects(ctx context.Context, keys []string) error {
	if len(keys) == 0 {
		return nil
	}

	// Convert keys to S3 object identifiers
	objects := make([]s3types.ObjectIdentifier, 0, len(keys))
	for _, key := range keys {
		if key != "" {
			objects = append(objects, s3types.ObjectIdentifier{
				Key: aws.String(key),
			})
		}
	}

	if len(objects) == 0 {
		return nil
	}

	// Delete objects in batches (S3 allows up to 1000 objects per request)
	const batchSize = 1000
	for i := 0; i < len(objects); i += batchSize {
		end := i + batchSize
		if end > len(objects) {
			end = len(objects)
		}

		_, err := u.Client.DeleteObjects(ctx, &s3.DeleteObjectsInput{
			Bucket: &u.Bucket,
			Delete: &s3types.Delete{
				Objects: objects[i:end],
				Quiet:   aws.Bool(true), // Don't return deleted objects in response
			},
		})
		if err != nil {
			return fmt.Errorf("delete objects from S3: %w", err)
		}
	}

	return nil
}

// DeleteObjectsByPrefix recursively deletes all objects with the given prefix
// This is equivalent to deleting an entire "directory" in S3
func (u *S3Deps) DeleteObjectsByPrefix(ctx context.Context, prefix string) error {
	if prefix == "" {
		return errors.New("prefix is empty")
	}

	// Ensure prefix ends with "/" to list all objects under this directory
	prefixWithSlash := prefix
	if !strings.HasSuffix(prefix, "/") {
		prefixWithSlash = prefix + "/"
	}

	// List all objects with pagination support
	var allKeys []string
	listInput := &s3.ListObjectsV2Input{
		Bucket: &u.Bucket,
		Prefix: &prefixWithSlash,
	}

	var continuationToken *string
	for {
		listInput.ContinuationToken = continuationToken
		result, err := u.Client.ListObjectsV2(ctx, listInput)
		if err != nil {
			return fmt.Errorf("list objects from S3: %w", err)
		}

		if result.Contents != nil {
			for _, obj := range result.Contents {
				if obj.Key != nil {
					allKeys = append(allKeys, *obj.Key)
				}
			}
		}

		// Check if there are more pages
		if !aws.ToBool(result.IsTruncated) {
			break
		}
		continuationToken = result.NextContinuationToken
	}

	// Delete all found objects in batches
	if len(allKeys) > 0 {
		return u.DeleteObjects(ctx, allKeys)
	}

	return nil
}
