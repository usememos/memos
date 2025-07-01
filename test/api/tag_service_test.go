package api

import (
	"context"
	"crypto/sha256"
	"fmt"
	"log/slog"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	// sqlite driver.
	_ "modernc.org/sqlite"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/server/profile"
	"github.com/usememos/memos/store"
	"github.com/usememos/memos/store/db"
)

// TestTagService wraps the real tag service with test-specific behavior
type TestTagService struct {
	store    *store.Store
	testUser *store.User
}

// NewTestTagService creates a test tag service with a fixed user
func NewTestTagService(store *store.Store, testUser *store.User) *TestTagService {
	return &TestTagService{
		store:    store,
		testUser: testUser,
	}
}

// ListPinnedTags mimics the API service but uses the test user
func (s *TestTagService) ListPinnedTags(ctx context.Context, request *v1pb.ListPinnedTagsRequest) (*v1pb.ListPinnedTagsResponse, error) {
	if s.testUser == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not found")
	}

	tags, err := s.store.ListPinnedTags(ctx, s.testUser.ID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list pinned tags: %v", err)
	}

	response := &v1pb.ListPinnedTagsResponse{
		Tags: []*v1pb.Tag{},
	}
	for _, tag := range tags {
		tagMessage, err := s.convertTagFromStore(ctx, tag)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to convert tag: %v", err)
		}
		response.Tags = append(response.Tags, tagMessage)
	}

	return response, nil
}

// ListTagsWithEmoji mimics the API service but uses the test user
func (s *TestTagService) ListTagsWithEmoji(ctx context.Context, request *v1pb.ListTagsWithEmojiRequest) (*v1pb.ListTagsWithEmojiResponse, error) {
	if s.testUser == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not found")
	}

	tags, err := s.store.ListTagsWithEmoji(ctx, s.testUser.ID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list emoji tags: %v", err)
	}

	response := &v1pb.ListTagsWithEmojiResponse{
		Tags: []*v1pb.Tag{},
	}
	for _, tag := range tags {
		tagMessage, err := s.convertTagFromStore(ctx, tag)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to convert tag: %v", err)
		}
		response.Tags = append(response.Tags, tagMessage)
	}

	return response, nil
}

// UpdateTag mimics the API service but uses the test user
func (s *TestTagService) UpdateTag(ctx context.Context, request *v1pb.UpdateTagRequest) (*v1pb.Tag, error) {
	if s.testUser == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not found")
	}

	// Validate tag name
	if request.TagName == "" {
		return nil, status.Errorf(codes.InvalidArgument, "tag name is required")
	}

	// Calculate tag hash
	tagHash := calculateTagHash(request.TagName)

	// Prepare update request
	update := &store.UpdateTag{
		TagHash:   tagHash,
		CreatorID: s.testUser.ID,
		TagName:   &request.TagName,
	}

	// Handle emoji update
	if request.Emoji != nil {
		update.Emoji = request.Emoji
	}

	// Handle pinned status update
	if request.Pinned != nil {
		update.UpdatePinned = true
		if *request.Pinned {
			// Pin the tag with current timestamp
			now := time.Now().Unix()
			update.PinnedTs = &now
		} else {
			// Unpin the tag (set to nil)
			update.PinnedTs = nil
		}
	}

	// Update tag in store
	tag, err := s.store.UpdateTag(ctx, update)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update tag: %v", err)
	}

	// Convert and return
	tagMessage, err := s.convertTagFromStore(ctx, tag)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to convert tag: %v", err)
	}

	return tagMessage, nil
}

// convertTagFromStore converts a store.Tag to v1pb.Tag
func (s *TestTagService) convertTagFromStore(ctx context.Context, tag *store.Tag) (*v1pb.Tag, error) {
	creator, err := s.store.GetUser(ctx, &store.FindUser{
		ID: &tag.CreatorID,
	})
	if err != nil {
		return nil, err
	}

	result := &v1pb.Tag{
		Id:         tag.ID,
		CreateTime: timestamppb.New(time.Unix(tag.CreatedTs, 0)),
		UpdateTime: timestamppb.New(time.Unix(tag.UpdatedTs, 0)),
		Creator:    fmt.Sprintf("users/%d", creator.ID),
		TagHash:    tag.TagHash,
		TagName:    tag.TagName,
		Emoji:      tag.Emoji,
	}

	if tag.PinnedTs != nil {
		result.PinnedTime = timestamppb.New(time.Unix(*tag.PinnedTs, 0))
	}

	return result, nil
}

func newTestingStore(ctx context.Context, t *testing.T) *store.Store {
	profile := &profile.Profile{
		Mode:   "prod",
		Driver: "sqlite",
		DSN:    ":memory:",
	}
	dbDriver, err := db.NewDBDriver(profile)
	if err != nil {
		slog.Error("failed to create db driver", slog.String("error", err.Error()))
		t.Fatal(err)
	}

	store := store.New(dbDriver, profile)
	if err := store.Migrate(ctx); err != nil {
		slog.Error("failed to migrate db", slog.String("error", err.Error()))
		t.Fatal(err)
	}
	return store
}

func createTestTagService(ts *store.Store, testUser *store.User) *TestTagService {
	return NewTestTagService(ts, testUser)
}

func TestTagService_ListPinnedTags(t *testing.T) {
	ctx := context.Background()
	ts := newTestingStore(ctx, t)
	defer ts.Close()

	// Create test user
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Create test tag service
	service := createTestTagService(ts, user)

	// Initially no pinned tags
	resp, err := service.ListPinnedTags(ctx, &v1pb.ListPinnedTagsRequest{})
	require.NoError(t, err)
	require.Empty(t, resp.Tags)

	// Create a pinned tag in store
	tagName := "important"
	tagHash := calculateTagHash(tagName)
	pinnedTime := time.Now().Unix()
	emoji := "⭐"

	_, err = ts.UpdateTag(ctx, &store.UpdateTag{
		TagHash:      tagHash,
		CreatorID:    user.ID,
		TagName:      &tagName,
		Emoji:        &emoji,
		PinnedTs:     &pinnedTime,
		UpdatePinned: true,
	})
	require.NoError(t, err)

	// Test ListPinnedTags with auth context
	resp, err = service.ListPinnedTags(ctx, &v1pb.ListPinnedTagsRequest{})
	require.NoError(t, err)
	require.Len(t, resp.Tags, 1)
	require.Equal(t, tagName, resp.Tags[0].TagName)
	require.Equal(t, emoji, resp.Tags[0].Emoji)
	require.NotNil(t, resp.Tags[0].PinnedTime)
}

func TestTagService_ListTagsWithEmoji(t *testing.T) {
	ctx := context.Background()
	ts := newTestingStore(ctx, t)
	defer ts.Close()

	// Create test user
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Create test tag service
	service := createTestTagService(ts, user)

	// Initially no emoji tags
	resp, err := service.ListTagsWithEmoji(ctx, &v1pb.ListTagsWithEmojiRequest{})
	require.NoError(t, err)
	require.Empty(t, resp.Tags)

	// Create tags with and without emojis
	tags := []struct {
		name  string
		emoji string
	}{
		{"programming", "💻"},
		{"design", "🎨"},
		{"no-emoji", ""},
	}

	for _, tag := range tags {
		tagHash := calculateTagHash(tag.name)
		updateTag := &store.UpdateTag{
			TagHash:   tagHash,
			CreatorID: user.ID,
			TagName:   &tag.name,
		}
		if tag.emoji != "" {
			updateTag.Emoji = &tag.emoji
		}

		_, err = ts.UpdateTag(ctx, updateTag)
		require.NoError(t, err)
	}

	// Test ListTagsWithEmoji
	resp, err = service.ListTagsWithEmoji(ctx, &v1pb.ListTagsWithEmojiRequest{})
	require.NoError(t, err)
	require.Len(t, resp.Tags, 2) // Only tags with emojis

	// Verify emojis are present
	emojiFound := make(map[string]bool)
	for _, respTag := range resp.Tags {
		require.NotEmpty(t, respTag.Emoji)
		emojiFound[respTag.Emoji] = true
	}
	require.True(t, emojiFound["💻"])
	require.True(t, emojiFound["🎨"])
}

func TestTagService_UpdateTag_Pin(t *testing.T) {
	ctx := context.Background()
	ts := newTestingStore(ctx, t)
	defer ts.Close()

	// Create test user
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Create test tag service
	service := createTestTagService(ts, user)

	tagName := "test-tag"
	pinned := true

	// Test pinning a tag
	req := &v1pb.UpdateTagRequest{
		TagName: tagName,
		Pinned:  &pinned,
	}

	resp, err := service.UpdateTag(ctx, req)
	require.NoError(t, err)
	require.Equal(t, tagName, resp.TagName)
	require.NotNil(t, resp.PinnedTime)

	// Verify in store by checking pinned tags
	pinnedTags, err := ts.ListPinnedTags(ctx, user.ID)
	require.NoError(t, err)
	require.Len(t, pinnedTags, 1)
	require.Equal(t, tagName, pinnedTags[0].TagName)
	require.NotNil(t, pinnedTags[0].PinnedTs)
}

func TestTagService_UpdateTag_Unpin(t *testing.T) {
	ctx := context.Background()
	ts := newTestingStore(ctx, t)
	defer ts.Close()

	// Create test user
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Create test tag service
	service := createTestTagService(ts, user)

	tagName := "test-tag"

	// First create a pinned tag
	pinnedTime := time.Now().Unix()
	tagHash := calculateTagHash(tagName)
	_, err = ts.UpdateTag(ctx, &store.UpdateTag{
		TagHash:      tagHash,
		CreatorID:    user.ID,
		TagName:      &tagName,
		PinnedTs:     &pinnedTime,
		UpdatePinned: true,
	})
	require.NoError(t, err)

	// Now unpin it
	unpinned := false
	req := &v1pb.UpdateTagRequest{
		TagName: tagName,
		Pinned:  &unpinned,
	}

	resp, err := service.UpdateTag(ctx, req)
	require.NoError(t, err)
	require.Equal(t, tagName, resp.TagName)
	require.Nil(t, resp.PinnedTime)

	// Verify in store by checking no pinned tags
	pinnedTags, err := ts.ListPinnedTags(ctx, user.ID)
	require.NoError(t, err)
	require.Len(t, pinnedTags, 0) // Should be no pinned tags after unpinning
}

func TestTagService_UpdateTag_SetEmoji(t *testing.T) {
	ctx := context.Background()
	ts := newTestingStore(ctx, t)
	defer ts.Close()

	// Create test user
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Create test tag service
	service := createTestTagService(ts, user)

	tagName := "test-tag"
	emoji := "🔥"

	// Test setting emoji
	req := &v1pb.UpdateTagRequest{
		TagName: tagName,
		Emoji:   &emoji,
	}

	resp, err := service.UpdateTag(ctx, req)
	require.NoError(t, err)
	require.Equal(t, tagName, resp.TagName)
	require.Equal(t, emoji, resp.Emoji)

	// Verify in store by checking emoji tags
	emojiTags, err := ts.ListTagsWithEmoji(ctx, user.ID)
	require.NoError(t, err)
	require.Len(t, emojiTags, 1)
	require.Equal(t, tagName, emojiTags[0].TagName)
	require.Equal(t, emoji, emojiTags[0].Emoji)
}

func TestTagService_UpdateTag_NoAuth(t *testing.T) {
	ctx := context.Background()
	ts := newTestingStore(ctx, t)
	defer ts.Close()

	// Create test tag service without user (authentication should fail)
	service := createTestTagService(ts, nil)

	// Test without authentication
	req := &v1pb.UpdateTagRequest{
		TagName: "test-tag",
	}

	_, err := service.UpdateTag(ctx, req)
	require.Error(t, err)
	// Verify it's an authentication error
	st, ok := status.FromError(err)
	require.True(t, ok)
	require.Equal(t, codes.Unauthenticated, st.Code())
}

func TestTagService_UpdateTag_InvalidTagName(t *testing.T) {
	ctx := context.Background()
	ts := newTestingStore(ctx, t)
	defer ts.Close()

	// Create test user
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Create test tag service
	service := createTestTagService(ts, user)

	// Test with empty tag name
	req := &v1pb.UpdateTagRequest{
		TagName: "",
	}

	_, err = service.UpdateTag(ctx, req)
	require.Error(t, err)
	st, ok := status.FromError(err)
	require.True(t, ok)
	require.Equal(t, codes.InvalidArgument, st.Code())
}

// Helper functions
func createTestingHostUser(ctx context.Context, ts *store.Store) (*store.User, error) {
	userCreate := &store.User{
		Username:    "test",
		Role:        store.RoleHost,
		Email:       "test@test.com",
		Nickname:    "test_nickname",
		Description: "test_description",
	}
	user, err := ts.CreateUser(ctx, userCreate)
	return user, err
}

func calculateTagHash(tagName string) string {
	hash := sha256.Sum256([]byte(tagName))
	return fmt.Sprintf("%x", hash)
}
