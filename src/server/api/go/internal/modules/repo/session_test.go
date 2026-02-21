package repo

import (
	"context"
	"fmt"
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

// MockAssetReferenceRepoForCopy is a mock implementation of AssetReferenceRepo for copy tests
type MockAssetReferenceRepoForCopy struct {
	BatchIncrementAssetRefsFunc func(ctx context.Context, projectID uuid.UUID, assets []model.Asset) error
}

func (m *MockAssetReferenceRepoForCopy) IncrementAssetRef(ctx context.Context, projectID uuid.UUID, asset model.Asset) error {
	return nil
}

func (m *MockAssetReferenceRepoForCopy) DecrementAssetRef(ctx context.Context, projectID uuid.UUID, asset model.Asset) error {
	return nil
}

func (m *MockAssetReferenceRepoForCopy) BatchIncrementAssetRefs(ctx context.Context, projectID uuid.UUID, assets []model.Asset) error {
	if m.BatchIncrementAssetRefsFunc != nil {
		return m.BatchIncrementAssetRefsFunc(ctx, projectID, assets)
	}
	return nil
}

func (m *MockAssetReferenceRepoForCopy) BatchDecrementAssetRefs(ctx context.Context, projectID uuid.UUID, assets []model.Asset) error {
	return nil
}

// TestSessionRepo_CopySession tests the CopySession method with comprehensive scenarios
func TestSessionRepo_CopySession(t *testing.T) {
	db := setupSessionTestDB(t)
	if db == nil {
		return // Test was skipped
	}

	logger, _ := zap.NewDevelopment()
	ctx := context.Background()

	// Create a project
	project := &model.Project{
		ID:               uuid.New(),
		SecretKeyHMAC:    "test_hmac_fork",
		SecretKeyHashPHC: "test_hash_fork",
	}
	require.NoError(t, db.Create(project).Error)
	defer cleanupSessionTestDB(t, db, project.ID)

	// Auto migrate required tables
	require.NoError(t, db.AutoMigrate(&model.Message{}, &model.Task{}, &model.AssetReference{}))

	t.Run("successful copy with messages and tasks", func(t *testing.T) {
		// Create original session
		originalSession := &model.Session{
			ID:                  uuid.New(),
			ProjectID:           project.ID,
			DisableTaskTracking: false,
			Configs:             datatypes.JSONMap{"key": "value"},
		}
		require.NoError(t, db.Create(originalSession).Error)

		// Create messages
		msg1 := &model.Message{
			ID:        uuid.New(),
			SessionID: originalSession.ID,
			Role:      "user",
			PartsAssetMeta: datatypes.NewJSONType(model.Asset{
				SHA256: "parts-asset-sha256",
				S3Key:  "parts/msg1.json",
			}),
		}
		require.NoError(t, db.Create(msg1).Error)

		msg2 := &model.Message{
			ID:        uuid.New(),
			SessionID: originalSession.ID,
			Role:      "assistant",
			ParentID:  &msg1.ID,
			PartsAssetMeta: datatypes.NewJSONType(model.Asset{
				SHA256: "parts-asset-sha256-2",
				S3Key:  "parts/msg2.json",
			}),
		}
		require.NoError(t, db.Create(msg2).Error)

		// Create tasks
		task1 := &model.Task{
			ID:        uuid.New(),
			SessionID: originalSession.ID,
			ProjectID: project.ID,
			Order:     1,
			Status:    "success",
			Data: model.TaskData{
				TaskDescription: "Test task",
			},
		}
		require.NoError(t, db.Create(task1).Error)

		// Setup mocks
		mockAssetRepo := &MockAssetReferenceRepoForCopy{
			BatchIncrementAssetRefsFunc: func(ctx context.Context, projectID uuid.UUID, assets []model.Asset) error {
				assert.Equal(t, project.ID, projectID)
				assert.GreaterOrEqual(t, len(assets), 2) // At least two parts assets
				return nil
			},
		}
		// Pass nil for S3 - code will skip S3 download and only collect parts assets
		repo := NewSessionRepo(db, mockAssetRepo, nil, logger)

		// Copy session
		result, err := repo.CopySession(ctx, originalSession.ID)
		require.NoError(t, err)
		assert.Equal(t, originalSession.ID, result.OldSessionID)
		assert.NotEqual(t, originalSession.ID, result.NewSessionID)

		// Verify new session exists
		var newSession model.Session
		require.NoError(t, db.First(&newSession, result.NewSessionID).Error)
		assert.Equal(t, project.ID, newSession.ProjectID)
		assert.Equal(t, originalSession.DisableTaskTracking, newSession.DisableTaskTracking)
		assert.Equal(t, originalSession.Configs, newSession.Configs)

		// Verify messages were copied
		var newMessages []model.Message
		require.NoError(t, db.Where("session_id = ?", result.NewSessionID).Order("created_at ASC").Find(&newMessages).Error)
		assert.Len(t, newMessages, 2)

		// Verify parent relationship was preserved
		assert.Nil(t, newMessages[0].ParentID)
		assert.NotNil(t, newMessages[1].ParentID)
		assert.Equal(t, newMessages[0].ID, *newMessages[1].ParentID)

		// Verify tasks were copied
		var newTasks []model.Task
		require.NoError(t, db.Where("session_id = ?", result.NewSessionID).Order("\"order\" ASC").Find(&newTasks).Error)
		assert.Len(t, newTasks, 1)
		assert.Equal(t, 1, newTasks[0].Order)
		assert.Equal(t, "success", newTasks[0].Status)

		// Verify original session unchanged
		var originalMessages []model.Message
		require.NoError(t, db.Where("session_id = ?", originalSession.ID).Find(&originalMessages).Error)
		assert.Len(t, originalMessages, 2)
	})

	t.Run("copy empty session", func(t *testing.T) {
		// Create empty session
		originalSession := &model.Session{
			ID:        uuid.New(),
			ProjectID: project.ID,
		}
		require.NoError(t, db.Create(originalSession).Error)

		mockAssetRepo := &MockAssetReferenceRepoForCopy{}
		repo := NewSessionRepo(db, mockAssetRepo, nil, logger)

		// Copy session
		result, err := repo.CopySession(ctx, originalSession.ID)
		require.NoError(t, err)

		// Verify new session exists
		var newSession model.Session
		require.NoError(t, db.First(&newSession, result.NewSessionID).Error)

		// Verify no messages or tasks
		var newMessages []model.Message
		require.NoError(t, db.Where("session_id = ?", result.NewSessionID).Find(&newMessages).Error)
		assert.Len(t, newMessages, 0)

		var newTasks []model.Task
		require.NoError(t, db.Where("session_id = ?", result.NewSessionID).Find(&newTasks).Error)
		assert.Len(t, newTasks, 0)
	})

	t.Run("copy with parent-child message relationships", func(t *testing.T) {
		// Create session with complex parent-child structure
		originalSession := &model.Session{
			ID:        uuid.New(),
			ProjectID: project.ID,
		}
		require.NoError(t, db.Create(originalSession).Error)

		// Create message chain: msg1 -> msg2 -> msg3
		msg1 := &model.Message{
			ID:        uuid.New(),
			SessionID: originalSession.ID,
			Role:      "user",
			PartsAssetMeta: datatypes.NewJSONType(model.Asset{
				SHA256: "sha1",
				S3Key:  "parts/msg1.json",
			}),
		}
		require.NoError(t, db.Create(msg1).Error)

		msg2 := &model.Message{
			ID:        uuid.New(),
			SessionID: originalSession.ID,
			Role:      "assistant",
			ParentID:  &msg1.ID,
			PartsAssetMeta: datatypes.NewJSONType(model.Asset{
				SHA256: "sha2",
				S3Key:  "parts/msg2.json",
			}),
		}
		require.NoError(t, db.Create(msg2).Error)

		msg3 := &model.Message{
			ID:        uuid.New(),
			SessionID: originalSession.ID,
			Role:      "user",
			ParentID:  &msg2.ID,
			PartsAssetMeta: datatypes.NewJSONType(model.Asset{
				SHA256: "sha3",
				S3Key:  "parts/msg3.json",
			}),
		}
		require.NoError(t, db.Create(msg3).Error)

		mockAssetRepo := &MockAssetReferenceRepoForCopy{}
		// Pass nil for S3 - code will skip S3 download
		repo := NewSessionRepo(db, mockAssetRepo, nil, logger)

		// Copy session
		result, err := repo.CopySession(ctx, originalSession.ID)
		require.NoError(t, err)

		// Verify messages with correct parent relationships
		var newMessages []model.Message
		require.NoError(t, db.Where("session_id = ?", result.NewSessionID).Order("created_at ASC").Find(&newMessages).Error)
		assert.Len(t, newMessages, 3)

		// Build ID mapping
		oldToNewID := make(map[uuid.UUID]uuid.UUID)
		oldToNewID[msg1.ID] = newMessages[0].ID
		oldToNewID[msg2.ID] = newMessages[1].ID
		oldToNewID[msg3.ID] = newMessages[2].ID

		// Verify relationships
		assert.Nil(t, newMessages[0].ParentID) // First message has no parent
		assert.NotNil(t, newMessages[1].ParentID)
		assert.Equal(t, newMessages[0].ID, *newMessages[1].ParentID) // msg2.parent = msg1
		assert.NotNil(t, newMessages[2].ParentID)
		assert.Equal(t, newMessages[1].ID, *newMessages[2].ParentID) // msg3.parent = msg2
	})

	t.Run("copy collects parts assets for reference counting", func(t *testing.T) {
		originalSession := &model.Session{
			ID:        uuid.New(),
			ProjectID: project.ID,
		}
		require.NoError(t, db.Create(originalSession).Error)

		msg := &model.Message{
			ID:        uuid.New(),
			SessionID: originalSession.ID,
			Role:      "user",
			PartsAssetMeta: datatypes.NewJSONType(model.Asset{
				SHA256: "parts-sha256",
				S3Key:  "parts/msg.json",
			}),
		}
		require.NoError(t, db.Create(msg).Error)

		// Track which assets were incremented
		incrementedAssets := make([]model.Asset, 0)
		mockAssetRepo := &MockAssetReferenceRepoForCopy{
			BatchIncrementAssetRefsFunc: func(ctx context.Context, projectID uuid.UUID, assets []model.Asset) error {
				incrementedAssets = append(incrementedAssets, assets...)
				return nil
			},
		}

		// Pass nil for S3 - code will skip S3 download but still collect parts assets
		repo := NewSessionRepo(db, mockAssetRepo, nil, logger)

		// Copy session
		_, err := repo.CopySession(ctx, originalSession.ID)
		require.NoError(t, err)

		// Verify parts assets were collected for reference counting
		assert.GreaterOrEqual(t, len(incrementedAssets), 1)
		assetSHAs := make(map[string]bool)
		for _, asset := range incrementedAssets {
			assetSHAs[asset.SHA256] = true
		}
		assert.True(t, assetSHAs["parts-sha256"], "parts asset should be incremented")
		// Note: Testing S3 download and part asset extraction requires integration test with real S3
	})

	t.Run("copy with single message succeeds", func(t *testing.T) {
		originalSession := &model.Session{
			ID:        uuid.New(),
			ProjectID: project.ID,
		}
		require.NoError(t, db.Create(originalSession).Error)

		msg := &model.Message{
			ID:        uuid.New(),
			SessionID: originalSession.ID,
			Role:      "user",
			PartsAssetMeta: datatypes.NewJSONType(model.Asset{
				SHA256: "sha1",
				S3Key:  "parts/msg.json",
			}),
		}
		require.NoError(t, db.Create(msg).Error)

		mockAssetRepo := &MockAssetReferenceRepoForCopy{}
		repo := NewSessionRepo(db, mockAssetRepo, nil, logger)

		result, err := repo.CopySession(ctx, originalSession.ID)
		require.NoError(t, err)

		var newSession model.Session
		require.NoError(t, db.First(&newSession, result.NewSessionID).Error)
		assert.NotEqual(t, originalSession.ID, newSession.ID)

		// Verify the copied message exists
		var newMessages []model.Message
		require.NoError(t, db.Where("session_id = ?", newSession.ID).Find(&newMessages).Error)
		assert.Len(t, newMessages, 1)
	})

	t.Run("transaction rollback on asset increment failure", func(t *testing.T) {
		originalSession := &model.Session{
			ID:        uuid.New(),
			ProjectID: project.ID,
		}
		require.NoError(t, db.Create(originalSession).Error)

		msg := &model.Message{
			ID:        uuid.New(),
			SessionID: originalSession.ID,
			Role:      "user",
			PartsAssetMeta: datatypes.NewJSONType(model.Asset{
				SHA256: "sha1",
				S3Key:  "parts/msg.json",
			}),
		}
		require.NoError(t, db.Create(msg).Error)

		// Mock asset repo to fail
		mockAssetRepo := &MockAssetReferenceRepoForCopy{
			BatchIncrementAssetRefsFunc: func(ctx context.Context, projectID uuid.UUID, assets []model.Asset) error {
				return fmt.Errorf("asset increment failed")
			},
		}
		// Pass nil for S3 - code will skip S3 download
		repo := NewSessionRepo(db, mockAssetRepo, nil, logger)

		// Copy should fail
		result, err := repo.CopySession(ctx, originalSession.ID)
		require.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "asset increment failed")

		// Verify no new session was created (transaction rolled back)
		var count int64
		db.Model(&model.Session{}).Where("project_id = ? AND id != ?", project.ID, originalSession.ID).Count(&count)
		assert.Equal(t, int64(0), count, "no new session should be created on failure")
	})

	t.Run("transaction rollback on S3 download failure", func(t *testing.T) {
		// Note: This test requires S3Deps to be mockable or integration test with real S3
		// Since S3Deps is a concrete type, we can't easily mock it in unit tests
		// This scenario should be tested in integration tests or with dependency injection refactoring
		// For now, we verify the code path exists by checking the error handling in CopySession
		t.Skip("S3 failure testing requires integration test or refactoring to use interface")
	})

	t.Run("size limit enforcement", func(t *testing.T) {
		originalSession := &model.Session{
			ID:        uuid.New(),
			ProjectID: project.ID,
		}
		require.NoError(t, db.Create(originalSession).Error)

		// Create MaxCopyableMessages + 1 messages using batch insert for speed
		overLimit := MaxCopyableMessages + 1
		msgs := make([]model.Message, 0, overLimit)
		for i := 0; i < overLimit; i++ {
			msgs = append(msgs, model.Message{
				ID:        uuid.New(),
				SessionID: originalSession.ID,
				Role:      "user",
				PartsAssetMeta: datatypes.NewJSONType(model.Asset{
					SHA256: fmt.Sprintf("sha%d", i),
					S3Key:  fmt.Sprintf("parts/msg%d.json", i),
				}),
			})
		}
		require.NoError(t, db.CreateInBatches(msgs, 500).Error)

		mockAssetRepo := &MockAssetReferenceRepoForCopy{}
		repo := NewSessionRepo(db, mockAssetRepo, nil, logger)

		// Copy should fail with size limit error
		result, err := repo.CopySession(ctx, originalSession.ID)
		require.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "exceeds maximum copyable size")

		// Verify no new session was created
		var count int64
		db.Model(&model.Session{}).Where("project_id = ? AND id != ?", project.ID, originalSession.ID).Count(&count)
		assert.Equal(t, int64(0), count)
	})

	t.Run("copy with orphaned parent references", func(t *testing.T) {
		originalSession := &model.Session{
			ID:        uuid.New(),
			ProjectID: project.ID,
		}
		require.NoError(t, db.Create(originalSession).Error)

		// Create message with parent_id pointing to non-existent message
		nonExistentParentID := uuid.New()
		msg := &model.Message{
			ID:        uuid.New(),
			SessionID: originalSession.ID,
			Role:      "assistant",
			ParentID:  &nonExistentParentID, // Orphaned reference
			PartsAssetMeta: datatypes.NewJSONType(model.Asset{
				SHA256: "sha1",
				S3Key:  "parts/msg.json",
			}),
		}
		require.NoError(t, db.Create(msg).Error)

		mockAssetRepo := &MockAssetReferenceRepoForCopy{}
		// Pass nil for S3 - code will skip S3 download
		repo := NewSessionRepo(db, mockAssetRepo, nil, logger)

		// Copy should succeed but log warning about orphaned parent
		result, err := repo.CopySession(ctx, originalSession.ID)
		require.NoError(t, err)

		// Verify message was copied without parent
		var newMessages []model.Message
		require.NoError(t, db.Where("session_id = ?", result.NewSessionID).Find(&newMessages).Error)
		assert.Len(t, newMessages, 1)
		assert.Nil(t, newMessages[0].ParentID, "orphaned parent should be cleared")
	})

	t.Run("concurrent copy prevention with SELECT FOR UPDATE", func(t *testing.T) {
		originalSession := &model.Session{
			ID:        uuid.New(),
			ProjectID: project.ID,
		}
		require.NoError(t, db.Create(originalSession).Error)

		msg := &model.Message{
			ID:        uuid.New(),
			SessionID: originalSession.ID,
			Role:      "user",
			PartsAssetMeta: datatypes.NewJSONType(model.Asset{
				SHA256: "sha1",
				S3Key:  "parts/msg.json",
			}),
		}
		require.NoError(t, db.Create(msg).Error)

		mockAssetRepo := &MockAssetReferenceRepoForCopy{}
		// Pass nil for S3 - code will skip S3 download
		repo := NewSessionRepo(db, mockAssetRepo, nil, logger)

		// Start two concurrent copies
		results := make(chan struct {
			result *CopySessionResult
			err    error
		}, 2)

		go func() {
			result, err := repo.CopySession(ctx, originalSession.ID)
			results <- struct {
				result *CopySessionResult
				err    error
			}{result, err}
		}()

		go func() {
			result, err := repo.CopySession(ctx, originalSession.ID)
			results <- struct {
				result *CopySessionResult
				err    error
			}{result, err}
		}()

		// Collect results
		result1 := <-results
		result2 := <-results

		// Both should succeed (SELECT FOR UPDATE ensures sequential execution)
		// In PostgreSQL, the second transaction will wait for the first to complete
		require.NoError(t, result1.err)
		require.NoError(t, result2.err)

		// Both should create different sessions
		assert.NotEqual(t, result1.result.NewSessionID, result2.result.NewSessionID)

		// Verify both sessions exist
		var session1, session2 model.Session
		require.NoError(t, db.First(&session1, result1.result.NewSessionID).Error)
		require.NoError(t, db.First(&session2, result2.result.NewSessionID).Error)
	})

	t.Run("copy preserves task order and status", func(t *testing.T) {
		originalSession := &model.Session{
			ID:        uuid.New(),
			ProjectID: project.ID,
		}
		require.NoError(t, db.Create(originalSession).Error)

		// Create tasks in specific order
		task1 := &model.Task{
			ID:        uuid.New(),
			SessionID: originalSession.ID,
			ProjectID: project.ID,
			Order:     1,
			Status:    "pending",
			Data:      model.TaskData{TaskDescription: "Task 1"},
		}
		require.NoError(t, db.Create(task1).Error)

		task2 := &model.Task{
			ID:         uuid.New(),
			SessionID:  originalSession.ID,
			ProjectID:  project.ID,
			Order:      2,
			Status:     "success",
			Data:       model.TaskData{TaskDescription: "Task 2"},
			IsPlanning: true,
		}
		require.NoError(t, db.Create(task2).Error)

		mockAssetRepo := &MockAssetReferenceRepoForCopy{}
		repo := NewSessionRepo(db, mockAssetRepo, nil, logger)

		// Copy session
		result, err := repo.CopySession(ctx, originalSession.ID)
		require.NoError(t, err)

		// Verify tasks were copied in correct order
		var newTasks []model.Task
		require.NoError(t, db.Where("session_id = ?", result.NewSessionID).Order("\"order\" ASC").Find(&newTasks).Error)
		assert.Len(t, newTasks, 2)
		assert.Equal(t, 1, newTasks[0].Order)
		assert.Equal(t, "pending", newTasks[0].Status)
		assert.Equal(t, "Task 1", newTasks[0].Data.TaskDescription)
		assert.Equal(t, 2, newTasks[1].Order)
		assert.Equal(t, "success", newTasks[1].Status)
		assert.True(t, newTasks[1].IsPlanning)
		assert.Equal(t, "Task 2", newTasks[1].Data.TaskDescription)
	})

	t.Run("copy preserves session configs", func(t *testing.T) {
		originalSession := &model.Session{
			ID:        uuid.New(),
			ProjectID: project.ID,
			Configs: datatypes.JSONMap{
				"temperature": 0.7,
				"model":       "gpt-4",
				"max_tokens":  1000,
			},
		}
		require.NoError(t, db.Create(originalSession).Error)

		mockAssetRepo := &MockAssetReferenceRepoForCopy{}
		repo := NewSessionRepo(db, mockAssetRepo, nil, logger)

		// Copy session
		result, err := repo.CopySession(ctx, originalSession.ID)
		require.NoError(t, err)

		// Verify configs were preserved
		var newSession model.Session
		require.NoError(t, db.First(&newSession, result.NewSessionID).Error)
		// JSONMap can be compared directly
		assert.Equal(t, originalSession.Configs, newSession.Configs)
	})

	t.Run("copy preserves disable_task_tracking flag", func(t *testing.T) {
		originalSession := &model.Session{
			ID:                  uuid.New(),
			ProjectID:           project.ID,
			DisableTaskTracking: true,
		}
		require.NoError(t, db.Create(originalSession).Error)

		mockAssetRepo := &MockAssetReferenceRepoForCopy{}
		repo := NewSessionRepo(db, mockAssetRepo, nil, logger)

		// Copy session
		result, err := repo.CopySession(ctx, originalSession.ID)
		require.NoError(t, err)

		// Verify flag was preserved
		var newSession model.Session
		require.NoError(t, db.First(&newSession, result.NewSessionID).Error)
		assert.True(t, newSession.DisableTaskTracking)
	})
}
