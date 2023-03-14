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
