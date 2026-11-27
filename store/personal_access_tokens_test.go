package store

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParsePersonalAccessTokensValid(t *testing.T) {
	raw := `{"tokens":[{"tokenHash":"aaa","createdAt":"2026-10-12T10:32:03Z"}]}`
	setting, err := ParsePersonalAccessTokens([]byte(raw))
	require.NoError(t, err)
	require.Len(t, setting.Tokens, 1)
	assert.Equal(t, "aaa", setting.Tokens[0].TokenHash)
}

// One malformed timestamp must not blank out the user's other tokens.
func TestParsePersonalAccessTokensSkipsCorruptEntry(t *testing.T) {
	raw := `{"tokens":[
		{"tokenHash":"aaa","createdAt":"这不是时间"},
		{"tokenHash":"bbb","createdAt":"2026-10-12T10:32:03Z"}
	]}`
	setting, err := ParsePersonalAccessTokens([]byte(raw))
	require.NoError(t, err)
	require.Len(t, setting.Tokens, 1, "the healthy token must survive")
	assert.Equal(t, "bbb", setting.Tokens[0].TokenHash)
	assert.NotEqual(t, "aaa", setting.Tokens[0].TokenHash, "the corrupt token must be dropped")
}

// A corrupt entry stays unreachable by its own hash, so its lookup misses
// instead of taking the healthy tokens down with it.
func TestParsePersonalAccessTokensCorruptTokenNotFound(t *testing.T) {
	raw := `{"tokens":[
		{"tokenHash":"aaa","createdAt":"不是时间"},
		{"tokenHash":"bbb","createdAt":"2026-10-12T10:32:03Z"}
	]}`
	setting, err := ParsePersonalAccessTokens([]byte(raw))
	require.NoError(t, err)
	for _, token := range setting.Tokens {
		assert.NotEqual(t, "aaa", token.TokenHash)
	}
	found := false
	for _, token := range setting.Tokens {
		if token.TokenHash == "bbb" {
			found = true
		}
	}
	assert.True(t, found, "the healthy token must still be resolvable")
}

func TestParsePersonalAccessTokensAllCorrupt(t *testing.T) {
	raw := `{"tokens":[{"tokenHash":"aaa","createdAt":"不是时间"}]}`
	_, err := ParsePersonalAccessTokens([]byte(raw))
	require.Error(t, err, "when every token is corrupt the caller must see an error")
}

func TestParsePersonalAccessTokensCorruptEnvelope(t *testing.T) {
	for _, raw := range []string{`{这不是JSON`, `{"tokens":"not-an-array"}`, ``} {
		_, err := ParsePersonalAccessTokens([]byte(raw))
		require.Error(t, err, "raw=%q", raw)
	}
}
