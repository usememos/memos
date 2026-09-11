package fileserver

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/usememos/memos/internal/testutil/fakes3"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/server/auth"
	"github.com/usememos/memos/store"
)

func TestMemoExportArchive(t *testing.T) {
	ctx := context.Background()
	_, fs, stores, cleanup := newShareAttachmentTestServices(ctx, t)
	defer cleanup()
	user, err := stores.CreateUser(ctx, &store.User{Username: "exporter", Role: store.RoleUser})
	require.NoError(t, err)
	other, err := stores.CreateUser(ctx, &store.User{Username: "other", Role: store.RoleAdmin})
	require.NoError(t, err)
	created := time.Date(2020, 2, 3, 4, 5, 6, 0, time.UTC)
	content := "# Original\r\n\r\n#旅行/nested\n![inline](/file/attachments/photo/image.png)\n```\nunchanged\n```"
	memo, err := stores.CreateMemo(ctx, &store.Memo{
		UID: "my-note", CreatorID: user.ID, Content: content, Visibility: store.Private,
		CreatedTs: created.Unix(), UpdatedTs: created.Add(time.Hour).Unix(),
		Payload: &storepb.MemoPayload{Tags: []string{"旅行/nested"}, Location: &storepb.MemoPayload_Location{
			Placeholder: "Vienna", Latitude: 48.2, Longitude: 16.3,
		}},
	})
	require.NoError(t, err)
	archived := store.Archived
	pinned := true
	err = stores.UpdateMemo(ctx, &store.UpdateMemo{ID: memo.ID, RowStatus: &archived, Pinned: &pinned})
	require.NoError(t, err)
	for _, visibility := range []store.Visibility{store.Private, store.Public, store.Protected} {
		_, err := stores.CreateMemo(ctx, &store.Memo{UID: "other-" + strings.ToLower(string(visibility)), CreatorID: other.ID, Content: "other-user-secret", Visibility: visibility})
		require.NoError(t, err)
	}
	// More than the default attachment and API memo page sizes must survive.
	for i := range 105 {
		_, err := stores.CreateMemo(ctx, &store.Memo{UID: fmt.Sprintf("memo-%03d", i), CreatorID: user.ID, Content: fmt.Sprint(i), Visibility: store.Private})
		require.NoError(t, err)
	}
	for i := range 12 {
		_, err := stores.CreateAttachment(ctx, &store.Attachment{
			UID: fmt.Sprintf("attachment-%02d", i), CreatorID: user.ID, MemoID: &memo.ID,
			Filename: "../CON/照片 [same].txt", Type: "text/plain", Blob: []byte("database bytes"), Size: 14,
			StorageType: storepb.AttachmentStorageType_ATTACHMENT_STORAGE_TYPE_UNSPECIFIED,
		})
		require.NoError(t, err)
	}
	_, err = stores.CreateAttachment(ctx, &store.Attachment{UID: "unlinked", CreatorID: user.ID, Filename: "unlinked-secret", Blob: []byte("unlinked bytes"), Size: 14})
	require.NoError(t, err)

	rec := requestMemoExport(t, fs, user)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	require.Equal(t, "private, no-store", rec.Header().Get("Cache-Control"))
	require.Equal(t, "application/zip", rec.Header().Get("Content-Type"))
	require.Contains(t, rec.Header().Get("Content-Disposition"), "attachment; filename=\"memos-export-")
	require.Equal(t, fmt.Sprint(rec.Body.Len()), rec.Header().Get("Content-Length"))
	files, manifest := readMemoExport(t, rec.Body.Bytes())
	require.Len(t, manifest.Memos, 106)
	require.Equal(t, content, files[fmt.Sprintf("memos/%d-my-note.md", memo.ID)])
	var exported memoExportEntry
	for _, item := range manifest.Memos {
		if item.UID == memo.UID {
			exported = item
		}
	}
	require.Equal(t, created, exported.CreatedAt)
	require.Equal(t, created.Add(time.Hour), exported.UpdatedAt)
	require.Equal(t, store.Archived, exported.State)
	require.Equal(t, store.Private, exported.Visibility)
	require.True(t, exported.Pinned)
	require.JSONEq(t, `{"tags":["旅行/nested"],"location":{"placeholder":"Vienna","latitude":48.2,"longitude":16.3}}`, string(exported.Payload))
	require.Len(t, exported.Attachments, 12)
	for _, attachment := range exported.Attachments {
		require.Equal(t, "database bytes", files[attachment.Path])
		require.Equal(t, "../CON/照片 [same].txt", attachment.Filename)
		require.Contains(t, files["index.md"], attachment.UID)
	}
	for name, data := range files {
		require.NotContains(t, name, "unlinked")
		require.NotContains(t, data, "other-user-secret")
		require.NotContains(t, data, "unlinked bytes")
	}
}

func TestMemoExportLocalAndS3Attachments(t *testing.T) {
	ctx := context.Background()
	svc, fs, stores, cleanup := newShareAttachmentTestServices(ctx, t)
	defer cleanup()
	user, err := stores.CreateUser(ctx, &store.User{Username: "storage-exporter", Role: store.RoleUser})
	require.NoError(t, err)
	memo, err := stores.CreateMemo(ctx, &store.Memo{UID: "storage-note", CreatorID: user.ID, Content: "storage", Visibility: store.Private})
	require.NoError(t, err)
	binary := []byte{0, 255, 1, 254, 0, 128}
	require.NoError(t, os.WriteFile(filepath.Join(fs.Profile.Data, "local.bin"), binary, 0o600))
	_, err = stores.CreateAttachment(ctx, &store.Attachment{
		UID: "local", CreatorID: user.ID, MemoID: &memo.ID, Filename: "same.bin", Type: "application/octet-stream",
		Size: int64(len(binary)), StorageType: storepb.AttachmentStorageType_LOCAL, Reference: "local.bin",
	})
	require.NoError(t, err)
	fake := fakes3.New(t, "export-attachments")
	_, err = stores.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_STORAGE,
		Value: &storepb.InstanceSetting_StorageSetting{StorageSetting: &storepb.InstanceStorageSetting{
			FilepathTemplate: "files/{uuid}_{filename}", UploadSizeLimitMb: 30,
			Storages: []*storepb.Storage{{Id: "export-s3", Name: "Export S3", Type: storepb.StorageType_STORAGE_TYPE_S3,
				Config: &storepb.Storage_S3Config{S3Config: fake.Config("export-attachments")}}},
			DefaultStorageId: "export-s3",
		}},
	})
	require.NoError(t, err)
	creatorCtx := context.WithValue(ctx, auth.UserIDContextKey, user.ID)
	_, err = svc.CreateAttachment(creatorCtx, &v1pb.CreateAttachmentRequest{Attachment: &v1pb.Attachment{
		Filename: "same.bin", Type: "application/octet-stream", Content: binary, Memo: ptr("memos/" + memo.UID),
	}})
	require.NoError(t, err)
	rec := requestMemoExport(t, fs, user)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	files, manifest := readMemoExport(t, rec.Body.Bytes())
	require.Len(t, manifest.Memos[0].Attachments, 2)
	for _, attachment := range manifest.Memos[0].Attachments {
		require.Equal(t, binary, []byte(files[attachment.Path]))
	}
	require.NotContains(t, files["manifest.json"], "s3Config")
	require.NotContains(t, files["manifest.json"], "accessKey")
}

func TestMemoExportCommentsExternalLinksAndCaseCollisions(t *testing.T) {
	ctx := context.Background()
	_, fs, stores, cleanup := newShareAttachmentTestServices(ctx, t)
	defer cleanup()
	user, err := stores.CreateUser(ctx, &store.User{Username: "export-comments", Role: store.RoleAdmin})
	require.NoError(t, err)
	other, err := stores.CreateUser(ctx, &store.User{Username: "other-comments", Role: store.RoleUser})
	require.NoError(t, err)
	parent, err := stores.CreateMemo(ctx, &store.Memo{UID: "Parent", CreatorID: user.ID, Content: "parent", Visibility: store.Private})
	require.NoError(t, err)
	_, err = stores.CreateMemo(ctx, &store.Memo{UID: "parent", CreatorID: user.ID, Content: "case-sensitive UID", Visibility: store.Private})
	require.NoError(t, err)
	foreign, err := stores.CreateMemo(ctx, &store.Memo{UID: "foreign-parent", CreatorID: other.ID, Content: "public context", Visibility: store.Public})
	require.NoError(t, err)
	for _, contextMemo := range []*store.Memo{parent, foreign} {
		_, err = stores.CreateMemoComment(ctx, &store.Memo{UID: "reply-" + contextMemo.UID, CreatorID: user.ID, Content: "own comment", Visibility: store.Private}, contextMemo.ID, user.ID)
		require.NoError(t, err)
	}
	_, err = stores.CreateAttachment(ctx, &store.Attachment{UID: "external-link", CreatorID: user.ID, MemoID: &parent.ID, Filename: "remote.pdf", Type: "application/pdf", StorageType: storepb.AttachmentStorageType_EXTERNAL, Reference: "https://example.invalid/original.pdf"})
	require.NoError(t, err)
	rec := requestMemoExport(t, fs, user)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	files, manifest := readMemoExport(t, rec.Body.Bytes())
	require.Len(t, manifest.Memos, 4)
	byUID := map[string]memoExportEntry{}
	for _, memo := range manifest.Memos {
		byUID[memo.UID] = memo
	}
	require.True(t, byUID["reply-Parent"].Comment)
	require.Equal(t, "Parent", byUID["reply-Parent"].ParentUID)
	require.True(t, byUID["reply-foreign-parent"].Comment)
	require.Empty(t, byUID["reply-foreign-parent"].ParentUID, "only exported parents may be identified")
	require.NotContains(t, byUID, "foreign-parent", "instance admin must not export other authors' memos")
	attachment := byUID["Parent"].Attachments[0]
	require.Equal(t, "https://example.invalid/original.pdf", attachment.ExternalURL)
	require.Empty(t, attachment.Path, "external URLs must not become empty local files")
	require.NotContains(t, files, "attachments/external-link/remote.pdf")
	lowerPaths := map[string]bool{}
	for name := range files {
		require.False(t, lowerPaths[strings.ToLower(name)], "paths must also be unique on case-insensitive filesystems")
		lowerPaths[strings.ToLower(name)] = true
	}
}

func TestMemoExportAuthentication(t *testing.T) {
	ctx := context.Background()
	_, fs, stores, cleanup := newShareAttachmentTestServices(ctx, t)
	defer cleanup()
	user, err := stores.CreateUser(ctx, &store.User{Username: "export-auth", Role: store.RoleUser})
	require.NoError(t, err)
	e := echo.New()
	fs.RegisterRoutes(e)
	for _, header := range []string{"", "Bearer invalid"} {
		req := httptest.NewRequest(http.MethodGet, "/file/memos/export?user_id=1&share_token=anything", nil)
		req.Header.Set("Authorization", header)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)
		require.Equal(t, http.StatusUnauthorized, rec.Code)
		require.Equal(t, "private, no-store", rec.Header().Get("Cache-Control"))
	}
	// A valid browser refresh cookie is sufficient; no token belongs in the URL.
	tokenID := "export-refresh"
	token, expires, err := auth.GenerateRefreshToken(user.ID, tokenID, []byte("test-secret"))
	require.NoError(t, err)
	require.NoError(t, stores.AddUserRefreshToken(ctx, user.ID, &storepb.RefreshTokensUserSetting_RefreshToken{TokenId: tokenID, ExpiresAt: timestamppb.New(expires)}))
	req := httptest.NewRequest(http.MethodGet, "/file/memos/export", nil)
	req.AddCookie(&http.Cookie{Name: auth.RefreshTokenCookieName, Value: token})
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)
	_, manifest := readMemoExport(t, rec.Body.Bytes())
	require.Empty(t, manifest.Memos)
}

func TestMemoExportFailureAndConcurrency(t *testing.T) {
	ctx := context.Background()
	_, fs, stores, cleanup := newShareAttachmentTestServices(ctx, t)
	defer cleanup()
	user, err := stores.CreateUser(ctx, &store.User{Username: "export-errors", Role: store.RoleUser})
	require.NoError(t, err)
	memo, err := stores.CreateMemo(ctx, &store.Memo{UID: "missing-file", CreatorID: user.ID, Content: "note", Visibility: store.Private})
	require.NoError(t, err)
	_, err = stores.CreateAttachment(ctx, &store.Attachment{UID: "missing", CreatorID: user.ID, MemoID: &memo.ID, Filename: "missing", Reference: "does-not-exist", StorageType: storepb.AttachmentStorageType_LOCAL})
	require.NoError(t, err)
	tmp := t.TempDir()
	t.Setenv("TMPDIR", tmp)
	rec := requestMemoExport(t, fs, user)
	require.Equal(t, http.StatusInternalServerError, rec.Code)
	require.NotContains(t, rec.Header().Get("Content-Type"), "zip")
	require.Empty(t, rec.Header().Get("Content-Disposition"))
	entries, err := os.ReadDir(tmp)
	require.NoError(t, err)
	require.Empty(t, entries, "failed exports must remove temporary archives")
	// A readable but truncated file is also an incomplete export, not success.
	require.NoError(t, os.WriteFile(filepath.Join(fs.Profile.Data, "does-not-exist"), []byte("unexpected bytes"), 0o600))
	rec = requestMemoExport(t, fs, user)
	require.Equal(t, http.StatusInternalServerError, rec.Code)
	// Repairing the attachment must allow the next attempt to complete.
	require.NoError(t, os.WriteFile(filepath.Join(fs.Profile.Data, "does-not-exist"), nil, 0o600))
	rec = requestMemoExport(t, fs, user)
	require.Equal(t, http.StatusOK, rec.Code)
	entries, err = os.ReadDir(tmp)
	require.NoError(t, err)
	require.Empty(t, entries, "successful exports must also remove temporary archives")
	require.True(t, fs.exportSemaphore.TryAcquire(1), "failure must release the export slot")
	rec = requestMemoExport(t, fs, user)
	require.Equal(t, http.StatusTooManyRequests, rec.Code)
	require.Equal(t, "30", rec.Header().Get("Retry-After"))
	fs.exportSemaphore.Release(1)
	canceled, cancel := context.WithCancel(ctx)
	cancel()
	require.Error(t, fs.writeMemoExport(canceled, io.Discard, user.ID, time.Now()))
	reader := &exportReader{ctx: canceled, reader: strings.NewReader("bytes")}
	_, err = reader.Read(make([]byte, 5))
	require.ErrorIs(t, err, context.Canceled)
}

func TestMemoExportSpaceMembership(t *testing.T) {
	ctx := context.Background()
	_, fs, stores, cleanup := newShareAttachmentTestServices(ctx, t)
	defer cleanup()
	user, err := stores.CreateUser(ctx, &store.User{Username: "export-member", Role: store.RoleUser})
	require.NoError(t, err)
	admin, err := stores.CreateUser(ctx, &store.User{Username: "space-admin", Role: store.RoleUser})
	require.NoError(t, err)
	space, err := stores.CreateSpace(ctx, &store.Space{UID: "export-space", Title: "Space"}, admin.ID)
	require.NoError(t, err)
	_, err = stores.CreateSpaceInvitation(ctx, &store.SpaceInvitation{SpaceID: space.ID, UserID: user.ID, Role: store.SpaceMemberRoleUser}, admin.ID)
	require.NoError(t, err)
	_, err = stores.AcceptSpaceInvitation(ctx, &store.AcceptSpaceInvitation{SpaceID: space.ID, UserID: user.ID}, user.ID)
	require.NoError(t, err)
	_, err = stores.CreateMemo(ctx, &store.Memo{UID: "space-note", CreatorID: user.ID, Content: "space secret", Visibility: store.SpaceAudience, SpaceID: &space.ID})
	require.NoError(t, err)
	rec := requestMemoExport(t, fs, user)
	require.Equal(t, http.StatusOK, rec.Code)
	_, manifest := readMemoExport(t, rec.Body.Bytes())
	require.Len(t, manifest.Memos, 1)
	require.NoError(t, stores.DeleteSpaceMember(ctx, &store.DeleteSpaceMember{SpaceID: space.ID, UserID: user.ID}, admin.ID))
	rec = requestMemoExport(t, fs, user)
	require.Equal(t, http.StatusOK, rec.Code)
	files, manifest := readMemoExport(t, rec.Body.Bytes())
	require.Empty(t, manifest.Memos)
	require.Len(t, files, 3)
}

func TestExportFilename(t *testing.T) {
	for _, filename := range []string{"", ".", "..", "../../escape", `C:\\..\\escape`, "CON", "NUL.txt", "photo.png.", "名字.jpg", "bad\x00\r\nname", strings.Repeat("z", 500), strings.Repeat("名", 150)} {
		name := exportFilename(filename)
		require.Equal(t, path.Base(name), name)
		require.NotContains(t, name, `\`)
		require.NotContains(t, name, "\x00")
		require.False(t, strings.HasSuffix(name, "."))
		require.LessOrEqual(t, len(name), 205)
		require.True(t, strings.HasPrefix(name, "file-"))
	}
}

func requestMemoExport(t *testing.T, fs *FileServerService, user *store.User) *httptest.ResponseRecorder {
	t.Helper()
	token, _, err := auth.GenerateAccessTokenV2(user.ID, user.Username, string(user.Role), string(user.RowStatus), []byte("test-secret"))
	require.NoError(t, err)
	req := httptest.NewRequest(http.MethodGet, "/file/memos/export", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	e := echo.New()
	fs.RegisterRoutes(e)
	e.ServeHTTP(rec, req)
	return rec
}

func readMemoExport(t *testing.T, data []byte) (map[string]string, memoExportManifest) {
	t.Helper()
	archive, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	require.NoError(t, err)
	files := map[string]string{}
	for _, file := range archive.File {
		require.True(t, filepath.IsLocal(file.Name), file.Name)
		require.Equal(t, path.Clean(file.Name), file.Name)
		require.Equal(t, os.FileMode(0o600), file.Mode().Perm())
		require.NotContains(t, files, file.Name, "duplicate archive entry")
		reader, err := file.Open()
		require.NoError(t, err)
		content, err := io.ReadAll(reader)
		require.NoError(t, err)
		require.NoError(t, reader.Close())
		files[file.Name] = string(content)
	}
	var manifest memoExportManifest
	require.NoError(t, json.Unmarshal([]byte(files["manifest.json"]), &manifest))
	require.Equal(t, 1, manifest.Version)
	return files, manifest
}

func ptr[T any](value T) *T { return &value }
