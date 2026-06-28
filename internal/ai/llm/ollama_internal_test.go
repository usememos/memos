package llm

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNormalizeBaseURLRewritesLocalhost(t *testing.T) {
	t.Parallel()

	baseURL, err := normalizeBaseURL("http://localhost:11434")
	require.NoError(t, err)
	require.Equal(t, "http://127.0.0.1:11434", baseURL)
}