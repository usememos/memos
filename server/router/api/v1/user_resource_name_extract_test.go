package v1

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// TestExtractUsernameFromName_EmailShapedSSOUsername ensures that legacy SSO users whose
// username was persisted as an email address remain resolvable through the resource name.
func TestExtractUsernameFromName_EmailShapedSSOUsername(t *testing.T) {
	u, err := ExtractUsernameFromName("users/529408806@QQ.COM")
	require.NoError(t, err)
	require.Equal(t, "529408806@QQ.COM", u)

	u, err = ExtractUsernameFromName("users/abc.def@gmail.com")
	require.NoError(t, err)
	require.Equal(t, "abc.def@gmail.com", u)
}

// TestExtractUsernameFromName_StillRejectsEmptyAndNumeric guards that relaxing the resource-name
// validator does not accept empty or all-numeric usernames, which would clash with numeric user IDs.
func TestExtractUsernameFromName_StillRejectsEmptyAndNumeric(t *testing.T) {
	_, err := ExtractUsernameFromName("users/")
	require.Error(t, err)

	_, err = ExtractUsernameFromName("users/123")
	require.Error(t, err)
}
