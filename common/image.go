package common

import (
	"bytes"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"os"
	"path/filepath"
	"strings"

	"github.com/disintegration/imaging"
)

const (
	ThumbnailDir  = ".thumbnail_cache"
	ThumbnailSize = 302 // Thumbnail size should be defined by frontend
)

func ResizeImageFile(dst, src string, mime string) error {
	srcBytes, err := os.ReadFile(src)
	if err != nil {
		return fmt.Errorf("Failed to open %s: %s", src, err)
	}

	dstBytes, err := ResizeImageBlob(srcBytes, ThumbnailSize, mime)
	if err != nil {
		return fmt.Errorf("Failed to resise %s: %s", src, err)
	}

	err = os.MkdirAll(filepath.Dir(dst), os.ModePerm)
	if err != nil {
		return fmt.Errorf("Failed to mkdir for %s: %s", dst, err)
	}

	err = os.WriteFile(dst, dstBytes, 0666)
	if err != nil {
		return fmt.Errorf("Failed to write %s: %s", dst, err)
	}

	return nil
}

func ResizeImageBlob(data []byte, maxSize int, mime string) ([]byte, error) {
	var err error
	var oldImage image.Image

	switch strings.ToLower(mime) {
	case "image/jpeg":
		oldImage, err = jpeg.Decode(bytes.NewReader(data))
	case "image/png":
		oldImage, err = png.Decode(bytes.NewReader(data))
	default:
		return nil, fmt.Errorf("mime %s is not support", mime)
	}

	if err != nil {
		return nil, err
	}

	newImage := imaging.Resize(oldImage, maxSize, 0, imaging.NearestNeighbor)

	var newBuffer bytes.Buffer
	switch mime {
	case "image/jpeg":
		err = jpeg.Encode(&newBuffer, newImage, nil)
	case "image/png":
		err = png.Encode(&newBuffer, newImage)
	}
	if err != nil {
		return nil, err
	}

	return newBuffer.Bytes(), nil
}
