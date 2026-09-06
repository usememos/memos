package v1

import (
	"context"
	"testing"

	"github.com/lithammer/shortuuid/v4"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/server/auth"
	"github.com/usememos/memos/store"
)

func TestMemoScanOrderIsExclusive(t *testing.T) {
	for _, order := range []string{"id asc", " id   asc ", "id", "id desc", "pinned, id asc", "id asc, update_time", "id asc extra", "id asc, id asc"} {
		t.Run(order, func(t *testing.T) {
			// Given a fresh memo query.
			find := &store.FindMemo{}
			// When parsing an ID scan order.
			err := (&APIV1Service{}).parseMemoOrderBy(order, find)
			// Then only the standalone ascending scan is accepted.
			if order == "id asc" || order == " id   asc " {
				require.NoError(t, err)
			} else {
				require.Error(t, err)
			}
		})
	}
}

func TestMemoScanPreservesBoundaryAndScope(t *testing.T) {
	// Given four owner memos and a page size of two.
	s := newLinkEnrichmentTestService(t, stubFetchResults{})
	t.Cleanup(func() { require.NoError(t, s.Store.Close()) })
	ctx := context.Background()
	user, err := s.Store.CreateUser(ctx, &store.User{Username: "scan-owner", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	ctx = context.WithValue(ctx, auth.UserIDContextKey, user.ID)
	var memos []*store.Memo
	for range 4 {
		memo, err := s.Store.CreateMemo(ctx, &store.Memo{UID: shortuuid.New(), CreatorID: user.ID, Content: "scan", Visibility: store.Private})
		require.NoError(t, err)
		memos = append(memos, memo)
	}
	require.NoError(t, s.Store.UpdateMemo(ctx, &store.UpdateMemo{ID: memos[3].ID, Pinned: proto.Bool(true)}))
	request := &v1pb.ListMemosRequest{OrderBy: "id asc", PageSize: 2}
	first, err := s.ListMemos(ctx, request)
	require.NoError(t, err)
	require.Len(t, first.Memos, 2)
	require.Equal(t, "memos/"+memos[0].UID, first.Memos[0].Name)
	require.Equal(t, "memos/"+memos[1].UID, first.Memos[1].Name)
	require.NotEmpty(t, first.NextPageToken)

	// When a preceding row disappears and a newer row is inserted.
	require.NoError(t, s.Store.DeleteMemo(ctx, &store.DeleteMemo{ID: memos[0].ID}))
	_, err = s.Store.CreateMemo(ctx, &store.Memo{UID: shortuuid.New(), CreatorID: user.ID, Content: "late", Visibility: store.Private})
	require.NoError(t, err)
	request.PageToken = first.NextPageToken
	second, err := s.ListMemos(ctx, request)

	// Then lookahead is retained, the late insert is excluded, and the scan terminates.
	require.NoError(t, err)
	require.Len(t, second.Memos, 2)
	require.Equal(t, "memos/"+memos[2].UID, second.Memos[0].Name)
	require.Equal(t, "memos/"+memos[3].UID, second.Memos[1].Name)
	require.Empty(t, second.NextPageToken)

	for _, changed := range []*v1pb.ListMemosRequest{
		{OrderBy: "id asc", PageSize: 2, State: v1pb.State_ARCHIVED, PageToken: first.NextPageToken},
		{OrderBy: "id asc", PageSize: 3, PageToken: first.NextPageToken},
		{OrderBy: "id asc", PageSize: 2, Filter: "has_link", PageToken: first.NextPageToken},
		{OrderBy: "id asc", PageSize: 2, PageToken: "malformed"},
	} {
		_, err := s.ListMemos(ctx, changed)
		require.Equal(t, codes.InvalidArgument, status.Code(err))
	}
	other, err := s.Store.CreateUser(ctx, &store.User{Username: "scan-other", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	_, err = s.ListMemos(context.WithValue(ctx, auth.UserIDContextKey, other.ID), request)
	require.Equal(t, codes.InvalidArgument, status.Code(err))
	_, _, err = s.scanMemos(ctx, &store.FindMemo{CreatorID: &user.ID}, memoScanRequest{
		Operation: "refresh", CallerID: user.ID, PageSize: 2, PageToken: first.NextPageToken,
	})
	require.Equal(t, codes.InvalidArgument, status.Code(err))
}
