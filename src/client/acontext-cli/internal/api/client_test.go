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

func TestClientGet_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "Bearer sk-ac-test", r.Header.Get("Authorization"))
		assert.Equal(t, "my-jwt", r.Header.Get("X-Access-Token"))

		resp := map[string]interface{}{
			"code": 200,
			"data": []map[string]string{
				{"id": "s1"},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewClient(server.URL, "sk-ac-test", "my-jwt")
	var sessions []Session
	err := client.Get(context.Background(), "/api/v1/session", &sessions)
	require.NoError(t, err)
	assert.Len(t, sessions, 1)
	assert.Equal(t, "s1", sessions[0].ID)
}

func TestClientGet_401(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(401)
		json.NewEncoder(w).Encode(map[string]interface{}{
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
		json.NewEncoder(w).Encode(map[string]interface{}{"code": 200, "data": []interface{}{}})
	}))
	defer server.Close()

	client := NewAdminClient(server.URL, "my-jwt-token")
	var result []interface{}
	err := client.Get(context.Background(), "/admin/v1/project", &result)
	require.NoError(t, err)
}

func TestClientPost_WithBody(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "POST", r.Method)

		var body map[string]string
		json.NewDecoder(r.Body).Decode(&body)
		assert.Equal(t, "alice@test.com", body["user"])

		resp := map[string]interface{}{
			"code": 200,
			"data": map[string]string{"id": "new-id"},
		}
		json.NewEncoder(w).Encode(resp)
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
