package crypto

import (
	"bytes"
	"testing"
)

func TestDeriveKEK_Deterministic(t *testing.T) {
	k1, err := DeriveKEK([]byte("secret"), []byte("salt"), []byte("info"))
	if err != nil {
		t.Fatal(err)
	}
	k2, err := DeriveKEK([]byte("secret"), []byte("salt"), []byte("info"))
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(k1, k2) {
		t.Fatal("DeriveKEK should be deterministic")
	}
	if len(k1) != KeySize {
		t.Fatalf("expected key size %d, got %d", KeySize, len(k1))
	}
}

func TestDeriveKEK_DifferentInputs(t *testing.T) {
	k1, _ := DeriveKEK([]byte("secret1"), []byte("salt"), []byte("info"))
	k2, _ := DeriveKEK([]byte("secret2"), []byte("salt"), []byte("info"))
	if bytes.Equal(k1, k2) {
		t.Fatal("different secrets should produce different KEKs")
	}
}

func TestDeriveKEK_EmptySecret(t *testing.T) {
	_, err := DeriveKEK(nil, []byte("salt"), []byte("info"))
	if err == nil {
		t.Fatal("expected error for empty secret")
	}
}

func TestWrapUnwrapDEK(t *testing.T) {
	kek, _ := DeriveKEK([]byte("test-kek"), []byte("salt"), []byte("info"))
	dek, err := GenerateDEK()
	if err != nil {
		t.Fatal(err)
	}

	wrapped, err := WrapDEK(kek, dek)
	if err != nil {
		t.Fatal(err)
	}

	unwrapped, err := UnwrapDEK(kek, wrapped)
	if err != nil {
		t.Fatal(err)
	}

	if !bytes.Equal(dek, unwrapped) {
		t.Fatal("unwrapped DEK should match original")
	}
}

func TestUnwrapDEK_WrongKey(t *testing.T) {
	kek1, _ := DeriveKEK([]byte("key1"), []byte("salt"), []byte("info"))
	kek2, _ := DeriveKEK([]byte("key2"), []byte("salt"), []byte("info"))
	dek, _ := GenerateDEK()

	wrapped, _ := WrapDEK(kek1, dek)

	_, err := UnwrapDEK(kek2, wrapped)
	if err == nil {
		t.Fatal("should fail with wrong KEK")
	}
}

func TestEncryptDecrypt(t *testing.T) {
	dek, _ := GenerateDEK()
	plaintext := []byte("hello world, this is sensitive data!")

	ciphertext, err := Encrypt(dek, plaintext)
	if err != nil {
		t.Fatal(err)
	}

	if bytes.Equal(ciphertext, plaintext) {
		t.Fatal("ciphertext should differ from plaintext")
	}

	decrypted, err := Decrypt(dek, ciphertext)
	if err != nil {
		t.Fatal(err)
	}

	if !bytes.Equal(plaintext, decrypted) {
		t.Fatal("decrypted should match plaintext")
	}
}

func TestDecrypt_WrongKey(t *testing.T) {
	dek1, _ := GenerateDEK()
	dek2, _ := GenerateDEK()
	plaintext := []byte("secret")

	ciphertext, _ := Encrypt(dek1, plaintext)
	_, err := Decrypt(dek2, ciphertext)
	if err == nil {
		t.Fatal("should fail with wrong DEK")
	}
}

func TestEncryptionService_Disabled(t *testing.T) {
	svc, err := NewEncryptionService("", false)
	if err != nil {
		t.Fatal(err)
	}
	if svc.Enabled() {
		t.Fatal("should be disabled")
	}
}

func TestEncryptionService_RoundTrip(t *testing.T) {
	svc, err := NewEncryptionService("my-master-key-for-testing", true)
	if err != nil {
		t.Fatal(err)
	}
	if !svc.Enabled() {
		t.Fatal("should be enabled")
	}

	userKEK, err := DeriveUserKEK("sk-ac-user-api-key", "pepper")
	if err != nil {
		t.Fatal(err)
	}

	plaintext := []byte("sensitive user data that must be protected")

	ciphertext, meta, err := svc.EncryptData(plaintext, userKEK)
	if err != nil {
		t.Fatal(err)
	}
	if meta.Algo != "AES-256-GCM" {
		t.Fatalf("expected AES-256-GCM, got %s", meta.Algo)
	}

	// Decrypt with admin KEK
	decrypted, err := svc.DecryptWithAdminKEK(ciphertext, meta)
	if err != nil {
		t.Fatal("admin decrypt:", err)
	}
	if !bytes.Equal(plaintext, decrypted) {
		t.Fatal("admin decrypted should match plaintext")
	}

	// Decrypt with user KEK
	decrypted, err = svc.DecryptWithUserKEK(ciphertext, userKEK, meta)
	if err != nil {
		t.Fatal("user decrypt:", err)
	}
	if !bytes.Equal(plaintext, decrypted) {
		t.Fatal("user decrypted should match plaintext")
	}
}

func TestEncryptionService_RewrapUserDEK(t *testing.T) {
	svc, _ := NewEncryptionService("master-key", true)
	oldUserKEK, _ := DeriveUserKEK("old-api-key", "pepper")
	newUserKEK, _ := DeriveUserKEK("new-api-key", "pepper")

	plaintext := []byte("data to survive key rotation")
	ciphertext, meta, _ := svc.EncryptData(plaintext, oldUserKEK)

	// Rewrap with new user KEK
	newWrapped, err := svc.RewrapUserDEK(meta, newUserKEK)
	if err != nil {
		t.Fatal(err)
	}
	meta.UserWrappedDEK = newWrapped

	// Old user KEK should fail
	_, err = svc.DecryptWithUserKEK(ciphertext, oldUserKEK, meta)
	if err == nil {
		t.Fatal("old user KEK should fail after rewrap")
	}

	// New user KEK should work
	decrypted, err := svc.DecryptWithUserKEK(ciphertext, newUserKEK, meta)
	if err != nil {
		t.Fatal("new user KEK should succeed:", err)
	}
	if !bytes.Equal(plaintext, decrypted) {
		t.Fatal("plaintext should match after rewrap")
	}

	// Admin KEK should still work
	decrypted, err = svc.DecryptWithAdminKEK(ciphertext, meta)
	if err != nil {
		t.Fatal("admin KEK should still work:", err)
	}
	if !bytes.Equal(plaintext, decrypted) {
		t.Fatal("admin decrypted should match after rewrap")
	}
}

func TestMetadataMapRoundTrip(t *testing.T) {
	meta := &EncryptedMeta{
		Algo:           "AES-256-GCM",
		AdminWrappedDEK: "YWRtaW4=",
		UserWrappedDEK:  "dXNlcg==",
	}
	m := meta.MetadataToMap()
	restored := MetadataFromMap(m)
	if restored == nil {
		t.Fatal("restored should not be nil")
	}
	if restored.Algo != meta.Algo || restored.AdminWrappedDEK != meta.AdminWrappedDEK || restored.UserWrappedDEK != meta.UserWrappedDEK {
		t.Fatal("restored metadata should match original")
	}
}

func TestMetadataFromMap_NoEncryption(t *testing.T) {
	m := map[string]string{"sha256": "abc"}
	meta := MetadataFromMap(m)
	if meta != nil {
		t.Fatal("should return nil for non-encrypted objects")
	}
}
