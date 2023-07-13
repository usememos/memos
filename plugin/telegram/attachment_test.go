package telegram

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGetMimeType(t *testing.T) {
	tests := []struct {
		mimeType string
		fileName string
		expected string
	}{
		{
			fileName: "file.jpg",
			mimeType: "image/jpeg",
			expected: "image/jpeg",
		},
		{
			fileName: "file.png",
			mimeType: "image/png",
			expected: "image/png",
		},
		{
			fileName: "file.pdf",
			mimeType: "application/pdf",
			expected: "application/pdf",
		},
		{
			fileName: "file.php",
			mimeType: "application/x-php",
			expected: "application/x-php",
		},
		{
			fileName: "file.xlsx",
			mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			expected: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		},
		{
			fileName: "file.oga",
			mimeType: "audio/ogg",
			expected: "audio/ogg",
		},
		{
			fileName: "file.jpg",
			expected: "image/jpeg",
		},
		{
			fileName: "file.png",
			expected: "image/png",
		},
		{
			fileName: "file.mp4",
			expected: "video/mp4",
		},
		{
			fileName: "file.pdf",
			expected: "application/octet-stream",
		},
		{
			fileName: "file.oga",
			expected: "audio/ogg",
		},
		{
			fileName: "file.xlsx",
			expected: "application/octet-stream",
		},
		{
			fileName: "file.txt",
			expected: "application/octet-stream",
		},
	}

	for _, test := range tests {
		attachment := Attachment{
			FileName: test.fileName,
			MimeType: test.mimeType,
		}

		require.Equal(t, test.expected, attachment.GetMimeType())
	}
}
