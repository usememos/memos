package v1

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestExtractImageInfo(t *testing.T) {
	imageType, base64Data, err := extractImageInfo("data:image/png;base64,iVBORw0KGgo=")
	require.NoError(t, err)
	require.Equal(t, "image/png", imageType)
	require.Equal(t, "iVBORw0KGgo=", base64Data)

	for _, dataURI := range []string{
		// Missing data-URI prefix.
		"image/png;base64,iVBORw0KGgo=",
		// Missing ;base64, marker.
		"data:image/png,iVBORw0KGgo=",
		// Empty MIME type.
		"data:;base64,iVBORw0KGgo=",
		// Empty payload.
		"data:image/png;base64,",
	} {
		_, _, err := extractImageInfo(dataURI)
		require.Error(t, err, "dataURI %q must be rejected", dataURI)
	}
}
