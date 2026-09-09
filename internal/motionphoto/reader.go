package motionphoto

import (
	"bytes"
	"io"
	"strconv"
)

// DetectJPEGReader detects embedded video without loading the JPEG into memory.
// It reads at most the metadata header plus the blocks needed to locate the video.
func DetectJPEGReader(reader io.ReaderAt, size int64) (*Detection, error) {
	if size < 16 {
		return nil, nil
	}
	header := make([]byte, min(size, maxMetadataScanBytes))
	if _, err := reader.ReadAt(header, 0); err != nil {
		return nil, err
	}
	if !bytes.HasPrefix(header, []byte{0xFF, 0xD8}) || !motionPhotoMarkerRegex.Match(header) {
		return nil, nil
	}
	text := string(header)
	makeDetection := func(start int64) *Detection {
		return &Detection{VideoStart: int(start), PresentationTimestampUs: parsePresentationTimestampUs(text)}
	}
	if matches := microVideoOffsetRegex.FindStringSubmatch(text); len(matches) == 2 {
		if offset, err := strconv.ParseInt(matches[1], 10, 64); err == nil && offset >= 12 && offset < size {
			var probe [12]byte
			if _, err := reader.ReadAt(probe[:], size-offset); err != nil {
				return nil, err
			}
			if looksLikeMP4(probe[:]) {
				return makeDetection(size - offset), nil
			}
		}
	}

	// Fall back to the last valid ftyp box, scanning backwards with overlap so
	// a box header crossing a block boundary is still found.
	buffer := make([]byte, 64*1024)
	for end := size; end >= 12; {
		start := max(int64(0), end-int64(len(buffer)))
		block := buffer[:end-start]
		if _, err := reader.ReadAt(block, start); err != nil {
			return nil, err
		}
		if index := findEmbeddedMP4Start(block); index >= 0 {
			return makeDetection(start + int64(index)), nil
		}
		if start == 0 {
			break
		}
		end = start + 11
	}
	return nil, nil
}
