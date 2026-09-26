package test

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/fieldmaskpb"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/usememos/memos/core/memoexport"
	"github.com/usememos/memos/internal/ratelimit"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	apiv1 "github.com/usememos/memos/server/api/v1"
	"github.com/usememos/memos/store"
)

// archiveFixture is the state one user builds before exporting.
type archiveFixture struct {
	user        *store.User
	userCtx     context.Context
	photo       []byte
	parent      *v1pb.Memo
	archived    *v1pb.Memo
	allMemoUIDs []string
}

// archiveParentContent links the referenced memo inline, which is how REFERENCE
// relations are derived now.
const archiveParentContent = "# Whiteboard\n\nSee the photo. No trailing newline [Memos](/memos/referenced1)"

func buildArchiveFixture(t *testing.T, ts *TestService, username string) *archiveFixture {
	t.Helper()
	ctx := context.Background()
	user, err := ts.CreateRegularUser(ctx, username)
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)
	space, err := ts.Store.CreateSpace(ctx, &store.Space{UID: "team-notes", Title: "Team Notes"}, user.ID)
	require.NoError(t, err)

	photo := []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3, 4}
	attachment, err := ts.Service.CreateAttachment(userCtx, &v1pb.CreateAttachmentRequest{
		AttachmentId: "photo0001",
		Attachment:   &v1pb.Attachment{Filename: "white board.png", Type: "image/png", Content: photo},
	})
	require.NoError(t, err)

	_, err = ts.Service.CreateMemo(userCtx, &v1pb.CreateMemoRequest{
		MemoId: "referenced1",
		Memo: &v1pb.Memo{
			Content:    "Referenced memo #work",
			Visibility: v1pb.Visibility_PUBLIC,
			CreateTime: timestamppb.New(mustTime(t, "2026-03-01T09:00:00Z")),
			UpdateTime: timestamppb.New(mustTime(t, "2026-03-01T09:30:00Z")),
		},
	})
	require.NoError(t, err)

	parent, err := ts.Service.CreateMemo(userCtx, &v1pb.CreateMemoRequest{
		MemoId: "parent00001",
		Memo: &v1pb.Memo{
			Content:     archiveParentContent,
			Visibility:  v1pb.Visibility_PRIVATE,
			Pinned:      true,
			CreateTime:  timestamppb.New(mustTime(t, "2026-03-02T14:05:11Z")),
			UpdateTime:  timestamppb.New(mustTime(t, "2026-03-02T14:20:47Z")),
			Location:    &v1pb.Location{Placeholder: "Office", Latitude: 52.52, Longitude: 13.405},
			Attachments: []*v1pb.Attachment{{Name: attachment.Name}},
		},
	})
	require.NoError(t, err)
	// Creation ignores pinned; pin the memo the way the client does.
	parent, err = ts.Service.UpdateMemo(userCtx, &v1pb.UpdateMemoRequest{
		Memo:       &v1pb.Memo{Name: parent.Name, Pinned: true, UpdateTime: timestamppb.New(mustTime(t, "2026-03-02T14:20:47Z"))},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"pinned", "update_time"}},
	})
	require.NoError(t, err)

	_, err = ts.Service.CreateMemoComment(userCtx, &v1pb.CreateMemoCommentRequest{
		Name:      parent.Name,
		CommentId: "comment0001",
		Comment: &v1pb.Memo{
			Content:    "A comment",
			Visibility: v1pb.Visibility_PRIVATE,
			CreateTime: timestamppb.New(mustTime(t, "2026-02-28T08:00:00Z")),
		},
	})
	require.NoError(t, err)

	spaceName := "spaces/" + space.UID
	_, err = ts.Service.CreateMemo(userCtx, &v1pb.CreateMemoRequest{
		MemoId: "spacememo01",
		Memo:   &v1pb.Memo{Content: "Shared with the team", Visibility: v1pb.Visibility_SPACE, Space: &spaceName},
	})
	require.NoError(t, err)

	archived, err := ts.Service.CreateMemo(userCtx, &v1pb.CreateMemoRequest{
		MemoId: "archived001",
		Memo:   &v1pb.Memo{Content: "Old note", Visibility: v1pb.Visibility_PROTECTED},
	})
	require.NoError(t, err)
	archived, err = ts.Service.UpdateMemo(userCtx, &v1pb.UpdateMemoRequest{
		Memo:       &v1pb.Memo{Name: archived.Name, State: v1pb.State_ARCHIVED},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"state"}},
	})
	require.NoError(t, err)

	return &archiveFixture{
		user: user, userCtx: userCtx, photo: photo, parent: parent, archived: archived,
		allMemoUIDs: []string{"referenced1", "parent00001", "comment0001", "spacememo01", "archived001"},
	}
}

func mustTime(t *testing.T, value string) time.Time {
	t.Helper()
	parsed, err := time.Parse(time.RFC3339, value)
	require.NoError(t, err)
	return parsed
}

func readArchive(t *testing.T, data []byte) *memoexport.File {
	t.Helper()
	archive, err := memoexport.Read(bytes.NewReader(data), int64(len(data)))
	require.NoError(t, err)
	return archive
}

func exportArchive(t *testing.T, ts *TestService, user *store.User) *memoexport.File {
	t.Helper()
	return readArchive(t, exportArchiveBytes(t, ts, user))
}

func exportArchiveBytes(t *testing.T, ts *TestService, user *store.User) []byte {
	t.Helper()
	var buffer bytes.Buffer
	require.NoError(t, ts.Service.WriteMemoExport(context.Background(), user, &buffer))
	return buffer.Bytes()
}

func archiveMemosByUID(archive *memoexport.File) map[string]*memoexport.Memo {
	byUID := make(map[string]*memoexport.Memo, len(archive.Memos))
	for _, memo := range archive.Memos {
		byUID[memo.UID] = memo
	}
	return byUID
}

func TestWriteMemoExport(t *testing.T) {
	ts := NewTestService(t)
	defer ts.Cleanup()
	fixture := buildArchiveFixture(t, ts, "exporter")

	// Another user's memo must never appear, even when it comments on ours.
	other, err := ts.CreateRegularUser(context.Background(), "someone-else")
	require.NoError(t, err)
	_, err = ts.Service.CreateMemo(ts.CreateUserContext(context.Background(), other.ID), &v1pb.CreateMemoRequest{
		Memo: &v1pb.Memo{Content: "not yours", Visibility: v1pb.Visibility_PUBLIC},
	})
	require.NoError(t, err)

	archive := exportArchive(t, ts, fixture.user)
	require.Equal(t, memoexport.ScopeKindUser, archive.Manifest.Scope.Kind)
	require.Equal(t, "exporter", archive.Manifest.Scope.User.Username)
	require.Equal(t, &memoexport.Counts{Memos: 5, Attachments: 1}, archive.Manifest.Counts)
	require.Empty(t, archive.Warnings)
	require.Len(t, archive.Memos, 5)

	byUID := archiveMemosByUID(archive)
	for _, uid := range fixture.allMemoUIDs {
		require.Contains(t, byUID, uid)
		require.Equal(t, "exporter", byUID[uid].Creator)
	}

	parent := byUID["parent00001"]
	require.Equal(t, "2026-03-02T14:05:11Z", parent.CreateTime)
	require.Equal(t, "2026-03-02T14:20:47Z", parent.UpdateTime)
	require.Equal(t, "NORMAL", parent.State)
	require.Equal(t, "PRIVATE", parent.Visibility)
	require.True(t, parent.Pinned)
	require.Equal(t, &memoexport.Location{Placeholder: "Office", Latitude: 52.52, Longitude: 13.405}, parent.Location)
	require.Equal(t, []memoexport.Relation{{Type: "REFERENCE", Memo: "referenced1"}}, parent.Relations)
	require.Empty(t, parent.Parent)
	content, err := archive.Content(parent)
	require.NoError(t, err)
	require.Equal(t, archiveParentContent, string(content))
	require.Len(t, parent.Attachments, 1)
	entry := parent.Attachments[0]
	require.Equal(t, "photo0001", entry.UID)
	require.Equal(t, "white board.png", entry.Filename)
	require.Equal(t, "image/png", entry.Type)
	require.Equal(t, "attachments/photo0001/white board.png", entry.Path)
	digest := sha256.Sum256(fixture.photo)
	require.Equal(t, hex.EncodeToString(digest[:]), entry.SHA256)
	require.Equal(t, int64(len(fixture.photo)), entry.Size)
	photoBytes, err := archive.ReadAttachment(&entry)
	require.NoError(t, err)
	require.Equal(t, fixture.photo, photoBytes)

	comment := byUID["comment0001"]
	require.Equal(t, "parent00001", comment.Parent)
	require.Equal(t, "2026-02-28T08:00:00Z", comment.CreateTime)
	// The comment is older than its parent but must still follow it.
	require.Less(t, indexOfMemo(archive, "parent00001"), indexOfMemo(archive, "comment0001"))

	require.Equal(t, &memoexport.Space{UID: "team-notes", Title: "Team Notes"}, byUID["spacememo01"].Space)
	require.Equal(t, "SPACE", byUID["spacememo01"].Visibility)
	require.Equal(t, "ARCHIVED", byUID["archived001"].State)
	require.Equal(t, "PROTECTED", byUID["archived001"].Visibility)
	require.Equal(t, []string{"work"}, byUID["referenced1"].Tags)
}

func indexOfMemo(archive *memoexport.File, uid string) int {
	for index, memo := range archive.Memos {
		if memo.UID == uid {
			return index
		}
	}
	return -1
}

func TestImportMemoExportIntoAnotherAccount(t *testing.T) {
	ts := NewTestService(t)
	defer ts.Cleanup()
	fixture := buildArchiveFixture(t, ts, "exporter")
	archive := exportArchive(t, ts, fixture.user)

	ctx := context.Background()
	importer, err := ts.CreateRegularUser(ctx, "importer")
	require.NoError(t, err)
	importerCtx := ts.CreateUserContext(ctx, importer.ID)

	report, err := ts.Service.ImportMemoExport(importerCtx, importer, archive, v1pb.ImportMemosRequest_SKIP)
	require.NoError(t, err)
	require.Equal(t, int32(5), report.Created)
	require.Zero(t, report.Updated)
	require.Zero(t, report.Skipped)
	require.Zero(t, report.Failed, "%v", report.Failures)
	// The space memo cannot land in a space the importer does not belong to.
	require.Len(t, report.Warnings, 2)
	require.Contains(t, report.Warnings[0].Message, "space")
	require.Contains(t, report.Warnings[1].Message, "SPACE visibility")

	memos, err := ts.Store.ListMemos(ctx, &store.FindMemo{CreatorID: &importer.ID})
	require.NoError(t, err)
	require.Len(t, memos, 5)
	byContent := make(map[string]*store.Memo, len(memos))
	for _, memo := range memos {
		byContent[memo.Content] = memo
		// The exporter still owns every original UID, so each import got a fresh one.
		require.NotContains(t, fixture.allMemoUIDs, memo.UID)
		require.Equal(t, importer.ID, memo.CreatorID)
	}

	parent := byContent[archiveParentContent]
	require.NotNil(t, parent)
	require.True(t, parent.Pinned)
	require.Equal(t, store.Private, parent.Visibility)
	require.Equal(t, mustTime(t, "2026-03-02T14:05:11Z").Unix(), parent.CreatedTs)
	require.Equal(t, mustTime(t, "2026-03-02T14:20:47Z").Unix(), parent.UpdatedTs)
	require.Equal(t, "Office", parent.Payload.GetLocation().GetPlaceholder())
	require.InDelta(t, 52.52, parent.Payload.GetLocation().GetLatitude(), 0.0001)

	comment := byContent["A comment"]
	require.NotNil(t, comment)
	require.NotNil(t, comment.ParentUID)
	require.Equal(t, parent.UID, *comment.ParentUID)

	referenced := byContent["Referenced memo #work"]
	require.NotNil(t, referenced)
	require.Equal(t, []string{"work"}, referenced.Payload.GetTags())
	relations, err := ts.Store.ListMemoRelations(ctx, &store.FindMemoRelation{MemoID: &parent.ID})
	require.NoError(t, err)
	var references []*store.MemoRelation
	for _, relation := range relations {
		if relation.Type == store.MemoRelationReference {
			references = append(references, relation)
		}
	}
	require.Len(t, references, 1)
	require.Equal(t, referenced.ID, references[0].RelatedMemoID)

	spaceMemo := byContent["Shared with the team"]
	require.NotNil(t, spaceMemo)
	require.Nil(t, spaceMemo.SpaceID)
	require.Equal(t, store.Private, spaceMemo.Visibility)

	archived := byContent["Old note"]
	require.NotNil(t, archived)
	require.Equal(t, store.Archived, archived.RowStatus)
	require.Equal(t, store.Protected, archived.Visibility)

	attachments, err := ts.Store.ListAttachments(ctx, &store.FindAttachment{MemoID: &parent.ID})
	require.NoError(t, err)
	require.Len(t, attachments, 1)
	require.Equal(t, "white board.png", attachments[0].Filename)
	require.Equal(t, importer.ID, attachments[0].CreatorID)
	require.NotEqual(t, "photo0001", attachments[0].UID, "the exporter still owns the original attachment UID")
	blob, err := ts.Service.GetAttachmentBlob(ctx, attachments[0])
	require.NoError(t, err)
	require.Equal(t, fixture.photo, blob)
}

func TestPlanMemoImport(t *testing.T) {
	ts := NewTestService(t)
	defer ts.Cleanup()
	fixture := buildArchiveFixture(t, ts, "owner")
	archive := exportArchive(t, ts, fixture.user)
	ctx := context.Background()

	// Delete one memo so its UID is free, and let another account take one.
	_, err := ts.Service.DeleteMemo(fixture.userCtx, &v1pb.DeleteMemoRequest{Name: fixture.archived.Name})
	require.NoError(t, err)
	other, err := ts.CreateRegularUser(ctx, "other")
	require.NoError(t, err)
	otherCtx := ts.CreateUserContext(ctx, other.ID)
	stranger, err := ts.CreateRegularUser(ctx, "stranger")
	require.NoError(t, err)
	_, err = ts.Service.CreateMemo(ts.CreateUserContext(ctx, stranger.ID), &v1pb.CreateMemoRequest{
		MemoId: "archived001", Memo: &v1pb.Memo{Content: "took the uid", Visibility: v1pb.Visibility_PRIVATE},
	})
	require.NoError(t, err)

	plan, err := ts.Service.PlanMemoImport(fixture.userCtx, fixture.user, archive)
	require.NoError(t, err)
	require.Equal(t, int32(5), plan.Memos)
	require.Equal(t, int32(4), plan.Existing)
	require.Equal(t, int32(1), plan.Renamed)
	require.Zero(t, plan.New)

	plan, err = ts.Service.PlanMemoImport(otherCtx, other, archive)
	require.NoError(t, err)
	require.Zero(t, plan.Existing)
	require.Equal(t, int32(5), plan.Renamed)
	require.Zero(t, plan.New)
}

func TestImportMemoExportConflictPolicies(t *testing.T) {
	ts := NewTestService(t)
	defer ts.Cleanup()
	fixture := buildArchiveFixture(t, ts, "owner")
	data := exportArchiveBytes(t, ts, fixture.user)
	ctx := context.Background()
	openArchive := func() *memoexport.File { return readArchive(t, data) }
	countOwn := func() int {
		memos, err := ts.Store.ListMemos(ctx, &store.FindMemo{CreatorID: &fixture.user.ID})
		require.NoError(t, err)
		return len(memos)
	}

	t.Run("skip is idempotent", func(t *testing.T) {
		report, err := ts.Service.ImportMemoExport(fixture.userCtx, fixture.user, openArchive(), v1pb.ImportMemosRequest_SKIP)
		require.NoError(t, err)
		require.Equal(t, int32(5), report.Skipped)
		require.Zero(t, report.Created+report.Updated+report.Failed)
		require.Equal(t, 5, countOwn())
	})

	t.Run("replace updates in place", func(t *testing.T) {
		// Change the memo on the instance, then bring the archive back.
		_, err := ts.Service.UpdateMemo(fixture.userCtx, &v1pb.UpdateMemoRequest{
			Memo:       &v1pb.Memo{Name: fixture.parent.Name, Content: "edited after export", Pinned: false},
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"content", "pinned"}},
		})
		require.NoError(t, err)

		report, err := ts.Service.ImportMemoExport(fixture.userCtx, fixture.user, openArchive(), v1pb.ImportMemosRequest_REPLACE)
		require.NoError(t, err)
		require.Equal(t, int32(5), report.Updated, "%v", report.Failures)
		require.Zero(t, report.Failed)
		require.Equal(t, 5, countOwn())

		uid := "parent00001"
		restored, err := ts.Store.GetMemo(ctx, &store.FindMemo{UID: &uid})
		require.NoError(t, err)
		require.Equal(t, archiveParentContent, restored.Content)
		require.True(t, restored.Pinned)
		require.Equal(t, mustTime(t, "2026-03-02T14:20:47Z").Unix(), restored.UpdatedTs)
		attachments, err := ts.Store.ListAttachments(ctx, &store.FindAttachment{MemoID: &restored.ID})
		require.NoError(t, err)
		require.Len(t, attachments, 1, "the bound attachment is kept, not duplicated")
		require.Equal(t, "photo0001", attachments[0].UID)
	})

	t.Run("duplicate creates copies", func(t *testing.T) {
		report, err := ts.Service.ImportMemoExport(fixture.userCtx, fixture.user, openArchive(), v1pb.ImportMemosRequest_DUPLICATE)
		require.NoError(t, err)
		require.Equal(t, int32(5), report.Created, "%v", report.Failures)
		require.Zero(t, report.Failed)
		require.Equal(t, 10, countOwn())

		memos, err := ts.Store.ListMemos(ctx, &store.FindMemo{CreatorID: &fixture.user.ID})
		require.NoError(t, err)
		var copies []*store.Memo
		for _, memo := range memos {
			if memo.Content == "A comment" && memo.UID != "comment0001" {
				copies = append(copies, memo)
			}
		}
		require.Len(t, copies, 1)
		require.NotNil(t, copies[0].ParentUID)
		require.NotEqual(t, "parent00001", *copies[0].ParentUID, "the copied comment threads under the copied parent")
	})
}

func userName(user *store.User) string {
	return apiv1.BuildUserName(user.Username)
}

func TestExportMemos(t *testing.T) {
	ts := NewTestService(t)
	defer ts.Cleanup()
	fixture := buildArchiveFixture(t, ts, "owner")
	ctx := context.Background()

	body, err := ts.Service.ExportMemos(fixture.userCtx, &v1pb.ExportMemosRequest{Name: userName(fixture.user)})
	require.NoError(t, err)
	require.Equal(t, "application/vnd.usememos.export+zip", body.ContentType)
	exported := readArchive(t, body.Data)
	require.Equal(t, "memos-export", exported.Manifest.Format)
	require.Len(t, exported.Memos, 5)

	other, err := ts.CreateRegularUser(ctx, "other")
	require.NoError(t, err)
	_, err = ts.Service.ExportMemos(ts.CreateUserContext(ctx, other.ID), &v1pb.ExportMemosRequest{Name: userName(fixture.user)})
	require.Equal(t, codes.PermissionDenied, status.Code(err))
	_, err = ts.Service.ExportMemos(ctx, &v1pb.ExportMemosRequest{Name: userName(fixture.user)})
	require.Equal(t, codes.Unauthenticated, status.Code(err))
}

func TestImportMemosExportFormats(t *testing.T) {
	for _, filename := range []string{"golden.zip", "legacy.zip"} {
		t.Run(filename, func(t *testing.T) {
			ts := NewTestService(t)
			defer ts.Cleanup()
			t.Cleanup(ts.Service.CloseUploads)
			user, err := ts.CreateRegularUser(context.Background(), "importer")
			require.NoError(t, err)
			ctx := ts.CreateUserContext(context.Background(), user.ID)
			data, err := os.ReadFile(filepath.Join("..", "..", "..", "..", "core", "memoexport", "testdata", "1.0", filename))
			require.NoError(t, err)
			response, err := ts.Service.ImportMemos(ctx, &v1pb.ImportMemosRequest{
				Name:        userName(user),
				Upload:      &v1pb.ImportMemosRequest_Spec{Spec: &v1pb.ImportMemosSpec{TotalSize: int64(len(data))}},
				Data:        data,
				FinishWrite: true,
			})
			require.NoError(t, err)
			report := response.GetReport()
			require.NotNil(t, report)
			require.EqualValues(t, 3, report.Created)
			require.Empty(t, report.Failures)
			memos, err := ts.Store.ListMemos(ctx, &store.FindMemo{CreatorID: &user.ID})
			require.NoError(t, err)
			require.Len(t, memos, 3)
			archived := 0
			for _, memo := range memos {
				if memo.RowStatus == store.Archived {
					archived++
				}
			}
			require.Equal(t, 1, archived)
		})
	}
}

func TestImportMemos(t *testing.T) {
	ts := NewTestService(t)
	defer ts.Cleanup()
	t.Cleanup(ts.Service.CloseUploads)
	fixture := buildArchiveFixture(t, ts, "owner")
	exported := exportArchiveBytes(t, ts, fixture.user)
	name := userName(fixture.user)
	importMemos := func(ctx context.Context, request *v1pb.ImportMemosRequest) (*v1pb.ImportMemosResponse, error) {
		request.Name = name
		return ts.Service.ImportMemos(ctx, request)
	}

	t.Run("one call stages, plans, then imports on a second finish", func(t *testing.T) {
		response, err := importMemos(fixture.userCtx, &v1pb.ImportMemosRequest{
			Upload:       &v1pb.ImportMemosRequest_Spec{Spec: &v1pb.ImportMemosSpec{TotalSize: int64(len(exported))}},
			Data:         exported,
			FinishWrite:  true,
			ValidateOnly: true,
		})
		require.NoError(t, err)
		require.NotEmpty(t, response.UploadId)
		require.Equal(t, int64(len(exported)), response.CommittedSize)
		plan := response.GetPlan()
		require.NotNil(t, plan, "a validate-only finish returns the plan")
		require.Equal(t, "owner", plan.Exporter)
		require.Equal(t, int32(5), plan.Memos)
		require.Equal(t, int32(1), plan.Attachments)
		require.Equal(t, int32(5), plan.Existing)
		require.NotNil(t, plan.ExportTime)

		response, err = importMemos(fixture.userCtx, &v1pb.ImportMemosRequest{
			Upload:         &v1pb.ImportMemosRequest_UploadId{UploadId: response.UploadId},
			WriteOffset:    int64(len(exported)),
			FinishWrite:    true,
			ConflictPolicy: v1pb.ImportMemosRequest_SKIP,
		})
		require.NoError(t, err)
		report := response.GetReport()
		require.NotNil(t, report, "a finishing call without validate_only imports")
		require.Equal(t, int32(5), report.Skipped)

		// A later call for an imported upload returns the same report.
		again, err := importMemos(fixture.userCtx, &v1pb.ImportMemosRequest{
			Upload:      &v1pb.ImportMemosRequest_UploadId{UploadId: response.UploadId},
			WriteOffset: int64(len(exported)),
			FinishWrite: true,
		})
		require.NoError(t, err)
		require.Equal(t, int32(5), again.GetReport().Skipped)
	})

	t.Run("chunks arrive in order and import straight away", func(t *testing.T) {
		importer, err := ts.CreateRegularUser(context.Background(), "chunked")
		require.NoError(t, err)
		importerCtx := ts.CreateUserContext(context.Background(), importer.ID)
		half := len(exported) / 2
		first, err := ts.Service.ImportMemos(importerCtx, &v1pb.ImportMemosRequest{
			Name:   userName(importer),
			Upload: &v1pb.ImportMemosRequest_Spec{Spec: &v1pb.ImportMemosSpec{TotalSize: int64(len(exported))}},
			Data:   exported[:half],
		})
		require.NoError(t, err)
		require.Nil(t, first.Result)
		require.Equal(t, int64(half), first.CommittedSize)
		second, err := ts.Service.ImportMemos(importerCtx, &v1pb.ImportMemosRequest{
			Name:        userName(importer),
			Upload:      &v1pb.ImportMemosRequest_UploadId{UploadId: first.UploadId},
			WriteOffset: int64(half),
			Data:        exported[half:],
			FinishWrite: true,
		})
		require.NoError(t, err)
		require.Equal(t, int32(5), second.GetReport().Created)
	})

	t.Run("rejects a file that is not an archive", func(t *testing.T) {
		garbage := []byte("not a zip")
		_, err := importMemos(fixture.userCtx, &v1pb.ImportMemosRequest{
			Upload:      &v1pb.ImportMemosRequest_Spec{Spec: &v1pb.ImportMemosSpec{TotalSize: int64(len(garbage))}},
			Data:        garbage,
			FinishWrite: true,
		})
		require.Equal(t, codes.InvalidArgument, status.Code(err))
		require.Contains(t, err.Error(), "invalid memo export file")
	})

	t.Run("refuses another account's upload id", func(t *testing.T) {
		response, err := importMemos(fixture.userCtx, &v1pb.ImportMemosRequest{
			Upload: &v1pb.ImportMemosRequest_Spec{Spec: &v1pb.ImportMemosSpec{TotalSize: int64(len(exported))}},
		})
		require.NoError(t, err)
		other, err := ts.CreateRegularUser(context.Background(), "intruder")
		require.NoError(t, err)
		_, err = ts.Service.ImportMemos(ts.CreateUserContext(context.Background(), other.ID), &v1pb.ImportMemosRequest{
			Name:   userName(other),
			Upload: &v1pb.ImportMemosRequest_UploadId{UploadId: response.UploadId},
		})
		require.Equal(t, codes.NotFound, status.Code(err))
	})
}

// buildImportArchive writes a one-memo export file whose attachments are given
// as (uid, filename, bytes). Sizes and digests are computed from the bytes.
func buildImportArchive(t *testing.T, username string, attachments []struct {
	uid, filename string
	content       []byte
}) []byte {
	t.Helper()
	var buf bytes.Buffer
	writer := memoexport.NewWriter(&buf, mustTime(t, "2026-04-01T00:00:00Z"))
	require.NoError(t, writer.WriteManifest(&memoexport.Manifest{
		Format: memoexport.Format, FormatVersion: memoexport.FormatVersion,
		Generator:  memoexport.Generator{Name: "test", Version: "1"},
		ExportTime: "2026-04-01T00:00:00Z",
		Scope:      memoexport.Scope{Kind: memoexport.ScopeKindUser, User: &memoexport.ScopeUser{Username: username}},
	}))
	record := &memoexport.Memo{
		UID: "importedmemo1", Creator: username, CreateTime: "2026-04-01T00:00:00Z", UpdateTime: "2026-04-01T00:00:00Z",
		State: "NORMAL", Visibility: "PRIVATE", ContentPath: memoexport.ContentPath("importedmemo1"),
	}
	for _, attachment := range attachments {
		path := memoexport.AttachmentPath(attachment.uid, attachment.filename)
		digest, size, err := writer.WriteAttachment(path, bytes.NewReader(attachment.content))
		require.NoError(t, err)
		record.Attachments = append(record.Attachments, memoexport.Attachment{
			UID: attachment.uid, Filename: attachment.filename, Type: "application/octet-stream", Size: size, SHA256: digest, Path: path,
			CreateTime: "2026-04-01T00:00:00Z",
		})
	}
	require.NoError(t, writer.WriteMemo(record, []byte("imported memo")))
	require.NoError(t, writer.Close())
	return buf.Bytes()
}

// A memo that fails to import must not take a pre-existing attachment of the
// user with it: only attachments the run stored are discarded.
func TestImportMemosFailureKeepsPreexistingAttachment(t *testing.T) {
	ts := NewTestService(t)
	defer ts.Cleanup()
	t.Cleanup(ts.Service.CloseUploads)
	ctx := context.Background()
	_, err := ts.Store.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key:   storepb.InstanceSettingKey_STORAGE,
		Value: &storepb.InstanceSetting_StorageSetting{StorageSetting: &storepb.InstanceStorageSetting{UploadSizeLimitMb: 1}},
	})
	require.NoError(t, err)
	user, err := ts.CreateRegularUser(ctx, "keeper")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	existingContent := []byte("bytes the user already uploaded")
	existing, err := ts.Service.CreateAttachment(userCtx, &v1pb.CreateAttachmentRequest{
		AttachmentId: "keepme0001",
		Attachment:   &v1pb.Attachment{Filename: "keep.bin", Type: "application/octet-stream", Content: existingContent},
	})
	require.NoError(t, err)

	archive := buildImportArchive(t, "keeper", []struct {
		uid, filename string
		content       []byte
	}{
		{"keepme0001", "keep.bin", existingContent},
		{"toolarge01", "big.bin", bytes.Repeat([]byte("x"), 2<<20)},
	})
	response, err := ts.Service.ImportMemos(userCtx, &v1pb.ImportMemosRequest{
		Name:        userName(user),
		Upload:      &v1pb.ImportMemosRequest_Spec{Spec: &v1pb.ImportMemosSpec{TotalSize: int64(len(archive))}},
		Data:        archive,
		FinishWrite: true,
	})
	require.NoError(t, err)
	report := response.GetReport()
	require.NotNil(t, report)
	require.Equal(t, int32(1), report.Failed)
	require.Zero(t, report.Created)

	kept, err := ts.Service.GetAttachment(userCtx, &v1pb.GetAttachmentRequest{Name: existing.Name})
	require.NoError(t, err, "the pre-existing attachment survives the failed import")
	require.Equal(t, existing.Name, kept.Name)
}

// Imported memos and stored attachments count against the same per-user
// write and upload budgets as the regular create paths.
func TestImportMemosChargesWriteAndUploadBudgets(t *testing.T) {
	ts := NewTestService(t)
	defer ts.Cleanup()
	t.Cleanup(ts.Service.CloseUploads)
	limiter := ratelimit.NewMemoryLimiter(ratelimit.DefaultPolicy())
	ts.Service.RateLimiter = limiter
	ctx := context.Background()
	user, err := ts.CreateRegularUser(ctx, "charged")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)
	key := strconv.Itoa(int(user.ID))
	writeBefore := limiter.Allowed(ratelimit.ScopeWriteUser, key, 1).Remaining
	uploadBefore := limiter.Allowed(ratelimit.ScopeUploadUser, key, 1).Remaining

	archive := buildImportArchive(t, "charged", []struct {
		uid, filename string
		content       []byte
	}{{"newfile001", "new.bin", []byte("fresh bytes")}})
	response, err := ts.Service.ImportMemos(userCtx, &v1pb.ImportMemosRequest{
		Name:        userName(user),
		Upload:      &v1pb.ImportMemosRequest_Spec{Spec: &v1pb.ImportMemosSpec{TotalSize: int64(len(archive))}},
		Data:        archive,
		FinishWrite: true,
	})
	require.NoError(t, err)
	require.Equal(t, int32(1), response.GetReport().Created)

	require.Equal(t, writeBefore-1, limiter.Allowed(ratelimit.ScopeWriteUser, key, 1).Remaining)
	require.Equal(t, uploadBefore-1, limiter.Allowed(ratelimit.ScopeUploadUser, key, 1).Remaining)
}
