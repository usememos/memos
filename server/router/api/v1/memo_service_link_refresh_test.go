package v1

import (
	"context"
	"testing"
	"time"

	"github.com/lithammer/shortuuid/v4"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"

	"github.com/usememos/memos/internal/httpgetter"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/server/auth"
	"github.com/usememos/memos/store"
)

type refreshWriteFailureDriver struct {
	store.Driver
}

func (d refreshWriteFailureDriver) UpdateMemo(context.Context, *store.UpdateMemo) error {
	return errors.New("injected memo write failure")
}

func (d refreshWriteFailureDriver) Close() error { return nil }

func TestRefreshMemoLinkCoversReturnsPersistenceFailure(t *testing.T) {
	// Given a real memo and a database adapter that fails only the final write.
	service := newLinkEnrichmentTestService(t, stubFetchResults{})
	user, err := service.Store.CreateUser(context.Background(), &store.User{Username: "refresh-write", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	_, err = service.Store.CreateMemo(context.Background(), &store.Memo{
		UID: shortuuid.New(), CreatorID: user.ID, Visibility: store.Private,
		Content: "https://example.com/a",
		Payload: &storepb.MemoPayload{
			Property: &storepb.MemoPayload_Property{HasLink: true},
			Links:    []*storepb.MemoPayload_LinkMetadata{{Url: "https://example.com/a"}},
		},
	})
	require.NoError(t, err)
	service.Store = store.New(refreshWriteFailureDriver{Driver: service.Store.GetDriver()}, service.Profile)
	t.Cleanup(func() { require.NoError(t, service.Store.Close()) })
	ctx := context.WithValue(context.Background(), auth.UserIDContextKey, user.ID)

	// When refreshing the memo.
	response, err := service.RefreshMemoLinkCovers(ctx, &v1pb.RefreshMemoLinkCoversRequest{})

	// Then the caller receives failure instead of a successful summary of unsaved changes.
	require.Equal(t, codes.Internal, status.Code(err))
	require.Nil(t, response)
}

func TestRefreshMemoLinkCoversRejectsInvalidPageToken(t *testing.T) {
	service := newLinkEnrichmentTestService(t, stubFetchResults{})
	user, err := service.Store.CreateUser(context.Background(), &store.User{Username: "refresh-token", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	ctx := context.WithValue(context.Background(), auth.UserIDContextKey, user.ID)
	for _, token := range []string{"invalid", "-1", "99999999999999999999999999999999"} {
		t.Run(token, func(t *testing.T) {
			response, err := service.RefreshMemoLinkCovers(ctx, &v1pb.RefreshMemoLinkCoversRequest{PageToken: token})
			require.Equal(t, codes.InvalidArgument, status.Code(err))
			require.Nil(t, response)
		})
	}
}

func TestRefreshMemoLinkCoversCancellationPreservesRetryState(t *testing.T) {
	// Given a pending link whose metadata request cancels the caller.
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	service := newLinkEnrichmentTestService(t, fakeLinkMetadataFetcher(func(context.Context, string) (*httpgetter.HTMLMeta, error) {
		cancel()
		return nil, context.Canceled
	}))
	user, err := service.Store.CreateUser(ctx, &store.User{Username: "refresh-cancel", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	payload := &storepb.MemoPayload{
		Property: &storepb.MemoPayload_Property{HasLink: true},
		Links:    []*storepb.MemoPayload_LinkMetadata{{Url: "https://example.com/a", FetchAttempts: 3, FirstAttemptAt: time.Now().Add(-time.Hour).Unix()}},
	}
	memo, err := service.Store.CreateMemo(ctx, &store.Memo{
		UID: shortuuid.New(), CreatorID: user.ID, Visibility: store.Private, Content: "https://example.com/a", Payload: payload,
	})
	require.NoError(t, err)
	ctx = context.WithValue(ctx, auth.UserIDContextKey, user.ID)

	// When the in-flight refresh is cancelled.
	response, err := service.RefreshMemoLinkCovers(ctx, &v1pb.RefreshMemoLinkCoversRequest{})

	// Then cancellation is reported and the saved retry schedule is unchanged.
	require.Equal(t, codes.Canceled, status.Code(err))
	require.Nil(t, response)
	stored, err := service.Store.GetMemo(context.Background(), &store.FindMemo{ID: &memo.ID})
	require.NoError(t, err)
	require.True(t, proto.Equal(payload, stored.Payload))
}

func TestRefreshMemoLinkCoversPreservesConcurrentEdit(t *testing.T) {
	// Given a pending bookmark and an author edit during its remote metadata fetch.
	service := newLinkEnrichmentTestService(t, stubFetchResults{})
	user, err := service.Store.CreateUser(context.Background(), &store.User{Username: "refresh-edit", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	memo, err := service.Store.CreateMemo(context.Background(), &store.Memo{
		UID: shortuuid.New(), CreatorID: user.ID, Visibility: store.Private, Content: "https://example.com/a",
		Payload: &storepb.MemoPayload{
			Property: &storepb.MemoPayload_Property{HasLink: true},
			Links:    []*storepb.MemoPayload_LinkMetadata{{Url: "https://example.com/a"}},
		},
	})
	require.NoError(t, err)
	authorPayload := &storepb.MemoPayload{Tags: []string{"edited"}, Property: &storepb.MemoPayload_Property{}}
	var editErr error
	service.linkMetadataFetcher = fakeLinkMetadataFetcher(func(ctx context.Context, _ string) (*httpgetter.HTMLMeta, error) {
		content := "#edited"
		editErr = service.Store.UpdateMemo(ctx, &store.UpdateMemo{ID: memo.ID, Content: &content, Payload: authorPayload})
		return &httpgetter.HTMLMeta{Title: "Fetched before the edit"}, nil
	})
	ctx := context.WithValue(context.Background(), auth.UserIDContextKey, user.ID)

	// When stale enrichment finishes after the author edit.
	response, err := service.RefreshMemoLinkCovers(ctx, &v1pb.RefreshMemoLinkCoversRequest{})

	// Then the newer payload survives and the obsolete enrichment is skipped.
	require.NoError(t, editErr)
	require.NoError(t, err)
	require.Zero(t, response.UpdatedLinks)
	require.Zero(t, response.FailedLinks)
	require.Equal(t, int32(1), response.SkippedLinks)
	stored, err := service.Store.GetMemo(ctx, &store.FindMemo{ID: &memo.ID})
	require.NoError(t, err)
	require.Equal(t, "#edited", stored.Content)
	require.True(t, proto.Equal(authorPayload, stored.Payload))
}

func TestRefreshMemoLinkCoversRediscoversExpiredImageWithoutCachedCover(t *testing.T) {
	const page = "https://example.com/stale"
	const renewed = "https://example.com/renewed.png"
	service := newLinkEnrichmentTestService(t, stubFetchResults{
		metas:  map[string]*httpgetter.HTMLMeta{page: {Image: renewed}},
		images: map[string]*httpgetter.Image{renewed: {Blob: validCoverPNG, Mediatype: "image/png"}},
	})
	t.Cleanup(func() { require.NoError(t, service.Store.Close()) })
	ctx := context.Background()
	user, err := service.Store.CreateUser(ctx, &store.User{Username: "refresh-stale", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	memo, err := service.Store.CreateMemo(ctx, &store.Memo{UID: shortuuid.New(), CreatorID: user.ID, Visibility: store.Private, Content: page,
		Payload: &storepb.MemoPayload{Property: &storepb.MemoPayload_Property{HasLink: true}, Links: []*storepb.MemoPayload_LinkMetadata{{Url: page, Image: "https://example.com/expired.png", FetchAttempts: 3}}},
	})
	require.NoError(t, err)
	response, err := service.RefreshMemoLinkCovers(context.WithValue(ctx, auth.UserIDContextKey, user.ID), &v1pb.RefreshMemoLinkCoversRequest{})
	require.NoError(t, err)
	require.Equal(t, int32(1), response.UpdatedLinks)
	persisted, err := service.Store.GetMemo(ctx, &store.FindMemo{ID: &memo.ID})
	require.NoError(t, err)
	require.Equal(t, renewed, persisted.Payload.Links[0].Image)
	require.NotEmpty(t, persisted.Payload.Links[0].CoverAttachmentUid)
	require.Zero(t, persisted.Payload.Links[0].FetchAttempts)
}
