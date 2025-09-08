package bootstrap

import (
	"context"

	"github.com/memodb-io/Acontext/internal/config"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/pkg/utils/secrets"
	"github.com/memodb-io/Acontext/internal/pkg/utils/tokens"
	"go.uber.org/zap"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// EnsureDefaultProjectExists Create/align the default Project when the service starts
func EnsureDefaultProjectExists(ctx context.Context, db *gorm.DB, cfg *config.Config, log *zap.Logger) error {
	secret := cfg.Root.ApiBearerToken
	pepper := cfg.Root.SecretPepper

	if secret == "" || pepper == "" {
		return nil
	}

	lookup := tokens.HMAC256Hex(pepper, secret)

	// First, check if a default project exists by looking for the special config field
	var defaultProject model.Project
	err := db.WithContext(ctx).
		Where("configs @> ?", `{"__default_init_project__": true}`).
		First(&defaultProject).Error

	switch err {
	case nil:
		// Default project exists, update its secret
		phc, err := secrets.HashSecret(secret, pepper)
		if err != nil {
			return err
		}

		updates := map[string]interface{}{
			"secret_key_hmac":     lookup,
			"secret_key_hash_phc": phc,
		}

		if uErr := db.WithContext(ctx).Model(&defaultProject).Updates(updates).Error; uErr != nil {
			return uErr
		}
		log.Sugar().Infow("default project exists", "project", defaultProject.ID)
		return nil

	case gorm.ErrRecordNotFound:
		// No default project exists, create a new one
		phc, err := secrets.HashSecret(secret, pepper)
		if err != nil {
			return err
		}

		newP := model.Project{
			SecretKeyHMAC:    lookup,
			SecretKeyHashPHC: phc,
			Configs: datatypes.JSONMap{
				"__default_init_project__": true,
			},
		}
		if cErr := db.WithContext(ctx).Create(&newP).Error; cErr != nil {
			return cErr
		}
		log.Sugar().Infow("default project created", "project", newP.ID)
		return nil

	default:
		return err
	}
}
