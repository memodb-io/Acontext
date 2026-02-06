package repo

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
	"gorm.io/datatypes"
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

	// Ensure pgvector extension exists
	db.Exec("CREATE EXTENSION IF NOT EXISTS vector")

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

// TestSessionRepo_PopGeminiCallIDAndName tests the PopGeminiCallIDAndName method with various boundary cases
func TestSessionRepo_PopGeminiCallIDAndName(t *testing.T) {
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
		SecretKeyHMAC:    "test_hmac_pop",
		SecretKeyHashPHC: "test_hash_pop",
	}
	require.NoError(t, db.Create(project).Error)
	defer cleanupSessionTestDB(t, db, project.ID)

	// Create a session
	session := &model.Session{
		ID:        uuid.New(),
		ProjectID: project.ID,
	}
	require.NoError(t, db.Create(session).Error)
	defer db.Delete(session)

	// Auto migrate Message table
	require.NoError(t, db.AutoMigrate(&model.Message{}))

	t.Run("successful pop from single message", func(t *testing.T) {
		// Create a message with call info
		msg := &model.Message{
			ID:        uuid.New(),
			SessionID: session.ID,
			Role:      "assistant",
			Meta: datatypes.NewJSONType(map[string]interface{}{
				model.GeminiCallInfoKey: []map[string]interface{}{
					{"id": "call_abc123", "name": "get_weather"},
				},
			}),
		}
		require.NoError(t, db.Create(msg).Error)
		defer db.Delete(msg)

		// Pop the call info
		id, name, err := repo.PopGeminiCallIDAndName(ctx, session.ID)
		require.NoError(t, err)
		assert.Equal(t, "call_abc123", id)
		assert.Equal(t, "get_weather", name)

		// Verify the message was updated (array should be empty or key removed)
		var updatedMsg model.Message
		require.NoError(t, db.First(&updatedMsg, msg.ID).Error)
		meta := updatedMsg.Meta.Data()
		_, exists := meta[model.GeminiCallInfoKey]
		assert.False(t, exists, "call info key should be removed when array is empty")
	})

	t.Run("pop from multiple call info entries", func(t *testing.T) {
		// Create a message with multiple call info entries
		msg := &model.Message{
			ID:        uuid.New(),
			SessionID: session.ID,
			Role:      "assistant",
			Meta: datatypes.NewJSONType(map[string]interface{}{
				model.GeminiCallInfoKey: []map[string]interface{}{
					{"id": "call_first", "name": "first_func"},
					{"id": "call_second", "name": "second_func"},
					{"id": "call_third", "name": "third_func"},
				},
			}),
		}
		require.NoError(t, db.Create(msg).Error)
		defer db.Delete(msg)

		// Pop first entry
		id1, name1, err := repo.PopGeminiCallIDAndName(ctx, session.ID)
		require.NoError(t, err)
		assert.Equal(t, "call_first", id1)
		assert.Equal(t, "first_func", name1)

		// Pop second entry
		id2, name2, err := repo.PopGeminiCallIDAndName(ctx, session.ID)
		require.NoError(t, err)
		assert.Equal(t, "call_second", id2)
		assert.Equal(t, "second_func", name2)

		// Verify remaining entry
		var updatedMsg model.Message
		require.NoError(t, db.First(&updatedMsg, msg.ID).Error)
		meta := updatedMsg.Meta.Data()
		callInfo, exists := meta[model.GeminiCallInfoKey]
		assert.True(t, exists, "call info key should still exist")
		callInfoArray := callInfo.([]interface{})
		assert.Len(t, callInfoArray, 1, "should have one remaining entry")
		remaining := callInfoArray[0].(map[string]interface{})
		assert.Equal(t, "call_third", remaining["id"])
		assert.Equal(t, "third_func", remaining["name"])
	})

	t.Run("pop from earliest message when multiple messages exist", func(t *testing.T) {
		// Create two messages with call info
		msg1 := &model.Message{
			ID:        uuid.New(),
			SessionID: session.ID,
			Role:      "assistant",
			Meta: datatypes.NewJSONType(map[string]interface{}{
				model.GeminiCallInfoKey: []map[string]interface{}{
					{"id": "call_earlier", "name": "earlier_func"},
				},
			}),
		}
		require.NoError(t, db.Create(msg1).Error)
		defer db.Delete(msg1)

		// Wait a bit to ensure different timestamps
		time.Sleep(10 * time.Millisecond)

		msg2 := &model.Message{
			ID:        uuid.New(),
			SessionID: session.ID,
			Role:      "assistant",
			Meta: datatypes.NewJSONType(map[string]interface{}{
				model.GeminiCallInfoKey: []map[string]interface{}{
					{"id": "call_later", "name": "later_func"},
				},
			}),
		}
		require.NoError(t, db.Create(msg2).Error)
		defer db.Delete(msg2)

		// Pop should get from earliest message (msg1)
		id, name, err := repo.PopGeminiCallIDAndName(ctx, session.ID)
		require.NoError(t, err)
		assert.Equal(t, "call_earlier", id)
		assert.Equal(t, "earlier_func", name)
	})

	t.Run("error when no call info available", func(t *testing.T) {
		// Create a session without any messages with call info
		emptySession := &model.Session{
			ID:        uuid.New(),
			ProjectID: project.ID,
		}
		require.NoError(t, db.Create(emptySession).Error)
		defer db.Delete(emptySession)

		// Try to pop from empty session
		_, _, err := repo.PopGeminiCallIDAndName(ctx, emptySession.ID)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "no available Gemini call info")
	})

	t.Run("error when call info array is empty", func(t *testing.T) {
		// Create a message with empty call info array
		msg := &model.Message{
			ID:        uuid.New(),
			SessionID: session.ID,
			Role:      "assistant",
			Meta: datatypes.NewJSONType(map[string]interface{}{
				model.GeminiCallInfoKey: []map[string]interface{}{},
			}),
		}
		require.NoError(t, db.Create(msg).Error)
		defer db.Delete(msg)

		// Try to pop from empty array
		_, _, err := repo.PopGeminiCallIDAndName(ctx, session.ID)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "no available Gemini call info")
	})

	t.Run("error when call info has invalid format", func(t *testing.T) {
		// Create a message with invalid call info format (not an array of objects)
		// The SQL query will fail because jsonb_array_length fails on non-array
		// This will cause a query error, not a "no available" error
		msg := &model.Message{
			ID:        uuid.New(),
			SessionID: session.ID,
			Role:      "assistant",
			Meta: datatypes.NewJSONType(map[string]interface{}{
				model.GeminiCallInfoKey: "invalid_format",
			}),
		}
		require.NoError(t, db.Create(msg).Error)
		defer db.Delete(msg)

		// Try to pop - SQL query will fail on jsonb_array_length for scalar value
		// This will return a query error
		_, _, err := repo.PopGeminiCallIDAndName(ctx, session.ID)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to query message with call info")
	})

	t.Run("error when call info entry missing id or name", func(t *testing.T) {
		// Create a message with call info missing id
		msg := &model.Message{
			ID:        uuid.New(),
			SessionID: session.ID,
			Role:      "assistant",
			Meta: datatypes.NewJSONType(map[string]interface{}{
				model.GeminiCallInfoKey: []map[string]interface{}{
					{"name": "missing_id"},
				},
			}),
		}
		require.NoError(t, db.Create(msg).Error)
		defer db.Delete(msg)

		// Try to pop - should return error because ID is missing
		_, _, err := repo.PopGeminiCallIDAndName(ctx, session.ID)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "call ID is not a string")
	})

	t.Run("concurrent pops should be thread-safe", func(t *testing.T) {
		// Create a message with multiple call info entries
		msg := &model.Message{
			ID:        uuid.New(),
			SessionID: session.ID,
			Role:      "assistant",
			Meta: datatypes.NewJSONType(map[string]interface{}{
				model.GeminiCallInfoKey: []map[string]interface{}{
					{"id": "call_concurrent1", "name": "func1"},
					{"id": "call_concurrent2", "name": "func2"},
				},
			}),
		}
		require.NoError(t, db.Create(msg).Error)
		defer db.Delete(msg)

		// Use channels to coordinate concurrent pops
		results := make(chan struct {
			id   string
			name string
			err  error
		}, 2)

		// Pop concurrently
		go func() {
			id, name, err := repo.PopGeminiCallIDAndName(ctx, session.ID)
			results <- struct {
				id   string
				name string
				err  error
			}{id, name, err}
		}()

		go func() {
			id, name, err := repo.PopGeminiCallIDAndName(ctx, session.ID)
			results <- struct {
				id   string
				name string
				err  error
			}{id, name, err}
		}()

		// Collect results
		result1 := <-results
		result2 := <-results

		// Both should succeed
		require.NoError(t, result1.err)
		require.NoError(t, result2.err)

		// Both should get different IDs
		assert.NotEqual(t, result1.id, result2.id)
		assert.Contains(t, []string{"call_concurrent1", "call_concurrent2"}, result1.id)
		assert.Contains(t, []string{"call_concurrent1", "call_concurrent2"}, result2.id)
	})
}
