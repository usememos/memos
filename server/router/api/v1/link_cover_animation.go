package v1

import "encoding/binary"

// animatedLinkCover inspects container chunk headers, never compressed pixels.
// Malformed containers are rejected by the complete image decoder.
func animatedLinkCover(blob []byte, format string) bool {
	switch format {
	case "png":
		for offset := 8; offset+12 <= len(blob); {
			length := binary.BigEndian.Uint32(blob[offset : offset+4])
			if uint64(length)+12 > uint64(len(blob)-offset) {
				return false
			}
			if string(blob[offset+4:offset+8]) == "acTL" {
				return true
			}
			offset += int(length) + 12
		}
	case "webp":
		for offset := 12; offset+8 <= len(blob); {
			length := binary.LittleEndian.Uint32(blob[offset+4 : offset+8])
			if uint64(length)+8 > uint64(len(blob)-offset) {
				return false
			}
			switch string(blob[offset : offset+4]) {
			case "ANIM", "ANMF":
				return true
			case "VP8X":
				if length > 0 && blob[offset+8]&2 != 0 {
					return true
				}
			}
			offset += int(length) + 8 + int(length%2)
		}
	}
	return false
}
