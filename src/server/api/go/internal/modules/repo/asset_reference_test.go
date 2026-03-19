package repo

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func setupAssetRefTestDB(t *testing.T) *gorm.DB {
	dsn := "host=localhost user=acontext password=helloworld dbname=acontext port=15432 sslmode=disable"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Skip("Test database not available, skipping integration tests")
		return nil
	}

	err = db.AutoMigrate(
		&model.Project{},
		&model.AssetReference{},
	)
	require.NoError(t, err)

	return db
}

func cleanupAssetRefTestDB(t *testing.T, db *gorm.DB, projectID uuid.UUID) {
	db.Exec("DELETE FROM asset_references WHERE project_id = ?", projectID)
	db.Exec("DELETE FROM projects WHERE id = ?", projectID)
}

func TestAssetReferenceRepo_BatchIncrementAssetRefs(t *testing.T) {
	db := setupAssetRefTestDB(t)
	if db == nil {
		return
	}

	// S3 is nil — we only test DB operations, not S3 cleanup
	repo := NewAssetReferenceRepo(db, nil)
	ctx := context.Background()

	projectID := uuid.New()
	project := &model.Project{
		ID:               projectID,
		SecretKeyHMAC:    "test_hmac_asset_ref_" + projectID.String()[:8],
		SecretKeyHashPHC: "test_hash_asset_ref",
	}
	require.NoError(t, db.Create(project).Error)
	defer cleanupAssetRefTestDB(t, db, projectID)

	t.Run("batch insert multiple new assets in one call", func(t *testing.T) {
		assets := []model.Asset{
			{SHA256: "aaaa" + uuid.New().String()[:60], S3Key: "assets/a.json", Bucket: "test"},
			{SHA256: "bbbb" + uuid.New().String()[:60], S3Key: "assets/b.json", Bucket: "test"},
			{SHA256: "cccc" + uuid.New().String()[:60], S3Key: "assets/c.json", Bucket: "test"},
		}

		err := repo.BatchIncrementAssetRefs(ctx, projectID, assets)
		require.NoError(t, err)

		// Verify all three were created with ref_count = 1
		for _, a := range assets {
			var ref model.AssetReference
			err := db.Where("project_id = ? AND sha256 = ?", projectID, a.SHA256).First(&ref).Error
			require.NoError(t, err)
			assert.Equal(t, 1, ref.RefCount, "ref_count should be 1 for %s", a.SHA256[:8])
		}

		// Cleanup
		for _, a := range assets {
			db.Where("project_id = ? AND sha256 = ?", projectID, a.SHA256).Delete(&model.AssetReference{})
		}
	})

	t.Run("batch upsert increments existing ref_count", func(t *testing.T) {
		sha := "dddd" + uuid.New().String()[:60]
		assets := []model.Asset{
			{SHA256: sha, S3Key: "assets/d.json", Bucket: "test"},
		}

		// First insert
		err := repo.BatchIncrementAssetRefs(ctx, projectID, assets)
		require.NoError(t, err)

		// Second insert — should increment
		err = repo.BatchIncrementAssetRefs(ctx, projectID, assets)
		require.NoError(t, err)

		var ref model.AssetReference
		err = db.Where("project_id = ? AND sha256 = ?", projectID, sha).First(&ref).Error
		require.NoError(t, err)
		assert.Equal(t, 2, ref.RefCount, "ref_count should be 2 after two increments")

		// Cleanup
		db.Where("project_id = ? AND sha256 = ?", projectID, sha).Delete(&model.AssetReference{})
	})

	t.Run("batch with duplicate sha256 coalesces counts", func(t *testing.T) {
		sha := "eeee" + uuid.New().String()[:60]
		assets := []model.Asset{
			{SHA256: sha, S3Key: "assets/e.json", Bucket: "test"},
			{SHA256: sha, S3Key: "assets/e.json", Bucket: "test"},
			{SHA256: sha, S3Key: "assets/e.json", Bucket: "test"},
		}

		err := repo.BatchIncrementAssetRefs(ctx, projectID, assets)
		require.NoError(t, err)

		var ref model.AssetReference
		err = db.Where("project_id = ? AND sha256 = ?", projectID, sha).First(&ref).Error
		require.NoError(t, err)
		assert.Equal(t, 3, ref.RefCount, "ref_count should be 3 for 3 duplicate assets")

		// Cleanup
		db.Where("project_id = ? AND sha256 = ?", projectID, sha).Delete(&model.AssetReference{})
	})

	t.Run("empty assets slice is no-op", func(t *testing.T) {
		err := repo.BatchIncrementAssetRefs(ctx, projectID, []model.Asset{})
		require.NoError(t, err)
	})

	t.Run("nil project_id returns error", func(t *testing.T) {
		assets := []model.Asset{
			{SHA256: "ffff" + uuid.New().String()[:60], S3Key: "assets/f.json"},
		}
		err := repo.BatchIncrementAssetRefs(ctx, uuid.Nil, assets)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "project_id is required")
	})
}

func TestAssetReferenceRepo_IncrementVsBatchIncrement(t *testing.T) {
	db := setupAssetRefTestDB(t)
	if db == nil {
		return
	}

	repo := NewAssetReferenceRepo(db, nil)
	ctx := context.Background()

	projectID := uuid.New()
	project := &model.Project{
		ID:               projectID,
		SecretKeyHMAC:    "test_hmac_cmp_" + projectID.String()[:8],
		SecretKeyHashPHC: "test_hash_cmp",
	}
	require.NoError(t, db.Create(project).Error)
	defer cleanupAssetRefTestDB(t, db, projectID)

	t.Run("single and batch produce same result", func(t *testing.T) {
		shaSingle := "s111" + uuid.New().String()[:60]
		shaBatch := "b111" + uuid.New().String()[:60]

		assetSingle := model.Asset{SHA256: shaSingle, S3Key: "assets/s.json", Bucket: "test"}
		assetBatch := model.Asset{SHA256: shaBatch, S3Key: "assets/b.json", Bucket: "test"}

		// Single increment 3 times
		for i := 0; i < 3; i++ {
			require.NoError(t, repo.IncrementAssetRef(ctx, projectID, assetSingle))
		}

		// Batch increment with 3 duplicates
		require.NoError(t, repo.BatchIncrementAssetRefs(ctx, projectID, []model.Asset{assetBatch, assetBatch, assetBatch}))

		var refSingle, refBatch model.AssetReference
		require.NoError(t, db.Where("project_id = ? AND sha256 = ?", projectID, shaSingle).First(&refSingle).Error)
		require.NoError(t, db.Where("project_id = ? AND sha256 = ?", projectID, shaBatch).First(&refBatch).Error)

		assert.Equal(t, refSingle.RefCount, refBatch.RefCount, "both should have ref_count=3")
		assert.Equal(t, 3, refBatch.RefCount)

		// Cleanup
		db.Where("project_id = ? AND sha256 = ?", projectID, shaSingle).Delete(&model.AssetReference{})
		db.Where("project_id = ? AND sha256 = ?", projectID, shaBatch).Delete(&model.AssetReference{})
	})
}
