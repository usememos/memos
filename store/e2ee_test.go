package store

import (
	"encoding/base64"
	"encoding/json"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestEncryptedEnvelopeValidation(t *testing.T) {
	cipher := Ciphertext{Nonce: base64.StdEncoding.EncodeToString(make([]byte, 12)), Ciphertext: base64.StdEncoding.EncodeToString(make([]byte, 48))}
	valid := EncryptedEnvelope{Version: 1, VaultID: uuid.NewString(), ObjectID: uuid.NewString(), RevisionID: uuid.NewString(), Body: cipher, DataKey: cipher}
	data, err := json.Marshal(valid)
	require.NoError(t, err)
	_, err = ParseEncryptedEnvelope(data)
	require.NoError(t, err)
	for _, alter := range []func(*EncryptedEnvelope){func(e *EncryptedEnvelope) { e.Version = 2 }, func(e *EncryptedEnvelope) { e.VaultID = "user/1" }, func(e *EncryptedEnvelope) { e.VaultID = "550e8400-e29b-11d4-a716-446655440000" }, func(e *EncryptedEnvelope) { e.Body.Nonce = "AA==" }, func(e *EncryptedEnvelope) { e.DataKey.Ciphertext = "AA==" }, func(e *EncryptedEnvelope) {
		e.Body.Ciphertext = base64.StdEncoding.EncodeToString(make([]byte, MaxEncryptedBody+1))
	}} {
		e := valid
		alter(&e)
		data, err = json.Marshal(e)
		require.NoError(t, err)
		_, err = ParseEncryptedEnvelope(data)
		require.ErrorIs(t, err, ErrEncryptionPolicy)
	}
	_, err = ParseEncryptedEnvelope([]byte(`{"version":1,"plaintext":"canary"}`))
	require.ErrorIs(t, err, ErrEncryptionPolicy)
}

func TestEncryptionJSONRequiresExactKeys(t *testing.T) {
	cipher := Ciphertext{Nonce: base64.StdEncoding.EncodeToString(make([]byte, 12)), Ciphertext: base64.StdEncoding.EncodeToString(make([]byte, 48))}
	vault := VaultRecord{Version: 1, ID: uuid.NewString(), Revision: uuid.NewString(), Salt: base64.StdEncoding.EncodeToString(make([]byte, 16)), PassphraseKey: cipher, RecoveryKey: cipher}
	raw, err := json.Marshal(vault)
	require.NoError(t, err)
	for _, bad := range []string{strings.Replace(string(raw), `"version"`, `"Version"`, 1), strings.Replace(string(raw), `"nonce"`, `"Nonce"`, 1), strings.Replace(string(raw), `"version":1`, `"version":1,"VERSION":1`, 1), strings.Replace(string(raw), `"version":1`, `"version":1,"version":1`, 1)} {
		_, err := ParseVaultRecord([]byte(bad))
		require.ErrorIs(t, err, ErrEncryptionPolicy)
	}
}
