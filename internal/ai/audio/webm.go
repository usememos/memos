// Package audio provides audio container/codec helpers for AI providers.
//
// The motivating use case is Gemini transcription: Gemini's audio inputs
// require WAV/MP3/AIFF/AAC/OGG/FLAC, but browser MediaRecorder defaults to
// WebM/Opus. This package converts WebM/Opus into 16-bit PCM WAV using
// pure-Go decoders — no ffmpeg or other system dependency.
package audio

import (
	"bytes"
	"encoding/binary"
	"io"
	"strings"

	"github.com/at-wat/ebml-go"
	"github.com/at-wat/ebml-go/webm"
	"github.com/pion/opus"
	"github.com/pkg/errors"
)

const (
	opusOutputSampleRate = 48000
	// maxOpusPacketSamples is Opus's spec maximum: 120 ms at 48 kHz.
	maxOpusPacketSamples = 5760
	// opusCodecID is the WebM TrackEntry CodecID for an Opus audio track.
	opusCodecID = "A_OPUS"
	// opusHeadMinLength is the minimum size of the OpusHead identification
	// header stored in TrackEntry.CodecPrivate.
	opusHeadMinLength = 19
)

// WebMOpusToWAV decodes a WebM/Opus file into 16-bit PCM WAV bytes.
//
// The output is mono or stereo at 48 kHz (Opus's native decode rate),
// regardless of the original encoder's hint. Pre-skip samples declared in
// the OpusHead are discarded to avoid the encoder's startup padding.
//
// The function reads the entire WebM document into memory; callers should
// enforce their own size limits before invoking it.
func WebMOpusToWAV(input []byte) ([]byte, error) {
	var doc struct {
		Header  webm.EBMLHeader `ebml:"EBML"`
		Segment webm.Segment    `ebml:"Segment"`
	}
	if err := ebml.Unmarshal(bytes.NewReader(input), &doc); err != nil && !errors.Is(err, io.EOF) {
		return nil, errors.Wrap(err, "parse webm")
	}

	track := findOpusTrack(doc.Segment.Tracks.TrackEntry)
	if track == nil {
		return nil, errors.New("webm has no Opus audio track")
	}
	if len(track.CodecPrivate) < opusHeadMinLength {
		return nil, errors.Errorf("invalid OpusHead: expected at least %d bytes, got %d", opusHeadMinLength, len(track.CodecPrivate))
	}

	channels := int(track.Audio.Channels)
	if channels < 1 || channels > 2 {
		return nil, errors.Errorf("unsupported Opus channel count: %d", channels)
	}
	preSkip := int(binary.LittleEndian.Uint16(track.CodecPrivate[10:12]))

	decoder := opus.NewDecoder()
	if err := decoder.Init(opusOutputSampleRate, channels); err != nil {
		return nil, errors.Wrap(err, "init opus decoder")
	}

	pcm := make([]int16, 0, 1<<16)
	frame := make([]int16, maxOpusPacketSamples*channels)

	decodeBlock := func(block ebml.Block) error {
		if block.TrackNumber != track.TrackNumber {
			return nil
		}
		for _, packet := range block.Data {
			if len(packet) == 0 {
				continue
			}
			n, err := decoder.DecodeToInt16(packet, frame)
			if err != nil {
				return errors.Wrap(err, "decode opus packet")
			}
			pcm = append(pcm, frame[:n*channels]...)
		}
		return nil
	}

	for _, cluster := range doc.Segment.Cluster {
		for _, sb := range cluster.SimpleBlock {
			if err := decodeBlock(sb); err != nil {
				return nil, err
			}
		}
		for _, bg := range cluster.BlockGroup {
			if err := decodeBlock(bg.Block); err != nil {
				return nil, err
			}
		}
	}

	skip := preSkip * channels
	if skip > len(pcm) {
		skip = len(pcm)
	}
	pcm = pcm[skip:]

	return encodeWAV(pcm, opusOutputSampleRate, channels), nil
}

// IsWebMContentType reports whether the MIME type is WebM audio.
// Both "audio/webm" and "audio/webm; codecs=opus" return true.
func IsWebMContentType(contentType string) bool {
	contentType = strings.TrimSpace(contentType)
	if contentType == "" {
		return false
	}
	if i := strings.IndexByte(contentType, ';'); i >= 0 {
		contentType = contentType[:i]
	}
	return strings.EqualFold(strings.TrimSpace(contentType), "audio/webm")
}

func findOpusTrack(entries []webm.TrackEntry) *webm.TrackEntry {
	for i := range entries {
		entry := &entries[i]
		if entry.CodecID == opusCodecID && entry.Audio != nil {
			return entry
		}
	}
	return nil
}

// encodeWAV writes a standard RIFF/WAVE container around 16-bit PCM samples.
// Reference layout: http://soundfile.sapp.org/doc/WaveFormat/
func encodeWAV(samples []int16, sampleRate, channels int) []byte {
	const bitsPerSample = 16
	const bytesPerSample = bitsPerSample / 8
	blockAlign := channels * bytesPerSample
	byteRate := sampleRate * blockAlign
	dataSize := len(samples) * bytesPerSample

	buf := bytes.NewBuffer(make([]byte, 0, 44+dataSize))
	buf.WriteString("RIFF")
	_ = binary.Write(buf, binary.LittleEndian, uint32(36+dataSize))
	buf.WriteString("WAVE")

	buf.WriteString("fmt ")
	_ = binary.Write(buf, binary.LittleEndian, uint32(16))
	_ = binary.Write(buf, binary.LittleEndian, uint16(1)) // PCM
	_ = binary.Write(buf, binary.LittleEndian, uint16(channels))
	_ = binary.Write(buf, binary.LittleEndian, uint32(sampleRate))
	_ = binary.Write(buf, binary.LittleEndian, uint32(byteRate))
	_ = binary.Write(buf, binary.LittleEndian, uint16(blockAlign))
	_ = binary.Write(buf, binary.LittleEndian, uint16(bitsPerSample))

	buf.WriteString("data")
	_ = binary.Write(buf, binary.LittleEndian, uint32(dataSize))
	_ = binary.Write(buf, binary.LittleEndian, samples)

	return buf.Bytes()
}
