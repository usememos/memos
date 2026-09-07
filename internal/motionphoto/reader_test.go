package motionphoto

import (
	"bytes"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/internal/testutil"
)

func TestDetectJPEGReader(t *testing.T) {
	fixture := testutil.BuildMotionPhotoJPEG()
	for _, blob := range [][]byte{nil, []byte("not a JPEG"), fixture} {
		detected, err := DetectJPEGReader(bytes.NewReader(blob), int64(len(blob)))
		require.NoError(t, err)
		require.Equal(t, DetectJPEG(blob), detected)
	}

	// Exercise MP4 headers straddling both sides of the backwards scan boundary.
	for offset := -12; offset <= 12; offset++ {
		blob := make([]byte, 200_000)
		copy(blob, []byte("\xff\xd8 Camera:MotionPhoto=\"1\""))
		start := len(blob) - 64*1024 + offset
		copy(blob[start:], []byte{0, 0, 0, 16, 'f', 't', 'y', 'p', 'm', 'p', '4', '2'})
		detected, err := DetectJPEGReader(bytes.NewReader(blob), int64(len(blob)))
		require.NoError(t, err)
		require.Equal(t, DetectJPEG(blob), detected, "offset %d", offset)
		require.Equal(t, start, detected.VideoStart)
	}

	// Prefer the explicit MicroVideoOffset even when a later ftyp box exists.
	blob := make([]byte, 1024)
	copy(blob, []byte("\xff\xd8 Camera:MotionPhoto=\"1\" Camera:MicroVideoOffset=\"128\""))
	copy(blob[896:], []byte{0, 0, 0, 16, 'f', 't', 'y', 'p', 'm', 'p', '4', '2'})
	copy(blob[1000:], []byte{0, 0, 0, 16, 'f', 't', 'y', 'p', 'm', 'p', '4', '2'})
	detected, err := DetectJPEGReader(bytes.NewReader(blob), int64(len(blob)))
	require.NoError(t, err)
	require.Equal(t, DetectJPEG(blob), detected)
	require.Equal(t, 896, detected.VideoStart)
}
