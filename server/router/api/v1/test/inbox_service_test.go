package v1

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/fieldmaskpb"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func TestListInboxes(t *testing.T) {
	ctx := context.Background()

	t.Run("ListInboxes success", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create a user
		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, user.ID)

		// List inboxes (should be empty initially)
		req := &v1pb.ListInboxesRequest{
			Parent: fmt.Sprintf("users/%d", user.ID),
		}

		resp, err := ts.Service.ListInboxes(userCtx, req)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Empty(t, resp.Inboxes)
		require.Equal(t, int32(0), resp.TotalSize)
	})

	t.Run("ListInboxes with pagination", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create a user
		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		// Create some inbox entries
		const systemBotID int32 = 0
		for i := 0; i < 3; i++ {
			_, err := ts.Store.CreateInbox(ctx, &store.Inbox{
				SenderID:   systemBotID,
				ReceiverID: user.ID,
				Status:     store.UNREAD,
				Message: &storepb.InboxMessage{
					Type: storepb.InboxMessage_MEMO_COMMENT,
				},
			})
			require.NoError(t, err)
		}

		// Set user context
		userCtx := ts.CreateUserContext(ctx, user.ID)

		// List inboxes with page size limit
		req := &v1pb.ListInboxesRequest{
			Parent:   fmt.Sprintf("users/%d", user.ID),
			PageSize: 2,
		}

		resp, err := ts.Service.ListInboxes(userCtx, req)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, 2, len(resp.Inboxes))
		require.NotEmpty(t, resp.NextPageToken)
	})

	t.Run("ListInboxes permission denied for different user", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create two users
		user1, err := ts.CreateRegularUser(ctx, "user1")
		require.NoError(t, err)
		user2, err := ts.CreateRegularUser(ctx, "user2")
		require.NoError(t, err)

		// Set user1 context but try to list user2's inboxes
		userCtx := ts.CreateUserContext(ctx, user1.ID)

		req := &v1pb.ListInboxesRequest{
			Parent: fmt.Sprintf("users/%d", user2.ID),
		}

		_, err = ts.Service.ListInboxes(userCtx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "cannot access inboxes")
	})

	t.Run("ListInboxes host can access other users' inboxes", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create a host user and a regular user
		hostUser, err := ts.CreateHostUser(ctx, "hostuser")
		require.NoError(t, err)
		regularUser, err := ts.CreateRegularUser(ctx, "regularuser")
		require.NoError(t, err)

		// Create an inbox for the regular user
		const systemBotID int32 = 0
		_, err = ts.Store.CreateInbox(ctx, &store.Inbox{
			SenderID:   systemBotID,
			ReceiverID: regularUser.ID,
			Status:     store.UNREAD,
			Message: &storepb.InboxMessage{
				Type: storepb.InboxMessage_MEMO_COMMENT,
			},
		})
		require.NoError(t, err)

		// Set host user context and try to list regular user's inboxes
		hostCtx := ts.CreateUserContext(ctx, hostUser.ID)

		req := &v1pb.ListInboxesRequest{
			Parent: fmt.Sprintf("users/%d", regularUser.ID),
		}

		resp, err := ts.Service.ListInboxes(hostCtx, req)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, 1, len(resp.Inboxes))
	})

	t.Run("ListInboxes invalid parent format", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create a user
		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, user.ID)

		req := &v1pb.ListInboxesRequest{
			Parent: "invalid-parent-format",
		}

		_, err = ts.Service.ListInboxes(userCtx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid parent name")
	})

	t.Run("ListInboxes unauthenticated", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		req := &v1pb.ListInboxesRequest{
			Parent: "users/1",
		}

		_, err := ts.Service.ListInboxes(ctx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "user not authenticated")
	})
}

func TestUpdateInbox(t *testing.T) {
	ctx := context.Background()

	t.Run("UpdateInbox success", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create a user
		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		// Create an inbox entry
		const systemBotID int32 = 0
		inbox, err := ts.Store.CreateInbox(ctx, &store.Inbox{
			SenderID:   systemBotID,
			ReceiverID: user.ID,
			Status:     store.UNREAD,
			Message: &storepb.InboxMessage{
				Type: storepb.InboxMessage_MEMO_COMMENT,
			},
		})
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, user.ID)

		// Update inbox status
		req := &v1pb.UpdateInboxRequest{
			Inbox: &v1pb.Inbox{
				Name:   fmt.Sprintf("inboxes/%d", inbox.ID),
				Status: v1pb.Inbox_ARCHIVED,
			},
			UpdateMask: &fieldmaskpb.FieldMask{
				Paths: []string{"status"},
			},
		}

		resp, err := ts.Service.UpdateInbox(userCtx, req)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, v1pb.Inbox_ARCHIVED, resp.Status)
	})

	t.Run("UpdateInbox permission denied for different user", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create two users
		user1, err := ts.CreateRegularUser(ctx, "user1")
		require.NoError(t, err)
		user2, err := ts.CreateRegularUser(ctx, "user2")
		require.NoError(t, err)

		// Create an inbox entry for user2
		const systemBotID int32 = 0
		inbox, err := ts.Store.CreateInbox(ctx, &store.Inbox{
			SenderID:   systemBotID,
			ReceiverID: user2.ID,
			Status:     store.UNREAD,
			Message: &storepb.InboxMessage{
				Type: storepb.InboxMessage_MEMO_COMMENT,
			},
		})
		require.NoError(t, err)

		// Set user1 context but try to update user2's inbox
		userCtx := ts.CreateUserContext(ctx, user1.ID)

		req := &v1pb.UpdateInboxRequest{
			Inbox: &v1pb.Inbox{
				Name:   fmt.Sprintf("inboxes/%d", inbox.ID),
				Status: v1pb.Inbox_ARCHIVED,
			},
			UpdateMask: &fieldmaskpb.FieldMask{
				Paths: []string{"status"},
			},
		}

		_, err = ts.Service.UpdateInbox(userCtx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "cannot update inbox")
	})

	t.Run("UpdateInbox missing update mask", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create a user
		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, user.ID)

		req := &v1pb.UpdateInboxRequest{
			Inbox: &v1pb.Inbox{
				Name:   "inboxes/1",
				Status: v1pb.Inbox_ARCHIVED,
			},
		}

		_, err = ts.Service.UpdateInbox(userCtx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "update mask is required")
	})

	t.Run("UpdateInbox invalid name format", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create a user
		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, user.ID)

		req := &v1pb.UpdateInboxRequest{
			Inbox: &v1pb.Inbox{
				Name:   "invalid-inbox-name",
				Status: v1pb.Inbox_ARCHIVED,
			},
			UpdateMask: &fieldmaskpb.FieldMask{
				Paths: []string{"status"},
			},
		}

		_, err = ts.Service.UpdateInbox(userCtx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid inbox name")
	})

	t.Run("UpdateInbox not found", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create a user
		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, user.ID)

		req := &v1pb.UpdateInboxRequest{
			Inbox: &v1pb.Inbox{
				Name:   "inboxes/99999", // Non-existent inbox
				Status: v1pb.Inbox_ARCHIVED,
			},
			UpdateMask: &fieldmaskpb.FieldMask{
				Paths: []string{"status"},
			},
		}

		_, err = ts.Service.UpdateInbox(userCtx, req)
		require.Error(t, err)
		st, ok := status.FromError(err)
		require.True(t, ok)
		require.Equal(t, codes.NotFound, st.Code())
	})

	t.Run("UpdateInbox unsupported field", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create a user
		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		// Create an inbox entry
		const systemBotID int32 = 0
		inbox, err := ts.Store.CreateInbox(ctx, &store.Inbox{
			SenderID:   systemBotID,
			ReceiverID: user.ID,
			Status:     store.UNREAD,
			Message: &storepb.InboxMessage{
				Type: storepb.InboxMessage_MEMO_COMMENT,
			},
		})
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, user.ID)

		req := &v1pb.UpdateInboxRequest{
			Inbox: &v1pb.Inbox{
				Name:   fmt.Sprintf("inboxes/%d", inbox.ID),
				Status: v1pb.Inbox_ARCHIVED,
			},
			UpdateMask: &fieldmaskpb.FieldMask{
				Paths: []string{"unsupported_field"},
			},
		}

		_, err = ts.Service.UpdateInbox(userCtx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "unsupported field")
	})
}

func TestDeleteInbox(t *testing.T) {
	ctx := context.Background()

	t.Run("DeleteInbox success", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create a user
		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		// Create an inbox entry
		const systemBotID int32 = 0
		inbox, err := ts.Store.CreateInbox(ctx, &store.Inbox{
			SenderID:   systemBotID,
			ReceiverID: user.ID,
			Status:     store.UNREAD,
			Message: &storepb.InboxMessage{
				Type: storepb.InboxMessage_MEMO_COMMENT,
			},
		})
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, user.ID)

		// Delete inbox
		req := &v1pb.DeleteInboxRequest{
			Name: fmt.Sprintf("inboxes/%d", inbox.ID),
		}

		_, err = ts.Service.DeleteInbox(userCtx, req)
		require.NoError(t, err)

		// Verify inbox is deleted
		inboxes, err := ts.Store.ListInboxes(ctx, &store.FindInbox{
			ReceiverID: &user.ID,
		})
		require.NoError(t, err)
		require.Equal(t, 0, len(inboxes))
	})

	t.Run("DeleteInbox permission denied for different user", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create two users
		user1, err := ts.CreateRegularUser(ctx, "user1")
		require.NoError(t, err)
		user2, err := ts.CreateRegularUser(ctx, "user2")
		require.NoError(t, err)

		// Create an inbox entry for user2
		const systemBotID int32 = 0
		inbox, err := ts.Store.CreateInbox(ctx, &store.Inbox{
			SenderID:   systemBotID,
			ReceiverID: user2.ID,
			Status:     store.UNREAD,
			Message: &storepb.InboxMessage{
				Type: storepb.InboxMessage_MEMO_COMMENT,
			},
		})
		require.NoError(t, err)

		// Set user1 context but try to delete user2's inbox
		userCtx := ts.CreateUserContext(ctx, user1.ID)

		req := &v1pb.DeleteInboxRequest{
			Name: fmt.Sprintf("inboxes/%d", inbox.ID),
		}

		_, err = ts.Service.DeleteInbox(userCtx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "cannot delete inbox")
	})

	t.Run("DeleteInbox invalid name format", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create a user
		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, user.ID)

		req := &v1pb.DeleteInboxRequest{
			Name: "invalid-inbox-name",
		}

		_, err = ts.Service.DeleteInbox(userCtx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid inbox name")
	})

	t.Run("DeleteInbox not found", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create a user
		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, user.ID)

		req := &v1pb.DeleteInboxRequest{
			Name: "inboxes/99999", // Non-existent inbox
		}

		_, err = ts.Service.DeleteInbox(userCtx, req)
		require.Error(t, err)
		st, ok := status.FromError(err)
		require.True(t, ok)
		require.Equal(t, codes.NotFound, st.Code())
	})
}

func TestInboxCRUDComplete(t *testing.T) {
	ctx := context.Background()

	t.Run("Complete CRUD lifecycle", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create a user
		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		// Create an inbox entry directly in store
		const systemBotID int32 = 0
		inbox, err := ts.Store.CreateInbox(ctx, &store.Inbox{
			SenderID:   systemBotID,
			ReceiverID: user.ID,
			Status:     store.UNREAD,
			Message: &storepb.InboxMessage{
				Type: storepb.InboxMessage_MEMO_COMMENT,
			},
		})
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, user.ID)

		// 1. List inboxes - should have 1
		listReq := &v1pb.ListInboxesRequest{
			Parent: fmt.Sprintf("users/%d", user.ID),
		}
		listResp, err := ts.Service.ListInboxes(userCtx, listReq)
		require.NoError(t, err)
		require.Equal(t, 1, len(listResp.Inboxes))
		require.Equal(t, v1pb.Inbox_UNREAD, listResp.Inboxes[0].Status)

		// 2. Update inbox status to ARCHIVED
		updateReq := &v1pb.UpdateInboxRequest{
			Inbox: &v1pb.Inbox{
				Name:   fmt.Sprintf("inboxes/%d", inbox.ID),
				Status: v1pb.Inbox_ARCHIVED,
			},
			UpdateMask: &fieldmaskpb.FieldMask{
				Paths: []string{"status"},
			},
		}
		updateResp, err := ts.Service.UpdateInbox(userCtx, updateReq)
		require.NoError(t, err)
		require.Equal(t, v1pb.Inbox_ARCHIVED, updateResp.Status)

		// 3. List inboxes again - should still have 1 but ARCHIVED
		listResp, err = ts.Service.ListInboxes(userCtx, listReq)
		require.NoError(t, err)
		require.Equal(t, 1, len(listResp.Inboxes))
		require.Equal(t, v1pb.Inbox_ARCHIVED, listResp.Inboxes[0].Status)

		// 4. Delete inbox
		deleteReq := &v1pb.DeleteInboxRequest{
			Name: fmt.Sprintf("inboxes/%d", inbox.ID),
		}
		_, err = ts.Service.DeleteInbox(userCtx, deleteReq)
		require.NoError(t, err)

		// 5. List inboxes - should be empty
		listResp, err = ts.Service.ListInboxes(userCtx, listReq)
		require.NoError(t, err)
		require.Equal(t, 0, len(listResp.Inboxes))
		require.Equal(t, int32(0), listResp.TotalSize)
	})
}
