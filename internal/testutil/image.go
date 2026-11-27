package testutil

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
)

func solidImage(width, height int) *image.RGBA {
	img := image.NewRGBA(image.Rect(0, 0, width, height))
	for y := range height {
		for x := range width {
			img.Set(x, y, color.RGBA{R: 80, G: 120, B: 160, A: 255})
		}
	}
	return img
}

// BuildPNG returns a solid-color width×height PNG blob for tests.
func BuildPNG(width, height int) []byte {
	var buffer bytes.Buffer
	if err := png.Encode(&buffer, solidImage(width, height)); err != nil {
		// Encoding an in-memory RGBA image cannot fail with valid dimensions.
		panic(err)
	}
	return buffer.Bytes()
}

// BuildJPEG returns a solid-color width×height JPEG blob for tests.
func BuildJPEG(width, height int) []byte {
	img := solidImage(width, height)
	var buffer bytes.Buffer
	if err := jpeg.Encode(&buffer, img, &jpeg.Options{Quality: 90}); err != nil {
		// Encoding an in-memory RGBA image cannot fail with valid dimensions.
		panic(err)
	}
	return buffer.Bytes()
}
