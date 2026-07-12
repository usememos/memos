package v1

import (
	"bytes"
	"context"
	"image"

	"github.com/disintegration/imaging"
	"github.com/pkg/errors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/usememos/memos/internal/motionphoto"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
)

func validateClientMotionMedia(motion *v1pb.MotionMedia, attachmentUID string) (*storepb.MotionMedia, error) {
	if motion == nil {
		return nil, nil
	}

	if motion.Family != v1pb.MotionMediaFamily_APPLE_LIVE_PHOTO {
		return nil, status.Errorf(codes.InvalidArgument, "only Apple Live Photo motion metadata can be provided by clients")
	}
	if motion.Role != v1pb.MotionMediaRole_STILL && motion.Role != v1pb.MotionMediaRole_VIDEO {
		return nil, status.Errorf(codes.InvalidArgument, "invalid Apple Live Photo motion role")
	}

	storeMotion := convertMotionMediaToStore(motion)
	if storeMotion.GroupId == "" {
		return nil, status.Errorf(codes.InvalidArgument, "motion media group_id is required")
	}
	if storeMotion.Family == storepb.MotionMediaFamily_ANDROID_MOTION_PHOTO && storeMotion.GroupId == "" {
		storeMotion.GroupId = attachmentUID
	}

	return storeMotion, nil
}

func detectAndroidMotionMedia(blob []byte, mimeType, attachmentUID string) *storepb.MotionMedia {
	if mimeType != "image/jpeg" && mimeType != "image/jpg" {
		return nil
	}

	detection := motionphoto.DetectJPEG(blob)
	if detection == nil {
		return nil
	}

	return &storepb.MotionMedia{
		Family:                  storepb.MotionMediaFamily_ANDROID_MOTION_PHOTO,
		Role:                    storepb.MotionMediaRole_CONTAINER,
		GroupId:                 attachmentUID,
		PresentationTimestampUs: detection.PresentationTimestampUs,
		HasEmbeddedVideo:        true,
	}
}

// shouldStripExif checks if the MIME type is an image format that may contain EXIF metadata.
// Returns true for formats like JPEG, TIFF, WebP, HEIC, and HEIF which commonly contain
// privacy-sensitive metadata such as GPS coordinates, camera settings, and device information.
func shouldStripExif(mimeType string) bool {
	return exifCapableImageTypes[mimeType]
}

func (s *APIV1Service) acquireImageProcessingSlot(ctx context.Context) (func(), error) {
	if s.imageProcessingSemaphore == nil {
		return func() {}, nil
	}
	if err := s.imageProcessingSemaphore.Acquire(ctx, 1); err != nil {
		return nil, err
	}
	return func() {
		s.imageProcessingSemaphore.Release(1)
	}, nil
}

func validateImagePixelCount(imageData []byte) error {
	config, _, err := image.DecodeConfig(bytes.NewReader(imageData))
	if err != nil {
		// Some formats supported by imaging do not expose dimensions through
		// the standard image registry. Let the full decoder handle those.
		return nil //nolint:nilerr
	}
	if config.Width <= 0 || config.Height <= 0 {
		return errors.New("invalid image dimensions")
	}
	if config.Width > maxImagePixels/config.Height {
		return errors.Errorf("image dimensions exceed maximum of %d pixels", maxImagePixels)
	}
	return nil
}

// stripImageExif removes EXIF metadata from image files by decoding and re-encoding them.
// This prevents exposure of sensitive metadata such as GPS location, camera details, and timestamps.
//
// The function preserves the correct image orientation by applying EXIF orientation tags
// during decoding before stripping all metadata. Images are re-encoded with high quality
// to minimize visual degradation.
//
// Supported formats:
//   - JPEG/JPG: Re-encoded as JPEG with quality 95
//   - PNG: Re-encoded as PNG (lossless)
//   - TIFF/WebP/HEIC/HEIF: Re-encoded as JPEG with quality 95
//
// Returns the cleaned image data without any EXIF metadata, or an error if processing fails.
func stripImageExif(imageData []byte, mimeType string) ([]byte, error) {
	if err := validateImagePixelCount(imageData); err != nil {
		return nil, err
	}

	// Decode image with automatic EXIF orientation correction.
	// This ensures the image displays correctly after metadata removal.
	img, err := imaging.Decode(bytes.NewReader(imageData), imaging.AutoOrientation(true))
	if err != nil {
		return nil, errors.Wrap(err, "failed to decode image")
	}

	// Re-encode the image without EXIF metadata.
	var buf bytes.Buffer
	var encodeErr error

	if mimeType == "image/png" {
		// Preserve PNG format for lossless encoding
		encodeErr = imaging.Encode(&buf, img, imaging.PNG)
	} else {
		// For JPEG, TIFF, WebP, HEIC, HEIF - re-encode as JPEG.
		// This ensures EXIF is stripped and provides good compression.
		encodeErr = imaging.Encode(&buf, img, imaging.JPEG, imaging.JPEGQuality(defaultJPEGQuality))
	}

	if encodeErr != nil {
		return nil, errors.Wrap(encodeErr, "failed to encode image")
	}

	return buf.Bytes(), nil
}
