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

func TestEncryptData_RoundTrip(t *testing.T) {
	userKEK, err := DeriveUserKEK("sk-ac-user-api-key", "pepper")
	if err != nil {
		t.Fatal(err)
	}

	plaintext := []byte("sensitive user data that must be protected")

	ciphertext, meta, err := EncryptData(userKEK, plaintext)
	if err != nil {
		t.Fatal(err)
	}
	if meta.Algo != "AES-256-GCM" {
		t.Fatalf("expected AES-256-GCM, got %s", meta.Algo)
	}
	if meta.UserWrappedDEK == "" {
		t.Fatal("UserWrappedDEK should not be empty")
	}

	// Decrypt with user KEK
	decrypted, err := DecryptData(userKEK, ciphertext, meta)
	if err != nil {
		t.Fatal("user decrypt:", err)
	}
	if !bytes.Equal(plaintext, decrypted) {
		t.Fatal("decrypted should match plaintext")
	}
}

func TestEncryptData_NilKEK(t *testing.T) {
	_, _, err := EncryptData(nil, []byte("data"))
	if err == nil {
		t.Fatal("should fail with nil KEK")
	}
}

func TestDecryptData_NilKEK(t *testing.T) {
	userKEK, _ := DeriveUserKEK("key", "pepper")
	ciphertext, meta, _ := EncryptData(userKEK, []byte("data"))

	_, err := DecryptData(nil, ciphertext, meta)
	if err == nil {
		t.Fatal("should fail with nil KEK")
	}
}

func TestDecryptData_WrongKEK(t *testing.T) {
	userKEK1, _ := DeriveUserKEK("key1", "pepper")
	userKEK2, _ := DeriveUserKEK("key2", "pepper")

	ciphertext, meta, _ := EncryptData(userKEK1, []byte("secret"))

	_, err := DecryptData(userKEK2, ciphertext, meta)
	if err == nil {
		t.Fatal("should fail with wrong KEK")
	}
}

func TestRewrapDEK(t *testing.T) {
	oldUserKEK, _ := DeriveUserKEK("old-api-key", "pepper")
	newUserKEK, _ := DeriveUserKEK("new-api-key", "pepper")

	plaintext := []byte("data to survive key rotation")
	ciphertext, meta, _ := EncryptData(oldUserKEK, plaintext)

	// Rewrap with new user KEK
	newWrapped, err := RewrapDEK(meta, oldUserKEK, newUserKEK)
	if err != nil {
		t.Fatal(err)
	}
	meta.UserWrappedDEK = newWrapped

	// Old user KEK should fail
	_, err = DecryptData(oldUserKEK, ciphertext, meta)
	if err == nil {
		t.Fatal("old user KEK should fail after rewrap")
	}

	// New user KEK should work
	decrypted, err := DecryptData(newUserKEK, ciphertext, meta)
	if err != nil {
		t.Fatal("new user KEK should succeed:", err)
	}
	if !bytes.Equal(plaintext, decrypted) {
		t.Fatal("plaintext should match after rewrap")
	}
}

func TestRewrapDEK_Idempotent(t *testing.T) {
	// Simulate the crash-safe key rotation: if an object is already rewrapped
	// with newKEK, calling RewrapDEK again should return "" (skip) instead of erroring.
	oldUserKEK, _ := DeriveUserKEK("old-key-for-idempotent", "pepper")
	newUserKEK, _ := DeriveUserKEK("new-key-for-idempotent", "pepper")

	plaintext := []byte("data for idempotent rewrap test")
	ciphertext, meta, _ := EncryptData(oldUserKEK, plaintext)

	// First rewrap: old → new
	newWrapped, err := RewrapDEK(meta, oldUserKEK, newUserKEK)
	if err != nil {
		t.Fatal("first rewrap failed:", err)
	}
	if newWrapped == "" {
		t.Fatal("first rewrap should not skip")
	}
	meta.UserWrappedDEK = newWrapped

	// Second rewrap with same old/new KEKs — should skip (return "")
	skipped, err := RewrapDEK(meta, oldUserKEK, newUserKEK)
	if err != nil {
		t.Fatal("second rewrap should not error:", err)
	}
	if skipped != "" {
		t.Fatal("second rewrap should return empty string (skip already-rewrapped object)")
	}

	// Verify data is still decryptable with new KEK
	decrypted, err := DecryptData(newUserKEK, ciphertext, meta)
	if err != nil {
		t.Fatal("decrypt with new KEK after idempotent rewrap:", err)
	}
	if !bytes.Equal(plaintext, decrypted) {
		t.Fatal("plaintext should match after idempotent rewrap")
	}
}

func TestRewrapDEK_BothKEKsFail(t *testing.T) {
	// If the DEK is wrapped with a totally different KEK, RewrapDEK should error.
	kek1, _ := DeriveUserKEK("kek-one", "pepper")
	kek2, _ := DeriveUserKEK("kek-two", "pepper")
	kekWrong, _ := DeriveUserKEK("kek-wrong", "pepper")

	_, meta, _ := EncryptData(kekWrong, []byte("data"))

	// Neither kek1 nor kek2 can unwrap — should return error
	_, err := RewrapDEK(meta, kek1, kek2)
	if err == nil {
		t.Fatal("RewrapDEK should fail when neither KEK can unwrap")
	}
}

func TestMetadataMapRoundTrip(t *testing.T) {
	meta := &EncryptedMeta{
		Algo:           "AES-256-GCM",
		UserWrappedDEK: "dXNlcg==",
	}
	m := meta.MetadataToMap()
	restored := MetadataFromMap(m)
	if restored == nil {
		t.Fatal("restored should not be nil")
	}
	if restored.Algo != meta.Algo || restored.UserWrappedDEK != meta.UserWrappedDEK {
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

func TestDeriveUserKEK_Deterministic(t *testing.T) {
	k1, err := DeriveUserKEK("auth-secret", "pepper")
	if err != nil {
		t.Fatal(err)
	}
	k2, err := DeriveUserKEK("auth-secret", "pepper")
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(k1, k2) {
		t.Fatal("DeriveUserKEK should be deterministic")
	}
	if len(k1) != KeySize {
		t.Fatalf("expected key size %d, got %d", KeySize, len(k1))
	}
}

func TestWrapUnwrapMasterKey(t *testing.T) {
	wk, _ := DeriveUserKEK("auth-secret", "pepper")
	mk, err := GenerateMasterKey()
	if err != nil {
		t.Fatal(err)
	}

	encB64, err := WrapMasterKey(wk, mk)
	if err != nil {
		t.Fatal(err)
	}
	if encB64 == "" {
		t.Fatal("encrypted master key should not be empty")
	}

	unwrapped, err := UnwrapMasterKey(wk, encB64)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(mk, unwrapped) {
		t.Fatal("unwrapped master key should match original")
	}
}

func TestUnwrapMasterKey_WrongWrappingKey(t *testing.T) {
	wk1, _ := DeriveUserKEK("auth1", "pepper")
	wk2, _ := DeriveUserKEK("auth2", "pepper")
	mk, _ := GenerateMasterKey()

	encB64, _ := WrapMasterKey(wk1, mk)

	_, err := UnwrapMasterKey(wk2, encB64)
	if err == nil {
		t.Fatal("should fail with wrong wrapping key")
	}
}

func TestMasterKeyAsKEK(t *testing.T) {
	// master_key is used directly as KEK for wrapping S3 DEKs
	mk, _ := GenerateMasterKey()

	plaintext := []byte("data encrypted with master key as KEK")
	ciphertext, meta, err := EncryptData(mk, plaintext)
	if err != nil {
		t.Fatal(err)
	}

	decrypted, err := DecryptData(mk, ciphertext, meta)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(plaintext, decrypted) {
		t.Fatal("decrypted should match plaintext when using master key as KEK")
	}
}

func TestMasterKeyRewrapPreservesDecryption(t *testing.T) {
	// Simulate: old auth_secret → new auth_secret, same master_key
	// S3 data should still decrypt with the same master_key
	mk, _ := GenerateMasterKey()

	// Encrypt data with master_key as KEK
	plaintext := []byte("data that should survive auth rotation")
	ciphertext, meta, _ := EncryptData(mk, plaintext)

	// Re-wrap master_key with new auth_secret (simulating rotation)
	oldWK, _ := DeriveUserKEK("old-auth", "pepper")
	newWK, _ := DeriveUserKEK("new-auth", "pepper")

	encB64, _ := WrapMasterKey(oldWK, mk)
	unwrapped, _ := UnwrapMasterKey(oldWK, encB64)

	// Re-wrap with new wrapping key
	newEncB64, _ := WrapMasterKey(newWK, unwrapped)
	rewrappedMK, _ := UnwrapMasterKey(newWK, newEncB64)

	// master_key should be the same
	if !bytes.Equal(mk, rewrappedMK) {
		t.Fatal("master key should be preserved across auth rotation")
	}

	// S3 data should still decrypt
	decrypted, err := DecryptData(rewrappedMK, ciphertext, meta)
	if err != nil {
		t.Fatal("data should decrypt with same master key after auth rotation:", err)
	}
	if !bytes.Equal(plaintext, decrypted) {
		t.Fatal("decrypted should match plaintext")
	}
}

func TestMetadataToMap_NoAdminDEK(t *testing.T) {
	meta := &EncryptedMeta{
		Algo:           "AES-256-GCM",
		UserWrappedDEK: "dXNlcg==",
	}
	m := meta.MetadataToMap()
	if _, ok := m["enc-dek-admin"]; ok {
		t.Fatal("should not contain enc-dek-admin")
	}
	if m["enc-algo"] != "AES-256-GCM" {
		t.Fatal("should contain enc-algo")
	}
	if m["enc-dek-user"] != "dXNlcg==" {
		t.Fatal("should contain enc-dek-user")
	}
}
