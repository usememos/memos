package common

import (
	"bytes"
	"fmt"
	"image"

	"image/jpeg"
	"image/png"
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

	bounds := oldImage.Bounds()
	if bounds.Dx() <= maxSize && bounds.Dy() <= maxSize {
		return data, nil
	}

	oldBounds := oldImage.Bounds()

	dy := maxSize
	r := float32(oldBounds.Dy()) / float32(maxSize)
	dx := int(float32(oldBounds.Dx()) / r)
	if oldBounds.Dx() > oldBounds.Dy() {
		dx = maxSize
		r = float32(oldBounds.Dx()) / float32(maxSize)
		dy = int(float32(oldBounds.Dy()) / r)
	}

	newBounds := image.Rect(0, 0, dx, dy)
	newImage := image.NewRGBA(newBounds)
	for x := 0; x < newBounds.Dx(); x++ {
		for y := 0; y < newBounds.Dy(); y++ {
			newImage.Set(x, y, oldImage.At(int(float32(x)*r), int(float32(y)*r)))
		}
	}

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
