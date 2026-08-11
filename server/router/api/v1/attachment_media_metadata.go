package v1

import (
	"math"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/pkg/errors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
)

const maxMediaMetadataStringBytes = 256

var (
	mediaLocalDateTimePattern = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?$`)
	mediaUTCOffsetPattern     = regexp.MustCompile(`^[+-](\d{2}):(\d{2})$`)
)

func validateClientMediaMetadata(metadata *v1pb.MediaMetadata, mimeType string) (*storepb.MediaMetadata, error) {
	if metadata == nil {
		return nil, nil
	}

	normalizedMIMEType := strings.ToLower(mimeType)
	isImage := strings.HasPrefix(normalizedMIMEType, "image/")
	isVideo := strings.HasPrefix(normalizedMIMEType, "video/")
	if !isImage && !isVideo {
		return nil, status.Errorf(codes.InvalidArgument, "media_metadata is only supported for image and video attachments")
	}

	if (metadata.Width == nil) != (metadata.Height == nil) {
		return nil, status.Errorf(codes.InvalidArgument, "media_metadata width and height must be provided together")
	}
	if metadata.Width != nil && (*metadata.Width <= 0 || *metadata.Height <= 0) {
		return nil, status.Errorf(codes.InvalidArgument, "media_metadata width and height must be positive")
	}

	switch details := metadata.Details.(type) {
	case nil:
		if metadata.Width == nil {
			return nil, status.Errorf(codes.InvalidArgument, "media_metadata must contain at least one value")
		}
	case *v1pb.MediaMetadata_Photo:
		if !isImage {
			return nil, status.Errorf(codes.InvalidArgument, "photo metadata requires an image MIME type")
		}
		if proto.Size(details.Photo) == 0 {
			return nil, status.Errorf(codes.InvalidArgument, "photo metadata must contain at least one value")
		}
		if err := validatePhotoMetadata(details.Photo); err != nil {
			return nil, err
		}
	case *v1pb.MediaMetadata_Video:
		if !isVideo {
			return nil, status.Errorf(codes.InvalidArgument, "video metadata requires a video MIME type")
		}
		if details.Video == nil || details.Video.DurationSeconds == nil {
			return nil, status.Errorf(codes.InvalidArgument, "video metadata must contain at least one value")
		}
		if !isFinite(*details.Video.DurationSeconds) || *details.Video.DurationSeconds < 0 {
			return nil, status.Errorf(codes.InvalidArgument, "video duration_seconds must be a finite non-negative number")
		}
	default:
		return nil, status.Errorf(codes.InvalidArgument, "unsupported media_metadata details")
	}

	storeMetadata := &storepb.MediaMetadata{}
	if err := transcodeProto(metadata, storeMetadata); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to convert media_metadata: %v", err)
	}
	return storeMetadata, nil
}

func validatePhotoMetadata(photo *v1pb.PhotoMetadata) error {
	if photo.SourceExifOrientation != nil && (*photo.SourceExifOrientation < 1 || *photo.SourceExifOrientation > 8) {
		return status.Errorf(codes.InvalidArgument, "photo source_exif_orientation must be between 1 and 8")
	}
	for _, field := range []struct {
		name  string
		value string
	}{
		{"camera_make", photo.CameraMake},
		{"camera_model", photo.CameraModel},
		{"lens_model", photo.LensModel},
	} {
		if field.value == "" {
			continue
		}
		if len(field.value) > maxMediaMetadataStringBytes {
			return status.Errorf(codes.InvalidArgument, "photo %s exceeds %d bytes", field.name, maxMediaMetadataStringBytes)
		}
		if strings.TrimSpace(field.value) == "" {
			return status.Errorf(codes.InvalidArgument, "photo %s must not be blank", field.name)
		}
		if strings.ContainsFunc(field.value, unicode.IsControl) {
			return status.Errorf(codes.InvalidArgument, "photo %s must not contain control characters", field.name)
		}
	}
	for _, field := range []struct {
		name  string
		value *float64
	}{
		{"f_number", photo.FNumber},
		{"exposure_time_seconds", photo.ExposureTimeSeconds},
		{"focal_length_mm", photo.FocalLengthMm},
	} {
		if field.value != nil && (!isFinite(*field.value) || *field.value <= 0) {
			return status.Errorf(codes.InvalidArgument, "photo %s must be a finite positive number", field.name)
		}
	}
	if photo.Iso != nil && *photo.Iso <= 0 {
		return status.Errorf(codes.InvalidArgument, "photo iso must be positive")
	}
	if err := validateMediaCaptureTime(photo.CaptureTime); err != nil {
		return err
	}
	return validateMediaLocation(photo.Location)
}

func validateMediaCaptureTime(captureTime *v1pb.MediaCaptureTime) error {
	if captureTime == nil {
		return nil
	}
	if !mediaLocalDateTimePattern.MatchString(captureTime.LocalDateTime) {
		return status.Errorf(codes.InvalidArgument, "capture_time local_date_time has an invalid format")
	}
	parsed, err := time.Parse("2006-01-02T15:04:05", captureTime.LocalDateTime)
	if err != nil || parsed.Year() == 0 {
		return status.Errorf(codes.InvalidArgument, "capture_time local_date_time is invalid")
	}
	if captureTime.UtcOffset == nil {
		return nil
	}
	if *captureTime.UtcOffset == "Z" {
		return nil
	}
	match := mediaUTCOffsetPattern.FindStringSubmatch(*captureTime.UtcOffset)
	if match == nil {
		return status.Errorf(codes.InvalidArgument, "capture_time utc_offset has an invalid format")
	}
	hours, _ := strconv.Atoi(match[1])
	minutes, _ := strconv.Atoi(match[2])
	if hours > 14 || minutes > 59 || (hours == 14 && minutes != 0) {
		return status.Errorf(codes.InvalidArgument, "capture_time utc_offset is outside the supported range")
	}
	return nil
}

func validateMediaLocation(location *v1pb.MediaLocation) error {
	if location == nil {
		return nil
	}
	if location.Latitude == nil || location.Longitude == nil {
		return status.Errorf(codes.InvalidArgument, "location latitude and longitude must be provided together")
	}
	if !isFinite(*location.Latitude) || *location.Latitude < -90 || *location.Latitude > 90 {
		return status.Errorf(codes.InvalidArgument, "location latitude must be between -90 and 90")
	}
	if !isFinite(*location.Longitude) || *location.Longitude < -180 || *location.Longitude > 180 {
		return status.Errorf(codes.InvalidArgument, "location longitude must be between -180 and 180")
	}
	if location.AltitudeMeters != nil && !isFinite(*location.AltitudeMeters) {
		return status.Errorf(codes.InvalidArgument, "location altitude_meters must be finite")
	}
	return nil
}

func isFinite(value float64) bool {
	return !math.IsNaN(value) && !math.IsInf(value, 0)
}

// transcodeProto copies src into dst through the wire format. The API and
// store MediaMetadata message trees are declared field-for-field identical, so
// the round-trip is the entire conversion; unknown fields (e.g. from a newer
// client) are dropped rather than stored.
func transcodeProto(src, dst proto.Message) error {
	data, err := proto.Marshal(src)
	if err != nil {
		return errors.Wrap(err, "failed to marshal source protobuf")
	}
	if err := (proto.UnmarshalOptions{DiscardUnknown: true}).Unmarshal(data, dst); err != nil {
		return errors.Wrap(err, "failed to unmarshal destination protobuf")
	}
	return nil
}

func convertMediaMetadataFromStore(metadata *storepb.MediaMetadata) *v1pb.MediaMetadata {
	if metadata == nil {
		return nil
	}
	apiMetadata := &v1pb.MediaMetadata{}
	if err := transcodeProto(metadata, apiMetadata); err != nil {
		return nil
	}
	return apiMetadata
}
