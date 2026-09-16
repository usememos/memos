package memoarchive

import (
	"archive/zip"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"strings"
	"time"

	"github.com/pkg/errors"
)

// Writer streams a Memo Archive to an io.Writer. Entries are written in the
// order the caller supplies them, so a caller that wants attachment digests
// in a memo record writes the attachment bytes before the record.
type Writer struct {
	zip           *zip.Writer
	modified      time.Time
	wroteManifest bool
	seen          map[string]struct{}
}

// NewWriter starts an archive on w. Every entry is stamped with modified,
// normally the export time; the zero time means now. A real timestamp
// matters because some extractors refuse the all-zero MS-DOS date that an
// unset time produces.
func NewWriter(w io.Writer, modified time.Time) *Writer {
	if modified.IsZero() {
		modified = time.Now()
	}
	return &Writer{zip: zip.NewWriter(w), modified: modified.UTC(), seen: map[string]struct{}{}}
}

// WriteManifest writes manifest.json. It fills in the format name and
// version, and must be called exactly once.
func (w *Writer) WriteManifest(manifest *Manifest) error {
	if w.wroteManifest {
		return errors.New("manifest already written")
	}
	if manifest == nil {
		return errors.New("manifest is required")
	}
	record := *manifest
	record.Format = Format
	record.FormatVersion = FormatVersion
	if err := validateManifest(&record); err != nil {
		return err
	}
	if err := w.writeJSON(ManifestEntry, &record); err != nil {
		return err
	}
	w.wroteManifest = true
	return nil
}

// WriteMemo writes a memo record and its content file. The record's
// contentPath is set to the conventional location. Attachment entries that
// carry a path must already have been written with WriteAttachment.
func (w *Writer) WriteMemo(memo *Memo, content []byte) error {
	if memo == nil {
		return errors.New("memo record is required")
	}
	record := *memo
	record.ContentPath = ContentPath(record.UID)
	if _, err := validateMemo(&record); err != nil {
		return err
	}
	for _, attachment := range record.Attachments {
		if attachment.Path == "" {
			continue
		}
		if _, ok := w.seen[attachment.Path]; !ok {
			return errors.Errorf("attachment entry %q must be written before memo %s", attachment.Path, record.UID)
		}
	}
	if err := w.writeJSON(RecordPath(record.UID), &record); err != nil {
		return err
	}
	entry, err := w.create(record.ContentPath, zip.Deflate)
	if err != nil {
		return err
	}
	if _, err := entry.Write(content); err != nil {
		return errors.Wrapf(err, "failed to write content of memo %s", record.UID)
	}
	return nil
}

// WriteAttachment copies attachment bytes into the entry at path and returns
// the digest and length it observed, which the caller records on the
// attachment entry.
func (w *Writer) WriteAttachment(path string, content io.Reader) (string, int64, error) {
	if !strings.HasPrefix(path, AttachmentsDir) {
		return "", 0, errors.Errorf("attachment entry %q must be under %s", path, AttachmentsDir)
	}
	entry, err := w.create(path, zip.Deflate)
	if err != nil {
		return "", 0, err
	}
	digest := sha256.New()
	size, err := io.Copy(io.MultiWriter(entry, digest), content)
	if err != nil {
		return "", 0, errors.Wrapf(err, "failed to write attachment entry %q", path)
	}
	return hex.EncodeToString(digest.Sum(nil)), size, nil
}

// Close finishes the central directory. The archive is unusable until Close
// returns nil.
func (w *Writer) Close() error {
	if !w.wroteManifest {
		return errors.New("manifest was not written")
	}
	return w.zip.Close()
}

func (w *Writer) writeJSON(name string, value any) error {
	entry, err := w.create(name, zip.Deflate)
	if err != nil {
		return err
	}
	encoder := json.NewEncoder(entry)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(value); err != nil {
		return errors.Wrapf(err, "failed to encode %s", name)
	}
	return nil
}

func (w *Writer) create(name string, method uint16) (io.Writer, error) {
	if err := ValidateEntryName(name); err != nil {
		return nil, err
	}
	if _, dup := w.seen[name]; dup {
		return nil, errors.Errorf("duplicate entry %q", name)
	}
	w.seen[name] = struct{}{}
	entry, err := w.zip.CreateHeader(&zip.FileHeader{Name: name, Method: method, Modified: w.modified})
	if err != nil {
		return nil, errors.Wrapf(err, "failed to create entry %q", name)
	}
	return entry, nil
}
