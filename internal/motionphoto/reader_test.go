package motionphoto

import (
	"bytes"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/internal/testutil"
)

func TestDetectJPEGReader(t *testing.T) {
	for _, blob := range [][]byte{nil, []byte("not a JPEG"), []byte("\xff\xd8 no motion marker here at all")} {
		detected, err := DetectJPEGReader(bytes.NewReader(blob), int64(len(blob)))
		require.NoError(t, err)
		require.Nil(t, detected)
	}
	fixture := testutil.BuildMotionPhotoJPEG()
	detected, err := DetectJPEGReader(bytes.NewReader(fixture), int64(len(fixture)))
	require.NoError(t, err)
	require.NotNil(t, detected)
	require.True(t, looksLikeMP4(fixture[detected.VideoStart:]))
	require.EqualValues(t, 123456, detected.PresentationTimestampUs)

	// Exercise MP4 headers straddling both sides of the backwards scan boundary.
	for offset := -12; offset <= 12; offset++ {
		blob := make([]byte, 200_000)
		copy(blob, []byte("\xff\xd8 Camera:MotionPhoto=\"1\""))
		start := len(blob) - 64*1024 + offset
		copy(blob[start:], []byte{0, 0, 0, 16, 'f', 't', 'y', 'p', 'm', 'p', '4', '2'})
		detected, err := DetectJPEGReader(bytes.NewReader(blob), int64(len(blob)))
		require.NoError(t, err)
		require.NotNil(t, detected, "offset %d", offset)
		require.Equal(t, start, detected.VideoStart, "offset %d", offset)
	}

	// Prefer the explicit MicroVideoOffset even when a later ftyp box exists.
	blob := make([]byte, 1024)
	copy(blob, []byte("\xff\xd8 Camera:MotionPhoto=\"1\" Camera:MicroVideoOffset=\"128\""))
	copy(blob[896:], []byte{0, 0, 0, 16, 'f', 't', 'y', 'p', 'm', 'p', '4', '2'})
	copy(blob[1000:], []byte{0, 0, 0, 16, 'f', 't', 'y', 'p', 'm', 'p', '4', '2'})
	detected, err = DetectJPEGReader(bytes.NewReader(blob), int64(len(blob)))
	require.NoError(t, err)
	require.Equal(t, 896, detected.VideoStart)
}
