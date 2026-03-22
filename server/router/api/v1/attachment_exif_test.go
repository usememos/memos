package v1

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"testing"

	"github.com/disintegration/imaging"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestShouldStripExif(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		mimeType string
		expected bool
	}{
		{
			name:     "JPEG should strip EXIF",
			mimeType: "image/jpeg",
			expected: true,
		},
		{
			name:     "JPG should strip EXIF",
			mimeType: "image/jpg",
			expected: true,
		},
		{
			name:     "TIFF should strip EXIF",
			mimeType: "image/tiff",
			expected: true,
		},
		{
			name:     "WebP should strip EXIF",
			mimeType: "image/webp",
			expected: true,
		},
		{
			name:     "HEIC should strip EXIF",
			mimeType: "image/heic",
			expected: true,
		},
		{
			name:     "HEIF should strip EXIF",
			mimeType: "image/heif",
			expected: true,
		},
		{
			name:     "PNG should not strip EXIF",
			mimeType: "image/png",
			expected: false,
		},
		{
			name:     "GIF should not strip EXIF",
			mimeType: "image/gif",
			expected: false,
		},
		{
			name:     "text file should not strip EXIF",
			mimeType: "text/plain",
			expected: false,
		},
		{
			name:     "PDF should not strip EXIF",
			mimeType: "application/pdf",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			result := shouldStripExif(tt.mimeType)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestStripImageExif(t *testing.T) {
	t.Parallel()

	// Create a simple test image
	img := image.NewRGBA(image.Rect(0, 0, 100, 100))
	// Fill with red color
	for y := 0; y < 100; y++ {
		for x := 0; x < 100; x++ {
			img.Set(x, y, color.RGBA{R: 255, G: 0, B: 0, A: 255})
		}
	}

	// Encode as JPEG
	var buf bytes.Buffer
	err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 90})
	require.NoError(t, err)
	originalData := buf.Bytes()

	t.Run("strip JPEG metadata", func(t *testing.T) {
		t.Parallel()

		strippedData, err := stripImageExif(originalData, "image/jpeg")
		require.NoError(t, err)
		assert.NotEmpty(t, strippedData)

		// Verify it's still a valid image
		decodedImg, err := imaging.Decode(bytes.NewReader(strippedData))
		require.NoError(t, err)
		assert.Equal(t, 100, decodedImg.Bounds().Dx())
		assert.Equal(t, 100, decodedImg.Bounds().Dy())
	})

	t.Run("strip JPG metadata (alternate extension)", func(t *testing.T) {
		t.Parallel()

		strippedData, err := stripImageExif(originalData, "image/jpg")
		require.NoError(t, err)
		assert.NotEmpty(t, strippedData)

		// Verify it's still a valid image
		decodedImg, err := imaging.Decode(bytes.NewReader(strippedData))
		require.NoError(t, err)
		assert.NotNil(t, decodedImg)
	})

	t.Run("strip PNG metadata", func(t *testing.T) {
		t.Parallel()

		// Encode as PNG first
		var pngBuf bytes.Buffer
		err := imaging.Encode(&pngBuf, img, imaging.PNG)
		require.NoError(t, err)

		strippedData, err := stripImageExif(pngBuf.Bytes(), "image/png")
		require.NoError(t, err)
		assert.NotEmpty(t, strippedData)

		// Verify it's still a valid image
		decodedImg, err := imaging.Decode(bytes.NewReader(strippedData))
		require.NoError(t, err)
		assert.Equal(t, 100, decodedImg.Bounds().Dx())
		assert.Equal(t, 100, decodedImg.Bounds().Dy())
	})

	t.Run("handle WebP format by converting to JPEG", func(t *testing.T) {
		t.Parallel()

		// WebP format will be converted to JPEG
		strippedData, err := stripImageExif(originalData, "image/webp")
		require.NoError(t, err)
		assert.NotEmpty(t, strippedData)

		// Verify it's a valid image
		decodedImg, err := imaging.Decode(bytes.NewReader(strippedData))
		require.NoError(t, err)
		assert.NotNil(t, decodedImg)
	})

	t.Run("handle HEIC format by converting to JPEG", func(t *testing.T) {
		t.Parallel()

		strippedData, err := stripImageExif(originalData, "image/heic")
		require.NoError(t, err)
		assert.NotEmpty(t, strippedData)

		// Verify it's a valid image
		decodedImg, err := imaging.Decode(bytes.NewReader(strippedData))
		require.NoError(t, err)
		assert.NotNil(t, decodedImg)
	})

	t.Run("return error for invalid image data", func(t *testing.T) {
		t.Parallel()

		invalidData := []byte("not an image")
		_, err := stripImageExif(invalidData, "image/jpeg")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "failed to decode image")
	})

	t.Run("return error for empty image data", func(t *testing.T) {
		t.Parallel()

		emptyData := []byte{}
		_, err := stripImageExif(emptyData, "image/jpeg")
		assert.Error(t, err)
	})
}
