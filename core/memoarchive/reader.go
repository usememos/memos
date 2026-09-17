package memoarchive

import (
	"archive/zip"
	"bytes"
	"cmp"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"maps"
	"slices"
	"strings"

	"github.com/pkg/errors"
)

const (
	// maxEntries bounds the central directory a reader is willing to walk.
	maxEntries = 1_000_000
	// maxManifestBytes bounds manifest.json.
	maxManifestBytes = 1 << 20
	// maxRecordBytes bounds one memo record.
	maxRecordBytes = 4 << 20
	// maxContentBytes bounds one memo content file. Instances enforce their
	// own, smaller content length limit on import.
	maxContentBytes = 64 << 20
	// maxExpansionRatio bounds the total declared uncompressed size relative
	// to the container, with maxExpansionSlack of headroom for tiny archives.
	// Memo text deflates around ten to one and media hardly at all, so a
	// container that claims to expand further is a decompression bomb.
	maxExpansionRatio = 64
	maxExpansionSlack = 64 << 20
)

// Archive is a validated, opened Memo Archive. Memos are ordered so that a
// parent precedes its comments, then by createTime, then by UID.
type Archive struct {
	Manifest *Manifest
	Memos    []*Memo
	// Warnings lists every soft deviation the reader corrected.
	Warnings []Warning

	entries map[string]*zip.File
}

// Read validates the container and loads every memo record. It fails on the
// first hard violation without returning a partial archive.
func Read(r io.ReaderAt, size int64) (*Archive, error) {
	reader, err := zip.NewReader(r, size)
	if err != nil {
		return nil, errors.Wrap(err, "not a ZIP file")
	}
	if len(reader.File) > maxEntries {
		return nil, errors.Errorf("archive has more than %d entries", maxEntries)
	}
	archive := &Archive{entries: make(map[string]*zip.File, len(reader.File))}
	var totalCompressed, totalUncompressed uint64
	for _, file := range reader.File {
		if strings.HasSuffix(file.Name, "/") && file.UncompressedSize64 == 0 {
			// Directory entries carry no data; readers must not depend on them.
			continue
		}
		totalCompressed += file.CompressedSize64
		totalUncompressed += file.UncompressedSize64
		if totalUncompressed > maxExpansionRatio*totalCompressed+maxExpansionSlack {
			return nil, errors.Errorf("archive declares %d uncompressed bytes for %d compressed bytes", totalUncompressed, totalCompressed)
		}
		if err := ValidateEntryName(file.Name); err != nil {
			return nil, err
		}
		if file.Method != zip.Store && file.Method != zip.Deflate {
			return nil, errors.Errorf("entry %q uses unsupported compression method %d", file.Name, file.Method)
		}
		if file.Flags&0x1 != 0 {
			return nil, errors.Errorf("entry %q is encrypted", file.Name)
		}
		if _, dup := archive.entries[file.Name]; dup {
			return nil, errors.Errorf("duplicate entry %q", file.Name)
		}
		archive.entries[file.Name] = file
	}

	manifest, err := archive.readManifest()
	if err != nil {
		return nil, err
	}
	archive.Manifest = manifest
	if err := archive.readMemos(); err != nil {
		return nil, err
	}
	return archive, nil
}

// Content returns the exact bytes of a memo's content file.
func (a *Archive) Content(memo *Memo) ([]byte, error) {
	return a.readEntry(memo.ContentPath, maxContentBytes)
}

// ReadAttachment returns the bytes of an attachment entry after checking
// their length and SHA-256 digest against the attachment record.
func (a *Archive) ReadAttachment(attachment *Attachment) ([]byte, error) {
	if attachment.Path == "" {
		return nil, errors.Errorf("attachment %s has no bytes in the archive", attachment.UID)
	}
	file, ok := a.entries[attachment.Path]
	if !ok {
		return nil, errors.Errorf("attachment entry %q is missing", attachment.Path)
	}
	if file.UncompressedSize64 != uint64(attachment.Size) {
		return nil, errors.Errorf("attachment %s: entry holds %d bytes but the record says %d", attachment.UID, file.UncompressedSize64, attachment.Size)
	}
	content, err := a.readEntry(attachment.Path, attachment.Size)
	if err != nil {
		return nil, err
	}
	digest := sha256.Sum256(content)
	if hex.EncodeToString(digest[:]) != attachment.SHA256 {
		return nil, errors.Errorf("attachment %s: SHA-256 digest does not match the record", attachment.UID)
	}
	return content, nil
}

func (a *Archive) readManifest() (*Manifest, error) {
	if _, ok := a.entries[ManifestEntry]; !ok {
		return nil, errors.Errorf("%s is missing", ManifestEntry)
	}
	content, err := a.readEntry(ManifestEntry, maxManifestBytes)
	if err != nil {
		return nil, err
	}
	manifest := &Manifest{}
	if err := json.Unmarshal(content, manifest); err != nil {
		return nil, errors.Wrapf(err, "%s is not valid JSON", ManifestEntry)
	}
	if err := validateManifest(manifest); err != nil {
		return nil, errors.Wrap(err, "invalid manifest")
	}
	return manifest, nil
}

func (a *Archive) readMemos() error {
	records := make(map[string]*Memo)
	contents := make(map[string]struct{})
	names := slices.Sorted(maps.Keys(a.entries))
	for _, name := range names {
		rest, ok := strings.CutPrefix(name, MemosDir)
		if !ok || strings.Contains(rest, "/") {
			// Nested entries under memos/ are reserved for later versions.
			continue
		}
		if uid, isContent := strings.CutSuffix(rest, ".md"); isContent {
			contents[uid] = struct{}{}
			continue
		}
		uid, isRecord := strings.CutSuffix(rest, ".json")
		if !isRecord {
			continue
		}
		content, err := a.readEntry(name, maxRecordBytes)
		if err != nil {
			return err
		}
		memo := &Memo{}
		if err := json.Unmarshal(content, memo); err != nil {
			return errors.Wrapf(err, "%s is not valid JSON", name)
		}
		if memo.UID != uid {
			return errors.Errorf("%s: uid %q does not match the file name", name, memo.UID)
		}
		warnings, err := validateMemo(memo)
		if err != nil {
			return err
		}
		a.Warnings = append(a.Warnings, warnings...)
		if _, ok := a.entries[memo.ContentPath]; !ok {
			return errors.Errorf("memo %s: content entry %q is missing", memo.UID, memo.ContentPath)
		}
		for _, attachment := range memo.Attachments {
			if _, ok := a.entries[attachment.Path]; attachment.Path != "" && !ok {
				return errors.Errorf("memo %s: attachment entry %q is missing", memo.UID, attachment.Path)
			}
		}
		records[memo.UID] = memo
	}
	for uid := range contents {
		if _, ok := records[uid]; !ok {
			return errors.Errorf("%s has no memo record", ContentPath(uid))
		}
	}
	if a.Manifest.Counts != nil && a.Manifest.Counts.Memos != len(records) {
		a.Warnings = append(a.Warnings, Warning{Message: fmt.Sprintf("manifest counts %d memos but the archive holds %d", a.Manifest.Counts.Memos, len(records))})
	}
	a.Memos = orderMemos(records)
	return nil
}

// orderMemos returns records with every parent ahead of its comments, then by
// createTime, then by UID. A parent that is not in the archive, or a cycle,
// leaves the record where the time order put it.
func orderMemos(records map[string]*Memo) []*Memo {
	createTimes := make(map[string]int64, len(records))
	memos := make([]*Memo, 0, len(records))
	for _, memo := range records {
		// validateMemo already accepted the timestamp.
		createTimes[memo.UID], _ = ParseTime(memo.CreateTime)
		memos = append(memos, memo)
	}
	slices.SortFunc(memos, func(a, b *Memo) int {
		return cmp.Or(cmp.Compare(createTimes[a.UID], createTimes[b.UID]), strings.Compare(a.UID, b.UID))
	})

	ordered := make([]*Memo, 0, len(memos))
	placed := make(map[string]struct{}, len(memos))
	visiting := make(map[string]struct{})
	var place func(memo *Memo)
	place = func(memo *Memo) {
		if _, done := placed[memo.UID]; done {
			return
		}
		if _, cycle := visiting[memo.UID]; cycle {
			return
		}
		visiting[memo.UID] = struct{}{}
		if parent, ok := records[memo.Parent]; ok {
			place(parent)
		}
		delete(visiting, memo.UID)
		placed[memo.UID] = struct{}{}
		ordered = append(ordered, memo)
	}
	for _, memo := range memos {
		place(memo)
	}
	return ordered
}

func (a *Archive) readEntry(name string, limit int64) ([]byte, error) {
	file, ok := a.entries[name]
	if !ok {
		return nil, errors.Errorf("entry %q is missing", name)
	}
	if file.UncompressedSize64 > uint64(limit) {
		return nil, errors.Errorf("entry %q is larger than %d bytes", name, limit)
	}
	reader, err := file.Open()
	if err != nil {
		return nil, errors.Wrapf(err, "failed to open entry %q", name)
	}
	defer reader.Close()
	var buffer bytes.Buffer
	buffer.Grow(int(file.UncompressedSize64))
	// The central directory size is untrusted; stop one byte past the limit.
	n, err := io.Copy(&buffer, io.LimitReader(reader, limit+1))
	if err != nil {
		return nil, errors.Wrapf(err, "failed to read entry %q", name)
	}
	if n > limit {
		return nil, errors.Errorf("entry %q is larger than %d bytes", name, limit)
	}
	return buffer.Bytes(), nil
}
