package motionphoto

import (
	"bytes"
	"encoding/binary"
	"regexp"
	"strconv"
)

type Detection struct {
	VideoStart              int
	PresentationTimestampUs int64
}

var (
	motionPhotoMarkerRegex = regexp.MustCompile(`(?i)(?:Camera:MotionPhoto|GCamera:MotionPhoto|MicroVideo)["'=:\s>]+1`)
	presentationRegex      = regexp.MustCompile(`(?i)(?:Camera:MotionPhotoPresentationTimestampUs|GCamera:MotionPhotoPresentationTimestampUs)["'=:\s>]+(-?\d+)`)
	microVideoOffsetRegex  = regexp.MustCompile(`(?i)(?:Camera:MicroVideoOffset|GCamera:MicroVideoOffset)["'=:\s>]+(\d+)`)
)

const maxMetadataScanBytes = 256 * 1024

func DetectJPEG(blob []byte) *Detection {
	if len(blob) < 16 || !bytes.HasPrefix(blob, []byte{0xFF, 0xD8}) {
		return nil
	}

	text := string(blob[:min(len(blob), maxMetadataScanBytes)])
	if !motionPhotoMarkerRegex.MatchString(text) {
		return nil
	}

	videoStart := detectVideoStart(blob, text)
	if videoStart < 0 || videoStart >= len(blob) {
		return nil
	}

	return &Detection{
		VideoStart:              videoStart,
		PresentationTimestampUs: parsePresentationTimestampUs(text),
	}
}

func ExtractVideo(blob []byte) ([]byte, *Detection) {
	detection := DetectJPEG(blob)
	if detection == nil {
		return nil, nil
	}

	videoBlob := blob[detection.VideoStart:]
	if !looksLikeMP4(videoBlob) {
		return nil, nil
	}

	return videoBlob, detection
}

func detectVideoStart(blob []byte, text string) int {
	if matches := microVideoOffsetRegex.FindStringSubmatch(text); len(matches) == 2 {
		if offset, err := strconv.Atoi(matches[1]); err == nil && offset > 0 && offset < len(blob) {
			start := len(blob) - offset
			if looksLikeMP4(blob[start:]) {
				return start
			}
		}
	}

	return findEmbeddedMP4Start(blob)
}

func parsePresentationTimestampUs(text string) int64 {
	matches := presentationRegex.FindStringSubmatch(text)
	if len(matches) != 2 {
		return 0
	}

	value, err := strconv.ParseInt(matches[1], 10, 64)
	if err != nil {
		return 0
	}
	return value
}

func findEmbeddedMP4Start(blob []byte) int {
	searchFrom := len(blob)
	for searchFrom > 8 {
		index := bytes.LastIndex(blob[:searchFrom], []byte("ftyp"))
		if index < 4 {
			return -1
		}

		start := index - 4
		if looksLikeMP4(blob[start:]) {
			return start
		}

		searchFrom = index - 1
	}

	return -1
}

func looksLikeMP4(blob []byte) bool {
	if len(blob) < 12 || !bytes.Equal(blob[4:8], []byte("ftyp")) {
		return false
	}

	size := binary.BigEndian.Uint32(blob[:4])
	return size == 1 || size >= 8
}
