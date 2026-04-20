package v1

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestExtractUsernameFromName_EmailShapedSSOUsername(t *testing.T) {
	u, err := ExtractUsernameFromName("users/529408806@QQ.COM")
	require.NoError(t, err)
	require.Equal(t, "529408806@QQ.COM", u)

	u, err = ExtractUsernameFromName("users/abc.def@gmail.com")
	require.NoError(t, err)
	require.Equal(t, "abc.def@gmail.com", u)
}

func TestExtractUsernameFromName_StillRejectsEmptyAndNumeric(t *testing.T) {
	_, err := ExtractUsernameFromName("users/")
	require.Error(t, err)

	_, err = ExtractUsernameFromName("users/123")
	require.Error(t, err)
}
