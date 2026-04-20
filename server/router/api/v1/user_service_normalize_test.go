package v1

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// TestNormalizeBatchUsernames_EmailShapedSSOUsername locks in that
// email-shaped SSO usernames survive batch normalization while empty and
// all-numeric inputs are dropped and duplicates are de-duplicated.
//
// This complements the ExtractUsernameFromName tests by exercising the
// BatchGetUsers normalization path independently.
func TestNormalizeBatchUsernames_EmailShapedSSOUsername(t *testing.T) {
	got := normalizeBatchUsernames([]string{
		"abc.def@gmail.com",
		"abc.def@gmail.com",
		"123",
		"",
	})

	require.Equal(t, []string{"abc.def@gmail.com"}, got)
}
