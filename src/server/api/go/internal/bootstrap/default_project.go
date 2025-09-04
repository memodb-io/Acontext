package bootstrap

import (
	"context"

	"github.com/memodb-io/Acontext/internal/config"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/pkg/utils/secrets"
	"github.com/memodb-io/Acontext/internal/pkg/utils/tokens"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// EnsureDefaultProjectExists Create/align the default Project when the service starts
func EnsureDefaultProjectExists(ctx context.Context, db *gorm.DB, cfg *config.Config) error {
	secret := cfg.Root.ApiBearerToken
	pepper := cfg.Root.SecretPepper

	if secret == "" || pepper == "" {
		return nil
	}

	lookup := tokens.HMAC256Hex(pepper, secret)

	var p model.Project
	err := db.WithContext(ctx).Where(&model.Project{SecretKeyHMAC: lookup}).First(&p).Error
	switch err {
	case nil:
		if p.SecretKeyHashPHC == "" {
			phc, err := secrets.HashSecret(secret, pepper)
			if err != nil {
				return err
			}
			if uErr := db.WithContext(ctx).Model(&p).Update("secret_key_hash_phc", phc).Error; uErr != nil {
				return uErr
			}
		}
		return nil

	case gorm.ErrRecordNotFound:
		phc, err := secrets.HashSecret(secret, pepper)
		if err != nil {
			return err
		}

		newP := model.Project{
			SecretKeyHMAC:    lookup,
			SecretKeyHashPHC: phc,
			Configs:          datatypes.JSONMap{},
		}
		if cErr := db.WithContext(ctx).Create(&newP).Error; cErr != nil {
			return cErr
		}

		return nil

	default:
		return err
	}
}
