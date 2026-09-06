package v1

import (
	"bytes"
	"encoding/binary"
	"hash/crc32"
	"image"
	"image/png"
	"testing"

	"github.com/stretchr/testify/require"
)

func coverPNGWithChunk(t *testing.T, kind string, data []byte) []byte {
	t.Helper()
	var encoded bytes.Buffer
	require.NoError(t, png.Encode(&encoded, image.NewNRGBA(image.Rect(0, 0, 1, 1))))
	chunk := make([]byte, 12+len(data))
	binary.BigEndian.PutUint32(chunk, uint32(len(data)))
	copy(chunk[4:8], kind)
	copy(chunk[8:], data)
	binary.BigEndian.PutUint32(chunk[8+len(data):], crc32.ChecksumIEEE(chunk[4:8+len(data)]))
	result := append([]byte{}, encoded.Bytes()[:33]...)
	result = append(result, chunk...)
	return append(result, encoded.Bytes()[33:]...)
}

func TestCoverValidationDistinguishesAnimationChunksFromText(t *testing.T) {
	// Given a valid static image whose metadata contains the animation marker.
	static := coverPNGWithChunk(t, "tEXt", []byte("note\x00acTL"))
	// When validating the complete image.
	w, h, err := validateLinkCover(static)
	// Then ordinary text is not treated as an animation control chunk.
	require.NoError(t, err)
	require.Equal(t, int32(1), w)
	require.Equal(t, int32(1), h)
	_, _, err = validateLinkCover(coverPNGWithChunk(t, "acTL", make([]byte, 8)))
	require.Error(t, err)
}

func TestCoverValidationBoundsDeclaredPixelDimensions(t *testing.T) {
	for _, dimensions := range [][2]uint32{{4097, 1}, {3000, 3000}} {
		blob := coverPNGWithChunk(t, "tEXt", []byte("note\x00static"))
		binary.BigEndian.PutUint32(blob[16:20], dimensions[0])
		binary.BigEndian.PutUint32(blob[20:24], dimensions[1])
		binary.BigEndian.PutUint32(blob[29:33], crc32.ChecksumIEEE(blob[12:29]))
		_, _, err := validateLinkCover(blob)
		require.EqualError(t, err, "cover exceeds dimension limit")
	}
}
