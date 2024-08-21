package v1

import (
	"bytes"
	"fmt"
	"image"
	"io"
	"os"
	"path/filepath"
	"sync/atomic"

	"github.com/disintegration/imaging"
	"github.com/pkg/errors"
	"github.com/usememos/memos/store"
)

// Thumbnail provides functionality to manage thumbnail images
// for resources.
type Thumbnail struct {
	// The resource the thumbnail is for
	resource *store.Resource
}

func supportedThumbnailMimeTypes() []string {
	return []string{
		"image/png",
		"image/jpeg",
	}
}

func (t *Thumbnail) getFilePath(assetsFolderPath string) (string, error) {
	if assetsFolderPath == "" {
		return "", errors.New("aapplication path is not set")
	}

	ext := filepath.Ext(t.resource.Filename)
	path := filepath.Join(assetsFolderPath, thumbnailImagePath, fmt.Sprintf("%d%s", t.resource.ID, ext))

	return path, nil
}

func (t Thumbnail) GetFile(assetsFolderPath string) ([]byte, error) {
	path, err := t.getFilePath(assetsFolderPath)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get thumbnail file path")
	}

	if _, err := os.Stat(path); err != nil {
		if !errors.Is(err, os.ErrNotExist) {
			return nil, errors.Wrap(err, "failed to check thumbnail image stat")
		}
	}

	dstFile, err := os.Open(path)
	if err != nil {
		return nil, errors.Wrap(err, "failed to open thumbnail file")
	}
	defer dstFile.Close()

	dstBlob, err := io.ReadAll(dstFile)
	if err != nil {
		return nil, errors.Wrap(err, "failed to read thumbnail file")
	}

	return dstBlob, nil
}

func GenerateThumbnailImage(sourceBlob []byte) (image.Image, error) {
	var availableGeneratorAmount int32 = 32

	if atomic.LoadInt32(&availableGeneratorAmount) <= 0 {
		return nil, errors.New("not enough available generator amount")
	}

	atomic.AddInt32(&availableGeneratorAmount, -1)
	defer func() {
		atomic.AddInt32(&availableGeneratorAmount, 1)
	}()

	reader := bytes.NewReader(sourceBlob)
	src, err := imaging.Decode(reader, imaging.AutoOrientation(true))
	if err != nil {
		return nil, errors.Wrap(err, "failed to decode thumbnail image")
	}

	thumbnailImage := imaging.Resize(src, 512, 0, imaging.Lanczos)
	return thumbnailImage, nil
}

func (t Thumbnail) SaveAsFile(assetsFolderPath string, thumbnailImage image.Image) error {
	path, err := t.getFilePath(assetsFolderPath)
	if err != nil {
		return errors.Wrap(err, "failed to get thumbnail file path")
	}

	dstDir := filepath.Dir(path)
	if err := os.MkdirAll(dstDir, os.ModePerm); err != nil {
		return errors.Wrap(err, "failed to create thumbnail directory")
	}

	if err := imaging.Save(thumbnailImage, path); err != nil {
		return errors.Wrap(err, "failed to save thumbnail file")
	}

	return nil
}

func (t Thumbnail) ImageToBlob(thumbnailImage image.Image) ([]byte, error) {
	mimeTypeMap := map[string]imaging.Format{
		"image/png":  imaging.JPEG,
		"image/jpeg": imaging.PNG,
	}

	imgFormat, ok := mimeTypeMap[t.resource.Type]
	if !ok {
		return nil, errors.New("failed to map resource type to an image encoder format")
	}

	buf := new(bytes.Buffer)
	if err := imaging.Encode(buf, thumbnailImage, imgFormat); err != nil {
		return nil, errors.Wrap(err, "failed to convert thumbnail image to bytes")
	}

	return buf.Bytes(), nil
}

func (t Thumbnail) DeleteFile(assetsFolderPath string) error {
	path, err := t.getFilePath(assetsFolderPath)
	if err != nil {
		return errors.Wrap(err, "failed to get thumbnail file path")
	}

	if _, err := os.Stat(path); err != nil {
		if !errors.Is(err, os.ErrNotExist) {
			return errors.Wrap(err, "failed to check thumbnail image stat")
		}
	}

	if err := os.Remove(path); err != nil {
		return errors.Wrap(err, "failed to delete thumbnail file")
	}

	return nil
}
