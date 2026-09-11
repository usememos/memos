package fileserver

import (
	"archive/zip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"slices"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/labstack/echo/v5"
	"github.com/pkg/errors"
	"google.golang.org/protobuf/encoding/protojson"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

const exportReadme = `# Memos export

Open index.md to browse your notes and their attached files offline.

- memos/<id>-<uid>.md contains the original Markdown, unchanged.
- attachments/<id>-<uid>/<filename> contains the original attachment bytes.
- manifest.json (format version 1) records UTC timestamps, state, visibility,
  pinning, tags, location, and the archive paths and original names of attachments.

This is an export of your own readable memos, including archived memos and comments.
Other users' notes, unlinked uploads, and notes you can no longer read are excluded.
Markdown URLs are preserved as written; use index.md or the manifest to find local
attachments. Legacy external attachments retain their URL in the manifest and
are not downloaded. Only comment context within this export is recorded. This is
not an instance backup or an import format. Changes made while an export is being prepared may be reflected
in it; avoid editing during export when you need a consistent copy.
`

type memoExportManifest struct {
	Version    int               `json:"version"`
	ExportedAt time.Time         `json:"exportedAt"`
	Memos      []memoExportEntry `json:"memos"`
}

type memoExportEntry struct {
	UID         string                 `json:"uid"`
	Path        string                 `json:"path"`
	CreatedAt   time.Time              `json:"createdAt"`
	UpdatedAt   time.Time              `json:"updatedAt"`
	State       store.RowStatus        `json:"state"`
	Visibility  store.Visibility       `json:"visibility"`
	Comment     bool                   `json:"comment"`
	ParentUID   string                 `json:"parentUid,omitempty"`
	Pinned      bool                   `json:"pinned"`
	Payload     json.RawMessage        `json:"payload"`
	Attachments []memoExportAttachment `json:"attachments"`
}

type memoExportAttachment struct {
	UID         string    `json:"uid"`
	Path        string    `json:"path,omitempty"`
	ExternalURL string    `json:"externalUrl,omitempty"`
	Filename    string    `json:"filename"`
	Type        string    `json:"type"`
	Size        int64     `json:"size"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

func (s *FileServerService) serveMemoExport(c *echo.Context) error {
	ctx := c.Request().Context()
	c.Response().Header().Set(echo.HeaderCacheControl, privateAttachmentCacheControl)
	setSecurityHeaders(c)
	user, err := s.getCurrentUser(ctx, c)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to authenticate export").Wrap(err)
	}
	if user == nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "authentication required")
	}
	if !s.exportSemaphore.TryAcquire(1) {
		c.Response().Header().Set("Retry-After", "30")
		return echo.NewHTTPError(http.StatusTooManyRequests, "another export is in progress; try again shortly")
	}
	defer s.exportSemaphore.Release(1)

	// Finish the ZIP before sending a successful response. A missing attachment
	// must produce an error, not a plausible but incomplete backup. CreateTemp
	// uses mode 0600, and every exit path removes the temporary archive.
	archive, err := os.CreateTemp("", "memos-export-*.zip")
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to create export").Wrap(err)
	}
	defer func() {
		archive.Close()
		os.Remove(archive.Name())
	}()
	now := time.Now().UTC()
	if err := s.writeMemoExport(ctx, archive, user.ID, now); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "could not export all memos and attachments; please try again").Wrap(err)
	}
	if _, err := archive.Seek(0, io.SeekStart); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to read export").Wrap(err)
	}
	info, err := archive.Stat()
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to read export").Wrap(err)
	}
	c.Response().Header().Set(echo.HeaderContentDisposition, `attachment; filename="memos-export-`+now.Format("2006-01-02")+`.zip"`)
	c.Response().Header().Set(echo.HeaderContentLength, fmt.Sprint(info.Size()))
	return c.Stream(http.StatusOK, "application/zip", archive)
}

func (s *FileServerService) writeMemoExport(ctx context.Context, dst io.Writer, userID int32, now time.Time) error {
	scope := &store.MemoAccessScope{UserID: &userID, AllowPublic: true, AllowProtected: true}
	// Capture the IDs without loading every note's content or applying API page
	// limits. Reload each memo with current access before exporting its content.
	memos, err := s.Store.ListMemos(ctx, &store.FindMemo{CreatorID: &userID, Access: scope, ExcludeContent: true})
	if err != nil {
		return errors.Wrap(err, "list export memos")
	}
	exportedUIDs := make(map[string]bool, len(memos))
	for _, memo := range memos {
		exportedUIDs[memo.UID] = true
	}
	slices.SortFunc(memos, func(a, b *store.Memo) int { return strings.Compare(a.UID, b.UID) })
	manifest := memoExportManifest{Version: 1, ExportedAt: now, Memos: make([]memoExportEntry, 0, len(memos))}
	archive := zip.NewWriter(dst)
	defer archive.Close()
	var index strings.Builder
	index.WriteString("# Exported memos\n\n")
	for _, snapshot := range memos {
		if err := ctx.Err(); err != nil {
			return err
		}
		memo, err := s.Store.GetMemo(ctx, &store.FindMemo{ID: &snapshot.ID, UID: &snapshot.UID, CreatorID: &userID, Access: scope})
		if err != nil {
			return errors.Wrap(err, "load export memo")
		}
		if memo == nil {
			return errors.New("memo removed or access changed during export")
		}
		entry, err := s.exportMemo(ctx, archive, memo, scope)
		if err != nil {
			return err
		}
		entry.Comment = memo.ParentUID != nil
		if memo.ParentUID != nil && exportedUIDs[*memo.ParentUID] {
			entry.ParentUID = *memo.ParentUID
		}
		manifest.Memos = append(manifest.Memos, *entry)
		fmt.Fprintf(&index, "## [%s](%s)\n\n%s · %s\n\n", entry.UID, entry.Path, entry.CreatedAt.Format(time.RFC3339), entry.State)
		for _, attachment := range entry.Attachments {
			if attachment.ExternalURL != "" {
				fmt.Fprintf(&index, "- Attachment %s (external URL in manifest.json)\n", attachment.UID)
				continue
			}
			// Display stable UIDs so user-provided filenames cannot inject Markdown.
			fmt.Fprintf(&index, "- [Attachment %s](%s)\n", attachment.UID, (&url.URL{Path: attachment.Path}).EscapedPath())
		}
		index.WriteString("\n")
	}
	data, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return errors.Wrap(err, "encode export manifest")
	}
	for _, file := range []struct{ name, content string }{
		{"README.md", exportReadme}, {"index.md", index.String()}, {"manifest.json", string(data) + "\n"},
	} {
		if err := writeExportFile(archive, file.name, now, strings.NewReader(file.content)); err != nil {
			return err
		}
	}
	return errors.Wrap(archive.Close(), "finish export archive")
}

func (s *FileServerService) exportMemo(ctx context.Context, archive *zip.Writer, memo *store.Memo, scope *store.MemoAccessScope) (*memoExportEntry, error) {
	entry := &memoExportEntry{
		UID: memo.UID, Path: fmt.Sprintf("memos/%d-%s.md", memo.ID, memo.UID),
		CreatedAt: time.Unix(memo.CreatedTs, 0).UTC(), UpdatedAt: time.Unix(memo.UpdatedTs, 0).UTC(),
		State: memo.RowStatus, Visibility: memo.Visibility, Pinned: memo.Pinned,
		Payload: json.RawMessage("{}"), Attachments: []memoExportAttachment{},
	}
	if memo.Payload != nil {
		payload, err := protojson.Marshal(memo.Payload)
		if err != nil {
			return nil, errors.Wrap(err, "encode memo metadata")
		}
		entry.Payload = payload
	}
	if err := writeExportFile(archive, entry.Path, entry.UpdatedAt, strings.NewReader(memo.Content)); err != nil {
		return nil, err
	}
	attachments, err := s.Store.ListAttachments(ctx, &store.FindAttachment{MemoID: &memo.ID, Access: scope})
	if err != nil {
		return nil, errors.Wrap(err, "list export attachments")
	}
	slices.SortFunc(attachments, func(a, b *store.Attachment) int { return strings.Compare(a.UID, b.UID) })
	for _, attachment := range attachments {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		// Load at most one database blob at a time, and recheck the binding and
		// audience in case an attachment moved while the archive was being built.
		attachment, err = s.Store.GetAttachment(ctx, &store.FindAttachment{
			ID: &attachment.ID, MemoID: &memo.ID, Access: scope, GetBlob: true,
		})
		if err != nil {
			return nil, errors.Wrap(err, "load export attachment")
		}
		if attachment == nil {
			return nil, errors.New("attachment removed or access changed during export")
		}
		attachmentEntry := memoExportAttachment{
			UID: attachment.UID, Filename: attachment.Filename, Type: attachment.Type, Size: attachment.Size,
			CreatedAt: time.Unix(attachment.CreatedTs, 0).UTC(), UpdatedAt: time.Unix(attachment.UpdatedTs, 0).UTC(),
		}
		if attachment.StorageType == storepb.AttachmentStorageType_EXTERNAL {
			if attachment.Reference == "" {
				return nil, errors.New("external attachment URL is missing")
			}
			attachmentEntry.ExternalURL = attachment.Reference
		} else {
			attachmentEntry.Path = fmt.Sprintf("attachments/%d-%s/%s", attachment.ID, attachment.UID, exportFilename(attachment.Filename))
			if err := s.exportAttachment(ctx, archive, attachment, attachmentEntry.Path); err != nil {
				return nil, err
			}
		}
		entry.Attachments = append(entry.Attachments, attachmentEntry)
	}
	return entry, nil
}

func (s *FileServerService) exportAttachment(ctx context.Context, archive *zip.Writer, attachment *store.Attachment, path string) error {
	reader, err := s.getAttachmentReader(ctx, attachment)
	if err != nil {
		return errors.Wrap(err, "open export attachment")
	}
	defer reader.Close()
	if attachment.Size < 0 {
		return errors.New("invalid attachment size")
	}
	counted := &exportReader{ctx: ctx, reader: reader}
	if err := writeExportFile(archive, path, time.Unix(attachment.UpdatedTs, 0).UTC(), counted); err != nil {
		return err
	}
	if counted.bytesRead != attachment.Size {
		return errors.New("attachment size changed during export")
	}
	return nil
}

func writeExportFile(archive *zip.Writer, name string, modified time.Time, reader io.Reader) error {
	header := &zip.FileHeader{Name: name, Method: zip.Deflate, Modified: modified}
	header.SetMode(0o600)
	writer, err := archive.CreateHeader(header)
	if err != nil {
		return errors.Wrap(err, "create export entry")
	}
	_, err = io.Copy(writer, reader)
	return errors.Wrap(err, "write export entry")
}

// exportFilename produces a single portable path segment. Prefixing also avoids
// Windows device names; the original filename is preserved in the manifest.
func exportFilename(filename string) string {
	name := strings.Map(func(r rune) rune {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || strings.ContainsRune("._-", r) {
			return r
		}
		return '_'
	}, filename)
	if len(name) > 200 {
		name = name[len(name)-200:]
		for !utf8.RuneStart(name[0]) {
			name = name[1:]
		}
	}
	return "file-" + strings.TrimRight(name, ".")
}

type exportReader struct {
	ctx       context.Context
	reader    io.Reader
	bytesRead int64
}

func (r *exportReader) Read(p []byte) (int, error) {
	if err := r.ctx.Err(); err != nil {
		return 0, err
	}
	n, err := r.reader.Read(p)
	r.bytesRead += int64(n)
	return n, err
}
