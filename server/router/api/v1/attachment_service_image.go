package v1

import (
	"bytes"
	"context"
	"image"
	"io"

	"github.com/disintegration/imaging"
	"github.com/pkg/errors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

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

func validateImageReaderPixelCount(reader io.Reader) error {
	config, _, err := image.DecodeConfig(reader)
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
// to minimize visual degradation. The re-encoded output is returned in memory; its size
// is bounded by maxImagePixels, which the decoder already has to hold.
//
// Supported formats:
//   - JPEG/JPG: Re-encoded as JPEG with quality 95
//   - PNG: Re-encoded as PNG (lossless)
//   - TIFF/WebP/HEIC/HEIF: Re-encoded as JPEG with quality 95
//
// Returns the cleaned image data without any EXIF metadata, or an error if processing fails.
func stripImageExif(source io.ReadSeeker, mimeType string) ([]byte, error) {
	if _, err := source.Seek(0, io.SeekStart); err != nil {
		return nil, errors.Wrap(err, "failed to rewind image")
	}
	if err := validateImageReaderPixelCount(source); err != nil {
		return nil, err
	}
	if _, err := source.Seek(0, io.SeekStart); err != nil {
		return nil, errors.Wrap(err, "failed to rewind image")
	}
	img, err := imaging.Decode(source, imaging.AutoOrientation(true))
	if err != nil {
		return nil, errors.Wrap(err, "failed to decode image")
	}
	var buf bytes.Buffer
	if mimeType == "image/png" {
		err = imaging.Encode(&buf, img, imaging.PNG)
	} else {
		err = imaging.Encode(&buf, img, imaging.JPEG, imaging.JPEGQuality(defaultJPEGQuality))
	}
	if err != nil {
		return nil, errors.Wrap(err, "failed to encode image")
	}
	return buf.Bytes(), nil
}
