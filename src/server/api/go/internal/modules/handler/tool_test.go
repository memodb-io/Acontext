package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/infra/httpclient"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"gorm.io/gorm"
)

func setupToolRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	return gin.New()
}

func getMockToolCoreClient() *httpclient.CoreClient {
	return &httpclient.CoreClient{
		BaseURL:    "http://invalid-test-url:99999",
		HTTPClient: &http.Client{},
	}
}

func TestToolHandler_ListTools_UserNotFoundReturnsEmptyWithoutCreatingUser(t *testing.T) {
	projectID := uuid.New()
	userIdentifier := "missing-user@acontext.io"

	mockUserService := &MockUserService{}
	mockUserService.On("GetByIdentifier", mock.Anything, projectID, userIdentifier).Return(nil, gorm.ErrRecordNotFound)

	handler := NewToolHandler(mockUserService, getMockToolCoreClient())
	router := setupToolRouter()
	router.GET("/tools", func(c *gin.Context) {
		project := &model.Project{ID: projectID}
		c.Set("project", project)
		handler.ListTools(c)
	})

	req := httptest.NewRequest("GET", "/tools?user="+userIdentifier+"&limit=20", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "\"items\":[]")
	mockUserService.AssertNotCalled(t, "GetOrCreate", mock.Anything, mock.Anything, mock.Anything)
	mockUserService.AssertExpectations(t)
}

func TestToolHandler_SearchTools_UserNotFoundReturnsEmptyWithoutCreatingUser(t *testing.T) {
	projectID := uuid.New()
	userIdentifier := "missing-user@acontext.io"

	mockUserService := &MockUserService{}
	mockUserService.On("GetByIdentifier", mock.Anything, projectID, userIdentifier).Return(nil, gorm.ErrRecordNotFound)

	handler := NewToolHandler(mockUserService, getMockToolCoreClient())
	router := setupToolRouter()
	router.GET("/tools/search", func(c *gin.Context) {
		project := &model.Project{ID: projectID}
		c.Set("project", project)
		handler.SearchTools(c)
	})

	req := httptest.NewRequest("GET", "/tools/search?user="+userIdentifier+"&query=github&limit=10", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "\"items\":[]")
	mockUserService.AssertNotCalled(t, "GetOrCreate", mock.Anything, mock.Anything, mock.Anything)
	mockUserService.AssertExpectations(t)
}

func TestToolHandler_DeleteTool_UserNotFoundReturnsNotFoundWithoutCreatingUser(t *testing.T) {
	projectID := uuid.New()
	userIdentifier := "missing-user@acontext.io"

	mockUserService := &MockUserService{}
	mockUserService.On("GetByIdentifier", mock.Anything, projectID, userIdentifier).Return(nil, gorm.ErrRecordNotFound)

	handler := NewToolHandler(mockUserService, getMockToolCoreClient())
	router := setupToolRouter()
	router.DELETE("/tools/:name", func(c *gin.Context) {
		project := &model.Project{ID: projectID}
		c.Set("project", project)
		handler.DeleteTool(c)
	})

	req := httptest.NewRequest("DELETE", "/tools/github_search?user="+userIdentifier, nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
	assert.Contains(t, w.Body.String(), "tool github_search not found")
	mockUserService.AssertNotCalled(t, "GetOrCreate", mock.Anything, mock.Anything, mock.Anything)
	mockUserService.AssertExpectations(t)
}

func TestToolHandler_ListTools_InvalidFormatReturnsBadRequestBeforeUserLookup(t *testing.T) {
	projectID := uuid.New()

	mockUserService := &MockUserService{}

	handler := NewToolHandler(mockUserService, getMockToolCoreClient())
	router := setupToolRouter()
	router.GET("/tools", func(c *gin.Context) {
		project := &model.Project{ID: projectID}
		c.Set("project", project)
		handler.ListTools(c)
	})

	req := httptest.NewRequest("GET", "/tools?user=missing-user@acontext.io&format=invalid&limit=20", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), "invalid format")
	mockUserService.AssertNotCalled(t, "GetByIdentifier", mock.Anything, mock.Anything, mock.Anything)
	mockUserService.AssertNotCalled(t, "GetOrCreate", mock.Anything, mock.Anything, mock.Anything)
}

func TestToolHandler_SearchTools_InvalidFormatReturnsBadRequestBeforeUserLookup(t *testing.T) {
	projectID := uuid.New()

	mockUserService := &MockUserService{}

	handler := NewToolHandler(mockUserService, getMockToolCoreClient())
	router := setupToolRouter()
	router.GET("/tools/search", func(c *gin.Context) {
		project := &model.Project{ID: projectID}
		c.Set("project", project)
		handler.SearchTools(c)
	})

	req := httptest.NewRequest("GET", "/tools/search?user=missing-user@acontext.io&query=github&format=invalid&limit=10", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), "invalid format")
	mockUserService.AssertNotCalled(t, "GetByIdentifier", mock.Anything, mock.Anything, mock.Anything)
	mockUserService.AssertNotCalled(t, "GetOrCreate", mock.Anything, mock.Anything, mock.Anything)
}

func TestToolHandler_UpsertTool_ForwardsEmptyConfigObjectToCore(t *testing.T) {
	projectID := uuid.New()
	now := time.Now().UTC().Format(time.RFC3339Nano)

	coreServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, http.MethodPost, r.Method)
		assert.Equal(t, fmt.Sprintf("/api/v1/project/%s/tools", projectID.String()), r.URL.Path)
		assert.Equal(t, "openai", r.URL.Query().Get("format"))

		bodyBytes, err := io.ReadAll(r.Body)
		assert.NoError(t, err)

		var payload map[string]interface{}
		err = json.Unmarshal(bodyBytes, &payload)
		assert.NoError(t, err)

		rawCfg, exists := payload["config"]
		assert.True(t, exists, "config key should be forwarded to Core")
		cfg, ok := rawCfg.(map[string]interface{})
		assert.True(t, ok, "config should be a JSON object")
		assert.Len(t, cfg, 0, "config should be forwarded as an empty object")

		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, fmt.Sprintf(`{
			"id":"%s",
			"project_id":"%s",
			"user_id":null,
			"name":"github_search",
			"description":"Search GitHub",
			"config":{},
			"schema":{"type":"function","function":{"name":"github_search","description":"Search GitHub","parameters":{"type":"object","properties":{}}}},
			"created_at":"%s",
			"updated_at":"%s"
		}`, uuid.New().String(), projectID.String(), now, now))
	}))
	defer coreServer.Close()

	handler := NewToolHandler(
		&MockUserService{},
		&httpclient.CoreClient{
			BaseURL:    coreServer.URL,
			HTTPClient: coreServer.Client(),
		},
	)

	router := setupToolRouter()
	router.POST("/tools", func(c *gin.Context) {
		project := &model.Project{ID: projectID}
		c.Set("project", project)
		handler.UpsertTool(c)
	})

	reqBody := `{
		"openai_schema": {
			"type": "function",
			"function": {
				"name": "github_search",
				"description": "Search GitHub",
				"parameters": {"type":"object","properties":{}}
			}
		},
		"config": {}
	}`
	req := httptest.NewRequest(http.MethodPost, "/tools?format=openai", strings.NewReader(reqBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), `"name":"github_search"`)
}

func TestToolHandler_ListAndSearch_ForwardQueryParamsToCore(t *testing.T) {
	projectID := uuid.New()
	userID := uuid.New()
	userIdentifier := "alice@acontext.io"

	var listQuery url.Values
	var searchQuery url.Values

	coreServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case fmt.Sprintf("/api/v1/project/%s/tools", projectID.String()):
			listQuery = r.URL.Query()
			_, _ = io.WriteString(w, `{"items":[],"has_more":false}`)
			return
		case fmt.Sprintf("/api/v1/project/%s/tools/search", projectID.String()):
			searchQuery = r.URL.Query()
			_, _ = io.WriteString(w, `{"items":[]}`)
			return
		default:
			w.WriteHeader(http.StatusNotFound)
			_, _ = io.WriteString(w, `{"detail":"not found"}`)
		}
	}))
	defer coreServer.Close()

	mockUserService := &MockUserService{}
	mockUserService.
		On("GetByIdentifier", mock.Anything, projectID, userIdentifier).
		Return(&model.User{ID: userID}, nil).
		Twice()

	handler := NewToolHandler(
		mockUserService,
		&httpclient.CoreClient{
			BaseURL:    coreServer.URL,
			HTTPClient: coreServer.Client(),
		},
	)

	router := setupToolRouter()
	router.GET("/tools", func(c *gin.Context) {
		project := &model.Project{ID: projectID}
		c.Set("project", project)
		handler.ListTools(c)
	})
	router.GET("/tools/search", func(c *gin.Context) {
		project := &model.Project{ID: projectID}
		c.Set("project", project)
		handler.SearchTools(c)
	})

	listURL := "/tools?user=" + url.QueryEscape(userIdentifier) +
		"&limit=17&cursor=cursor_123&time_desc=true&filter_config=" + url.QueryEscape(`{"tag":"web"}`) +
		"&format=anthropic"
	listReq := httptest.NewRequest(http.MethodGet, listURL, nil)
	listW := httptest.NewRecorder()
	router.ServeHTTP(listW, listReq)
	assert.Equal(t, http.StatusOK, listW.Code)

	searchURL := "/tools/search?user=" + url.QueryEscape(userIdentifier) +
		"&query=slack&limit=9&format=gemini"
	searchReq := httptest.NewRequest(http.MethodGet, searchURL, nil)
	searchW := httptest.NewRecorder()
	router.ServeHTTP(searchW, searchReq)
	assert.Equal(t, http.StatusOK, searchW.Code)

	assert.NotNil(t, listQuery)
	assert.Equal(t, userID.String(), listQuery.Get("user_id"))
	assert.Equal(t, "17", listQuery.Get("limit"))
	assert.Equal(t, "cursor_123", listQuery.Get("cursor"))
	assert.Equal(t, "true", listQuery.Get("time_desc"))
	assert.Equal(t, `{"tag":"web"}`, listQuery.Get("filter_config"))
	assert.Equal(t, "anthropic", listQuery.Get("format"))

	assert.NotNil(t, searchQuery)
	assert.Equal(t, userID.String(), searchQuery.Get("user_id"))
	assert.Equal(t, "slack", searchQuery.Get("query"))
	assert.Equal(t, "9", searchQuery.Get("limit"))
	assert.Equal(t, "gemini", searchQuery.Get("format"))

	mockUserService.AssertExpectations(t)
}

func TestToolHandler_SmokeFlow_ProjectAndUserScopedCRUDAndSearch(t *testing.T) {
	projectID := uuid.New()
	userID := uuid.New()
	userIdentifier := "alice@acontext.io"

	type toolRecord struct {
		ID          uuid.UUID
		ProjectID   uuid.UUID
		UserID      *uuid.UUID
		Name        string
		Description string
		Parameters  map[string]interface{}
		Config      map[string]interface{}
	}

	store := map[string]toolRecord{}
	keyFor := func(pid uuid.UUID, uid *uuid.UUID, name string) string {
		userPart := ""
		if uid != nil {
			userPart = uid.String()
		}
		return pid.String() + "|" + userPart + "|" + name
	}
	sameUser := func(a, b *uuid.UUID) bool {
		if a == nil || b == nil {
			return a == nil && b == nil
		}
		return *a == *b
	}
	parseUserID := func(raw string) (*uuid.UUID, error) {
		raw = strings.TrimSpace(raw)
		if raw == "" {
			return nil, nil
		}
		id, err := uuid.Parse(raw)
		if err != nil {
			return nil, err
		}
		return &id, nil
	}
	toSchema := func(format, name, description string, parameters map[string]interface{}) map[string]interface{} {
		switch format {
		case "anthropic":
			return map[string]interface{}{
				"name":         name,
				"description":  description,
				"input_schema": parameters,
			}
		case "gemini":
			return map[string]interface{}{
				"name":        name,
				"description": description,
				"parameters":  parameters,
			}
		default:
			return map[string]interface{}{
				"type": "function",
				"function": map[string]interface{}{
					"name":        name,
					"description": description,
					"parameters":  parameters,
				},
			}
		}
	}
	toToolOut := func(rec toolRecord, format string) map[string]interface{} {
		now := time.Now().UTC().Format(time.RFC3339Nano)
		var uid interface{}
		if rec.UserID != nil {
			uid = rec.UserID.String()
		}
		return map[string]interface{}{
			"id":          rec.ID.String(),
			"project_id":  rec.ProjectID.String(),
			"user_id":     uid,
			"name":        rec.Name,
			"description": rec.Description,
			"config":      rec.Config,
			"schema":      toSchema(format, rec.Name, rec.Description, rec.Parameters),
			"created_at":  now,
			"updated_at":  now,
		}
	}

	coreServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		if len(parts) < 5 || parts[0] != "api" || parts[1] != "v1" || parts[2] != "project" || parts[4] != "tools" {
			w.WriteHeader(http.StatusNotFound)
			_, _ = io.WriteString(w, `{"detail":"not found"}`)
			return
		}

		pid, err := uuid.Parse(parts[3])
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			_, _ = io.WriteString(w, `{"detail":"invalid project id"}`)
			return
		}
		format := strings.TrimSpace(r.URL.Query().Get("format"))
		if format == "" {
			format = "openai"
		}

		if len(parts) == 5 && r.Method == http.MethodPost {
			var payload map[string]interface{}
			if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
				w.WriteHeader(http.StatusBadRequest)
				_, _ = io.WriteString(w, `{"detail":"invalid payload"}`)
				return
			}

			var scopedUserID *uuid.UUID
			if raw, ok := payload["user_id"].(string); ok {
				scopedUserID, err = parseUserID(raw)
				if err != nil {
					w.WriteHeader(http.StatusBadRequest)
					_, _ = io.WriteString(w, `{"detail":"invalid user id"}`)
					return
				}
			}

			rawSchema, ok := payload["openai_schema"].(map[string]interface{})
			if !ok {
				w.WriteHeader(http.StatusBadRequest)
				_, _ = io.WriteString(w, `{"detail":"openai_schema is required"}`)
				return
			}

			funcObj := rawSchema
			if maybeFunc, ok := rawSchema["function"].(map[string]interface{}); ok {
				funcObj = maybeFunc
			}

			name, _ := funcObj["name"].(string)
			description, _ := funcObj["description"].(string)
			parameters, _ := funcObj["parameters"].(map[string]interface{})
			if parameters == nil {
				parameters = map[string]interface{}{}
			}

			var config map[string]interface{}
			if rawConfig, ok := payload["config"].(map[string]interface{}); ok {
				config = rawConfig
			}

			k := keyFor(pid, scopedUserID, name)
			rec, exists := store[k]
			if !exists {
				rec = toolRecord{
					ID:        uuid.New(),
					ProjectID: pid,
					UserID:    scopedUserID,
					Name:      name,
				}
			}
			rec.Description = description
			rec.Parameters = parameters
			rec.Config = config
			store[k] = rec

			_ = json.NewEncoder(w).Encode(toToolOut(rec, format))
			return
		}

		if len(parts) == 5 && r.Method == http.MethodGet {
			scopedUserID, err := parseUserID(r.URL.Query().Get("user_id"))
			if err != nil {
				w.WriteHeader(http.StatusBadRequest)
				_, _ = io.WriteString(w, `{"detail":"invalid user id"}`)
				return
			}

			items := make([]map[string]interface{}, 0)
			for _, rec := range store {
				if rec.ProjectID != pid || !sameUser(rec.UserID, scopedUserID) {
					continue
				}
				items = append(items, toToolOut(rec, format))
			}
			sort.Slice(items, func(i, j int) bool {
				return items[i]["name"].(string) < items[j]["name"].(string)
			})

			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"items":    items,
				"has_more": false,
			})
			return
		}

		if len(parts) == 6 && parts[5] == "search" && r.Method == http.MethodGet {
			scopedUserID, err := parseUserID(r.URL.Query().Get("user_id"))
			if err != nil {
				w.WriteHeader(http.StatusBadRequest)
				_, _ = io.WriteString(w, `{"detail":"invalid user id"}`)
				return
			}
			query := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("query")))

			hits := make([]map[string]interface{}, 0)
			for _, rec := range store {
				if rec.ProjectID != pid || !sameUser(rec.UserID, scopedUserID) {
					continue
				}
				searchable := strings.ToLower(rec.Name + " " + rec.Description)
				if !strings.Contains(searchable, query) {
					continue
				}
				hits = append(hits, map[string]interface{}{
					"tool":     toToolOut(rec, format),
					"distance": 0.0,
				})
			}
			sort.Slice(hits, func(i, j int) bool {
				left := hits[i]["tool"].(map[string]interface{})["name"].(string)
				right := hits[j]["tool"].(map[string]interface{})["name"].(string)
				return left < right
			})

			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"items": hits,
			})
			return
		}

		if len(parts) == 6 && r.Method == http.MethodDelete {
			scopedUserID, err := parseUserID(r.URL.Query().Get("user_id"))
			if err != nil {
				w.WriteHeader(http.StatusBadRequest)
				_, _ = io.WriteString(w, `{"detail":"invalid user id"}`)
				return
			}
			name, err := url.PathUnescape(parts[5])
			if err != nil {
				w.WriteHeader(http.StatusBadRequest)
				_, _ = io.WriteString(w, `{"detail":"invalid tool name"}`)
				return
			}

			k := keyFor(pid, scopedUserID, name)
			if _, exists := store[k]; !exists {
				w.WriteHeader(http.StatusNotFound)
				_, _ = io.WriteString(w, `{"detail":"tool not found"}`)
				return
			}
			delete(store, k)
			w.WriteHeader(http.StatusOK)
			return
		}

		w.WriteHeader(http.StatusNotFound)
		_, _ = io.WriteString(w, `{"detail":"not found"}`)
	}))
	defer coreServer.Close()

	mockUserService := &MockUserService{}
	mockUserService.
		On("GetOrCreate", mock.Anything, projectID, userIdentifier).
		Return(&model.User{ID: userID, Identifier: userIdentifier}, nil).
		Once()
	mockUserService.
		On("GetByIdentifier", mock.Anything, projectID, userIdentifier).
		Return(&model.User{ID: userID, Identifier: userIdentifier}, nil).
		Times(4)

	handler := NewToolHandler(
		mockUserService,
		&httpclient.CoreClient{
			BaseURL:    coreServer.URL,
			HTTPClient: coreServer.Client(),
		},
	)

	router := setupToolRouter()
	router.POST("/tools", func(c *gin.Context) {
		project := &model.Project{ID: projectID}
		c.Set("project", project)
		handler.UpsertTool(c)
	})
	router.GET("/tools", func(c *gin.Context) {
		project := &model.Project{ID: projectID}
		c.Set("project", project)
		handler.ListTools(c)
	})
	router.GET("/tools/search", func(c *gin.Context) {
		project := &model.Project{ID: projectID}
		c.Set("project", project)
		handler.SearchTools(c)
	})
	router.DELETE("/tools/:name", func(c *gin.Context) {
		project := &model.Project{ID: projectID}
		c.Set("project", project)
		handler.DeleteTool(c)
	})

	parseItemNames := func(body string) []string {
		resp := map[string]interface{}{}
		err := json.Unmarshal([]byte(body), &resp)
		assert.NoError(t, err)

		data, ok := resp["data"].(map[string]interface{})
		assert.True(t, ok)

		itemsRaw, ok := data["items"].([]interface{})
		assert.True(t, ok)

		names := make([]string, 0, len(itemsRaw))
		for _, it := range itemsRaw {
			itemMap := it.(map[string]interface{})
			if toolRaw, ok := itemMap["tool"]; ok {
				toolMap := toolRaw.(map[string]interface{})
				names = append(names, toolMap["name"].(string))
				continue
			}
			names = append(names, itemMap["name"].(string))
		}
		sort.Strings(names)
		return names
	}

	upsertProjectReq := `{
		"openai_schema": {
			"type": "function",
			"function": {
				"name": "github_search",
				"description": "Search GitHub issues and PRs",
				"parameters": {"type":"object","properties":{}}
			}
		},
		"config": {"tag":"web"}
	}`
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/tools?format=openai", strings.NewReader(upsertProjectReq))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	upsertUserReq := fmt.Sprintf(`{
		"user": "%s",
		"openai_schema": {
			"type": "function",
			"function": {
				"name": "slack_search",
				"description": "Search Slack messages",
				"parameters": {"type":"object","properties":{}}
			}
		},
		"config": {"tag":"chat"}
	}`, userIdentifier)
	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/tools?format=openai", strings.NewReader(upsertUserReq))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/tools?limit=20&format=anthropic", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, []string{"github_search"}, parseItemNames(w.Body.String()))
	assert.Contains(t, w.Body.String(), "input_schema")

	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/tools?user="+url.QueryEscape(userIdentifier)+"&limit=20&format=anthropic", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, []string{"slack_search"}, parseItemNames(w.Body.String()))

	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/tools/search?query=github&limit=10&format=openai", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, []string{"github_search"}, parseItemNames(w.Body.String()))

	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/tools/search?user="+url.QueryEscape(userIdentifier)+"&query=slack&limit=10&format=openai", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, []string{"slack_search"}, parseItemNames(w.Body.String()))

	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodDelete, "/tools/slack_search?user="+url.QueryEscape(userIdentifier), nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/tools?user="+url.QueryEscape(userIdentifier)+"&limit=20&format=openai", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, []string{}, parseItemNames(w.Body.String()))

	mockUserService.AssertExpectations(t)
}
