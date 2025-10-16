package test

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/fieldmaskpb"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
)

func TestListShortcuts(t *testing.T) {
	ctx := context.Background()

	t.Run("ListShortcuts success", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create a user
		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, user.ID)

		// List shortcuts (should be empty initially)
		req := &v1pb.ListShortcutsRequest{
			Parent: fmt.Sprintf("users/%d", user.ID),
		}

		resp, err := ts.Service.ListShortcuts(userCtx, req)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Empty(t, resp.Shortcuts)
	})

	t.Run("ListShortcuts permission denied for different user", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create two users
		user1, err := ts.CreateRegularUser(ctx, "user1")
		require.NoError(t, err)
		user2, err := ts.CreateRegularUser(ctx, "user2")
		require.NoError(t, err)

		// Set user1 context but try to list user2's shortcuts
		userCtx := ts.CreateUserContext(ctx, user1.ID)

		req := &v1pb.ListShortcutsRequest{
			Parent: fmt.Sprintf("users/%d", user2.ID),
		}

		_, err = ts.Service.ListShortcuts(userCtx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "permission denied")
	})

	t.Run("ListShortcuts invalid parent format", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create user
		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, user.ID)

		req := &v1pb.ListShortcutsRequest{
			Parent: "invalid-parent-format",
		}

		_, err = ts.Service.ListShortcuts(userCtx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid user name")
	})

	t.Run("ListShortcuts unauthenticated", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		req := &v1pb.ListShortcutsRequest{
			Parent: "users/1",
		}

		_, err := ts.Service.ListShortcuts(ctx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "permission denied")
	})
}

func TestGetShortcut(t *testing.T) {
	ctx := context.Background()

	t.Run("GetShortcut success", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create a user
		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, user.ID)

		// First create a shortcut
		createReq := &v1pb.CreateShortcutRequest{
			Parent: fmt.Sprintf("users/%d", user.ID),
			Shortcut: &v1pb.Shortcut{
				Title:  "Test Shortcut",
				Filter: "tag in [\"test\"]",
			},
		}

		created, err := ts.Service.CreateShortcut(userCtx, createReq)
		require.NoError(t, err)

		// Now get the shortcut
		getReq := &v1pb.GetShortcutRequest{
			Name: created.Name,
		}

		resp, err := ts.Service.GetShortcut(userCtx, getReq)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, created.Name, resp.Name)
		require.Equal(t, "Test Shortcut", resp.Title)
		require.Equal(t, "tag in [\"test\"]", resp.Filter)
	})

	t.Run("GetShortcut permission denied for different user", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create two users
		user1, err := ts.CreateRegularUser(ctx, "user1")
		require.NoError(t, err)
		user2, err := ts.CreateRegularUser(ctx, "user2")
		require.NoError(t, err)

		// Create shortcut as user1
		user1Ctx := ts.CreateUserContext(ctx, user1.ID)
		createReq := &v1pb.CreateShortcutRequest{
			Parent: fmt.Sprintf("users/%d", user1.ID),
			Shortcut: &v1pb.Shortcut{
				Title:  "User1 Shortcut",
				Filter: "tag in [\"user1\"]",
			},
		}

		created, err := ts.Service.CreateShortcut(user1Ctx, createReq)
		require.NoError(t, err)

		// Try to get shortcut as user2
		user2Ctx := ts.CreateUserContext(ctx, user2.ID)
		getReq := &v1pb.GetShortcutRequest{
			Name: created.Name,
		}

		_, err = ts.Service.GetShortcut(user2Ctx, getReq)
		require.Error(t, err)
		require.Contains(t, err.Error(), "permission denied")
	})

	t.Run("GetShortcut invalid name format", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create user
		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, user.ID)

		req := &v1pb.GetShortcutRequest{
			Name: "invalid-shortcut-name",
		}

		_, err = ts.Service.GetShortcut(userCtx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid shortcut name")
	})

	t.Run("GetShortcut not found", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create user
		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, user.ID)

		req := &v1pb.GetShortcutRequest{
			Name: fmt.Sprintf("users/%d", user.ID) + "/shortcuts/nonexistent",
		}

		_, err = ts.Service.GetShortcut(userCtx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "not found")
	})
}

func TestCreateShortcut(t *testing.T) {
	ctx := context.Background()

	t.Run("CreateShortcut success", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create a user
		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, user.ID)

		req := &v1pb.CreateShortcutRequest{
			Parent: fmt.Sprintf("users/%d", user.ID),
			Shortcut: &v1pb.Shortcut{
				Title:  "My Shortcut",
				Filter: "tag in [\"important\"]",
			},
		}

		resp, err := ts.Service.CreateShortcut(userCtx, req)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, "My Shortcut", resp.Title)
		require.Equal(t, "tag in [\"important\"]", resp.Filter)
		require.Contains(t, resp.Name, fmt.Sprintf("users/%d/shortcuts/", user.ID))

		// Verify the shortcut was created by listing
		listReq := &v1pb.ListShortcutsRequest{
			Parent: fmt.Sprintf("users/%d", user.ID),
		}

		listResp, err := ts.Service.ListShortcuts(userCtx, listReq)
		require.NoError(t, err)
		require.Len(t, listResp.Shortcuts, 1)
		require.Equal(t, "My Shortcut", listResp.Shortcuts[0].Title)
	})

	t.Run("CreateShortcut permission denied for different user", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create two users
		user1, err := ts.CreateRegularUser(ctx, "user1")
		require.NoError(t, err)
		user2, err := ts.CreateRegularUser(ctx, "user2")
		require.NoError(t, err)

		// Set user1 context but try to create shortcut for user2
		userCtx := ts.CreateUserContext(ctx, user1.ID)

		req := &v1pb.CreateShortcutRequest{
			Parent: fmt.Sprintf("users/%d", user2.ID),
			Shortcut: &v1pb.Shortcut{
				Title:  "Forbidden Shortcut",
				Filter: "tag in [\"forbidden\"]",
			},
		}

		_, err = ts.Service.CreateShortcut(userCtx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "permission denied")
	})

	t.Run("CreateShortcut invalid parent format", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create user
		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, user.ID)

		req := &v1pb.CreateShortcutRequest{
			Parent: "invalid-parent",
			Shortcut: &v1pb.Shortcut{
				Title:  "Test Shortcut",
				Filter: "tag in [\"test\"]",
			},
		}

		_, err = ts.Service.CreateShortcut(userCtx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid user name")
	})

	t.Run("CreateShortcut invalid filter", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create user
		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, user.ID)

		req := &v1pb.CreateShortcutRequest{
			Parent: fmt.Sprintf("users/%d", user.ID),
			Shortcut: &v1pb.Shortcut{
				Title:  "Invalid Filter Shortcut",
				Filter: "invalid||filter))syntax",
			},
		}

		_, err = ts.Service.CreateShortcut(userCtx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid filter")
	})

	t.Run("CreateShortcut missing title", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create user
		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, user.ID)

		req := &v1pb.CreateShortcutRequest{
			Parent: fmt.Sprintf("users/%d", user.ID),
			Shortcut: &v1pb.Shortcut{
				Filter: "tag in [\"test\"]",
			},
		}

		_, err = ts.Service.CreateShortcut(userCtx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "title is required")
	})
}

func TestUpdateShortcut(t *testing.T) {
	ctx := context.Background()

	t.Run("UpdateShortcut success", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create a user
		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, user.ID)

		// Create a shortcut first
		createReq := &v1pb.CreateShortcutRequest{
			Parent: fmt.Sprintf("users/%d", user.ID),
			Shortcut: &v1pb.Shortcut{
				Title:  "Original Title",
				Filter: "tag in [\"original\"]",
			},
		}

		created, err := ts.Service.CreateShortcut(userCtx, createReq)
		require.NoError(t, err)

		// Update the shortcut
		updateReq := &v1pb.UpdateShortcutRequest{
			Shortcut: &v1pb.Shortcut{
				Name:   created.Name,
				Title:  "Updated Title",
				Filter: "tag in [\"updated\"]",
			},
			UpdateMask: &fieldmaskpb.FieldMask{
				Paths: []string{"title", "filter"},
			},
		}

		updated, err := ts.Service.UpdateShortcut(userCtx, updateReq)
		require.NoError(t, err)
		require.NotNil(t, updated)
		require.Equal(t, "Updated Title", updated.Title)
		require.Equal(t, "tag in [\"updated\"]", updated.Filter)
		require.Equal(t, created.Name, updated.Name)
	})

	t.Run("UpdateShortcut permission denied for different user", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create two users
		user1, err := ts.CreateRegularUser(ctx, "user1")
		require.NoError(t, err)
		user2, err := ts.CreateRegularUser(ctx, "user2")
		require.NoError(t, err)

		// Create shortcut as user1
		user1Ctx := ts.CreateUserContext(ctx, user1.ID)
		createReq := &v1pb.CreateShortcutRequest{
			Parent: fmt.Sprintf("users/%d", user1.ID),
			Shortcut: &v1pb.Shortcut{
				Title:  "User1 Shortcut",
				Filter: "tag in [\"user1\"]",
			},
		}

		created, err := ts.Service.CreateShortcut(user1Ctx, createReq)
		require.NoError(t, err)

		// Try to update shortcut as user2
		user2Ctx := ts.CreateUserContext(ctx, user2.ID)
		updateReq := &v1pb.UpdateShortcutRequest{
			Shortcut: &v1pb.Shortcut{
				Name:   created.Name,
				Title:  "Hacked Title",
				Filter: "tag in [\"hacked\"]",
			},
			UpdateMask: &fieldmaskpb.FieldMask{
				Paths: []string{"title", "filter"},
			},
		}

		_, err = ts.Service.UpdateShortcut(user2Ctx, updateReq)
		require.Error(t, err)
		require.Contains(t, err.Error(), "permission denied")
	})

	t.Run("UpdateShortcut missing update mask", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create a user and context for authentication
		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, user.ID)

		req := &v1pb.UpdateShortcutRequest{
			Shortcut: &v1pb.Shortcut{
				Name:  fmt.Sprintf("users/%d/shortcuts/test", user.ID),
				Title: "Updated Title",
			},
		}

		_, err = ts.Service.UpdateShortcut(userCtx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "update mask is required")
	})

	t.Run("UpdateShortcut invalid name format", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		req := &v1pb.UpdateShortcutRequest{
			Shortcut: &v1pb.Shortcut{
				Name:  "invalid-shortcut-name",
				Title: "Updated Title",
			},
			UpdateMask: &fieldmaskpb.FieldMask{
				Paths: []string{"title"},
			},
		}

		_, err := ts.Service.UpdateShortcut(ctx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid shortcut name")
	})

	t.Run("UpdateShortcut invalid filter", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create user
		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, user.ID)

		// Create a shortcut first
		createReq := &v1pb.CreateShortcutRequest{
			Parent: fmt.Sprintf("users/%d", user.ID),
			Shortcut: &v1pb.Shortcut{
				Title:  "Test Shortcut",
				Filter: "tag in [\"test\"]",
			},
		}

		created, err := ts.Service.CreateShortcut(userCtx, createReq)
		require.NoError(t, err)

		// Try to update with invalid filter
		updateReq := &v1pb.UpdateShortcutRequest{
			Shortcut: &v1pb.Shortcut{
				Name:   created.Name,
				Filter: "invalid||filter))syntax",
			},
			UpdateMask: &fieldmaskpb.FieldMask{
				Paths: []string{"filter"},
			},
		}

		_, err = ts.Service.UpdateShortcut(userCtx, updateReq)
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid filter")
	})
}

func TestDeleteShortcut(t *testing.T) {
	ctx := context.Background()

	t.Run("DeleteShortcut success", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create a user
		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, user.ID)

		// Create a shortcut first
		createReq := &v1pb.CreateShortcutRequest{
			Parent: fmt.Sprintf("users/%d", user.ID),
			Shortcut: &v1pb.Shortcut{
				Title:  "Shortcut to Delete",
				Filter: "tag in [\"delete\"]",
			},
		}

		created, err := ts.Service.CreateShortcut(userCtx, createReq)
		require.NoError(t, err)

		// Delete the shortcut
		deleteReq := &v1pb.DeleteShortcutRequest{
			Name: created.Name,
		}

		_, err = ts.Service.DeleteShortcut(userCtx, deleteReq)
		require.NoError(t, err)

		// Verify deletion by listing shortcuts
		listReq := &v1pb.ListShortcutsRequest{
			Parent: fmt.Sprintf("users/%d", user.ID),
		}

		listResp, err := ts.Service.ListShortcuts(userCtx, listReq)
		require.NoError(t, err)
		require.Empty(t, listResp.Shortcuts)

		// Also verify by trying to get the deleted shortcut
		getReq := &v1pb.GetShortcutRequest{
			Name: created.Name,
		}

		_, err = ts.Service.GetShortcut(userCtx, getReq)
		require.Error(t, err)
		require.Contains(t, err.Error(), "not found")
	})

	t.Run("DeleteShortcut permission denied for different user", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create two users
		user1, err := ts.CreateRegularUser(ctx, "user1")
		require.NoError(t, err)
		user2, err := ts.CreateRegularUser(ctx, "user2")
		require.NoError(t, err)

		// Create shortcut as user1
		user1Ctx := ts.CreateUserContext(ctx, user1.ID)
		createReq := &v1pb.CreateShortcutRequest{
			Parent: fmt.Sprintf("users/%d", user1.ID),
			Shortcut: &v1pb.Shortcut{
				Title:  "User1 Shortcut",
				Filter: "tag in [\"user1\"]",
			},
		}

		created, err := ts.Service.CreateShortcut(user1Ctx, createReq)
		require.NoError(t, err)

		// Try to delete shortcut as user2
		user2Ctx := ts.CreateUserContext(ctx, user2.ID)
		deleteReq := &v1pb.DeleteShortcutRequest{
			Name: created.Name,
		}

		_, err = ts.Service.DeleteShortcut(user2Ctx, deleteReq)
		require.Error(t, err)
		require.Contains(t, err.Error(), "permission denied")
	})

	t.Run("DeleteShortcut invalid name format", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		req := &v1pb.DeleteShortcutRequest{
			Name: "invalid-shortcut-name",
		}

		_, err := ts.Service.DeleteShortcut(ctx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid shortcut name")
	})

	t.Run("DeleteShortcut not found", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create user
		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, user.ID)

		req := &v1pb.DeleteShortcutRequest{
			Name: fmt.Sprintf("users/%d", user.ID) + "/shortcuts/nonexistent",
		}

		_, err = ts.Service.DeleteShortcut(userCtx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "not found")
	})
}

func TestShortcutFiltering(t *testing.T) {
	ctx := context.Background()

	t.Run("CreateShortcut with valid filters", func(t *testing.T) {
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
			req := &v1pb.CreateShortcutRequest{
				Parent: fmt.Sprintf("users/%d", user.ID),
				Shortcut: &v1pb.Shortcut{
					Title:  "Valid Filter " + string(rune(i)),
					Filter: filter,
				},
			}

			_, err = ts.Service.CreateShortcut(userCtx, req)
			require.NoError(t, err, "Filter should be valid: %s", filter)
		}
	})

	t.Run("CreateShortcut with invalid filters", func(t *testing.T) {
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
			req := &v1pb.CreateShortcutRequest{
				Parent: fmt.Sprintf("users/%d", user.ID),
				Shortcut: &v1pb.Shortcut{
					Title:  "Invalid Filter Test",
					Filter: filter,
				},
			}

			_, err = ts.Service.CreateShortcut(userCtx, req)
			require.Error(t, err, "Filter should be invalid: %s", filter)
			require.Contains(t, err.Error(), "invalid filter", "Error should mention invalid filter for: %s", filter)
		}
	})
}

func TestShortcutCRUDComplete(t *testing.T) {
	ctx := context.Background()

	t.Run("Complete CRUD lifecycle", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create user
		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)

		// Set user context
		userCtx := ts.CreateUserContext(ctx, user.ID)

		// 1. Create multiple shortcuts
		shortcut1Req := &v1pb.CreateShortcutRequest{
			Parent: fmt.Sprintf("users/%d", user.ID),
			Shortcut: &v1pb.Shortcut{
				Title:  "Work Notes",
				Filter: "tag in [\"work\"]",
			},
		}

		shortcut2Req := &v1pb.CreateShortcutRequest{
			Parent: fmt.Sprintf("users/%d", user.ID),
			Shortcut: &v1pb.Shortcut{
				Title:  "Personal Notes",
				Filter: "tag in [\"personal\"]",
			},
		}

		created1, err := ts.Service.CreateShortcut(userCtx, shortcut1Req)
		require.NoError(t, err)
		require.Equal(t, "Work Notes", created1.Title)

		created2, err := ts.Service.CreateShortcut(userCtx, shortcut2Req)
		require.NoError(t, err)
		require.Equal(t, "Personal Notes", created2.Title)

		// 2. List shortcuts and verify both exist
		listReq := &v1pb.ListShortcutsRequest{
			Parent: fmt.Sprintf("users/%d", user.ID),
		}

		listResp, err := ts.Service.ListShortcuts(userCtx, listReq)
		require.NoError(t, err)
		require.Len(t, listResp.Shortcuts, 2)

		// 3. Get individual shortcuts
		getReq1 := &v1pb.GetShortcutRequest{Name: created1.Name}
		getResp1, err := ts.Service.GetShortcut(userCtx, getReq1)
		require.NoError(t, err)
		require.Equal(t, created1.Name, getResp1.Name)
		require.Equal(t, "Work Notes", getResp1.Title)

		getReq2 := &v1pb.GetShortcutRequest{Name: created2.Name}
		getResp2, err := ts.Service.GetShortcut(userCtx, getReq2)
		require.NoError(t, err)
		require.Equal(t, created2.Name, getResp2.Name)
		require.Equal(t, "Personal Notes", getResp2.Title)

		// 4. Update one shortcut
		updateReq := &v1pb.UpdateShortcutRequest{
			Shortcut: &v1pb.Shortcut{
				Name:   created1.Name,
				Title:  "Work & Meeting Notes",
				Filter: "tag in [\"work\"] || tag in [\"meeting\"]",
			},
			UpdateMask: &fieldmaskpb.FieldMask{
				Paths: []string{"title", "filter"},
			},
		}

		updated, err := ts.Service.UpdateShortcut(userCtx, updateReq)
		require.NoError(t, err)
		require.Equal(t, "Work & Meeting Notes", updated.Title)
		require.Equal(t, "tag in [\"work\"] || tag in [\"meeting\"]", updated.Filter)

		// 5. Verify update by getting it again
		getUpdatedReq := &v1pb.GetShortcutRequest{Name: created1.Name}
		getUpdatedResp, err := ts.Service.GetShortcut(userCtx, getUpdatedReq)
		require.NoError(t, err)
		require.Equal(t, "Work & Meeting Notes", getUpdatedResp.Title)
		require.Equal(t, "tag in [\"work\"] || tag in [\"meeting\"]", getUpdatedResp.Filter)

		// 6. Delete one shortcut
		deleteReq := &v1pb.DeleteShortcutRequest{
			Name: created2.Name,
		}

		_, err = ts.Service.DeleteShortcut(userCtx, deleteReq)
		require.NoError(t, err)

		// 7. Verify deletion by listing (should only have 1 left)
		finalListResp, err := ts.Service.ListShortcuts(userCtx, listReq)
		require.NoError(t, err)
		require.Len(t, finalListResp.Shortcuts, 1)
		require.Equal(t, "Work & Meeting Notes", finalListResp.Shortcuts[0].Title)

		// 8. Verify deleted shortcut can't be accessed
		getDeletedReq := &v1pb.GetShortcutRequest{Name: created2.Name}
		_, err = ts.Service.GetShortcut(userCtx, getDeletedReq)
		require.Error(t, err)
		require.Contains(t, err.Error(), "not found")
	})
}
