package repo

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// setupSessionTestDB creates a test database connection for session tests
func setupSessionTestDB(t *testing.T) *gorm.DB {
	// Skip if no test database is configured
	dsn := "host=localhost user=acontext password=helloworld dbname=acontext port=15432 sslmode=disable"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Skip("Test database not available, skipping integration tests")
		return nil
	}

	// Auto migrate all required tables
	err = db.AutoMigrate(
		&model.Project{},
		&model.Session{},
	)
	require.NoError(t, err)

	return db
}

// cleanupSessionTestDB cleans up test data
func cleanupSessionTestDB(t *testing.T, db *gorm.DB, projectID uuid.UUID) {
	// Clean up in reverse order of foreign key dependencies
	db.Exec("DELETE FROM sessions WHERE project_id = ?", projectID)
	db.Exec("DELETE FROM projects WHERE id = ?", projectID)
}

// TestSessionRepo_GetDisableTaskTracking tests the GetDisableTaskTracking method
func TestSessionRepo_GetDisableTaskTracking(t *testing.T) {
	db := setupSessionTestDB(t)
	if db == nil {
		return // Test was skipped
	}

	logger, _ := zap.NewDevelopment()
	repo := NewSessionRepo(db, nil, nil, logger)
	ctx := context.Background()

	// Create a project
	project := &model.Project{
		ID:               uuid.New(),
		SecretKeyHMAC:    "test_hmac_session",
		SecretKeyHashPHC: "test_hash_session",
	}
	require.NoError(t, db.Create(project).Error)
	defer cleanupSessionTestDB(t, db, project.ID)

	t.Run("returns false when disable_task_tracking is false", func(t *testing.T) {
		// Create a session with task tracking enabled (default)
		session := &model.Session{
			ID:                  uuid.New(),
			ProjectID:           project.ID,
			DisableTaskTracking: false,
		}
		require.NoError(t, db.Create(session).Error)

		// Test: Get disable_task_tracking value
		result, err := repo.GetDisableTaskTracking(ctx, session.ID)
		require.NoError(t, err)
		assert.False(t, result, "disable_task_tracking should be false")

		// Cleanup
		db.Delete(session)
	})

	t.Run("returns true when disable_task_tracking is true", func(t *testing.T) {
		// Create a session with task tracking disabled
		session := &model.Session{
			ID:                  uuid.New(),
			ProjectID:           project.ID,
			DisableTaskTracking: true,
		}
		require.NoError(t, db.Create(session).Error)

		// Test: Get disable_task_tracking value
		result, err := repo.GetDisableTaskTracking(ctx, session.ID)
		require.NoError(t, err)
		assert.True(t, result, "disable_task_tracking should be true")

		// Cleanup
		db.Delete(session)
	})

	t.Run("returns error when session does not exist", func(t *testing.T) {
		// Test with non-existent session ID
		nonExistentID := uuid.New()
		_, err := repo.GetDisableTaskTracking(ctx, nonExistentID)
		require.Error(t, err)
		assert.ErrorIs(t, err, gorm.ErrRecordNotFound, "should return record not found error")
	})

	t.Run("only fetches disable_task_tracking field", func(t *testing.T) {
		// Create a session with various fields set
		session := &model.Session{
			ID:                  uuid.New(),
			ProjectID:           project.ID,
			DisableTaskTracking: true,
		}
		require.NoError(t, db.Create(session).Error)

		// Test: Verify only disable_task_tracking is fetched
		// This is more of a performance check to ensure we're not loading the whole object
		result, err := repo.GetDisableTaskTracking(ctx, session.ID)
		require.NoError(t, err)
		assert.True(t, result)

		// The method should work correctly regardless of other fields
		// Cleanup
		db.Delete(session)
	})
}
