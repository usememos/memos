package testutil

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
)

// BuildJPEG returns a solid-color width×height JPEG blob for tests.
func BuildJPEG(width, height int) []byte {
	img := image.NewRGBA(image.Rect(0, 0, width, height))
	for y := range height {
		for x := range width {
			img.Set(x, y, color.RGBA{R: 80, G: 120, B: 160, A: 255})
		}
	}
	var buffer bytes.Buffer
	if err := jpeg.Encode(&buffer, img, &jpeg.Options{Quality: 90}); err != nil {
		// Encoding an in-memory RGBA image cannot fail with valid dimensions.
		panic(err)
	}
	return buffer.Bytes()
}
