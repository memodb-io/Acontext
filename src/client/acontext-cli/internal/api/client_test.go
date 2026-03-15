package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- buildQuery tests ---

func TestBuildQuery_NilParams(t *testing.T) {
	assert.Equal(t, "", buildQuery(nil))
}

func TestBuildQuery_EmptyStruct(t *testing.T) {
	assert.Equal(t, "", buildQuery(&ListParams{}))
}

func TestBuildQuery_UserOnly(t *testing.T) {
	assert.Equal(t, "?user=alice", buildQuery(&ListParams{User: "alice"}))
}

func TestBuildQuery_AllFields(t *testing.T) {
	q := buildQuery(&ListParams{User: "bob", Limit: 10, Cursor: "abc", TimeDesc: true})
	assert.Contains(t, q, "user=bob")
	assert.Contains(t, q, "limit=10")
	assert.Contains(t, q, "cursor=abc")
	assert.Contains(t, q, "time_desc=true")
}

func TestBuildQuery_LimitZeroNotIncluded(t *testing.T) {
	q := buildQuery(&ListParams{User: "x", Limit: 0})
	assert.NotContains(t, q, "limit")
}

// --- APIError.Error() tests ---

func TestAPIError_WithMessage(t *testing.T) {
	err := &APIError{StatusCode: 401, Message: "unauthorized"}
	assert.Equal(t, "API error 401: unauthorized", err.Error())
}

func TestAPIError_WithoutMessage(t *testing.T) {
	err := &APIError{StatusCode: 500}
	assert.Equal(t, "API error 500", err.Error())
}

func TestClientGet_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "Bearer sk-ac-test", r.Header.Get("Authorization"))
		assert.Equal(t, "my-jwt", r.Header.Get("X-Access-Token"))

		resp := map[string]interface{}{
			"code": 200,
			"data": map[string]interface{}{
				"id":   "s1",
				"name": "test-project",
			},
		}
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewClient(server.URL, "sk-ac-test", "my-jwt")
	var session Session
	err := client.Get(context.Background(), "/api/v1/session/s1", &session)
	require.NoError(t, err)
	assert.Equal(t, "s1", session.ID)
}

func TestClientGet_401(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(401)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"code":  401,
			"error": "unauthorized",
		})
	}))
	defer server.Close()

	client := NewClient(server.URL, "bad-key", "")
	var result interface{}
	err := client.Get(context.Background(), "/api/v1/session", &result)
	require.Error(t, err)

	apiErr, ok := err.(*APIError)
	require.True(t, ok)
	assert.Equal(t, 401, apiErr.StatusCode)
}

func TestAdminClient_HeadersSet(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "my-jwt-token", r.Header.Get("X-Access-Token"))
		assert.Empty(t, r.Header.Get("Authorization"))
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"code": 200, "data": map[string]interface{}{}})
	}))
	defer server.Close()

	client := NewAdminClient(server.URL, "my-jwt-token")
	var result map[string]interface{}
	err := client.Get(context.Background(), "/admin/v1/project", &result)
	require.NoError(t, err)
}

func TestClientPost_WithBody(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "POST", r.Method)

		var body map[string]string
		_ = json.NewDecoder(r.Body).Decode(&body)
		assert.Equal(t, "alice@test.com", body["user"])

		resp := map[string]interface{}{
			"code": 200,
			"data": map[string]string{"id": "new-id"},
		}
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewClient(server.URL, "key", "jwt")
	var session Session
	err := client.Post(context.Background(), "/api/v1/session", &CreateSessionRequest{User: "alice@test.com"}, &session)
	require.NoError(t, err)
	assert.Equal(t, "new-id", session.ID)
}

func TestClientDelete(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "DELETE", r.Method)
		w.WriteHeader(200)
	}))
	defer server.Close()

	client := NewClient(server.URL, "key", "jwt")
	err := client.Delete(context.Background(), "/api/v1/session/s1", nil)
	require.NoError(t, err)
}

// --- Paginated response tests ---

func TestListSessions_PaginatedResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]interface{}{
			"code": 200,
			"data": map[string]interface{}{
				"items": []map[string]string{
					{"id": "s1", "project_id": "p1"},
					{"id": "s2", "project_id": "p1"},
				},
				"next_cursor": "abc123",
				"has_more":    true,
			},
		}
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewClient(server.URL, "key", "jwt")
	sessions, err := client.ListSessions(context.Background(), nil)
	require.NoError(t, err)
	assert.Len(t, sessions, 2)
	assert.Equal(t, "s1", sessions[0].ID)
	assert.Equal(t, "s2", sessions[1].ID)
}

func TestListSessions_EmptyItems(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]interface{}{
			"code": 200,
			"data": map[string]interface{}{
				"items":    []interface{}{},
				"has_more": false,
			},
		}
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewClient(server.URL, "key", "jwt")
	sessions, err := client.ListSessions(context.Background(), nil)
	require.NoError(t, err)
	assert.Empty(t, sessions)
}

func TestListDisks_PaginatedResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]interface{}{
			"code": 200,
			"data": map[string]interface{}{
				"items": []map[string]string{
					{"id": "d1"},
				},
				"has_more": false,
			},
		}
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewClient(server.URL, "key", "jwt")
	disks, err := client.ListDisks(context.Background(), nil)
	require.NoError(t, err)
	assert.Len(t, disks, 1)
	assert.Equal(t, "d1", disks[0].ID)
}

func TestListMessages_PaginatedResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]interface{}{
			"code": 200,
			"data": map[string]interface{}{
				"items": []map[string]string{
					{"id": "m1", "role": "user", "content": "hello"},
					{"id": "m2", "role": "assistant", "content": "hi"},
				},
				"has_more": false,
			},
		}
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewClient(server.URL, "key", "jwt")
	messages, err := client.ListMessages(context.Background(), "s1", nil)
	require.NoError(t, err)
	assert.Len(t, messages, 2)
	assert.Equal(t, "user", messages[0].Role)
	assert.Equal(t, "hello", messages[0].Content)
}

func TestListArtifacts_Response(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]interface{}{
			"code": 200,
			"data": map[string]interface{}{
				"artifacts": []map[string]interface{}{
					{"id": "a1", "disk_id": "d1", "path": "/docs/readme.md"},
					{"id": "a2", "disk_id": "d1", "path": "/docs/guide.md"},
				},
				"directories": []string{"images", "config"},
			},
		}
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewClient(server.URL, "key", "jwt")
	artifacts, err := client.ListArtifacts(context.Background(), "d1")
	require.NoError(t, err)
	assert.Len(t, artifacts, 2)
	assert.Equal(t, "a1", artifacts[0].ID)
	assert.Equal(t, "/docs/readme.md", artifacts[0].Path)
}

func TestListAgentSkills_PaginatedResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]interface{}{
			"code": 200,
			"data": map[string]interface{}{
				"items": []map[string]string{
					{"id": "sk1", "name": "my-skill"},
				},
				"has_more": false,
			},
		}
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewClient(server.URL, "key", "jwt")
	skills, err := client.ListAgentSkills(context.Background(), nil)
	require.NoError(t, err)
	assert.Len(t, skills, 1)
	assert.Equal(t, "my-skill", skills[0].Name)
}

func TestListUsers_PaginatedResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]interface{}{
			"code": 200,
			"data": map[string]interface{}{
				"items": []map[string]string{
					{"id": "u1", "identifier": "alice@test.com"},
				},
				"has_more": false,
			},
		}
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewClient(server.URL, "key", "jwt")
	users, err := client.ListUsers(context.Background(), nil)
	require.NoError(t, err)
	assert.Len(t, users, 1)
	assert.Equal(t, "alice@test.com", users[0].Identifier)
}

func TestListLearningSpaces_PaginatedResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]interface{}{
			"code": 200,
			"data": map[string]interface{}{
				"items": []map[string]string{
					{"id": "ls1", "project_id": "p1"},
				},
				"has_more": false,
			},
		}
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewClient(server.URL, "key", "jwt")
	spaces, err := client.ListLearningSpaces(context.Background(), nil)
	require.NoError(t, err)
	assert.Len(t, spaces, 1)
	assert.Equal(t, "ls1", spaces[0].ID)
}

func TestPing_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "GET", r.Method)
		assert.Equal(t, "/api/v1/ping", r.URL.Path)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"code": 200,
			"msg":  "pong",
		})
	}))
	defer server.Close()

	client := NewClient(server.URL, "key", "jwt")
	err := client.Ping(context.Background())
	require.NoError(t, err)
}

func TestPing_Failure(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(401)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"code":  401,
			"error": "invalid api key",
		})
	}))
	defer server.Close()

	client := NewClient(server.URL, "bad-key", "jwt")
	err := client.Ping(context.Background())
	require.Error(t, err)
	apiErr, ok := err.(*APIError)
	require.True(t, ok)
	assert.Equal(t, 401, apiErr.StatusCode)
}

// --- Create/Get/Delete method tests ---

func newEnvelopeServer(t *testing.T, wantMethod string, checkFn func(*http.Request), data interface{}) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if wantMethod != "" {
			assert.Equal(t, wantMethod, r.Method)
		}
		if checkFn != nil {
			checkFn(r)
		}
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"code": 200, "data": data})
	}))
}

func TestCreateSession(t *testing.T) {
	server := newEnvelopeServer(t, "POST", func(r *http.Request) {
		var body CreateSessionRequest
		_ = json.NewDecoder(r.Body).Decode(&body)
		assert.Equal(t, "alice@test.com", body.User)
	}, map[string]string{"id": "s-new", "project_id": "p1"})
	defer server.Close()

	client := NewClient(server.URL, "key", "jwt")
	session, err := client.CreateSession(context.Background(), &CreateSessionRequest{User: "alice@test.com"})
	require.NoError(t, err)
	assert.Equal(t, "s-new", session.ID)
}

func TestGetSession_Success(t *testing.T) {
	server := newEnvelopeServer(t, "GET", func(r *http.Request) {
		assert.Equal(t, "s1", r.URL.Query().Get("id"))
	}, map[string]interface{}{
		"items": []map[string]string{{"id": "s1", "project_id": "p1"}},
	})
	defer server.Close()

	client := NewClient(server.URL, "key", "jwt")
	session, err := client.GetSession(context.Background(), "s1")
	require.NoError(t, err)
	assert.Equal(t, "s1", session.ID)
}

func TestGetSession_404WhenEmpty(t *testing.T) {
	server := newEnvelopeServer(t, "GET", nil, map[string]interface{}{
		"items": []interface{}{},
	})
	defer server.Close()

	client := NewClient(server.URL, "key", "jwt")
	_, err := client.GetSession(context.Background(), "missing")
	require.Error(t, err)
	apiErr, ok := err.(*APIError)
	require.True(t, ok)
	assert.Equal(t, 404, apiErr.StatusCode)
}

func TestDeleteSession(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "DELETE", r.Method)
		assert.Equal(t, "/api/v1/session/s1", r.URL.Path)
		w.WriteHeader(200)
	}))
	defer server.Close()

	client := NewClient(server.URL, "key", "jwt")
	err := client.DeleteSession(context.Background(), "s1")
	require.NoError(t, err)
}

func TestStoreMessage(t *testing.T) {
	server := newEnvelopeServer(t, "POST", func(r *http.Request) {
		assert.Contains(t, r.URL.Path, "/api/v1/session/s1/messages")
		var body StoreMessageRequest
		_ = json.NewDecoder(r.Body).Decode(&body)
		assert.Equal(t, "user", body.Role)
		assert.Equal(t, "hello", body.Content)
	}, map[string]string{"id": "m1", "role": "user", "content": "hello"})
	defer server.Close()

	client := NewClient(server.URL, "key", "jwt")
	msg, err := client.StoreMessage(context.Background(), "s1", &StoreMessageRequest{Role: "user", Content: "hello"})
	require.NoError(t, err)
	assert.Equal(t, "m1", msg.ID)
}

func TestCreateDisk(t *testing.T) {
	server := newEnvelopeServer(t, "POST", func(r *http.Request) {
		var body CreateDiskRequest
		_ = json.NewDecoder(r.Body).Decode(&body)
		assert.Equal(t, "alice", body.User)
	}, map[string]string{"id": "d-new"})
	defer server.Close()

	client := NewClient(server.URL, "key", "jwt")
	disk, err := client.CreateDisk(context.Background(), &CreateDiskRequest{User: "alice"})
	require.NoError(t, err)
	assert.Equal(t, "d-new", disk.ID)
}

func TestGetDisk_Success(t *testing.T) {
	server := newEnvelopeServer(t, "GET", func(r *http.Request) {
		assert.Equal(t, "d1", r.URL.Query().Get("id"))
	}, map[string]interface{}{
		"items": []map[string]string{{"id": "d1"}},
	})
	defer server.Close()

	client := NewClient(server.URL, "key", "jwt")
	disk, err := client.GetDisk(context.Background(), "d1")
	require.NoError(t, err)
	assert.Equal(t, "d1", disk.ID)
}

func TestGetDisk_404WhenEmpty(t *testing.T) {
	server := newEnvelopeServer(t, "GET", nil, map[string]interface{}{
		"items": []interface{}{},
	})
	defer server.Close()

	client := NewClient(server.URL, "key", "jwt")
	_, err := client.GetDisk(context.Background(), "missing")
	require.Error(t, err)
	apiErr, ok := err.(*APIError)
	require.True(t, ok)
	assert.Equal(t, 404, apiErr.StatusCode)
}

func TestDeleteDisk(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "DELETE", r.Method)
		assert.Equal(t, "/api/v1/disk/d1", r.URL.Path)
		w.WriteHeader(200)
	}))
	defer server.Close()

	client := NewClient(server.URL, "key", "jwt")
	err := client.DeleteDisk(context.Background(), "d1")
	require.NoError(t, err)
}

func TestDeleteArtifact(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "DELETE", r.Method)
		assert.Equal(t, "/docs/readme.md", r.URL.Query().Get("path"))
		w.WriteHeader(200)
	}))
	defer server.Close()

	client := NewClient(server.URL, "key", "jwt")
	err := client.DeleteArtifact(context.Background(), "d1", "/docs/readme.md")
	require.NoError(t, err)
}

func TestGetAgentSkill(t *testing.T) {
	server := newEnvelopeServer(t, "GET", func(r *http.Request) {
		assert.Equal(t, "/api/v1/agent_skills/sk1", r.URL.Path)
	}, map[string]string{"id": "sk1", "name": "my-skill"})
	defer server.Close()

	client := NewClient(server.URL, "key", "jwt")
	skill, err := client.GetAgentSkill(context.Background(), "sk1")
	require.NoError(t, err)
	assert.Equal(t, "sk1", skill.ID)
	assert.Equal(t, "my-skill", skill.Name)
}

func TestDeleteAgentSkill(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "DELETE", r.Method)
		assert.Equal(t, "/api/v1/agent_skills/sk1", r.URL.Path)
		w.WriteHeader(200)
	}))
	defer server.Close()

	client := NewClient(server.URL, "key", "jwt")
	err := client.DeleteAgentSkill(context.Background(), "sk1")
	require.NoError(t, err)
}

func TestDeleteUser(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "DELETE", r.Method)
		assert.Equal(t, "/api/v1/user/alice@test.com", r.URL.Path)
		w.WriteHeader(200)
	}))
	defer server.Close()

	client := NewClient(server.URL, "key", "jwt")
	err := client.DeleteUser(context.Background(), "alice@test.com")
	require.NoError(t, err)
}

func TestCreateLearningSpace(t *testing.T) {
	server := newEnvelopeServer(t, "POST", func(r *http.Request) {
		var body CreateLearningSpaceRequest
		_ = json.NewDecoder(r.Body).Decode(&body)
		assert.Equal(t, "alice", body.User)
	}, map[string]string{"id": "ls-new"})
	defer server.Close()

	client := NewClient(server.URL, "key", "jwt")
	space, err := client.CreateLearningSpace(context.Background(), &CreateLearningSpaceRequest{User: "alice"})
	require.NoError(t, err)
	assert.Equal(t, "ls-new", space.ID)
}

func TestGetLearningSpace(t *testing.T) {
	server := newEnvelopeServer(t, "GET", func(r *http.Request) {
		assert.Equal(t, "/api/v1/learning_spaces/ls1", r.URL.Path)
	}, map[string]string{"id": "ls1"})
	defer server.Close()

	client := NewClient(server.URL, "key", "jwt")
	space, err := client.GetLearningSpace(context.Background(), "ls1")
	require.NoError(t, err)
	assert.Equal(t, "ls1", space.ID)
}

func TestDeleteLearningSpace(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "DELETE", r.Method)
		assert.Equal(t, "/api/v1/learning_spaces/ls1", r.URL.Path)
		w.WriteHeader(200)
	}))
	defer server.Close()

	client := NewClient(server.URL, "key", "jwt")
	err := client.DeleteLearningSpace(context.Background(), "ls1")
	require.NoError(t, err)
}

func TestLearnFromSession(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "POST", r.Method)
		assert.Contains(t, r.URL.Path, "/api/v1/learning_spaces/ls1/learn")
		assert.Equal(t, "s1", r.URL.Query().Get("session_id"))
		w.WriteHeader(200)
	}))
	defer server.Close()

	client := NewClient(server.URL, "key", "jwt")
	err := client.LearnFromSession(context.Background(), "ls1", "s1")
	require.NoError(t, err)
}

// --- Admin methods ---

func TestAdminCreateProject(t *testing.T) {
	server := newEnvelopeServer(t, "POST", func(r *http.Request) {
		assert.Equal(t, "/admin/v1/project", r.URL.Path)
		var body CreateProjectRequest
		_ = json.NewDecoder(r.Body).Decode(&body)
		assert.Equal(t, "my-proj", body.Name)
	}, map[string]string{"project_id": "p1", "secret_key": "sk-ac-xxx"})
	defer server.Close()

	client := NewAdminClient(server.URL, "jwt")
	proj, err := client.AdminCreateProject(context.Background(), &CreateProjectRequest{Name: "my-proj"})
	require.NoError(t, err)
	assert.Equal(t, "p1", proj.ProjectID)
	assert.Equal(t, "sk-ac-xxx", proj.SecretKey)
}

func TestAdminDeleteProject(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "DELETE", r.Method)
		assert.Equal(t, "/admin/v1/project/p1", r.URL.Path)
		w.WriteHeader(200)
	}))
	defer server.Close()

	client := NewAdminClient(server.URL, "jwt")
	err := client.AdminDeleteProject(context.Background(), "p1")
	require.NoError(t, err)
}

func TestAdminRotateKey(t *testing.T) {
	server := newEnvelopeServer(t, "PUT", func(r *http.Request) {
		assert.Equal(t, "/admin/v1/project/p1/secret_key", r.URL.Path)
	}, map[string]string{"secret_key": "sk-ac-new"})
	defer server.Close()

	client := NewAdminClient(server.URL, "jwt")
	resp, err := client.AdminRotateKey(context.Background(), "p1")
	require.NoError(t, err)
	assert.Equal(t, "sk-ac-new", resp.SecretKey)
}

func TestAdminGetProjectStats(t *testing.T) {
	server := newEnvelopeServer(t, "GET", func(r *http.Request) {
		assert.Equal(t, "/admin/v1/project/p1/statistics", r.URL.Path)
	}, map[string]interface{}{"taskCount": 10, "skillCount": 3, "sessionCount": 5})
	defer server.Close()

	client := NewAdminClient(server.URL, "jwt")
	stats, err := client.AdminGetProjectStats(context.Background(), "p1")
	require.NoError(t, err)
	assert.Equal(t, int64(5), stats.SessionCount)
	assert.Equal(t, int64(10), stats.TaskCount)
	assert.Equal(t, int64(3), stats.SkillCount)
}

func TestAdminGetProjectUsages(t *testing.T) {
	server := newEnvelopeServer(t, "GET", func(r *http.Request) {
		assert.Equal(t, "/admin/v1/project/p1/usages", r.URL.Path)
	}, map[string]interface{}{"total": 100})
	defer server.Close()

	client := NewAdminClient(server.URL, "jwt")
	usages, err := client.AdminGetProjectUsages(context.Background(), "p1")
	require.NoError(t, err)
	assert.NotNil(t, usages)
}

// --- Put/Patch method tests ---

func TestClientPut(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "PUT", r.Method)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"code": 200, "data": map[string]string{"id": "x"}})
	}))
	defer server.Close()

	client := NewClient(server.URL, "key", "jwt")
	var result map[string]string
	err := client.Put(context.Background(), "/test", map[string]string{"a": "b"}, &result)
	require.NoError(t, err)
	assert.Equal(t, "x", result["id"])
}

func TestClientPatch(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "PATCH", r.Method)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"code": 200, "data": map[string]string{"id": "y"}})
	}))
	defer server.Close()

	client := NewClient(server.URL, "key", "jwt")
	var result map[string]string
	err := client.Patch(context.Background(), "/test", map[string]string{"a": "b"}, &result)
	require.NoError(t, err)
	assert.Equal(t, "y", result["id"])
}

// --- Error handling tests ---

func TestErrorHandling_NonJSONBody(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(500)
		_, _ = w.Write([]byte("Internal Server Error"))
	}))
	defer server.Close()

	client := NewClient(server.URL, "key", "jwt")
	var result interface{}
	err := client.Get(context.Background(), "/fail", &result)
	require.Error(t, err)
	apiErr, ok := err.(*APIError)
	require.True(t, ok)
	assert.Equal(t, 500, apiErr.StatusCode)
	assert.Equal(t, "Internal Server Error", apiErr.Message)
}

func TestErrorHandling_EnvelopeWithMsg(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(403)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"code": 403,
			"msg":  "forbidden resource",
		})
	}))
	defer server.Close()

	client := NewClient(server.URL, "key", "jwt")
	var result interface{}
	err := client.Get(context.Background(), "/forbidden", &result)
	require.Error(t, err)
	apiErr, ok := err.(*APIError)
	require.True(t, ok)
	assert.Equal(t, 403, apiErr.StatusCode)
	assert.Equal(t, "forbidden resource", apiErr.Message)
}
