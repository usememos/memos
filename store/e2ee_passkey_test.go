package store

import (
	"encoding/base64"
	"encoding/json"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestPasskeyRecordValidation(t *testing.T) {
	valid := PasskeyRecord{Version: 1, ID: uuid.NewString(), VaultID: uuid.NewString(), CredentialID: "AA", RPID: "localhost", Salt: base64.StdEncoding.EncodeToString(make([]byte, 32)), Key: Ciphertext{Nonce: base64.StdEncoding.EncodeToString(make([]byte, 12)), Ciphertext: base64.StdEncoding.EncodeToString(make([]byte, 48))}}
	encode := func(v PasskeyRecord) []byte { b, err := json.Marshal(v); require.NoError(t, err); return b }
	raw := encode(valid)
	_, err := ParsePasskeyRecord(raw)
	require.NoError(t, err)
	for name, alter := range map[string]func(*PasskeyRecord){
		"version": func(p *PasskeyRecord) { p.Version = 2 }, "uuid": func(p *PasskeyRecord) { p.ID = "550e8400-e29b-11d4-a716-446655440000" }, "vault": func(p *PasskeyRecord) { p.VaultID = "invalid" },
		"empty credential": func(p *PasskeyRecord) { p.CredentialID = "" }, "padded credential": func(p *PasskeyRecord) { p.CredentialID = "AA==" }, "noncanonical credential": func(p *PasskeyRecord) { p.CredentialID = "AB" }, "large credential": func(p *PasskeyRecord) { p.CredentialID = base64.RawURLEncoding.EncodeToString(make([]byte, 1025)) },
		"salt": func(p *PasskeyRecord) { p.Salt = base64.StdEncoding.EncodeToString(make([]byte, 31)) }, "nonce": func(p *PasskeyRecord) { p.Key.Nonce = "AA==" }, "key": func(p *PasskeyRecord) { p.Key.Ciphertext = base64.StdEncoding.EncodeToString(make([]byte, 47)) },
	} {
		t.Run(name, func(t *testing.T) {
			p := valid
			alter(&p)
			_, err := ParsePasskeyRecord(encode(p))
			require.ErrorIs(t, err, ErrEncryptionPolicy)
		})
	}
	for _, rp := range []string{"", "Example.com", "LOCALHOST", "https://example.com", "example.com:443", "é.com", "-bad.com", "bad-.com", "a..b", "a.", strings.Repeat("a", 64) + ".com", strings.Repeat("a.", 127) + "a"} {
		p := valid
		p.RPID = rp
		_, err := ParsePasskeyRecord(encode(p))
		require.ErrorIs(t, err, ErrEncryptionPolicy, rp)
	}
	for _, rp := range []string{"localhost", "127.0.0.1", "example.com", strings.Repeat("a", 63) + "." + strings.Repeat("b", 63) + "." + strings.Repeat("c", 63) + "." + strings.Repeat("d", 61)} {
		p := valid
		p.RPID = rp
		p.CredentialID = base64.RawURLEncoding.EncodeToString(make([]byte, 1024))
		_, err := ParsePasskeyRecord(encode(p))
		require.NoError(t, err)
	}
	for _, bad := range []string{strings.Replace(string(raw), `"version":1`, `"version":1,"version":1`, 1), strings.Replace(string(raw), `"version"`, `"Version"`, 1), strings.Replace(string(raw), `"nonce"`, `"Nonce"`, 1), strings.Replace(string(raw), `"version":1`, `"version":1,"extra":null`, 1), strings.Replace(string(raw), `"nonce":`, `"nonce":"AA==","nonce":`, 1), string(raw) + "{}", string(raw) + strings.Repeat(" ", 4096)} {
		_, err := ParsePasskeyRecord([]byte(bad))
		require.ErrorIs(t, err, ErrEncryptionPolicy)
	}
	_, err = ParsePasskeyRecord(append(raw, []byte(strings.Repeat(" ", 4096-len(raw)))...))
	require.NoError(t, err)
}
