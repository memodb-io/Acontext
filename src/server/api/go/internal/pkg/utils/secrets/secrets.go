package secrets

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"

	"golang.org/x/crypto/argon2"
)

const (
	Time      = 2
	MemoryMB  = 16
	Threads   = 1
	KeyLen    = 32
	SaltBytes = 16
)

func HashSecret(secret, pepper string) (string, error) {
	if secret == "" {
		return "", errors.New("empty secret")
	}
	salt := make([]byte, SaltBytes)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	key := argon2.IDKey([]byte(secret+pepper), salt, Time, MemoryMB*1024, Threads, KeyLen)
	return fmt.Sprintf("$argon2id$v=19$m=%d,t=%d,p=%d$%s$%s",
		MemoryMB*1024, Time, Threads,
		base64.RawStdEncoding.EncodeToString(salt),
		base64.RawStdEncoding.EncodeToString(key),
	), nil
}

func VerifySecret(secret, pepper, phc string) (bool, error) {
	if !strings.HasPrefix(phc, "$argon2id$") {
		return false, errors.New("unsupported hash format")
	}
	parts := strings.Split(phc, "$")
	if len(parts) != 6 {
		return false, errors.New("invalid phc")
	}

	var m, t, p uint32
	if _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &m, &t, &p); err != nil {
		return false, err
	}

	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		return false, err
	}
	want, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil {
		return false, err
	}

	got := argon2.IDKey([]byte(secret+pepper), salt, t, m, uint8(p), uint32(len(want)))
	if len(got) != len(want) {
		return false, nil
	}

	var diff byte
	for i := range got {
		diff |= got[i] ^ want[i]
	}
	return diff == 0, nil
}
