package teststore

import (
	"context"
	"crypto/sha256"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

func TestTagStore(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Test UpdateTag (Create new tag)
	tagName1 := "programming"
	tagHash1 := calculateTagHash(tagName1)
	emoji1 := "💻"

	tag1, err := ts.UpdateTag(ctx, &store.UpdateTag{
		TagHash:   tagHash1,
		CreatorID: user.ID,
		TagName:   &tagName1,
		Emoji:     &emoji1,
	})
	require.NoError(t, err)
	require.NotNil(t, tag1)
	require.NotEmpty(t, tag1.ID)
	require.Equal(t, user.ID, tag1.CreatorID)
	require.Equal(t, tagHash1, tag1.TagHash)
	require.Equal(t, tagName1, tag1.TagName)
	require.Equal(t, emoji1, tag1.Emoji)
	require.Nil(t, tag1.PinnedTs) // Initially not pinned

	// Test UpdateTag (Update existing tag - add pinning)
	now := time.Now().Unix()
	tag1Updated, err := ts.UpdateTag(ctx, &store.UpdateTag{
		TagHash:      tagHash1,
		CreatorID:    user.ID,
		PinnedTs:     &now,
		UpdatePinned: true,
	})
	require.NoError(t, err)
	require.Equal(t, tag1.ID, tag1Updated.ID)
	require.Equal(t, emoji1, tag1Updated.Emoji) // Emoji should remain
	require.NotNil(t, tag1Updated.PinnedTs)
	require.Equal(t, now, *tag1Updated.PinnedTs)

	// Create another tag with emoji but not pinned
	tagName2 := "design"
	tagHash2 := calculateTagHash(tagName2)
	emoji2 := "🎨"

	tag2, err := ts.UpdateTag(ctx, &store.UpdateTag{
		TagHash:   tagHash2,
		CreatorID: user.ID,
		TagName:   &tagName2,
		Emoji:     &emoji2,
	})
	require.NoError(t, err)
	require.NotNil(t, tag2)
	require.Equal(t, tagName2, tag2.TagName)
	require.Equal(t, emoji2, tag2.Emoji)
	require.Nil(t, tag2.PinnedTs)

	// Create a third tag that is pinned but has no emoji
	tagName3 := "important"
	tagHash3 := calculateTagHash(tagName3)
	pinnedTime := time.Now().Unix() + 1 // Newer pinned time

	tag3, err := ts.UpdateTag(ctx, &store.UpdateTag{
		TagHash:      tagHash3,
		CreatorID:    user.ID,
		TagName:      &tagName3,
		PinnedTs:     &pinnedTime,
		UpdatePinned: true,
	})
	require.NoError(t, err)
	require.NotNil(t, tag3)
	require.Equal(t, tagName3, tag3.TagName)
	require.Equal(t, "", tag3.Emoji) // No emoji
	require.NotNil(t, tag3.PinnedTs)
	require.Equal(t, pinnedTime, *tag3.PinnedTs)

	// Test ListPinnedTags
	pinnedTags, err := ts.ListPinnedTags(ctx, user.ID)
	require.NoError(t, err)
	require.Len(t, pinnedTags, 2) // tag1 and tag3 are pinned

	// Should be ordered by pinned_ts DESC (newest first)
	require.Equal(t, tag3.ID, pinnedTags[0].ID)        // tag3 has newer pinned time
	require.Equal(t, tag1Updated.ID, pinnedTags[1].ID) // tag1 has older pinned time

	// Test ListTagsWithEmoji
	emojiTags, err := ts.ListTagsWithEmoji(ctx, user.ID)
	require.NoError(t, err)
	require.Len(t, emojiTags, 2) // tag1 and tag2 have emojis

	// Should be ordered by updated_ts DESC (most recently updated first)
	// tag1 was updated more recently (when we pinned it)
	require.Contains(t, []int32{tag1Updated.ID, tag2.ID}, emojiTags[0].ID)
	require.Contains(t, []int32{tag1Updated.ID, tag2.ID}, emojiTags[1].ID)
	require.NotEqual(t, emojiTags[0].ID, emojiTags[1].ID)

	// Test UpdateTag (Remove pinning)
	tag1Unpinned, err := ts.UpdateTag(ctx, &store.UpdateTag{
		TagHash:      tagHash1,
		CreatorID:    user.ID,
		PinnedTs:     nil,
		UpdatePinned: true,
	})
	require.NoError(t, err)
	require.Nil(t, tag1Unpinned.PinnedTs)
	require.Equal(t, emoji1, tag1Unpinned.Emoji) // Emoji should remain

	// Verify pinned tags now only contains tag3
	pinnedTags, err = ts.ListPinnedTags(ctx, user.ID)
	require.NoError(t, err)
	require.Len(t, pinnedTags, 1)
	require.Equal(t, tag3.ID, pinnedTags[0].ID)

	// Test UpdateTag (Remove emoji)
	emptyEmoji := ""
	tag2NoEmoji, err := ts.UpdateTag(ctx, &store.UpdateTag{
		TagHash:   tagHash2,
		CreatorID: user.ID,
		Emoji:     &emptyEmoji,
	})
	require.NoError(t, err)
	require.Equal(t, "", tag2NoEmoji.Emoji)

	// Verify emoji tags now only contains tag1
	emojiTags, err = ts.ListTagsWithEmoji(ctx, user.ID)
	require.NoError(t, err)
	require.Len(t, emojiTags, 1)
	require.Equal(t, tag1Unpinned.ID, emojiTags[0].ID)
}

func TestTagStore_MultipleUsers(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	// Create two users
	user1, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	user2Create := &store.User{
		Username: "test2",
		Role:     store.RoleUser,
		Email:    "test2@test.com",
		Nickname: "test_nickname_2",
	}
	user2, err := ts.CreateUser(ctx, user2Create)
	require.NoError(t, err)

	// Both users create tags with the same name but different metadata
	tagName := "shared-tag"
	tagHash := calculateTagHash(tagName)
	emoji1 := "👤"
	emoji2 := "👥"

	// User1 creates a pinned tag with emoji
	pinnedTime := time.Now().Unix()
	tag1, err := ts.UpdateTag(ctx, &store.UpdateTag{
		TagHash:      tagHash,
		CreatorID:    user1.ID,
		TagName:      &tagName,
		Emoji:        &emoji1,
		PinnedTs:     &pinnedTime,
		UpdatePinned: true,
	})
	require.NoError(t, err)

	// User2 creates a non-pinned tag with different emoji
	_, err = ts.UpdateTag(ctx, &store.UpdateTag{
		TagHash:   tagHash,
		CreatorID: user2.ID,
		TagName:   &tagName,
		Emoji:     &emoji2,
	})
	require.NoError(t, err)

	// Verify each user only sees their own tags
	user1PinnedTags, err := ts.ListPinnedTags(ctx, user1.ID)
	require.NoError(t, err)
	require.Len(t, user1PinnedTags, 1)
	require.Equal(t, tag1.ID, user1PinnedTags[0].ID)

	user2PinnedTags, err := ts.ListPinnedTags(ctx, user2.ID)
	require.NoError(t, err)
	require.Len(t, user2PinnedTags, 0) // User2 has no pinned tags

	user1EmojiTags, err := ts.ListTagsWithEmoji(ctx, user1.ID)
	require.NoError(t, err)
	require.Len(t, user1EmojiTags, 1)
	require.Equal(t, emoji1, user1EmojiTags[0].Emoji)

	user2EmojiTags, err := ts.ListTagsWithEmoji(ctx, user2.ID)
	require.NoError(t, err)
	require.Len(t, user2EmojiTags, 1)
	require.Equal(t, emoji2, user2EmojiTags[0].Emoji)
}

func TestTagStore_EmptyResults(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Test with no tags
	pinnedTags, err := ts.ListPinnedTags(ctx, user.ID)
	require.NoError(t, err)
	require.Len(t, pinnedTags, 0)

	emojiTags, err := ts.ListTagsWithEmoji(ctx, user.ID)
	require.NoError(t, err)
	require.Len(t, emojiTags, 0)
}

// Helper function to calculate tag hash (same as in API layer).
func calculateTagHash(tagName string) string {
	hash := sha256.Sum256([]byte(tagName))
	return fmt.Sprintf("%x", hash)
}
