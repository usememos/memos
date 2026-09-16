package memoarchive

import (
	"archive/zip"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"flag"
	"io"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

var updateGolden = flag.Bool("update", false, "rewrite the golden archives under testdata")

// goldenFixture is the content of every golden archive. Changing it changes
// the golden file, so bump it deliberately.
type goldenFixture struct {
	manifest    Manifest
	memos       []*Memo
	contents    map[string][]byte
	attachments map[string][]byte
}

// fixtureExportTime keeps golden archives byte-stable across runs.
var fixtureExportTime = time.Date(2026, 9, 16, 8, 30, 0, 0, time.UTC)

func newGoldenFixture() goldenFixture {
	photo := []byte("not really a jpeg")
	photoDigest := sha256.Sum256(photo)
	return goldenFixture{
		manifest: Manifest{
			Generator:  Generator{Name: "memos", Version: "0.31.0"},
			ExportTime: "2026-09-16T08:30:00Z",
			Scope:      Scope{Kind: ScopeKindUser, User: &ScopeUser{Username: "steven", DisplayName: "Steven"}},
			Counts:     &Counts{Memos: 3, Attachments: 1},
		},
		memos: []*Memo{
			{
				UID:        "Xy7LmN01",
				Creator:    "steven",
				CreateTime: "2026-03-01T09:00:00Z",
				UpdateTime: "2026-03-01T09:00:00Z",
				State:      "NORMAL",
				Visibility: "PUBLIC",
				Pinned:     false,
				Tags:       []string{"work"},
			},
			{
				UID:        "Ab3kZ9q2",
				Creator:    "steven",
				CreateTime: "2026-03-02T14:05:11Z",
				UpdateTime: "2026-03-02T14:20:47Z",
				State:      "NORMAL",
				Visibility: "SPACE",
				Pinned:     true,
				Tags:       []string{"work", "work/q3"},
				Location:   &Location{Placeholder: "Office", Latitude: 52.52, Longitude: 13.405},
				Space:      &Space{UID: "team-notes", Title: "Team Notes"},
				Relations:  []Relation{{Type: RelationReference, Memo: "Xy7LmN01"}},
				Attachments: []Attachment{{
					UID:           "att1c9d",
					Filename:      "whiteboard photo.jpg",
					Type:          "image/jpeg",
					Size:          int64(len(photo)),
					SHA256:        hex.EncodeToString(photoDigest[:]),
					Path:          AttachmentPath("att1c9d", "whiteboard photo.jpg"),
					CreateTime:    "2026-03-02T14:05:30Z",
					MediaMetadata: json.RawMessage(`{"width":4032,"height":3024}`),
				}, {
					UID:          "att77e0",
					Filename:     "spec.pdf",
					Type:         "application/pdf",
					Size:         120400,
					ExternalLink: "https://files.example.com/spec.pdf",
					CreateTime:   "2026-03-02T14:06:02Z",
				}},
				Reactions: []Reaction{{ReactionType: "👍", Creator: "alice", CreateTime: "2026-03-03T09:00:00Z"}},
			},
			{
				UID:        "Cm9Rt4v7",
				Creator:    "steven",
				CreateTime: "2026-02-28T08:00:00Z", // older than its parent on purpose
				UpdateTime: "2026-02-28T08:00:00Z",
				State:      "ARCHIVED",
				Visibility: "PRIVATE",
				Parent:     "Xy7LmN01",
			},
		},
		contents: map[string][]byte{
			"Xy7LmN01": []byte("Top-level memo #work"),
			"Ab3kZ9q2": []byte("# Whiteboard\n\nSee the photo. No trailing newline"),
			"Cm9Rt4v7": []byte("A comment"),
		},
		attachments: map[string][]byte{"att1c9d": photo},
	}
}

func writeFixture(t *testing.T, fixture goldenFixture) []byte {
	t.Helper()
	var buffer bytes.Buffer
	writer := NewWriter(&buffer, fixtureExportTime)
	require.NoError(t, writer.WriteManifest(&fixture.manifest))
	for _, memo := range fixture.memos {
		for _, attachment := range memo.Attachments {
			if attachment.Path == "" {
				continue
			}
			digest, size, err := writer.WriteAttachment(attachment.Path, bytes.NewReader(fixture.attachments[attachment.UID]))
			require.NoError(t, err)
			require.Equal(t, attachment.SHA256, digest)
			require.Equal(t, attachment.Size, size)
		}
		require.NoError(t, writer.WriteMemo(memo, fixture.contents[memo.UID]))
	}
	require.NoError(t, writer.Close())
	return buffer.Bytes()
}

func readArchive(t *testing.T, data []byte) *Archive {
	t.Helper()
	archive, err := Read(bytes.NewReader(data), int64(len(data)))
	require.NoError(t, err)
	return archive
}

func requireFixtureRoundTrip(t *testing.T, fixture goldenFixture, archive *Archive) {
	t.Helper()
	require.Equal(t, Format, archive.Manifest.Format)
	require.Equal(t, FormatVersion, archive.Manifest.FormatVersion)
	require.Equal(t, fixture.manifest.Scope, archive.Manifest.Scope)
	require.Empty(t, archive.Warnings)

	uids := make([]string, 0, len(archive.Memos))
	for _, memo := range archive.Memos {
		uids = append(uids, memo.UID)
	}
	// Cm9Rt4v7 is older than its parent Xy7LmN01 but must follow it.
	require.Equal(t, []string{"Xy7LmN01", "Cm9Rt4v7", "Ab3kZ9q2"}, uids)

	byUID := make(map[string]*Memo, len(archive.Memos))
	for _, memo := range archive.Memos {
		byUID[memo.UID] = memo
	}
	for _, want := range fixture.memos {
		got := byUID[want.UID]
		require.NotNil(t, got, want.UID)
		expected := *want
		expected.ContentPath = ContentPath(want.UID)
		require.Equal(t, &expected, got)
		content, err := archive.Content(got)
		require.NoError(t, err)
		require.Equal(t, fixture.contents[want.UID], content)
		for i := range got.Attachments {
			attachment := &got.Attachments[i]
			if attachment.Path == "" {
				continue
			}
			bytesRead, err := archive.ReadAttachment(attachment)
			require.NoError(t, err)
			require.Equal(t, fixture.attachments[attachment.UID], bytesRead)
		}
	}
}

func TestRoundTrip(t *testing.T) {
	fixture := newGoldenFixture()
	data := writeFixture(t, fixture)

	reader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	require.NoError(t, err)
	require.Equal(t, ManifestEntry, reader.File[0].Name)
	for _, file := range reader.File {
		// macOS Archive Utility refuses an all-zero DOS date, and treats a
		// leading "mimetype" entry as an unknown document package.
		require.NotEqual(t, "mimetype", file.Name)
		require.NotZero(t, file.ModifiedDate, file.Name)
		require.Equal(t, fixtureExportTime, file.Modified.UTC(), file.Name)
	}

	requireFixtureRoundTrip(t, fixture, readArchive(t, data))
}

// TestGoldenArchives reads every golden archive ever published. A reader
// change that breaks an older archive fails here.
func TestGoldenArchives(t *testing.T) {
	fixture := newGoldenFixture()
	goldenPath := filepath.Join("testdata", "1.0", "golden.zip")
	if *updateGolden {
		require.NoError(t, os.MkdirAll(filepath.Dir(goldenPath), 0o755))
		require.NoError(t, os.WriteFile(goldenPath, writeFixture(t, fixture), 0o644))
	}
	versions, err := filepath.Glob(filepath.Join("testdata", "*", "golden.zip"))
	require.NoError(t, err)
	require.NotEmpty(t, versions, "no golden archives found; run with -update")
	for _, path := range versions {
		t.Run(filepath.Base(filepath.Dir(path)), func(t *testing.T) {
			data, err := os.ReadFile(path)
			require.NoError(t, err)
			archive := readArchive(t, data)
			if filepath.Base(filepath.Dir(path)) == FormatVersion {
				requireFixtureRoundTrip(t, fixture, archive)
			}
		})
	}
}

func TestReaderAppliesFallbacksAndIgnoresUnknowns(t *testing.T) {
	fixture := newGoldenFixture()
	memo := fixture.memos[0]
	memo.State = "DELETED"
	memo.Visibility = "SECRET"
	memo.Relations = []Relation{{Type: "FOLLOWS", Memo: "Ab3kZ9q2"}}

	memo.ContentPath = ContentPath(memo.UID)
	var buffer bytes.Buffer
	writer := NewWriter(&buffer, fixtureExportTime)
	require.NoError(t, writer.WriteManifest(&fixture.manifest))
	// Bypass the writer's validation so the record carries the unknown values.
	raw, err := json.Marshal(struct {
		*Memo
		Future string `json:"future"`
	}{Memo: memo, Future: "from a later minor"})
	require.NoError(t, err)
	entry, err := writer.zip.Create(RecordPath(memo.UID))
	require.NoError(t, err)
	_, err = entry.Write(raw)
	require.NoError(t, err)
	entry, err = writer.zip.Create(ContentPath(memo.UID))
	require.NoError(t, err)
	_, err = entry.Write([]byte("x"))
	require.NoError(t, err)
	entry, err = writer.zip.Create("extra/ignored.txt")
	require.NoError(t, err)
	_, err = entry.Write([]byte("ignored"))
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	archive := readArchive(t, buffer.Bytes())
	require.Len(t, archive.Memos, 1)
	got := archive.Memos[0]
	require.Equal(t, "NORMAL", got.State)
	require.Equal(t, "PRIVATE", got.Visibility)
	require.Empty(t, got.Relations)
	messages := make([]string, 0, len(archive.Warnings))
	for _, warning := range archive.Warnings {
		messages = append(messages, warning.Message)
	}
	require.Len(t, messages, 4) // state, visibility, relation, manifest count
	require.Contains(t, messages[0], "unknown state")
	require.Contains(t, messages[1], "unknown visibility")
	require.Contains(t, messages[2], "unknown relation type")
	require.Contains(t, messages[3], "manifest counts")
}

func TestReaderRejectsUnsafeArchives(t *testing.T) {
	fixture := newGoldenFixture()
	base := writeFixture(t, fixture)

	rewrite := func(t *testing.T, mutate func(*zip.Writer, *zip.File, []byte) bool) []byte {
		t.Helper()
		reader, err := zip.NewReader(bytes.NewReader(base), int64(len(base)))
		require.NoError(t, err)
		var buffer bytes.Buffer
		writer := zip.NewWriter(&buffer)
		for _, file := range reader.File {
			rc, err := file.Open()
			require.NoError(t, err)
			content, err := io.ReadAll(rc)
			require.NoError(t, err)
			require.NoError(t, rc.Close())
			if mutate(writer, file, content) {
				continue
			}
			entry, err := writer.CreateHeader(&zip.FileHeader{Name: file.Name, Method: file.Method})
			require.NoError(t, err)
			_, err = entry.Write(content)
			require.NoError(t, err)
		}
		require.NoError(t, writer.Close())
		return buffer.Bytes()
	}

	cases := map[string]struct {
		mutate func(*zip.Writer, *zip.File, []byte) bool
		want   string
	}{
		"dot-dot entry": {
			mutate: func(w *zip.Writer, f *zip.File, _ []byte) bool {
				if f.Name == ManifestEntry {
					entry, _ := w.Create("../escape.txt")
					_, _ = entry.Write([]byte("x"))
				}
				return false
			},
			want: "dot segment",
		},
		"absolute entry": {
			mutate: func(w *zip.Writer, f *zip.File, _ []byte) bool {
				if f.Name == ManifestEntry {
					entry, _ := w.Create("/etc/passwd")
					_, _ = entry.Write([]byte("x"))
				}
				return false
			},
			want: "is absolute",
		},
		"backslash entry": {
			mutate: func(w *zip.Writer, f *zip.File, _ []byte) bool {
				if f.Name == ManifestEntry {
					entry, _ := w.Create(`memos\x.md`)
					_, _ = entry.Write([]byte("x"))
				}
				return false
			},
			want: "forbidden character",
		},
		"missing manifest": {
			mutate: func(_ *zip.Writer, f *zip.File, _ []byte) bool { return f.Name == ManifestEntry },
			want:   "manifest.json is missing",
		},
		"unsupported major": {
			mutate: func(w *zip.Writer, f *zip.File, content []byte) bool {
				if f.Name != ManifestEntry {
					return false
				}
				entry, _ := w.Create(ManifestEntry)
				_, _ = entry.Write(bytes.ReplaceAll(content, []byte(`"formatVersion":"1.0"`), []byte(`"formatVersion":"2.0"`)))
				return true
			},
			want: "format version 2.0 is not supported",
		},
		"uid mismatch": {
			mutate: func(w *zip.Writer, f *zip.File, content []byte) bool {
				if f.Name != RecordPath("Cm9Rt4v7") {
					return false
				}
				entry, _ := w.Create(RecordPath("Cm9Rt4v7"))
				_, _ = entry.Write(bytes.ReplaceAll(content, []byte(`"uid":"Cm9Rt4v7"`), []byte(`"uid":"Other001"`)))
				return true
			},
			want: "does not match the file name",
		},
		"content without record": {
			mutate: func(w *zip.Writer, f *zip.File, _ []byte) bool {
				if f.Name == ManifestEntry {
					entry, _ := w.Create(ContentPath("orphan01"))
					_, _ = entry.Write([]byte("x"))
				}
				return false
			},
			want: "has no memo record",
		},
		"missing attachment entry": {
			mutate: func(_ *zip.Writer, f *zip.File, _ []byte) bool {
				return f.Name == AttachmentPath("att1c9d", "whiteboard photo.jpg")
			},
			want: "attachment entry",
		},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			data := rewrite(t, tc.mutate)
			_, err := Read(bytes.NewReader(data), int64(len(data)))
			require.Error(t, err)
			require.Contains(t, err.Error(), tc.want)
		})
	}
}

func TestReadAttachmentVerifiesDigest(t *testing.T) {
	fixture := newGoldenFixture()
	fixture.memos[1].Attachments[0].SHA256 = hex.EncodeToString(bytes.Repeat([]byte{0xab}, 32))
	var buffer bytes.Buffer
	writer := NewWriter(&buffer, fixtureExportTime)
	require.NoError(t, writer.WriteManifest(&fixture.manifest))
	attachment := fixture.memos[1].Attachments[0]
	_, _, err := writer.WriteAttachment(attachment.Path, bytes.NewReader(fixture.attachments[attachment.UID]))
	require.NoError(t, err)
	require.NoError(t, writer.WriteMemo(fixture.memos[1], fixture.contents["Ab3kZ9q2"]))
	require.NoError(t, writer.Close())

	archive := readArchive(t, buffer.Bytes())
	_, err = archive.ReadAttachment(&archive.Memos[0].Attachments[0])
	require.ErrorContains(t, err, "digest does not match")
}

func TestSafeFilename(t *testing.T) {
	cases := map[string]string{
		"whiteboard photo.jpg": "whiteboard photo.jpg",
		"../../etc/passwd":     "_.._etc_passwd",
		"a:b\\c/d.txt":         "a_b_c_d.txt",
		"CON.txt":              "_CON.txt",
		"lpt9":                 "_lpt9",
		" .hidden. ":           "hidden",
		"":                     "file",
		"...":                  "file",
		"résumé.pdf":           "résumé.pdf",
		"tab\there":            "tab_here",
	}
	for input, want := range cases {
		require.Equal(t, want, SafeFilename(input), input)
	}
}

func TestValidateEntryName(t *testing.T) {
	require.NoError(t, ValidateEntryName("memos/a.md"))
	require.NoError(t, ValidateEntryName("attachments/x/a..b.jpg"))
	require.NoError(t, ValidateEntryName("attachments/x/résumé.pdf"))
	for _, bad := range []string{"", "/a", "a/", "a//b", "./a", "a/./b", "../a", "a/..", `a\b`, "a:b", "a\x00b", "a\x1fb", "\xff"} {
		require.Error(t, ValidateEntryName(bad), bad)
	}
}

func TestWriterRefusesRecordBeforeAttachment(t *testing.T) {
	fixture := newGoldenFixture()
	var buffer bytes.Buffer
	writer := NewWriter(&buffer, fixtureExportTime)
	require.NoError(t, writer.WriteManifest(&fixture.manifest))
	err := writer.WriteMemo(fixture.memos[1], nil)
	require.ErrorContains(t, err, "must be written before memo")
}
