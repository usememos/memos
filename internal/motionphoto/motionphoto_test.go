package motionphoto

import (
	"bytes"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/internal/testutil"
)

func TestDetectJPEG(t *testing.T) {
	t.Parallel()

	blob := testutil.BuildMotionPhotoJPEG()
	detection := DetectJPEG(blob)
	require.NotNil(t, detection)
	require.Positive(t, detection.VideoStart)
	require.EqualValues(t, 123456, detection.PresentationTimestampUs)

	videoBlob, extracted := ExtractVideo(blob)
	require.NotNil(t, extracted)
	require.True(t, bytes.Equal(videoBlob[:4], []byte{0x00, 0x00, 0x00, 0x10}))
	require.Equal(t, []byte("ftyp"), videoBlob[4:8])
}
