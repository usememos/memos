// Package imagelimit bounds the decoded size of untrusted images before a
// full decode allocates memory for them. A few kilobytes of compressed data
// can declare billions of pixels; reading only the header keeps the check
// cheap and lets callers refuse the image before paying for it.
package imagelimit

import (
	"image"
	"io"

	// Register the standard formats so DecodeConfig can read their headers.
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"

	"github.com/pkg/errors"
)

// MaxPixels is the largest decoded pixel count accepted for any image the
// server decodes itself: EXIF stripping on upload and thumbnail generation
// on read. 50 megapixels decodes to about 200 MiB of RGBA.
const MaxPixels = 50_000_000

// ErrTooLarge reports an image whose declared dimensions exceed MaxPixels.
var ErrTooLarge = errors.Errorf("image dimensions exceed maximum of %d pixels", MaxPixels)

// CheckReader reads the image header from r and reports whether the declared
// dimensions fit within MaxPixels. Formats that the image registry cannot
// size are allowed through so the full decoder decides; the caller must then
// be prepared for that decode to fail. The reader is consumed; rewind it
// before decoding.
func CheckReader(r io.Reader) error {
	config, _, err := image.DecodeConfig(r)
	if err != nil {
		return nil //nolint:nilerr // unknown formats defer to the full decoder
	}
	return CheckDimensions(config.Width, config.Height)
}

// CheckDimensions reports whether width×height fits within MaxPixels.
func CheckDimensions(width, height int) error {
	if width <= 0 || height <= 0 {
		return errors.New("invalid image dimensions")
	}
	if width > MaxPixels/height {
		return ErrTooLarge
	}
	return nil
}
