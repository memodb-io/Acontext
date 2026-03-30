package handler

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"

	"github.com/memodb-io/Acontext/internal/infra/blob"
	"github.com/memodb-io/Acontext/internal/middleware"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/repo"
	"github.com/memodb-io/Acontext/internal/modules/serializer"
	"gorm.io/gorm"
)

// encryptProject is the shared implementation for enabling project encryption.
// Both AdminHandler and ProjectHandler delegate to this function.
func encryptProject(c *gin.Context, db *gorm.DB, rdb *redis.Client, s3 *blob.S3Deps, assetRefRepo repo.AssetReferenceRepo) {
	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("project not found", fmt.Errorf("project not found")))
		return
	}

	userKEK := middleware.GetUserKEK(c)
	if userKEK == nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("compact API key required to derive encryption key; rotate your API key to enable encryption", nil))
		return
	}

	// No early-return if EncryptionEnabled is already true — allow idempotent
	// retry so that partial failures (crash after flag set, before all objects
	// encrypted) can be recovered by re-calling this endpoint.
	// EncryptObject skips already-encrypted objects, and the DB UPDATE is a no-op
	// when the flag is already true.

	// Set encryption_enabled = true FIRST for crash safety.
	// If we crash after this but before encrypting all objects, reads will use KEK
	// and unencrypted objects pass through decryption gracefully. Retry re-encrypts
	// remaining objects (EncryptObject is idempotent).
	if err := db.WithContext(c.Request.Context()).Model(&model.Project{}).
		Where("id = ?", project.ID).
		Update("encryption_enabled", true).Error; err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("failed to update project", err))
		return
	}

	// Invalidate cached project so subsequent requests see encryption_enabled = true
	middleware.InvalidateProjectAuthCache(rdb, project.SecretKeyHMAC)

	// Enumerate all S3 keys for this project
	s3Keys, err := assetRefRepo.ListS3KeysByProject(c.Request.Context(), project.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("failed to list S3 keys", err))
		return
	}

	// Encrypt each object (idempotent — skips already-encrypted objects)
	for _, key := range s3Keys {
		if err := s3.EncryptObject(c.Request.Context(), key, userKEK); err != nil {
			c.JSON(http.StatusInternalServerError, serializer.DBErr(fmt.Sprintf("failed to encrypt object %s", key), err))
			return
		}
	}

	c.JSON(http.StatusOK, serializer.Response{Msg: "encryption enabled"})
}

// decryptProject is the shared implementation for disabling project encryption.
// Both AdminHandler and ProjectHandler delegate to this function.
func decryptProject(c *gin.Context, db *gorm.DB, rdb *redis.Client, s3 *blob.S3Deps, assetRefRepo repo.AssetReferenceRepo) {
	project, ok := c.MustGet("project").(*model.Project)
	if !ok {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("project not found", fmt.Errorf("project not found")))
		return
	}

	userKEK := middleware.GetUserKEK(c)
	if userKEK == nil {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("compact API key required to derive encryption key; rotate your API key to disable encryption", nil))
		return
	}

	if !project.EncryptionEnabled {
		c.JSON(http.StatusBadRequest, serializer.ParamErr("project encryption is not enabled", nil))
		return
	}

	// Enumerate all S3 keys for this project
	s3Keys, err := assetRefRepo.ListS3KeysByProject(c.Request.Context(), project.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("failed to list S3 keys", err))
		return
	}

	// Decrypt each object FIRST, then clear the flag (idempotent — skips already-decrypted).
	// If we crash mid-decrypt, flag stays true so reads use KEK, which works on
	// both encrypted and already-decrypted objects. Retry re-decrypts remaining.
	for _, key := range s3Keys {
		if err := s3.DecryptObject(c.Request.Context(), key, userKEK); err != nil {
			c.JSON(http.StatusInternalServerError, serializer.DBErr(fmt.Sprintf("failed to decrypt object %s", key), err))
			return
		}
	}

	// Set encryption_enabled = false AFTER all objects are decrypted
	if err := db.WithContext(c.Request.Context()).Model(&model.Project{}).
		Where("id = ?", project.ID).
		Update("encryption_enabled", false).Error; err != nil {
		c.JSON(http.StatusInternalServerError, serializer.DBErr("failed to update project", err))
		return
	}

	// Invalidate cached project so subsequent requests see encryption_enabled = false
	middleware.InvalidateProjectAuthCache(rdb, project.SecretKeyHMAC)

	c.JSON(http.StatusOK, serializer.Response{Msg: "encryption disabled"})
}
