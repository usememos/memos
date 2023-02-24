package getter

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGetImage(t *testing.T) {
	tests := []struct {
		urlStr string
	}{
		{
			urlStr: "https://star-history.com/bytebase.webp",
		},
	}
	for _, test := range tests {
		_, err := GetImage(test.urlStr)
		require.NoError(t, err)
	}
}

func TestNoInternalImage(t *testing.T) {
	tests := []struct {
		urlStr string
	}{
		{
			urlStr: "http://127.0.0.1",
		},
	}
	for _, test := range tests {
		_, err := GetImage(test.urlStr)
		require.Error(t, err)
		require.Contains(t, err.Error(), "is not allowed")
	}
}
