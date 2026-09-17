package imagelimit

import (
	"bytes"
	"encoding/binary"
	"hash/crc32"
	"image"
	"image/color"
	"image/png"
	"testing"

	"github.com/stretchr/testify/require"
)

// oversizedPNG returns a syntactically valid PNG header that declares
// width×height pixels without carrying the pixel data for them.
func oversizedPNG(width, height uint32) []byte {
	var buf bytes.Buffer
	buf.Write([]byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'})
	ihdr := make([]byte, 13)
	binary.BigEndian.PutUint32(ihdr[0:4], width)
	binary.BigEndian.PutUint32(ihdr[4:8], height)
	ihdr[8] = 8 // bit depth
	ihdr[9] = 6 // RGBA
	chunk := append([]byte("IHDR"), ihdr...)
	binary.Write(&buf, binary.BigEndian, uint32(len(ihdr)))
	buf.Write(chunk)
	binary.Write(&buf, binary.BigEndian, crc32.ChecksumIEEE(chunk))
	return buf.Bytes()
}

func TestCheckReader(t *testing.T) {
	var small bytes.Buffer
	require.NoError(t, png.Encode(&small, image.NewRGBA(image.Rect(0, 0, 4, 4))))
	require.NoError(t, CheckReader(bytes.NewReader(small.Bytes())))

	err := CheckReader(bytes.NewReader(oversizedPNG(30_000, 30_000)))
	require.ErrorIs(t, err, ErrTooLarge)

	// A format the registry cannot size defers to the full decoder.
	require.NoError(t, CheckReader(bytes.NewReader([]byte("not an image"))))
}

func TestCheckDimensions(t *testing.T) {
	require.NoError(t, CheckDimensions(8000, 6000))
	require.ErrorIs(t, CheckDimensions(10_000, 10_000), ErrTooLarge)
	require.Error(t, CheckDimensions(0, 10))
	require.Error(t, CheckDimensions(10, -1))
	_ = color.Black
}
