package memoexport

import (
	"archive/zip"
	"bytes"
	"io"
	"testing"

	"github.com/stretchr/testify/require"
)

// A container whose entries declare far more bytes than it holds is refused
// before any entry is read.
func TestReadRejectsDecompressionBomb(t *testing.T) {
	var buf bytes.Buffer
	writer := zip.NewWriter(&buf)
	entry, err := writer.Create(AttachmentsDir + "bomb/zeros.bin")
	require.NoError(t, err)
	zeros := make([]byte, 1<<20)
	for range 80 {
		_, err = entry.Write(zeros)
		require.NoError(t, err)
	}
	require.NoError(t, writer.Close())
	require.Less(t, buf.Len(), 1<<20, "80 MiB of zeros deflates to well under a mebibyte")

	_, err = Read(bytes.NewReader(buf.Bytes()), int64(buf.Len()))
	require.Error(t, err)
	require.Contains(t, err.Error(), "uncompressed bytes")
	_ = io.EOF
}
