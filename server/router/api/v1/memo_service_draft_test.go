package v1

import (
	"context"
	"testing"
	"time"

	"github.com/lithammer/shortuuid/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/fieldmaskpb"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// NOTE ON WEBHOOK OBSERVABILITY (harness limitation, documented intentionally):
// internal/webhook dispatches via an unexported safeClient whose dialer rejects
// connections to reserved/private IPs (SSRF guard). An httptest.Server always
// binds to loopback, so webhook *delivery* cannot be observed from these tests
// without modifying production code (forbidden by the task constraints). The
// create-side-effect suppression and the publish side-effect firing are
// therefore asserted via the two reliably-observable channels: the SSE hub
// (synchronous broadcast) and the mention-notification inbox (synchronous DB
// write). These fully exercise the draft side-effect contract; the webhook
// guard is a sibling call on the same code path gated by the same condition.

func memoMentionInboxes(t *testing.T, svc *APIV1Service, receiverID int32) []*store.Inbox {
	t.Helper()
	mentionType := storepb.InboxMessage_MEMO_MENTION
	inboxes, err := svc.Store.ListInboxes(context.Background(), &store.FindInbox{
		ReceiverID:  &receiverID,
		MessageType: &mentionType,
	})
	require.NoError(t, err)
	return inboxes
}

// Item 1: CreateMemo with State=DRAFT -> persisted DRAFT, and the three create
// side-effects (webhook / SSE feed broadcast / mention notification) are all
// suppressed.
//
// RED today: CreateMemo (memo_service.go:87-92) never reads request.Memo.State,
// so the memo is created NORMAL and all three side-effects fire normally.
func TestCreateMemo_DraftPersistsAndSuppressesSideEffects(t *testing.T) {
	ctx := context.Background()
	svc := newIntegrationService(t)

	author, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "draft-author", Role: store.RoleAdmin, Email: "draft-author@example.com",
	})
	require.NoError(t, err)
	mentioned, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "draft-mentioned", Role: store.RoleUser, Email: "draft-mentioned@example.com",
	})
	require.NoError(t, err)
	authorCtx := userCtx(ctx, author.ID)

	// Register a webhook for the author so that, absent the draft guard, the
	// create path would reach the (suppressible) webhook dispatch. We assert
	// suppression via SSE + inbox (see harness note at top of file).
	require.NoError(t, svc.Store.AddUserWebhook(ctx, author.ID, &storepb.WebhooksUserSetting_Webhook{
		Id: shortuuid.New(), Title: "test-hook", Url: "https://webhook.example.com/hook",
	}))

	// Subscribe before the create so we can observe (the absence of) the
	// memo.created broadcast.
	client := svc.SSEHub.Subscribe(author.ID, store.RoleAdmin)
	defer svc.SSEHub.Unsubscribe(client)

	memo, err := svc.CreateMemo(authorCtx, &v1pb.CreateMemoRequest{
		Memo: &v1pb.Memo{
			Content:    "a private draft mentioning @draft-mentioned",
			Visibility: v1pb.Visibility_PUBLIC,
			State:      v1pb.State_DRAFT,
		},
	})
	require.NoError(t, err)
	require.NotNil(t, memo)

	// Persisted as a draft.
	require.Equal(t, v1pb.State_DRAFT, memo.State, "memo created with State=DRAFT must be persisted and returned as DRAFT")

	// No SSE memo.created broadcast for a draft.
	require.Empty(t, collectEventsFor(client.events, 200*time.Millisecond),
		"a draft create must not broadcast an SSE feed event")

	// No mention notification inbox for a draft.
	require.Empty(t, memoMentionInboxes(t, svc, mentioned.ID),
		"a draft create must not notify mentioned users")
}

// Item 2 (edge E1): CreateMemo with State=STATE_UNSPECIFIED -> persists NORMAL.
//
// This currently PASSES (handler ignores state, default is NORMAL) and must
// STAY green after T7: only an explicit DRAFT yields a draft.
func TestCreateMemo_UnspecifiedStateIsNormal(t *testing.T) {
	ctx := context.Background()
	svc := newIntegrationService(t)

	user, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "unspec-user", Role: store.RoleAdmin, Email: "unspec-user@example.com",
	})
	require.NoError(t, err)
	uctx := userCtx(ctx, user.ID)

	memo, err := svc.CreateMemo(uctx, &v1pb.CreateMemoRequest{
		Memo: &v1pb.Memo{
			Content:    "no explicit state",
			Visibility: v1pb.Visibility_PRIVATE,
			// State left STATE_UNSPECIFIED.
		},
	})
	require.NoError(t, err)
	require.Equal(t, v1pb.State_NORMAL, memo.State, "STATE_UNSPECIFIED on create must resolve to NORMAL")
}

// Item 3: Default ListMemos (no state) excludes a seeded draft.
//
// This already PASSES (ListMemos default branch pins store.Normal) and is a
// regression pin that must STAY green.
func TestListMemos_DefaultExcludesDraft(t *testing.T) {
	ctx := context.Background()
	svc := newIntegrationService(t)

	user, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "list-default-user", Role: store.RoleAdmin, Email: "list-default-user@example.com",
	})
	require.NoError(t, err)
	uctx := userCtx(ctx, user.ID)

	normal, err := svc.Store.CreateMemo(ctx, &store.Memo{
		UID: shortuuid.New(), CreatorID: user.ID, RowStatus: store.Normal,
		Visibility: store.Public, Content: "a normal memo",
	})
	require.NoError(t, err)
	_, err = svc.Store.CreateMemo(ctx, &store.Memo{
		UID: shortuuid.New(), CreatorID: user.ID, RowStatus: store.Draft,
		Visibility: store.Public, Content: "a seeded draft must not appear",
	})
	require.NoError(t, err)

	resp, err := svc.ListMemos(uctx, &v1pb.ListMemosRequest{PageSize: 50})
	require.NoError(t, err)
	require.Len(t, resp.Memos, 1)
	require.Equal(t, buildMemoName(normal.UID), resp.Memos[0].Name)
}

// Item 4: ListMemos{state:DRAFT} as creator -> only own drafts;
// unauthenticated -> empty list (not error), mirroring the ARCHIVED precedent.
//
// RED today: ListMemos has no STATE_DRAFT branch (memo_service.go:191-202), so
// it falls into the else branch and pins store.Normal, returning no drafts for
// the creator at all.
func TestListMemos_DraftStateIsCreatorOnly(t *testing.T) {
	ctx := context.Background()
	svc := newIntegrationService(t)

	owner, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "draft-owner", Role: store.RoleUser, Email: "draft-owner@example.com",
	})
	require.NoError(t, err)
	other, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "draft-other", Role: store.RoleUser, Email: "draft-other@example.com",
	})
	require.NoError(t, err)

	ownDraft, err := svc.Store.CreateMemo(ctx, &store.Memo{
		UID: shortuuid.New(), CreatorID: owner.ID, RowStatus: store.Draft,
		Visibility: store.Private, Content: "owner draft",
	})
	require.NoError(t, err)
	_, err = svc.Store.CreateMemo(ctx, &store.Memo{
		UID: shortuuid.New(), CreatorID: other.ID, RowStatus: store.Draft,
		Visibility: store.Public, Content: "other user draft",
	})
	require.NoError(t, err)

	// Creator sees only their own draft.
	ownerResp, err := svc.ListMemos(userCtx(ctx, owner.ID), &v1pb.ListMemosRequest{
		PageSize: 50,
		State:    v1pb.State_DRAFT,
	})
	require.NoError(t, err)
	require.Len(t, ownerResp.Memos, 1, "creator must see exactly their own draft")
	require.Equal(t, buildMemoName(ownDraft.UID), ownerResp.Memos[0].Name)

	// Unauthenticated request: empty list, NOT an error (archived precedent).
	anonResp, err := svc.ListMemos(ctx, &v1pb.ListMemosRequest{
		PageSize: 50,
		State:    v1pb.State_DRAFT,
	})
	require.NoError(t, err, "unauthenticated DRAFT list must return empty, not error")
	require.Empty(t, anonResp.Memos)
}

// Item 5 (edges E2/E3): a non-creator GetMemo on another user's draft -- even a
// PUBLIC-visibility draft -- is denied.
//
// RED today: checkMemoReadAccess (memo_service.go:42-71) only guards Archived;
// a PUBLIC draft passes the visibility check and leaks to any caller.
func TestGetMemo_DraftIsCreatorOnlyRegardlessOfVisibility(t *testing.T) {
	ctx := context.Background()
	svc := newIntegrationService(t)

	owner, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "get-draft-owner", Role: store.RoleUser, Email: "get-draft-owner@example.com",
	})
	require.NoError(t, err)
	attacker, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "get-draft-attacker", Role: store.RoleUser, Email: "get-draft-attacker@example.com",
	})
	require.NoError(t, err)

	publicDraft, err := svc.Store.CreateMemo(ctx, &store.Memo{
		UID: shortuuid.New(), CreatorID: owner.ID, RowStatus: store.Draft,
		Visibility: store.Public, Content: "public-visibility draft, still creator-only",
	})
	require.NoError(t, err)
	privateDraft, err := svc.Store.CreateMemo(ctx, &store.Memo{
		UID: shortuuid.New(), CreatorID: owner.ID, RowStatus: store.Draft,
		Visibility: store.Private, Content: "private draft",
	})
	require.NoError(t, err)

	// Owner can read their own drafts.
	_, err = svc.GetMemo(userCtx(ctx, owner.ID), &v1pb.GetMemoRequest{Name: buildMemoName(publicDraft.UID)})
	require.NoError(t, err, "creator must be able to read their own draft")

	// A different authenticated user is denied, even for a PUBLIC draft (E2/E3).
	_, err = svc.GetMemo(userCtx(ctx, attacker.ID), &v1pb.GetMemoRequest{Name: buildMemoName(publicDraft.UID)})
	require.Error(t, err, "a non-creator must NOT read a PUBLIC-visibility draft")
	require.Contains(t, []codes.Code{codes.NotFound, codes.PermissionDenied}, status.Code(err))

	_, err = svc.GetMemo(userCtx(ctx, attacker.ID), &v1pb.GetMemoRequest{Name: buildMemoName(privateDraft.UID)})
	require.Error(t, err)
	require.Contains(t, []codes.Code{codes.NotFound, codes.PermissionDenied}, status.Code(err))

	// An unauthenticated caller is also denied a PUBLIC draft.
	_, err = svc.GetMemo(ctx, &v1pb.GetMemoRequest{Name: buildMemoName(publicDraft.UID)})
	require.Error(t, err, "an unauthenticated caller must NOT read a PUBLIC-visibility draft")
}

// Item 6 (edge E5 / O4): publishing DRAFT->NORMAL fires webhook + SSE exactly
// once and refreshes created_ts/updated_ts; a NORMAL->NORMAL content edit fires
// no extra side-effect and leaves created_ts unchanged.

// RED today: a draft cannot even be created via the handler (item 1), and there
// is no Draft->NORMAL transition detection to refresh created_ts. We seed the
// draft directly in the store so this test isolates the publish-transition
// behaviour.
func TestUpdateMemo_PublishDraftRefreshesTimestampsAndFiresSideEffects(t *testing.T) {
	ctx := context.Background()
	svc := newIntegrationService(t)

	author, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "publish-author", Role: store.RoleAdmin, Email: "publish-author@example.com",
	})
	require.NoError(t, err)
	authorCtx := userCtx(ctx, author.ID)

	oldTs := time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC).Unix()
	draft, err := svc.Store.CreateMemo(ctx, &store.Memo{
		UID: shortuuid.New(), CreatorID: author.ID, RowStatus: store.Draft,
		Visibility: store.Public, Content: "draft to be published",
		CreatedTs: oldTs, UpdatedTs: oldTs,
	})
	require.NoError(t, err)

	client := svc.SSEHub.Subscribe(author.ID, store.RoleAdmin)
	defer svc.SSEHub.Unsubscribe(client)

	before := time.Now().Unix()
	published, err := svc.UpdateMemo(authorCtx, &v1pb.UpdateMemoRequest{
		Memo: &v1pb.Memo{
			Name:  buildMemoName(draft.UID),
			State: v1pb.State_NORMAL,
		},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"state"}},
	})
	require.NoError(t, err)
	require.Equal(t, v1pb.State_NORMAL, published.State)

	// O4: created_ts AND updated_ts refreshed on the publish transition.
	require.GreaterOrEqual(t, published.CreateTime.AsTime().Unix(), before,
		"publishing a draft must refresh created_ts to now")
	require.GreaterOrEqual(t, published.UpdateTime.AsTime().Unix(), before,
		"publishing a draft must refresh updated_ts to now")

	// Exactly one SSE memo.updated broadcast at publish (the publish side-effect
	// fires; the sibling webhook dispatch is on the same gated path -- see the
	// harness note at the top of this file for why webhook delivery itself is
	// not directly observable here).
	events := collectEventsFor(client.events, 250*time.Millisecond)
	require.Len(t, events, 1, "publishing a draft must broadcast exactly one SSE event, got: %v", events)
	assert.Contains(t, events[0], `"memo.updated"`)
}

// Edge E5 reverse: a NORMAL->NORMAL content edit must NOT touch created_ts.
// This currently PASSES (no publish logic exists) and must STAY green: only the
// Draft->NORMAL transition refreshes created_ts.
func TestUpdateMemo_NormalContentEditDoesNotRefreshCreatedTs(t *testing.T) {
	ctx := context.Background()
	svc := newIntegrationService(t)

	author, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "edit-author", Role: store.RoleAdmin, Email: "edit-author@example.com",
	})
	require.NoError(t, err)
	authorCtx := userCtx(ctx, author.ID)

	oldTs := time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC).Unix()
	memo, err := svc.Store.CreateMemo(ctx, &store.Memo{
		UID: shortuuid.New(), CreatorID: author.ID, RowStatus: store.Normal,
		Visibility: store.Public, Content: "original content",
		CreatedTs: oldTs, UpdatedTs: oldTs,
	})
	require.NoError(t, err)

	updated, err := svc.UpdateMemo(authorCtx, &v1pb.UpdateMemoRequest{
		Memo: &v1pb.Memo{
			Name:    buildMemoName(memo.UID),
			Content: "edited content",
		},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"content"}},
	})
	require.NoError(t, err)
	require.Equal(t, "edited content", updated.Content)
	require.Equal(t, oldTs, updated.CreateTime.AsTime().Unix(),
		"editing a NORMAL memo's content must NOT change created_ts")
}

// Item 8: leakage regression. A seeded DRAFT must be absent from every
// non-creator surface. The default-NORMAL surfaces (RSS, default list, user
// stats) already PASS today and are pinned as regressions; the added-guard
// surfaces (read-access via GetMemo, relations, reaction) FAIL today.
//
// (sitemap / MCP leakage are covered in frontend / mcp packages respectively.)

// Already-explicit-NORMAL surface: GetUserStats. Regression pin -- STAYS green.
func TestUserStatsExcludesDraftRegressionPin(t *testing.T) {
	ctx := context.Background()
	svc := newIntegrationService(t)

	user, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "stats-user", Role: store.RoleUser, Email: "stats-user@example.com",
	})
	require.NoError(t, err)

	_, err = svc.Store.CreateMemo(ctx, &store.Memo{
		UID: shortuuid.New(), CreatorID: user.ID, RowStatus: store.Normal,
		Visibility: store.Public, Content: "counted normal memo",
	})
	require.NoError(t, err)
	_, err = svc.Store.CreateMemo(ctx, &store.Memo{
		UID: shortuuid.New(), CreatorID: user.ID, RowStatus: store.Draft,
		Visibility: store.Public, Content: "uncounted draft memo",
	})
	require.NoError(t, err)

	stats, err := svc.GetUserStats(userCtx(ctx, user.ID), &v1pb.GetUserStatsRequest{
		Name: "users/" + user.Username,
	})
	require.NoError(t, err)
	require.EqualValues(t, 1, stats.TotalMemoCount, "drafts must not be counted in user stats")
}

// Added-guard surface: ListMemoRelations must not surface a DRAFT related memo
// to a non-creator. RED today: relations filter is visibility-only, so a PUBLIC
// draft pointed at by a relation leaks its content/name.
func TestListMemoRelations_ExcludesDraftFromNonCreator(t *testing.T) {
	ctx := context.Background()
	svc := newIntegrationService(t)

	owner, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "rel-owner", Role: store.RoleUser, Email: "rel-owner@example.com",
	})
	require.NoError(t, err)
	viewer, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "rel-viewer", Role: store.RoleUser, Email: "rel-viewer@example.com",
	})
	require.NoError(t, err)

	publicMemo, err := svc.Store.CreateMemo(ctx, &store.Memo{
		UID: shortuuid.New(), CreatorID: owner.ID, RowStatus: store.Normal,
		Visibility: store.Public, Content: "public anchor memo",
	})
	require.NoError(t, err)
	publicDraft, err := svc.Store.CreateMemo(ctx, &store.Memo{
		UID: shortuuid.New(), CreatorID: owner.ID, RowStatus: store.Draft,
		Visibility: store.Public, Content: "secret draft referenced by a relation",
	})
	require.NoError(t, err)

	_, err = svc.Store.UpsertMemoRelation(ctx, &store.MemoRelation{
		MemoID: publicMemo.ID, RelatedMemoID: publicDraft.ID, Type: store.MemoRelationReference,
	})
	require.NoError(t, err)

	resp, err := svc.ListMemoRelations(userCtx(ctx, viewer.ID), &v1pb.ListMemoRelationsRequest{
		Name: buildMemoName(publicMemo.UID),
	})
	require.NoError(t, err)
	for _, rel := range resp.Relations {
		require.NotEqual(t, buildMemoName(publicDraft.UID), rel.GetRelatedMemo().GetName(),
			"a DRAFT memo must not be surfaced via memo relations to a non-creator")
		require.NotEqual(t, buildMemoName(publicDraft.UID), rel.GetMemo().GetName(),
			"a DRAFT memo must not be surfaced via memo relations to a non-creator")
	}
}

// Added-guard surface: ListMemoReactions on a PUBLIC draft must be denied to a
// non-creator. RED today: ListMemoReactions (reaction_service.go:15-58) only
// checks visibility, so a PUBLIC draft's reactions are readable by anyone.
func TestListMemoReactions_DraftIsCreatorOnly(t *testing.T) {
	ctx := context.Background()
	svc := newIntegrationService(t)

	owner, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "react-owner", Role: store.RoleUser, Email: "react-owner@example.com",
	})
	require.NoError(t, err)
	viewer, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "react-viewer", Role: store.RoleUser, Email: "react-viewer@example.com",
	})
	require.NoError(t, err)

	publicDraft, err := svc.Store.CreateMemo(ctx, &store.Memo{
		UID: shortuuid.New(), CreatorID: owner.ID, RowStatus: store.Draft,
		Visibility: store.Public, Content: "public draft with reactions",
	})
	require.NoError(t, err)

	_, err = svc.ListMemoReactions(userCtx(ctx, viewer.ID), &v1pb.ListMemoReactionsRequest{
		Name: buildMemoName(publicDraft.UID),
	})
	require.Error(t, err, "a non-creator must NOT read reactions of a PUBLIC-visibility draft")
	require.Contains(t, []codes.Code{codes.NotFound, codes.PermissionDenied}, status.Code(err))
}
