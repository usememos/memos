package v1

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/fieldmaskpb"

	"github.com/usememos/memos/internal/profile"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/server/auth"
	"github.com/usememos/memos/store"
	teststore "github.com/usememos/memos/store/test"
)

// newIntegrationService builds a minimal APIV1Service backed by an in-memory
// SQLite database.  The store is closed automatically via t.Cleanup.
func newIntegrationService(t *testing.T) *APIV1Service {
	t.Helper()
	ctx := context.Background()
	st := teststore.NewTestingStore(ctx, t)
	t.Cleanup(func() { st.Close() })
	p := &profile.Profile{Demo: true, Data: t.TempDir(), Driver: "sqlite", DSN: ":memory:"}
	return NewAPIV1Service("test-secret", p, st)
}

// userCtx returns a context that authenticates as the given user.
func userCtx(ctx context.Context, userID int32) context.Context {
	return context.WithValue(ctx, auth.UserIDContextKey, userID)
}

// collectEventsFor reads events from ch for the given duration and returns them.
func collectEventsFor(ch <-chan []byte, d time.Duration) []string {
	var out []string
	deadline := time.After(d)
	for {
		select {
		case data := <-ch:
			out = append(out, string(data))
		case <-deadline:
			return out
		}
	}
}

func requireMemoChanged(t *testing.T, ch <-chan []byte) {
	t.Helper()
	require.Equal(t, memoChangedSSEFrame, string(mustReceive(t, ch, time.Second)))
}

func requireSpaceChanged(t *testing.T, ch <-chan []byte) {
	t.Helper()
	require.Equal(t, spaceChangedSSEFrame, string(mustReceive(t, ch, time.Second)))
}

func requireNoMemoChanged(t *testing.T, ch <-chan []byte) {
	t.Helper()
	select {
	case event := <-ch:
		require.Failf(t, "unexpected SSE event", "received %q", event)
	default:
	}
}

func TestAttachmentMutationsPublishMemoChangedOnlyWhenBound(t *testing.T) {
	ctx := context.Background()
	svc := newIntegrationService(t)
	owner := createSpaceTestUser(ctx, t, svc, "sse-attachment-owner", store.RoleUser)
	ownerCtx := userCtx(ctx, owner.ID)
	memo, err := svc.CreateMemo(ownerCtx, &v1pb.CreateMemoRequest{
		Memo: &v1pb.Memo{Content: "attachment event memo", Visibility: v1pb.Visibility_PRIVATE},
	})
	require.NoError(t, err)

	client := svc.SSEHub.Subscribe()
	defer svc.SSEHub.Unsubscribe(client)
	createAttachment := func(filename string, memoName *string) *v1pb.Attachment {
		t.Helper()
		attachment, err := svc.CreateAttachment(ownerCtx, &v1pb.CreateAttachmentRequest{Attachment: &v1pb.Attachment{
			Filename: filename,
			Type:     "text/plain",
			Content:  []byte(filename),
			Memo:     memoName,
		}})
		require.NoError(t, err)
		return attachment
	}

	unbound := createAttachment("sse-unbound.txt", nil)
	requireNoMemoChanged(t, client.events)
	_, err = svc.UpdateAttachment(ownerCtx, &v1pb.UpdateAttachmentRequest{
		Attachment: &v1pb.Attachment{Name: unbound.Name, Filename: "sse-unbound-renamed.txt"},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"filename"}},
	})
	require.NoError(t, err)
	requireNoMemoChanged(t, client.events)
	_, err = svc.DeleteAttachment(ownerCtx, &v1pb.DeleteAttachmentRequest{Name: unbound.Name})
	require.NoError(t, err)
	requireNoMemoChanged(t, client.events)

	bound := createAttachment("sse-bound.txt", &memo.Name)
	requireMemoChanged(t, client.events)
	_, err = svc.UpdateAttachment(ownerCtx, &v1pb.UpdateAttachmentRequest{
		Attachment: &v1pb.Attachment{Name: bound.Name, Filename: "sse-bound-renamed.txt"},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"filename"}},
	})
	require.NoError(t, err)
	requireMemoChanged(t, client.events)
	_, err = svc.DeleteAttachment(ownerCtx, &v1pb.DeleteAttachmentRequest{Name: bound.Name})
	require.NoError(t, err)
	requireMemoChanged(t, client.events)

	firstUnbound := createAttachment("sse-batch-unbound-first.txt", nil)
	secondUnbound := createAttachment("sse-batch-unbound-second.txt", nil)
	requireNoMemoChanged(t, client.events)
	_, err = svc.BatchDeleteAttachments(ownerCtx, &v1pb.BatchDeleteAttachmentsRequest{
		Names: []string{firstUnbound.Name, secondUnbound.Name},
	})
	require.NoError(t, err)
	requireNoMemoChanged(t, client.events)

	mixedUnbound := createAttachment("sse-batch-mixed-unbound.txt", nil)
	mixedBound := createAttachment("sse-batch-mixed-bound.txt", &memo.Name)
	requireMemoChanged(t, client.events)
	_, err = svc.BatchDeleteAttachments(ownerCtx, &v1pb.BatchDeleteAttachmentsRequest{
		Names: []string{mixedUnbound.Name, mixedBound.Name},
	})
	require.NoError(t, err)
	requireMemoChanged(t, client.events)
}

func TestUpdateAttachmentPublishesAfterCommittedAccessChange(t *testing.T) {
	ctx := context.Background()
	svc := newIntegrationService(t)
	owner := createSpaceTestUser(ctx, t, svc, "sse-attachment-access-owner", store.RoleUser)
	ownerCtx := userCtx(ctx, owner.ID)
	space, err := svc.CreateSpace(ownerCtx, &v1pb.CreateSpaceRequest{
		SpaceId: "sse-attachment-access-space",
		Space:   &v1pb.Space{Title: "Attachment access space"},
	})
	require.NoError(t, err)
	spaceName := space.Name
	memo, err := svc.CreateMemo(ownerCtx, &v1pb.CreateMemoRequest{Memo: &v1pb.Memo{
		Content:    "attachment access changed during update",
		Visibility: v1pb.Visibility_SPACE,
		Space:      &spaceName,
	}})
	require.NoError(t, err)
	attachment, err := svc.CreateAttachment(ownerCtx, &v1pb.CreateAttachmentRequest{Attachment: &v1pb.Attachment{
		Filename: "before.txt",
		Type:     "text/plain",
		Content:  []byte("attachment"),
		Memo:     &memo.Name,
	}})
	require.NoError(t, err)
	attachmentUID, err := ExtractAttachmentUIDFromName(attachment.Name)
	require.NoError(t, err)
	storedAttachment, err := svc.Store.GetAttachment(ctx, &store.FindAttachment{UID: &attachmentUID})
	require.NoError(t, err)
	require.NotNil(t, storedAttachment)

	// Authorization is checked before the attachment update. Simulate membership
	// changing in the same transaction so the committed response can no longer be
	// built through the read-authorized GetAttachment service method.
	trigger := fmt.Sprintf(`
		CREATE TRIGGER revoke_attachment_owner_membership
		AFTER UPDATE OF filename ON attachment
		WHEN NEW.id = %d
		BEGIN
			DELETE FROM space_member WHERE user_id = %d;
		END`, storedAttachment.ID, owner.ID)
	_, err = svc.Store.GetDriver().GetDB().ExecContext(ctx, trigger)
	require.NoError(t, err)

	client := svc.SSEHub.Subscribe()
	defer svc.SSEHub.Unsubscribe(client)
	updated, err := svc.UpdateAttachment(ownerCtx, &v1pb.UpdateAttachmentRequest{
		Attachment: &v1pb.Attachment{Name: attachment.Name, Filename: "after.txt"},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"filename"}},
	})
	require.NoError(t, err)
	require.Equal(t, "after.txt", updated.Filename)
	requireMemoChanged(t, client.events)
	requireNoMemoChanged(t, client.events)

	_, err = svc.GetAttachment(ownerCtx, &v1pb.GetAttachmentRequest{Name: attachment.Name})
	require.Equal(t, codes.PermissionDenied, status.Code(err), "the authorized read would fail after the committed membership change")
}

func TestDeleteAttachmentPublishesBeforeStorageCleanupFailure(t *testing.T) {
	ctx := context.Background()
	svc := newIntegrationService(t)
	owner := createSpaceTestUser(ctx, t, svc, "sse-attachment-cleanup-owner", store.RoleUser)
	ownerCtx := userCtx(ctx, owner.ID)
	memo, err := svc.CreateMemo(ownerCtx, &v1pb.CreateMemoRequest{
		Memo: &v1pb.Memo{Content: "attachment cleanup failure", Visibility: v1pb.Visibility_PRIVATE},
	})
	require.NoError(t, err)
	attachment, err := svc.CreateAttachment(ownerCtx, &v1pb.CreateAttachmentRequest{Attachment: &v1pb.Attachment{
		Filename: "cleanup.txt",
		Type:     "text/plain",
		Content:  []byte("attachment"),
		Memo:     &memo.Name,
	}})
	require.NoError(t, err)

	client := svc.SSEHub.Subscribe()
	defer svc.SSEHub.Unsubscribe(client)
	_, err = svc.DeleteAttachment(store.WithDeleteAttachmentStorageFailpoint(ownerCtx), &v1pb.DeleteAttachmentRequest{Name: attachment.Name})
	require.Equal(t, codes.Internal, status.Code(err))
	require.ErrorContains(t, err, "attachments were deleted but storage cleanup failed")
	requireMemoChanged(t, client.events)
	requireNoMemoChanged(t, client.events)

	attachmentUID, err := ExtractAttachmentUIDFromName(attachment.Name)
	require.NoError(t, err)
	storedAttachment, err := svc.Store.GetAttachment(ctx, &store.FindAttachment{UID: &attachmentUID})
	require.NoError(t, err)
	require.Nil(t, storedAttachment, "the database deletion must remain committed")
}

func TestSpaceMutationsPublishSpaceChanged(t *testing.T) {
	ctx := context.Background()
	svc := newIntegrationService(t)
	owner := createSpaceTestUser(ctx, t, svc, "sse-space-owner", store.RoleAdmin)
	member := createSpaceTestUser(ctx, t, svc, "sse-space-member", store.RoleUser)
	ownerCtx := userCtx(ctx, owner.ID)
	client := svc.SSEHub.Subscribe()
	defer svc.SSEHub.Unsubscribe(client)

	space, err := svc.CreateSpace(ownerCtx, &v1pb.CreateSpaceRequest{
		SpaceId: "sse-space",
		Space:   &v1pb.Space{Title: "SSE Space"},
	})
	require.NoError(t, err)
	requireSpaceChanged(t, client.events)

	space.Title = "Renamed SSE Space"
	_, err = svc.UpdateSpace(ownerCtx, &v1pb.UpdateSpaceRequest{
		Space:      space,
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"title"}},
	})
	require.NoError(t, err)
	requireSpaceChanged(t, client.events)

	invitation, err := svc.CreateSpaceInvitation(ownerCtx, &v1pb.CreateSpaceInvitationRequest{
		Parent:          space.Name,
		SpaceInvitation: &v1pb.SpaceInvitation{Invitee: BuildUserName(member.Username), Role: v1pb.SpaceMember_USER},
	})
	require.NoError(t, err)
	requireSpaceChanged(t, client.events)
	membership, err := svc.AcceptSpaceInvitation(userCtx(ctx, member.ID), &v1pb.AcceptSpaceInvitationRequest{Name: invitation.Name})
	require.NoError(t, err)
	requireSpaceChanged(t, client.events)

	membership.Role = v1pb.SpaceMember_ADMIN
	_, err = svc.UpdateSpaceMember(ownerCtx, &v1pb.UpdateSpaceMemberRequest{
		SpaceMember: membership,
		UpdateMask:  &fieldmaskpb.FieldMask{Paths: []string{"role"}},
	})
	require.NoError(t, err)
	requireSpaceChanged(t, client.events)

	_, err = svc.DeleteSpaceMember(ownerCtx, &v1pb.DeleteSpaceMemberRequest{Name: membership.Name})
	require.NoError(t, err)
	requireSpaceChanged(t, client.events)

	_, err = svc.DeleteSpace(ownerCtx, &v1pb.DeleteSpaceRequest{Name: space.Name})
	require.NoError(t, err)
	requireSpaceChanged(t, client.events)
}

func TestUpdateMemoSSEBroadcastsToAllSubscribers(t *testing.T) {
	ctx := context.Background()
	svc := newIntegrationService(t)
	owner, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "audience-owner", Role: store.RoleAdmin, Email: "audience-owner@example.com",
	})
	require.NoError(t, err)
	ownerCtx := userCtx(ctx, owner.ID)
	memo, err := svc.CreateMemo(ownerCtx, &v1pb.CreateMemoRequest{
		Memo: &v1pb.Memo{Content: "public before update", Visibility: v1pb.Visibility_PUBLIC},
	})
	require.NoError(t, err)

	ownerClient := svc.SSEHub.Subscribe()
	defer svc.SSEHub.Unsubscribe(ownerClient)
	otherClient := svc.SSEHub.Subscribe()
	defer svc.SSEHub.Unsubscribe(otherClient)

	_, err = svc.UpdateMemo(ownerCtx, &v1pb.UpdateMemoRequest{
		Memo:       &v1pb.Memo{Name: memo.Name, Visibility: v1pb.Visibility_PRIVATE},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"visibility"}},
	})
	require.NoError(t, err)
	requireMemoChanged(t, ownerClient.events)
	requireMemoChanged(t, otherClient.events)

	_, err = svc.UpdateMemo(ownerCtx, &v1pb.UpdateMemoRequest{
		Memo:       &v1pb.Memo{Name: memo.Name, Content: "private after update"},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"content"}},
	})
	require.NoError(t, err)
	requireMemoChanged(t, ownerClient.events)
	requireMemoChanged(t, otherClient.events)
}

func TestMoveSpaceAudienceMemoSSEBroadcastsWithoutAudienceCalculation(t *testing.T) {
	ctx := context.Background()
	svc := newIntegrationService(t)
	owner := createSpaceTestUser(ctx, t, svc, "move-audience-owner", store.RoleAdmin)
	sourceMember := createSpaceTestUser(ctx, t, svc, "move-source-member", store.RoleUser)
	targetMember := createSpaceTestUser(ctx, t, svc, "move-target-member", store.RoleUser)
	ownerCtx := userCtx(ctx, owner.ID)

	source, err := svc.CreateSpace(ownerCtx, &v1pb.CreateSpaceRequest{
		SpaceId: "move-source-space",
		Space:   &v1pb.Space{Title: "Source"},
	})
	require.NoError(t, err)
	target, err := svc.CreateSpace(ownerCtx, &v1pb.CreateSpaceRequest{
		SpaceId: "move-target-space",
		Space:   &v1pb.Space{Title: "Target"},
	})
	require.NoError(t, err)
	inviteAndAcceptSpaceTestUser(ctx, t, svc, owner, sourceMember, source, v1pb.SpaceMember_USER)
	inviteAndAcceptSpaceTestUser(ctx, t, svc, owner, targetMember, target, v1pb.SpaceMember_USER)

	sourceName := source.Name
	memo, err := svc.CreateMemo(ownerCtx, &v1pb.CreateMemoRequest{Memo: &v1pb.Memo{
		Content:    "move between spaces",
		Visibility: v1pb.Visibility_SPACE,
		Space:      &sourceName,
	}})
	require.NoError(t, err)
	sourceClient := svc.SSEHub.Subscribe()
	defer svc.SSEHub.Unsubscribe(sourceClient)
	targetClient := svc.SSEHub.Subscribe()
	defer svc.SSEHub.Unsubscribe(targetClient)
	outsiderClient := svc.SSEHub.Subscribe()
	defer svc.SSEHub.Unsubscribe(outsiderClient)

	targetName := target.Name
	_, err = svc.UpdateMemo(ownerCtx, &v1pb.UpdateMemoRequest{
		Memo: &v1pb.Memo{
			Name:       memo.Name,
			Visibility: v1pb.Visibility_SPACE,
			Space:      &targetName,
		},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"space", "visibility"}},
	})
	require.NoError(t, err)
	requireMemoChanged(t, sourceClient.events)
	requireMemoChanged(t, targetClient.events)
	requireMemoChanged(t, outsiderClient.events)

	_, err = svc.UpdateMemo(ownerCtx, &v1pb.UpdateMemoRequest{
		Memo:       &v1pb.Memo{Name: memo.Name, Content: "target only now"},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"content"}},
	})
	require.NoError(t, err)
	requireMemoChanged(t, sourceClient.events)
	requireMemoChanged(t, targetClient.events)
	requireMemoChanged(t, outsiderClient.events)
}

// ---- CreateMemoComment double-broadcast fix ----

func TestCreateMemoComment_NoDuplicateSSEBroadcast(t *testing.T) {
	ctx := context.Background()
	svc := newIntegrationService(t)

	// Create an admin so the store is initialised, then a regular commenter.
	author, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "author", Role: store.RoleAdmin, Email: "author@example.com",
	})
	require.NoError(t, err)
	commenter, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "commenter", Role: store.RoleUser, Email: "commenter@example.com",
	})
	require.NoError(t, err)

	authorCtx := userCtx(ctx, author.ID)
	commenterCtx := userCtx(ctx, commenter.ID)

	// Create a public memo so the commenter can react.
	parent, err := svc.CreateMemo(authorCtx, &v1pb.CreateMemoRequest{
		Memo: &v1pb.Memo{Content: "parent memo", Visibility: v1pb.Visibility_PUBLIC},
	})
	require.NoError(t, err)

	// Subscribe after the parent memo is created so its change event does not
	// pollute the assertion window.
	client := svc.SSEHub.Subscribe()
	defer svc.SSEHub.Unsubscribe(client)

	// Comment creation is one mutation and emits one invalidation event.
	_, err = svc.CreateMemoComment(commenterCtx, &v1pb.CreateMemoCommentRequest{
		Name:    parent.Name,
		Comment: &v1pb.Memo{Content: "a comment", Visibility: v1pb.Visibility_PUBLIC},
	})
	require.NoError(t, err)

	// Give the synchronous broadcast a moment to land in the buffer, then
	// collect everything that arrived.
	events := collectEventsFor(client.events, 150*time.Millisecond)

	require.Len(t, events, 1, "expected exactly one SSE event for a comment creation, got: %v", events)
	assert.Equal(t, memoChangedSSEFrame, events[0])
}

func TestCreateMemoComment_SSEBroadcastContainsNoSubject(t *testing.T) {
	ctx := context.Background()
	svc := newIntegrationService(t)
	author, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "comment-context-author", Role: store.RoleAdmin, Email: "comment-context-author@example.com",
	})
	require.NoError(t, err)
	commenter, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "private-comment-author", Role: store.RoleUser, Email: "private-comment-author@example.com",
	})
	require.NoError(t, err)

	parent, err := svc.CreateMemo(userCtx(ctx, author.ID), &v1pb.CreateMemoRequest{
		Memo: &v1pb.Memo{Content: "public context", Visibility: v1pb.Visibility_PUBLIC},
	})
	require.NoError(t, err)
	authorClient := svc.SSEHub.Subscribe()
	defer svc.SSEHub.Unsubscribe(authorClient)
	commenterClient := svc.SSEHub.Subscribe()
	defer svc.SSEHub.Unsubscribe(commenterClient)

	_, err = svc.CreateMemoComment(userCtx(ctx, commenter.ID), &v1pb.CreateMemoCommentRequest{
		Name: parent.Name,
		Comment: &v1pb.Memo{
			Content:    "private reply",
			Visibility: v1pb.Visibility_PRIVATE,
		},
	})
	require.NoError(t, err)
	requireMemoChanged(t, commenterClient.events)
	requireMemoChanged(t, authorClient.events)
}

func TestCreateMemoWithAttachment_NoDuplicateUpdatedSSEBroadcast(t *testing.T) {
	ctx := context.Background()
	svc := newIntegrationService(t)

	user, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "user", Role: store.RoleAdmin, Email: "user@example.com",
	})
	require.NoError(t, err)
	uctx := userCtx(ctx, user.ID)

	attachment, err := svc.CreateAttachment(uctx, &v1pb.CreateAttachmentRequest{
		Attachment: &v1pb.Attachment{
			Filename: "test.txt",
			Size:     5,
			Type:     "text/plain",
			Content:  []byte("hello"),
		},
	})
	require.NoError(t, err)

	client := svc.SSEHub.Subscribe()
	defer svc.SSEHub.Unsubscribe(client)

	_, err = svc.CreateMemo(uctx, &v1pb.CreateMemoRequest{
		Memo: &v1pb.Memo{
			Content:    "memo with initial attachment",
			Visibility: v1pb.Visibility_PUBLIC,
			Attachments: []*v1pb.Attachment{
				{Name: attachment.Name},
			},
		},
	})
	require.NoError(t, err)

	events := collectEventsFor(client.events, 150*time.Millisecond)

	require.Len(t, events, 1, "expected exactly one SSE event for memo creation with attachment, got: %v", events)
	assert.Equal(t, memoChangedSSEFrame, events[0])
}

func TestUpsertMemoReactionPublishesMemoChanged(t *testing.T) {
	ctx := context.Background()
	svc := newIntegrationService(t)

	user, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "user", Role: store.RoleAdmin, Email: "user@example.com",
	})
	require.NoError(t, err)
	uctx := userCtx(ctx, user.ID)

	memo, err := svc.CreateMemo(uctx, &v1pb.CreateMemoRequest{
		Memo: &v1pb.Memo{Content: "reacted memo", Visibility: v1pb.Visibility_PUBLIC},
	})
	require.NoError(t, err)

	client := svc.SSEHub.Subscribe()
	defer svc.SSEHub.Unsubscribe(client)

	_, err = svc.UpsertMemoReaction(uctx, &v1pb.UpsertMemoReactionRequest{
		Name: memo.Name,
		Reaction: &v1pb.Reaction{
			ReactionType: "👍",
		},
	})
	require.NoError(t, err)

	requireMemoChanged(t, client.events)
	mustNotReceive(t, client.events, 100*time.Millisecond)
}

func TestDeleteMemoReactionPublishesMemoChanged(t *testing.T) {
	ctx := context.Background()
	svc := newIntegrationService(t)

	user, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "user", Role: store.RoleAdmin, Email: "user@example.com",
	})
	require.NoError(t, err)
	uctx := userCtx(ctx, user.ID)

	memo, err := svc.CreateMemo(uctx, &v1pb.CreateMemoRequest{
		Memo: &v1pb.Memo{Content: "reacted memo", Visibility: v1pb.Visibility_PUBLIC},
	})
	require.NoError(t, err)

	reaction, err := svc.UpsertMemoReaction(uctx, &v1pb.UpsertMemoReactionRequest{
		Name: memo.Name,
		Reaction: &v1pb.Reaction{
			ReactionType: "❤️",
		},
	})
	require.NoError(t, err)

	client := svc.SSEHub.Subscribe()
	defer svc.SSEHub.Unsubscribe(client)

	_, err = svc.DeleteMemoReaction(uctx, &v1pb.DeleteMemoReactionRequest{
		Name: reaction.Name,
	})
	require.NoError(t, err)

	requireMemoChanged(t, client.events)
	mustNotReceive(t, client.events, 100*time.Millisecond)
}

func TestDeleteMemo_DeletesOnlyRequestedMemo(t *testing.T) {
	ctx := context.Background()
	svc := newIntegrationService(t)
	rootAuthor, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "delete-root-author", Role: store.RoleAdmin, Email: "delete-root-author@example.com",
	})
	require.NoError(t, err)
	commentAuthor, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "delete-comment-author", Role: store.RoleUser, Email: "delete-comment-author@example.com",
	})
	require.NoError(t, err)
	replyAuthor, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "delete-reply-author", Role: store.RoleUser, Email: "delete-reply-author@example.com",
	})
	require.NoError(t, err)

	root, err := svc.CreateMemo(userCtx(ctx, rootAuthor.ID), &v1pb.CreateMemoRequest{
		Memo: &v1pb.Memo{Content: "context memo", Visibility: v1pb.Visibility_PUBLIC},
	})
	require.NoError(t, err)
	comment, err := svc.CreateMemoComment(userCtx(ctx, commentAuthor.ID), &v1pb.CreateMemoCommentRequest{
		Name:    root.Name,
		Comment: &v1pb.Memo{Content: "branch", Visibility: v1pb.Visibility_PUBLIC},
	})
	require.NoError(t, err)
	reply, err := svc.CreateMemoComment(userCtx(ctx, replyAuthor.ID), &v1pb.CreateMemoCommentRequest{
		Name:    comment.Name,
		Comment: &v1pb.Memo{Content: "nested reply"},
	})
	require.NoError(t, err)

	replyClient := svc.SSEHub.Subscribe()
	defer svc.SSEHub.Unsubscribe(replyClient)
	_, err = svc.DeleteMemo(userCtx(ctx, commentAuthor.ID), &v1pb.DeleteMemoRequest{Name: comment.Name})
	require.NoError(t, err)
	requireMemoChanged(t, replyClient.events)

	commentUID, err := ExtractMemoUIDFromName(comment.Name)
	require.NoError(t, err)
	storedComment, err := svc.Store.GetMemo(ctx, &store.FindMemo{UID: &commentUID})
	require.NoError(t, err)
	require.Nil(t, storedComment)
	replyUID, err := ExtractMemoUIDFromName(reply.Name)
	require.NoError(t, err)
	storedReply, err := svc.Store.GetMemo(ctx, &store.FindMemo{UID: &replyUID})
	require.NoError(t, err)
	require.NotNil(t, storedReply, "deleting a COMMENT endpoint must not cascade to the replying memo")
	rootUID, err := ExtractMemoUIDFromName(root.Name)
	require.NoError(t, err)
	storedRoot, err := svc.Store.GetMemo(ctx, &store.FindMemo{UID: &rootUID})
	require.NoError(t, err)
	require.NotNil(t, storedRoot)
}

func TestDeleteMemoCleansAttachmentStorage(t *testing.T) {
	ctx := context.Background()
	svc := newIntegrationService(t)
	owner, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "delete-cleanup-owner", Role: store.RoleAdmin, Email: "delete-cleanup-owner@example.com",
	})
	require.NoError(t, err)
	ownerCtx := userCtx(ctx, owner.ID)
	memo, err := svc.CreateMemo(ownerCtx, &v1pb.CreateMemoRequest{
		Memo: &v1pb.Memo{Content: "attachment cleanup", Visibility: v1pb.Visibility_PRIVATE},
	})
	require.NoError(t, err)
	memoUID, err := ExtractMemoUIDFromName(memo.Name)
	require.NoError(t, err)
	storedMemo, err := svc.Store.GetMemo(ctx, &store.FindMemo{UID: &memoUID})
	require.NoError(t, err)
	require.NotNil(t, storedMemo)
	attachmentPath := filepath.Join(t.TempDir(), "sse-delete-cleanup.txt")
	require.NoError(t, os.WriteFile(attachmentPath, []byte("cleanup"), 0o600))
	attachment, err := svc.Store.CreateAttachment(ctx, &store.Attachment{
		UID:         "sse-delete-cleanup",
		CreatorID:   owner.ID,
		Filename:    "cleanup.txt",
		Type:        "text/plain",
		Size:        7,
		Blob:        []byte("cleanup"),
		StorageType: storepb.AttachmentStorageType_LOCAL,
		Reference:   attachmentPath,
		MemoID:      &storedMemo.ID,
	})
	require.NoError(t, err)

	client := svc.SSEHub.Subscribe()
	defer svc.SSEHub.Unsubscribe(client)
	_, err = svc.DeleteMemo(ownerCtx, &v1pb.DeleteMemoRequest{Name: memo.Name})
	require.NoError(t, err, "committed deletion must not be reported as a failure")
	requireMemoChanged(t, client.events)

	deletedMemo, err := svc.Store.GetMemo(ctx, &store.FindMemo{UID: &memoUID})
	require.NoError(t, err)
	require.Nil(t, deletedMemo)
	deletedAttachment, err := svc.Store.GetAttachment(ctx, &store.FindAttachment{ID: &attachment.ID})
	require.NoError(t, err)
	require.Nil(t, deletedAttachment)
	_, err = os.Stat(attachmentPath)
	require.ErrorIs(t, err, os.ErrNotExist)
}

func TestSetMemoAttachmentsPublishesMemoChanged(t *testing.T) {
	ctx := context.Background()
	svc := newIntegrationService(t)

	user, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "user", Role: store.RoleAdmin, Email: "user@example.com",
	})
	require.NoError(t, err)
	uctx := userCtx(ctx, user.ID)

	memo, err := svc.CreateMemo(uctx, &v1pb.CreateMemoRequest{
		Memo: &v1pb.Memo{Content: "memo with attachments", Visibility: v1pb.Visibility_PUBLIC},
	})
	require.NoError(t, err)

	attachment, err := svc.CreateAttachment(uctx, &v1pb.CreateAttachmentRequest{
		Attachment: &v1pb.Attachment{
			Filename: "test.txt",
			Size:     5,
			Type:     "text/plain",
			Content:  []byte("hello"),
		},
	})
	require.NoError(t, err)

	client := svc.SSEHub.Subscribe()
	defer svc.SSEHub.Unsubscribe(client)

	_, err = svc.SetMemoAttachments(uctx, &v1pb.SetMemoAttachmentsRequest{
		Name: memo.Name,
		Attachments: []*v1pb.Attachment{
			{Name: attachment.Name},
		},
	})
	require.NoError(t, err)

	requireMemoChanged(t, client.events)
	mustNotReceive(t, client.events, 100*time.Millisecond)
}

func TestSetMemoRelationsPublishesMemoChanged(t *testing.T) {
	ctx := context.Background()
	svc := newIntegrationService(t)

	user, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "user", Role: store.RoleAdmin, Email: "user@example.com",
	})
	require.NoError(t, err)
	uctx := userCtx(ctx, user.ID)

	memo1, err := svc.CreateMemo(uctx, &v1pb.CreateMemoRequest{
		Memo: &v1pb.Memo{Content: "memo one", Visibility: v1pb.Visibility_PUBLIC},
	})
	require.NoError(t, err)
	memo2, err := svc.CreateMemo(uctx, &v1pb.CreateMemoRequest{
		Memo: &v1pb.Memo{Content: "memo two", Visibility: v1pb.Visibility_PUBLIC},
	})
	require.NoError(t, err)

	client := svc.SSEHub.Subscribe()
	defer svc.SSEHub.Unsubscribe(client)

	_, err = svc.SetMemoRelations(uctx, &v1pb.SetMemoRelationsRequest{
		Name: memo1.Name,
		Relations: []*v1pb.MemoRelation{
			{
				RelatedMemo: &v1pb.MemoRelation_Memo{Name: memo2.Name},
				Type:        v1pb.MemoRelation_REFERENCE,
			},
		},
	})
	require.NoError(t, err)

	requireMemoChanged(t, client.events)
	mustNotReceive(t, client.events, 100*time.Millisecond)
}
