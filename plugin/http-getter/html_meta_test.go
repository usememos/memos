package getter

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGetHTMLMeta(t *testing.T) {
	tests := []struct {
		urlStr   string
		htmlMeta HTMLMeta
	}{}
	for _, test := range tests {
		metadata, err := GetHTMLMeta(test.urlStr)
		require.NoError(t, err)
		require.Equal(t, test.htmlMeta, *metadata)
	}
}
