package audio

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestIsWebMContentType(t *testing.T) {
	cases := []struct {
		in   string
		want bool
	}{
		{"audio/webm", true},
		{"audio/webm;codecs=opus", true},
		{"audio/webm; codecs=opus", true},
		{"AUDIO/WEBM", true},
		{"  audio/webm  ", true},
		{"audio/wav", false},
		{"audio/mp4", false},
		{"video/webm", false},
		{"", false},
		{"webm", false},
	}
	for _, tc := range cases {
		t.Run(tc.in, func(t *testing.T) {
			require.Equal(t, tc.want, IsWebMContentType(tc.in))
		})
	}
}

func TestWebMOpusToWAV_RejectsInvalidInput(t *testing.T) {
	t.Run("empty", func(t *testing.T) {
		_, err := WebMOpusToWAV(nil)
		require.Error(t, err)
	})

	t.Run("not webm", func(t *testing.T) {
		_, err := WebMOpusToWAV([]byte("hello world this is not webm"))
		require.Error(t, err)
	})

	t.Run("truncated webm header bytes", func(t *testing.T) {
		// Valid EBML magic but no Segment.
		_, err := WebMOpusToWAV([]byte{0x1A, 0x45, 0xDF, 0xA3})
		require.Error(t, err)
	})
}
