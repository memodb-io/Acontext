package tokens

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"strings"
)

func ParseToken(raw, prefix string) (secret string, ok bool) {
	if !strings.HasPrefix(raw, prefix) {
		return "", false
	}
	return strings.TrimPrefix(raw, prefix), true
}

func HMAC256Hex(pepper, secret string) string {
	m := hmac.New(sha256.New, []byte(pepper))
	m.Write([]byte(secret))
	return hex.EncodeToString(m.Sum(nil)) // 64 hex chars
}
