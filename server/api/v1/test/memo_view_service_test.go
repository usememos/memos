package test

import (
	"context"
	"fmt"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/fieldmaskpb"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
)

func TestListMemoViews(t *testing.T) {
	ctx := context.Background()

	t.Run("ListMemoViews success", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create a user
		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, user.ID)

		// List memoViews (should be empty initially)
		req := &v1pb.ListMemoViewsRequest{
			Parent: fmt.Sprintf("users/%s", user.Username),
		}

		resp, err := ts.Service.ListMemoViews(userCtx, req)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Empty(t, resp.MemoViews)
	})

	t.Run("ListMemoViews permission denied for different user", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create two users
		user1, err := ts.CreateRegularUser(ctx, "user1")
		require.NoError(t, err)
		user2, err := ts.CreateRegularUser(ctx, "user2")
		require.NoError(t, err)

		// Set user1 context but try to list user2's memoViews
		userCtx := ts.CreateUserContext(ctx, user1.ID)

		req := &v1pb.ListMemoViewsRequest{
			Parent: fmt.Sprintf("users/%s", user2.Username),
		}

		_, err = ts.Service.ListMemoViews(userCtx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "permission denied")
	})

	t.Run("ListMemoViews invalid parent format", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create user
		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, user.ID)

		req := &v1pb.ListMemoViewsRequest{
			Parent: "invalid-parent-format",
		}

		_, err = ts.Service.ListMemoViews(userCtx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid user name")
	})

	t.Run("ListMemoViews unauthenticated", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		_, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		req := &v1pb.ListMemoViewsRequest{
			Parent: "users/testuser",
		}

		_, err = ts.Service.ListMemoViews(ctx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "user not authenticated")
	})

	t.Run("ListMemoViews returns not found for numeric parent", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		userCtx := ts.CreateUserContext(ctx, user.ID)

		_, err = ts.Service.ListMemoViews(userCtx, &v1pb.ListMemoViewsRequest{
			Parent: "users/1",
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "user not found")
	})
}

func TestGetMemoView(t *testing.T) {
	ctx := context.Background()

	t.Run("GetMemoView success", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create a user
		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, user.ID)

		// First create a memoView
		createReq := &v1pb.CreateMemoViewRequest{
			Parent: fmt.Sprintf("users/%s", user.Username),
			MemoView: &v1pb.MemoView{
				Title:  "Test MemoView",
				Filter: "tag in [\"test\"]",
			},
		}

		created, err := ts.Service.CreateMemoView(userCtx, createReq)
		require.NoError(t, err)

		// Now get the memoView
		getReq := &v1pb.GetMemoViewRequest{
			Name: created.Name,
		}

		resp, err := ts.Service.GetMemoView(userCtx, getReq)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, created.Name, resp.Name)
		require.Equal(t, "Test MemoView", resp.Title)
		require.Equal(t, "tag in [\"test\"]", resp.Filter)
	})

	t.Run("GetMemoView permission denied for different user", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create two users
		user1, err := ts.CreateRegularUser(ctx, "user1")
		require.NoError(t, err)
		user2, err := ts.CreateRegularUser(ctx, "user2")
		require.NoError(t, err)

		// Create memoView as user1
		user1Ctx := ts.CreateUserContext(ctx, user1.ID)
		createReq := &v1pb.CreateMemoViewRequest{
			Parent: fmt.Sprintf("users/%s", user1.Username),
			MemoView: &v1pb.MemoView{
				Title:  "User1 MemoView",
				Filter: "tag in [\"user1\"]",
			},
		}

		created, err := ts.Service.CreateMemoView(user1Ctx, createReq)
		require.NoError(t, err)

		// Try to get memoView as user2
		user2Ctx := ts.CreateUserContext(ctx, user2.ID)
		getReq := &v1pb.GetMemoViewRequest{
			Name: created.Name,
		}

		_, err = ts.Service.GetMemoView(user2Ctx, getReq)
		require.Error(t, err)
		require.Contains(t, err.Error(), "permission denied")
	})

	t.Run("GetMemoView invalid name format", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create user
		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, user.ID)

		req := &v1pb.GetMemoViewRequest{
			Name: "invalid-memo-view-name",
		}

		_, err = ts.Service.GetMemoView(userCtx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid memo view name")
	})

	t.Run("GetMemoView not found", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create user
		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, user.ID)

		req := &v1pb.GetMemoViewRequest{
			Name: fmt.Sprintf("users/%s", user.Username) + "/views/nonexistent",
		}

		_, err = ts.Service.GetMemoView(userCtx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "not found")
	})
}

func TestCreateMemoView(t *testing.T) {
	ctx := context.Background()

	t.Run("CreateMemoView success", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create a user
		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, user.ID)

		req := &v1pb.CreateMemoViewRequest{
			Parent: fmt.Sprintf("users/%s", user.Username),
			MemoView: &v1pb.MemoView{
				Title:  "My MemoView",
				Filter: "tag in [\"important\"]",
			},
		}

		resp, err := ts.Service.CreateMemoView(userCtx, req)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, "My MemoView", resp.Title)
		require.Equal(t, "tag in [\"important\"]", resp.Filter)
		require.Contains(t, resp.Name, fmt.Sprintf("users/%s/views/", user.Username))

		// Verify the memoView was created by listing
		listReq := &v1pb.ListMemoViewsRequest{
			Parent: fmt.Sprintf("users/%s", user.Username),
		}

		listResp, err := ts.Service.ListMemoViews(userCtx, listReq)
		require.NoError(t, err)
		require.Len(t, listResp.MemoViews, 1)
		require.Equal(t, "My MemoView", listResp.MemoViews[0].Title)
	})

	t.Run("CreateMemoView permission denied for different user", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create two users
		user1, err := ts.CreateRegularUser(ctx, "user1")
		require.NoError(t, err)
		user2, err := ts.CreateRegularUser(ctx, "user2")
		require.NoError(t, err)

		// Set user1 context but try to create memoView for user2
		userCtx := ts.CreateUserContext(ctx, user1.ID)

		req := &v1pb.CreateMemoViewRequest{
			Parent: fmt.Sprintf("users/%s", user2.Username),
			MemoView: &v1pb.MemoView{
				Title:  "Forbidden MemoView",
				Filter: "tag in [\"forbidden\"]",
			},
		}

		_, err = ts.Service.CreateMemoView(userCtx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "permission denied")
	})

	t.Run("CreateMemoView invalid parent format", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create user
		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, user.ID)

		req := &v1pb.CreateMemoViewRequest{
			Parent: "invalid-parent",
			MemoView: &v1pb.MemoView{
				Title:  "Test MemoView",
				Filter: "tag in [\"test\"]",
			},
		}

		_, err = ts.Service.CreateMemoView(userCtx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid user name")
	})

	t.Run("CreateMemoView invalid filter", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create user
		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, user.ID)

		req := &v1pb.CreateMemoViewRequest{
			Parent: fmt.Sprintf("users/%s", user.Username),
			MemoView: &v1pb.MemoView{
				Title:  "Invalid Filter MemoView",
				Filter: "invalid||filter))syntax",
			},
		}

		_, err = ts.Service.CreateMemoView(userCtx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid filter")
	})

	t.Run("CreateMemoView missing title", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create user
		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, user.ID)

		req := &v1pb.CreateMemoViewRequest{
			Parent: fmt.Sprintf("users/%s", user.Username),
			MemoView: &v1pb.MemoView{
				Filter: "tag in [\"test\"]",
			},
		}

		_, err = ts.Service.CreateMemoView(userCtx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "title is required")
	})
}

func TestUpdateMemoView(t *testing.T) {
	ctx := context.Background()

	t.Run("UpdateMemoView success", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create a user
		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, user.ID)

		// Create a memoView first
		createReq := &v1pb.CreateMemoViewRequest{
			Parent: fmt.Sprintf("users/%s", user.Username),
			MemoView: &v1pb.MemoView{
				Title:  "Original Title",
				Filter: "tag in [\"original\"]",
			},
		}

		created, err := ts.Service.CreateMemoView(userCtx, createReq)
		require.NoError(t, err)

		// Update the memoView
		updateReq := &v1pb.UpdateMemoViewRequest{
			MemoView: &v1pb.MemoView{
				Name:   created.Name,
				Title:  "Updated Title",
				Filter: "tag in [\"updated\"]",
			},
			UpdateMask: &fieldmaskpb.FieldMask{
				Paths: []string{"title", "filter"},
			},
		}

		updated, err := ts.Service.UpdateMemoView(userCtx, updateReq)
		require.NoError(t, err)
		require.NotNil(t, updated)
		require.Equal(t, "Updated Title", updated.Title)
		require.Equal(t, "tag in [\"updated\"]", updated.Filter)
		require.Equal(t, created.Name, updated.Name)
	})

	t.Run("UpdateMemoView permission denied for different user", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create two users
		user1, err := ts.CreateRegularUser(ctx, "user1")
		require.NoError(t, err)
		user2, err := ts.CreateRegularUser(ctx, "user2")
		require.NoError(t, err)

		// Create memoView as user1
		user1Ctx := ts.CreateUserContext(ctx, user1.ID)
		createReq := &v1pb.CreateMemoViewRequest{
			Parent: fmt.Sprintf("users/%s", user1.Username),
			MemoView: &v1pb.MemoView{
				Title:  "User1 MemoView",
				Filter: "tag in [\"user1\"]",
			},
		}

		created, err := ts.Service.CreateMemoView(user1Ctx, createReq)
		require.NoError(t, err)

		// Try to update memoView as user2
		user2Ctx := ts.CreateUserContext(ctx, user2.ID)
		updateReq := &v1pb.UpdateMemoViewRequest{
			MemoView: &v1pb.MemoView{
				Name:   created.Name,
				Title:  "Hacked Title",
				Filter: "tag in [\"hacked\"]",
			},
			UpdateMask: &fieldmaskpb.FieldMask{
				Paths: []string{"title", "filter"},
			},
		}

		_, err = ts.Service.UpdateMemoView(user2Ctx, updateReq)
		require.Error(t, err)
		require.Contains(t, err.Error(), "permission denied")
	})

	t.Run("UpdateMemoView missing update mask", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create a user and context for authentication
		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, user.ID)

		req := &v1pb.UpdateMemoViewRequest{
			MemoView: &v1pb.MemoView{
				Name:  fmt.Sprintf("users/%s/views/test", user.Username),
				Title: "Updated Title",
			},
		}

		_, err = ts.Service.UpdateMemoView(userCtx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "update mask is required")
	})

	t.Run("UpdateMemoView rejects unsupported update mask paths", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, user.ID)
		created, err := ts.Service.CreateMemoView(userCtx, &v1pb.CreateMemoViewRequest{
			Parent: fmt.Sprintf("users/%s", user.Username),
			MemoView: &v1pb.MemoView{
				Title:  "Original Title",
				Filter: `tag in ["original"]`,
			},
		})
		require.NoError(t, err)

		_, err = ts.Service.UpdateMemoView(userCtx, &v1pb.UpdateMemoViewRequest{
			MemoView:   created,
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"name"}},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "unsupported update mask path: name")
	})

	t.Run("UpdateMemoView invalid name format", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		req := &v1pb.UpdateMemoViewRequest{
			MemoView: &v1pb.MemoView{
				Name:  "invalid-memo-view-name",
				Title: "Updated Title",
			},
			UpdateMask: &fieldmaskpb.FieldMask{
				Paths: []string{"title"},
			},
		}

		_, err := ts.Service.UpdateMemoView(ctx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid memo view name")
	})

	t.Run("UpdateMemoView invalid filter", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create user
		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, user.ID)

		// Create a memoView first
		createReq := &v1pb.CreateMemoViewRequest{
			Parent: fmt.Sprintf("users/%s", user.Username),
			MemoView: &v1pb.MemoView{
				Title:  "Test MemoView",
				Filter: "tag in [\"test\"]",
			},
		}

		created, err := ts.Service.CreateMemoView(userCtx, createReq)
		require.NoError(t, err)

		// Try to update with invalid filter
		updateReq := &v1pb.UpdateMemoViewRequest{
			MemoView: &v1pb.MemoView{
				Name:   created.Name,
				Filter: "invalid||filter))syntax",
			},
			UpdateMask: &fieldmaskpb.FieldMask{
				Paths: []string{"filter"},
			},
		}

		_, err = ts.Service.UpdateMemoView(userCtx, updateReq)
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid filter")
	})
}

func TestDeleteMemoView(t *testing.T) {
	ctx := context.Background()

	t.Run("DeleteMemoView success", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create a user
		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, user.ID)

		// Create a memoView first
		createReq := &v1pb.CreateMemoViewRequest{
			Parent: fmt.Sprintf("users/%s", user.Username),
			MemoView: &v1pb.MemoView{
				Title:  "MemoView to Delete",
				Filter: "tag in [\"delete\"]",
			},
		}

		created, err := ts.Service.CreateMemoView(userCtx, createReq)
		require.NoError(t, err)

		// Delete the memoView
		deleteReq := &v1pb.DeleteMemoViewRequest{
			Name: created.Name,
		}

		_, err = ts.Service.DeleteMemoView(userCtx, deleteReq)
		require.NoError(t, err)

		// Verify deletion by listing memoViews
		listReq := &v1pb.ListMemoViewsRequest{
			Parent: fmt.Sprintf("users/%s", user.Username),
		}

		listResp, err := ts.Service.ListMemoViews(userCtx, listReq)
		require.NoError(t, err)
		require.Empty(t, listResp.MemoViews)

		// Also verify by trying to get the deleted memoView
		getReq := &v1pb.GetMemoViewRequest{
			Name: created.Name,
		}

		_, err = ts.Service.GetMemoView(userCtx, getReq)
		require.Error(t, err)
		require.Contains(t, err.Error(), "not found")
	})

	t.Run("DeleteMemoView permission denied for different user", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create two users
		user1, err := ts.CreateRegularUser(ctx, "user1")
		require.NoError(t, err)
		user2, err := ts.CreateRegularUser(ctx, "user2")
		require.NoError(t, err)

		// Create memoView as user1
		user1Ctx := ts.CreateUserContext(ctx, user1.ID)
		createReq := &v1pb.CreateMemoViewRequest{
			Parent: fmt.Sprintf("users/%s", user1.Username),
			MemoView: &v1pb.MemoView{
				Title:  "User1 MemoView",
				Filter: "tag in [\"user1\"]",
			},
		}

		created, err := ts.Service.CreateMemoView(user1Ctx, createReq)
		require.NoError(t, err)

		// Try to delete memoView as user2
		user2Ctx := ts.CreateUserContext(ctx, user2.ID)
		deleteReq := &v1pb.DeleteMemoViewRequest{
			Name: created.Name,
		}

		_, err = ts.Service.DeleteMemoView(user2Ctx, deleteReq)
		require.Error(t, err)
		require.Contains(t, err.Error(), "permission denied")
	})

	t.Run("DeleteMemoView invalid name format", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		req := &v1pb.DeleteMemoViewRequest{
			Name: "invalid-memo-view-name",
		}

		_, err := ts.Service.DeleteMemoView(ctx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid memo view name")
	})

	t.Run("DeleteMemoView not found", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create user
		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, user.ID)

		req := &v1pb.DeleteMemoViewRequest{
			Name: fmt.Sprintf("users/%s", user.Username) + "/views/nonexistent",
		}

		_, err = ts.Service.DeleteMemoView(userCtx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "not found")
	})
}

func TestMemoViewFiltering(t *testing.T) {
	ctx := context.Background()

	t.Run("CreateMemoView with valid filters", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create user
		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, user.ID)

		// Test various valid filter formats
		validFilters := []string{
			"tag in [\"work\"]",
			"content.contains(\"meeting\")",
			"tag in [\"work\"] && content.contains(\"meeting\")",
			"tag in [\"work\"] || tag in [\"personal\"]",
			"creator_id == 1",
			"visibility == \"PUBLIC\"",
			"has_task_list == true",
			"has_task_list == false",
		}

		for i, filter := range validFilters {
			req := &v1pb.CreateMemoViewRequest{
				Parent: fmt.Sprintf("users/%s", user.Username),
				MemoView: &v1pb.MemoView{
					Title:  fmt.Sprintf("Valid Filter %d", i),
					Filter: filter,
				},
			}

			_, err = ts.Service.CreateMemoView(userCtx, req)
			require.NoError(t, err, "Filter should be valid: %s", filter)
		}
	})

	t.Run("CreateMemoView with invalid filters", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create user
		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, user.ID)

		// Test various invalid filter formats
		invalidFilters := []string{
			"tag in ",                                   // incomplete expression
			"invalid_field @in [\"value\"]",             // unknown field
			"tag in [\"work\"] &&",                      // incomplete expression
			"tag in [\"work\"] || || tag in [\"test\"]", // double operator
			"((tag in [\"work\"]",                       // unmatched parentheses
			"tag in [\"work\"] && )",                    // mismatched parentheses
			"tag == \"work\"",                           // wrong operator (== not supported for tags)
			"tag in work",                               // missing brackets
		}

		for _, filter := range invalidFilters {
			req := &v1pb.CreateMemoViewRequest{
				Parent: fmt.Sprintf("users/%s", user.Username),
				MemoView: &v1pb.MemoView{
					Title:  "Invalid Filter Test",
					Filter: filter,
				},
			}

			_, err = ts.Service.CreateMemoView(userCtx, req)
			require.Error(t, err, "Filter should be invalid: %s", filter)
			require.Contains(t, err.Error(), "invalid filter", "Error should mention invalid filter for: %s", filter)
		}
	})
}

func TestMemoViewCRUDComplete(t *testing.T) {
	ctx := context.Background()

	t.Run("Complete CRUD lifecycle", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create user
		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, user.ID)

		// 1. Create multiple memoViews
		memoView1Req := &v1pb.CreateMemoViewRequest{
			Parent: fmt.Sprintf("users/%s", user.Username),
			MemoView: &v1pb.MemoView{
				Title:  "Work Notes",
				Filter: "tag in [\"work\"]",
			},
		}

		memoView2Req := &v1pb.CreateMemoViewRequest{
			Parent: fmt.Sprintf("users/%s", user.Username),
			MemoView: &v1pb.MemoView{
				Title:  "Personal Notes",
				Filter: "tag in [\"personal\"]",
			},
		}

		created1, err := ts.Service.CreateMemoView(userCtx, memoView1Req)
		require.NoError(t, err)
		require.Equal(t, "Work Notes", created1.Title)

		created2, err := ts.Service.CreateMemoView(userCtx, memoView2Req)
		require.NoError(t, err)
		require.Equal(t, "Personal Notes", created2.Title)

		// 2. List memoViews and verify both exist
		listReq := &v1pb.ListMemoViewsRequest{
			Parent: fmt.Sprintf("users/%s", user.Username),
		}

		listResp, err := ts.Service.ListMemoViews(userCtx, listReq)
		require.NoError(t, err)
		require.Len(t, listResp.MemoViews, 2)

		// 3. Get individual memoViews
		getReq1 := &v1pb.GetMemoViewRequest{Name: created1.Name}
		getResp1, err := ts.Service.GetMemoView(userCtx, getReq1)
		require.NoError(t, err)
		require.Equal(t, created1.Name, getResp1.Name)
		require.Equal(t, "Work Notes", getResp1.Title)

		getReq2 := &v1pb.GetMemoViewRequest{Name: created2.Name}
		getResp2, err := ts.Service.GetMemoView(userCtx, getReq2)
		require.NoError(t, err)
		require.Equal(t, created2.Name, getResp2.Name)
		require.Equal(t, "Personal Notes", getResp2.Title)

		// 4. Update one memoView
		updateReq := &v1pb.UpdateMemoViewRequest{
			MemoView: &v1pb.MemoView{
				Name:   created1.Name,
				Title:  "Work & Meeting Notes",
				Filter: "tag in [\"work\"] || tag in [\"meeting\"]",
			},
			UpdateMask: &fieldmaskpb.FieldMask{
				Paths: []string{"title", "filter"},
			},
		}

		updated, err := ts.Service.UpdateMemoView(userCtx, updateReq)
		require.NoError(t, err)
		require.Equal(t, "Work & Meeting Notes", updated.Title)
		require.Equal(t, "tag in [\"work\"] || tag in [\"meeting\"]", updated.Filter)

		// 5. Verify update by getting it again
		getUpdatedReq := &v1pb.GetMemoViewRequest{Name: created1.Name}
		getUpdatedResp, err := ts.Service.GetMemoView(userCtx, getUpdatedReq)
		require.NoError(t, err)
		require.Equal(t, "Work & Meeting Notes", getUpdatedResp.Title)
		require.Equal(t, "tag in [\"work\"] || tag in [\"meeting\"]", getUpdatedResp.Filter)

		// 6. Delete one memoView
		deleteReq := &v1pb.DeleteMemoViewRequest{
			Name: created2.Name,
		}

		_, err = ts.Service.DeleteMemoView(userCtx, deleteReq)
		require.NoError(t, err)

		// 7. Verify deletion by listing (should only have 1 left)
		finalListResp, err := ts.Service.ListMemoViews(userCtx, listReq)
		require.NoError(t, err)
		require.Len(t, finalListResp.MemoViews, 1)
		require.Equal(t, "Work & Meeting Notes", finalListResp.MemoViews[0].Title)

		// 8. Verify deleted memoView can't be accessed
		getDeletedReq := &v1pb.GetMemoViewRequest{Name: created2.Name}
		_, err = ts.Service.GetMemoView(userCtx, getDeletedReq)
		require.Error(t, err)
		require.Contains(t, err.Error(), "not found")
	})
}

func TestMemoViewRegressions(t *testing.T) {
	ctx := context.Background()

	t.Run("UpdateMemoView rejects a missing memo view instead of panicking", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, user.ID)

		req := &v1pb.UpdateMemoViewRequest{
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"title"}},
		}

		_, err = ts.Service.UpdateMemoView(userCtx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid memo view name")
	})

	t.Run("UpdateMemoView leaves the stored view untouched when validation fails", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, user.ID)

		created, err := ts.Service.CreateMemoView(userCtx, &v1pb.CreateMemoViewRequest{
			Parent: fmt.Sprintf("users/%s", user.Username),
			MemoView: &v1pb.MemoView{
				Title:  "Original Title",
				Filter: `tag in ["work"]`,
			},
		})
		require.NoError(t, err)

		// The title path is applied before the filter path is validated. A rejected
		// filter must not leave the new title behind.
		_, err = ts.Service.UpdateMemoView(userCtx, &v1pb.UpdateMemoViewRequest{
			MemoView: &v1pb.MemoView{
				Name:   created.Name,
				Title:  "Phantom Title",
				Filter: "this is not (((a valid filter",
			},
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"title", "filter"}},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid filter")

		got, err := ts.Service.GetMemoView(userCtx, &v1pb.GetMemoViewRequest{Name: created.Name})
		require.NoError(t, err)
		require.Equal(t, "Original Title", got.Title)
		require.Equal(t, `tag in ["work"]`, got.Filter)
	})

	t.Run("CreateMemoView keeps every view under concurrent creates", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, user.ID)

		const concurrency = 8
		var wg sync.WaitGroup
		errs := make([]error, concurrency)
		for i := range concurrency {
			wg.Go(func() {
				_, errs[i] = ts.Service.CreateMemoView(userCtx, &v1pb.CreateMemoViewRequest{
					Parent: fmt.Sprintf("users/%s", user.Username),
					MemoView: &v1pb.MemoView{
						Title:  fmt.Sprintf("View %d", i),
						Filter: `tag in ["work"]`,
					},
				})
			})
		}
		wg.Wait()
		for _, err := range errs {
			require.NoError(t, err)
		}

		resp, err := ts.Service.ListMemoViews(userCtx, &v1pb.ListMemoViewsRequest{
			Parent: fmt.Sprintf("users/%s", user.Username),
		})
		require.NoError(t, err)
		require.Len(t, resp.MemoViews, concurrency)
	})
}
