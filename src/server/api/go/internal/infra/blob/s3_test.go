package blob

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"mime/multipart"
	"net/textproto"
	"strings"
	"testing"

	"github.com/bytedance/sonic"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPrepareJSONAsset(t *testing.T) {
	s3 := &S3Deps{Bucket: "test-bucket"}

	data := map[string]string{"hello": "world"}
	prepared, err := s3.PrepareJSONAsset("parts/project-123", data)
	require.NoError(t, err)

	// Verify SHA256 matches manual computation
	jsonBytes, _ := sonic.Marshal(data)
	h := sha256.New()
	h.Write(jsonBytes)
	expectedSHA := hex.EncodeToString(h.Sum(nil))

	assert.Equal(t, expectedSHA, prepared.Asset.SHA256)
	assert.Equal(t, "test-bucket", prepared.Asset.Bucket)
	assert.Equal(t, "application/json", prepared.Asset.MIME)
	assert.Equal(t, int64(len(jsonBytes)), prepared.Asset.SizeB)
	assert.Equal(t, jsonBytes, prepared.Content)

	// Verify S3 key format: {prefix}/{date}/{sha256}.json
	assert.True(t, strings.HasPrefix(prepared.Asset.S3Key, "parts/project-123/"))
	assert.True(t, strings.HasSuffix(prepared.Asset.S3Key, expectedSHA+".json"))

	// Verify metadata
	assert.Equal(t, expectedSHA, prepared.Metadata["sha256"])
}

func TestPrepareJSONAsset_Deterministic(t *testing.T) {
	s3 := &S3Deps{Bucket: "test-bucket"}

	data := []int{1, 2, 3}
	p1, err := s3.PrepareJSONAsset("prefix", data)
	require.NoError(t, err)

	p2, err := s3.PrepareJSONAsset("prefix", data)
	require.NoError(t, err)

	// Same input produces same SHA256 and key
	assert.Equal(t, p1.Asset.SHA256, p2.Asset.SHA256)
	assert.Equal(t, p1.Asset.S3Key, p2.Asset.S3Key)
	assert.Equal(t, p1.Content, p2.Content)
}

func TestPrepareJSONAsset_DifferentData(t *testing.T) {
	s3 := &S3Deps{Bucket: "test-bucket"}

	p1, err := s3.PrepareJSONAsset("prefix", "aaa")
	require.NoError(t, err)

	p2, err := s3.PrepareJSONAsset("prefix", "bbb")
	require.NoError(t, err)

	assert.NotEqual(t, p1.Asset.SHA256, p2.Asset.SHA256)
}

// newTestFileHeader creates a multipart.FileHeader for testing.
func newTestFileHeader(filename string, content []byte) *multipart.FileHeader {
	var b bytes.Buffer
	w := multipart.NewWriter(&b)
	part, _ := w.CreatePart(textproto.MIMEHeader{
		"Content-Disposition": {`form-data; name="file"; filename="` + filename + `"`},
		"Content-Type":        {"application/octet-stream"},
	})
	part.Write(content)
	w.Close()

	r := multipart.NewReader(&b, w.Boundary())
	form, _ := r.ReadForm(1 << 20)
	return form.File["file"][0]
}

func TestPrepareFormFileAsset(t *testing.T) {
	s3 := &S3Deps{Bucket: "test-bucket"}

	content := []byte("test file content")
	fh := newTestFileHeader("document.txt", content)

	prepared, err := s3.PrepareFormFileAsset("assets/project-456", fh)
	require.NoError(t, err)

	// Verify SHA256
	h := sha256.New()
	h.Write(content)
	expectedSHA := hex.EncodeToString(h.Sum(nil))

	assert.Equal(t, expectedSHA, prepared.Asset.SHA256)
	assert.Equal(t, "test-bucket", prepared.Asset.Bucket)
	assert.Equal(t, int64(len(content)), prepared.Asset.SizeB)
	assert.Equal(t, content, prepared.Content)

	// Verify S3 key has correct extension
	assert.True(t, strings.HasSuffix(prepared.Asset.S3Key, expectedSHA+".txt"))
	assert.True(t, strings.HasPrefix(prepared.Asset.S3Key, "assets/project-456/"))

	// Verify metadata includes filename
	assert.Equal(t, expectedSHA, prepared.Metadata["sha256"])
	assert.Equal(t, "document.txt", prepared.Metadata["name"])
}

func TestPrepareFormFileAsset_Deterministic(t *testing.T) {
	s3 := &S3Deps{Bucket: "test-bucket"}

	content := []byte("same content")
	fh1 := newTestFileHeader("file.bin", content)
	fh2 := newTestFileHeader("file.bin", content)

	p1, err := s3.PrepareFormFileAsset("prefix", fh1)
	require.NoError(t, err)

	p2, err := s3.PrepareFormFileAsset("prefix", fh2)
	require.NoError(t, err)

	assert.Equal(t, p1.Asset.SHA256, p2.Asset.SHA256)
	assert.Equal(t, p1.Asset.S3Key, p2.Asset.S3Key)
}
