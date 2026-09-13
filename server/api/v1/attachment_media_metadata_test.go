package v1

import (
	"math"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
)

func TestValidateClientMediaMetadata(t *testing.T) {
	t.Parallel()

	validPhoto := func() *v1pb.MediaMetadata {
		return &v1pb.MediaMetadata{
			Width:  proto.Int32(4032),
			Height: proto.Int32(3024),
			Details: &v1pb.MediaMetadata_Photo{Photo: &v1pb.PhotoMetadata{
				CaptureTime: &v1pb.MediaCaptureTime{
					LocalDateTime: "2026-08-10T14:32:18.123",
					UtcOffset:     proto.String("+08:00"),
				},
				Location: &v1pb.MediaLocation{
					Latitude:       proto.Float64(1.3521),
					Longitude:      proto.Float64(103.8198),
					AltitudeMeters: proto.Float64(18.4),
				},
				SourceExifOrientation: proto.Int32(6),
				CameraMake:            "Apple",
				CameraModel:           "iPhone",
				LensModel:             "Main Camera",
				FNumber:               proto.Float64(1.78),
				ExposureTimeSeconds:   proto.Float64(1.0 / 120.0),
				Iso:                   proto.Int32(64),
				FocalLengthMm:         proto.Float64(6.86),
			}},
		}
	}

	t.Run("accepts photo metadata", func(t *testing.T) {
		metadata, err := validateClientMediaMetadata(validPhoto(), "image/jpeg")
		require.NoError(t, err)
		require.Equal(t, int32(4032), metadata.GetWidth())
		require.Equal(t, "Apple", metadata.GetPhoto().GetCameraMake())
	})

	t.Run("accepts dimensions without details", func(t *testing.T) {
		metadata, err := validateClientMediaMetadata(&v1pb.MediaMetadata{
			Width: proto.Int32(1920), Height: proto.Int32(1080),
		}, "video/mp4")
		require.NoError(t, err)
		require.Equal(t, int32(1920), metadata.GetWidth())
	})

	t.Run("accepts video metadata", func(t *testing.T) {
		metadata, err := validateClientMediaMetadata(&v1pb.MediaMetadata{
			Details: &v1pb.MediaMetadata_Video{Video: &v1pb.VideoMetadata{DurationSeconds: proto.Float64(12.5)}},
		}, "video/mp4")
		require.NoError(t, err)
		require.Equal(t, 12.5, metadata.GetVideo().GetDurationSeconds())
	})

	t.Run("accepts uppercase MIME type", func(t *testing.T) {
		metadata, err := validateClientMediaMetadata(validPhoto(), "IMAGE/JPEG")
		require.NoError(t, err)
		require.Equal(t, "Apple", metadata.GetPhoto().GetCameraMake())
	})

	t.Run("accepts Z UTC offset", func(t *testing.T) {
		metadata, err := validateClientMediaMetadata(photoOnly(&v1pb.PhotoMetadata{
			CaptureTime: &v1pb.MediaCaptureTime{LocalDateTime: "2026-08-10T14:32:18", UtcOffset: proto.String("Z")},
		}), "image/jpeg")
		require.NoError(t, err)
		require.Equal(t, "Z", metadata.GetPhoto().GetCaptureTime().GetUtcOffset())
	})

	tests := []struct {
		name     string
		mimeType string
		metadata *v1pb.MediaMetadata
	}{
		{name: "empty", mimeType: "image/jpeg", metadata: &v1pb.MediaMetadata{}},
		{name: "non-media MIME", mimeType: "application/pdf", metadata: validPhoto()},
		{name: "width without height", mimeType: "image/jpeg", metadata: &v1pb.MediaMetadata{Width: proto.Int32(100)}},
		{name: "non-positive dimension", mimeType: "image/jpeg", metadata: &v1pb.MediaMetadata{Width: proto.Int32(0), Height: proto.Int32(100)}},
		{name: "photo on video", mimeType: "video/mp4", metadata: validPhoto()},
		{name: "empty photo", mimeType: "image/jpeg", metadata: &v1pb.MediaMetadata{Details: &v1pb.MediaMetadata_Photo{Photo: &v1pb.PhotoMetadata{}}}},
		{name: "video on image", mimeType: "image/jpeg", metadata: &v1pb.MediaMetadata{Details: &v1pb.MediaMetadata_Video{Video: &v1pb.VideoMetadata{DurationSeconds: proto.Float64(1)}}}},
		{name: "empty video", mimeType: "video/mp4", metadata: &v1pb.MediaMetadata{Details: &v1pb.MediaMetadata_Video{Video: &v1pb.VideoMetadata{}}}},
		{name: "invalid source EXIF orientation", mimeType: "image/jpeg", metadata: photoOnly(&v1pb.PhotoMetadata{SourceExifOrientation: proto.Int32(9)})},
		{name: "blank camera make", mimeType: "image/jpeg", metadata: photoOnly(&v1pb.PhotoMetadata{CameraMake: "   "})},
		{name: "control character in camera make", mimeType: "image/jpeg", metadata: photoOnly(&v1pb.PhotoMetadata{CameraMake: "Apple\nCo"})},
		{name: "null byte in lens model", mimeType: "image/jpeg", metadata: photoOnly(&v1pb.PhotoMetadata{LensModel: "Main\x00Camera"})},
		{name: "long camera model", mimeType: "image/jpeg", metadata: photoOnly(&v1pb.PhotoMetadata{CameraModel: strings.Repeat("x", maxMediaMetadataStringBytes+1)})},
		{name: "non-finite aperture", mimeType: "image/jpeg", metadata: photoOnly(&v1pb.PhotoMetadata{FNumber: proto.Float64(math.NaN())})},
		{name: "zero exposure", mimeType: "image/jpeg", metadata: photoOnly(&v1pb.PhotoMetadata{ExposureTimeSeconds: proto.Float64(0)})},
		{name: "zero ISO", mimeType: "image/jpeg", metadata: photoOnly(&v1pb.PhotoMetadata{Iso: proto.Int32(0)})},
		{name: "invalid capture format", mimeType: "image/jpeg", metadata: photoOnly(&v1pb.PhotoMetadata{CaptureTime: &v1pb.MediaCaptureTime{LocalDateTime: "2026:08:10 14:32:18"}})},
		{name: "invalid calendar date", mimeType: "image/jpeg", metadata: photoOnly(&v1pb.PhotoMetadata{CaptureTime: &v1pb.MediaCaptureTime{LocalDateTime: "2026-02-30T14:32:18"}})},
		{name: "invalid offset", mimeType: "image/jpeg", metadata: photoOnly(&v1pb.PhotoMetadata{CaptureTime: &v1pb.MediaCaptureTime{LocalDateTime: "2026-08-10T14:32:18", UtcOffset: proto.String("+14:30")}})},
		{name: "missing longitude", mimeType: "image/jpeg", metadata: photoOnly(&v1pb.PhotoMetadata{Location: &v1pb.MediaLocation{Latitude: proto.Float64(1)}})},
		{name: "latitude out of range", mimeType: "image/jpeg", metadata: photoOnly(&v1pb.PhotoMetadata{Location: &v1pb.MediaLocation{Latitude: proto.Float64(91), Longitude: proto.Float64(1)}})},
		{name: "non-finite altitude", mimeType: "image/jpeg", metadata: photoOnly(&v1pb.PhotoMetadata{Location: &v1pb.MediaLocation{Latitude: proto.Float64(1), Longitude: proto.Float64(1), AltitudeMeters: proto.Float64(math.Inf(1))}})},
		{name: "negative duration", mimeType: "video/mp4", metadata: &v1pb.MediaMetadata{Details: &v1pb.MediaMetadata_Video{Video: &v1pb.VideoMetadata{DurationSeconds: proto.Float64(-1)}}}},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			_, err := validateClientMediaMetadata(test.metadata, test.mimeType)
			require.Error(t, err)
			require.Equal(t, codes.InvalidArgument, status.Code(err))
		})
	}
}

func photoOnly(photo *v1pb.PhotoMetadata) *v1pb.MediaMetadata {
	return &v1pb.MediaMetadata{Details: &v1pb.MediaMetadata_Photo{Photo: photo}}
}
