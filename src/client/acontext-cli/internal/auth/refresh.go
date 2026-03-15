package auth

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const refreshThreshold = 5 * time.Minute

// tokenResponse is the Supabase token endpoint response.
type tokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
	TokenType    string `json:"token_type"`
}

// RefreshIfNeeded checks if the token is close to expiry and refreshes it.
// Returns the (possibly updated) AuthFile.
func RefreshIfNeeded(af *AuthFile) (*AuthFile, error) {
	if af == nil {
		return nil, fmt.Errorf("no auth file")
	}
	if !af.ExpiresWithin(refreshThreshold) {
		return af, nil
	}
	if af.RefreshToken == "" {
		return nil, fmt.Errorf("token expired and no refresh token available — run 'acontext login' again")
	}

	newTokens, err := refreshToken(af.RefreshToken)
	if err != nil {
		return nil, fmt.Errorf("refresh token: %w", err)
	}

	af.AccessToken = newTokens.AccessToken
	af.RefreshToken = newTokens.RefreshToken
	af.ExpiresAt = time.Now().Unix() + int64(newTokens.ExpiresIn)

	if err := Save(af); err != nil {
		return nil, fmt.Errorf("save refreshed auth: %w", err)
	}
	return af, nil
}

// EnsureValidToken loads auth, refreshes if needed, and returns a valid access token.
func EnsureValidToken() (string, error) {
	af, err := MustLoad()
	if err != nil {
		return "", err
	}
	af, err = RefreshIfNeeded(af)
	if err != nil {
		return "", err
	}
	return af.AccessToken, nil
}

// getSupabaseUser calls Supabase GET /auth/v1/user to verify the JWT is valid.
// Returns user info on success, error on 401 or other failures.
func getSupabaseUser(jwt string) (*AuthUser, error) {
	req, err := http.NewRequest("GET", SupabaseURL+"/auth/v1/user", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+jwt)
	req.Header.Set("apikey", SupabaseAnonKey)

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read user response: %w", err)
	}

	if resp.StatusCode == 401 {
		return nil, fmt.Errorf("token rejected by Supabase (401)")
	}
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("supabase user check failed (%d): %s", resp.StatusCode, string(body))
	}

	var user struct {
		ID    string `json:"id"`
		Email string `json:"email"`
	}
	if err := json.Unmarshal(body, &user); err != nil {
		return nil, fmt.Errorf("parse user response: %w", err)
	}
	return &AuthUser{ID: user.ID, Email: user.Email}, nil
}

// ValidateAndRefresh validates the access token with Supabase and refreshes if needed.
// Unlike RefreshIfNeeded (which only checks local expiry), this verifies the token is
// actually accepted by Supabase (catches revoked tokens, deleted users, etc.).
func ValidateAndRefresh(af *AuthFile) (*AuthFile, error) {
	if af == nil {
		return nil, fmt.Errorf("no auth file")
	}

	// Step 1: refresh if near expiry
	if af.ExpiresWithin(refreshThreshold) {
		refreshed, err := RefreshIfNeeded(af)
		if err != nil {
			return nil, err
		}
		af = refreshed
	}

	// Step 2: validate with Supabase
	user, err := getSupabaseUser(af.AccessToken)
	if err == nil {
		// Token is valid — update user info if changed
		if user.ID != af.User.ID || user.Email != af.User.Email {
			af.User.ID = user.ID
			af.User.Email = user.Email
			_ = Save(af)
		}
		return af, nil
	}

	// Step 3: token rejected — try refresh if we have a refresh token
	if af.RefreshToken == "" {
		return nil, fmt.Errorf("token invalid and no refresh token available — run 'acontext login' again")
	}

	newTokens, refreshErr := refreshToken(af.RefreshToken)
	if refreshErr != nil {
		return nil, fmt.Errorf("token invalid and refresh failed — run 'acontext login' again: %w", refreshErr)
	}

	af.AccessToken = newTokens.AccessToken
	af.RefreshToken = newTokens.RefreshToken
	af.ExpiresAt = time.Now().Unix() + int64(newTokens.ExpiresIn)

	// Step 4: re-validate the refreshed token
	user, err = getSupabaseUser(af.AccessToken)
	if err != nil {
		return nil, fmt.Errorf("refreshed token still invalid — run 'acontext login' again: %w", err)
	}

	af.User.ID = user.ID
	af.User.Email = user.Email
	if err := Save(af); err != nil {
		return nil, fmt.Errorf("save refreshed auth: %w", err)
	}
	return af, nil
}

func refreshToken(refreshTok string) (*tokenResponse, error) {
	bodyBytes, err := json.Marshal(map[string]string{"refresh_token": refreshTok})
	if err != nil {
		return nil, fmt.Errorf("marshal refresh request: %w", err)
	}

	req, err := http.NewRequest("POST", SupabaseURL+"/auth/v1/token?grant_type=refresh_token",
		strings.NewReader(string(bodyBytes)))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", SupabaseAnonKey)

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read refresh response: %w", err)
	}
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("refresh failed (%d): %s", resp.StatusCode, string(respBody))
	}

	var tokens tokenResponse
	if err := json.Unmarshal(respBody, &tokens); err != nil {
		return nil, err
	}
	return &tokens, nil
}
