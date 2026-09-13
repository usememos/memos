package v1

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestDetectAttachmentMimeType(t *testing.T) {
	tests := []struct {
		name     string
		filename string
		content  []byte
		want     string
	}{
		{
			name:     "heic image via extension fallback",
			filename: "photo.heic",
			want:     "image/heic",
		},
		{
			name:     "heif image via extension fallback",
			filename: "photo.heif",
			want:     "image/heif",
		},
		{
			name:     "uppercase HEIC extension",
			filename: "PHOTO.HEIC",
			want:     "image/heic",
		},
		{
			name:     "regular image by builtin extension",
			filename: "image.png",
			want:     "image/png",
		},
		{
			name:     "unknown extension falls back to content sniffing",
			filename: "photo.xyz",
			content:  []byte{0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a},
			want:     "image/png",
		},
		{
			name:     "no extension and no sniffable content",
			filename: "attachment",
			want:     "text/plain; charset=utf-8",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := detectAttachmentMimeType(tt.filename, tt.content)
			require.Equal(t, tt.want, got)
		})
	}
}
