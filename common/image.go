package common

import (
	"bytes"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"

	"github.com/disintegration/imaging"
)

const ThumbnailPath = ".thumbnail_cache"

func ResizeImageBlob(data []byte, maxSize int, mime string) ([]byte, error) {
	var err error
	var oldImage image.Image

	switch mime {
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
