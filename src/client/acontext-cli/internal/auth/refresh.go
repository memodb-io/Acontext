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
	defer resp.Body.Close()

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
