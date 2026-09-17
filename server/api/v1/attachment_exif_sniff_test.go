package v1

import (
	"bytes"
	"context"
	"encoding/binary"
	"image"
	"image/color"
	"image/jpeg"
	"testing"

	"github.com/stretchr/testify/require"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

const exifTestMarker = "MEMOS-GPS-MARKER-0123456789"

// jpegWithExifMarker returns a decodable JPEG whose APP1 segment carries a
// recognizable marker, standing in for privacy-sensitive EXIF metadata.
func jpegWithExifMarker(t *testing.T) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 16, 16))
	for y := range 16 {
		for x := range 16 {
			img.Set(x, y, color.RGBA{R: 200, G: 30, B: 30, A: 255})
		}
	}
	var encoded bytes.Buffer
	require.NoError(t, jpeg.Encode(&encoded, img, &jpeg.Options{Quality: 90}))
	raw := encoded.Bytes()
	require.Equal(t, []byte{0xFF, 0xD8}, raw[:2])

	payload := append([]byte("Exif\x00\x00"), []byte(exifTestMarker)...)
	var out bytes.Buffer
	out.Write(raw[:2])
	out.Write([]byte{0xFF, 0xE1})
	_ = binary.Write(&out, binary.BigEndian, uint16(len(payload)+2))
	out.Write(payload)
	out.Write(raw[2:])
	return out.Bytes()
}

func TestShouldStripExifContentSniffsMislabeledJPEG(t *testing.T) {
	t.Parallel()
	content := jpegWithExifMarker(t)

	for _, declared := range []string{"application/octet-stream", "image/png", "text/plain"} {
		strip, err := shouldStripExifContent(bytes.NewReader(content), declared)
		require.NoError(t, err)
		require.True(t, strip, "declared %s", declared)
	}
	strip, err := shouldStripExifContent(bytes.NewReader([]byte("plain text file")), "application/octet-stream")
	require.NoError(t, err)
	require.False(t, strip)
}

// A JPEG uploaded under a non-image declared type is still stripped of its
// metadata; the declared type alone must not decide the privacy policy.
func TestCreateAttachmentStripsExifFromMislabeledJPEG(t *testing.T) {
	svc := newIntegrationService(t)
	ctx := context.Background()
	user := createSpaceTestUser(ctx, t, svc, "exif-mislabel", store.RoleUser)
	content := jpegWithExifMarker(t)
	require.Contains(t, string(content), exifTestMarker)

	created, err := svc.CreateAttachment(userCtx(ctx, user.ID), &v1pb.CreateAttachmentRequest{Attachment: &v1pb.Attachment{
		Filename: "photo.bin", Type: "application/octet-stream", Content: content,
	}})
	require.NoError(t, err)

	uid := created.Name[len(AttachmentNamePrefix):]
	stored, err := svc.Store.GetAttachment(ctx, &store.FindAttachment{UID: &uid})
	require.NoError(t, err)
	blob, err := svc.GetAttachmentBlob(ctx, stored)
	require.NoError(t, err)
	require.NotContains(t, string(blob), exifTestMarker)
	_, err = jpeg.Decode(bytes.NewReader(blob))
	require.NoError(t, err)
}
