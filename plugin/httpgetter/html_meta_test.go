package httpgetter

import (
	"errors"
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

func TestGetHTMLMetaForInternal(t *testing.T) {
	// test for internal IP
	if _, err := GetHTMLMeta("http://192.168.0.1"); !errors.Is(err, ErrInternalIP) {
		t.Errorf("Expected error for internal IP, got %v", err)
	}

	// test for resolved internal IP
	if _, err := GetHTMLMeta("http://localhost"); !errors.Is(err, ErrInternalIP) {
		t.Errorf("Expected error for resolved internal IP, got %v", err)
	}
}
