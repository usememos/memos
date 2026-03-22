package test

import (
	"context"
	"strconv"
	"testing"

	"github.com/lithammer/shortuuid/v4"
	"github.com/stretchr/testify/require"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// =============================================================================
// Formatting Helpers
// =============================================================================

func formatInt64(n int64) string {
	return strconv.FormatInt(n, 10)
}

func formatInt32(n int32) string {
	return strconv.FormatInt(int64(n), 10)
}

func formatInt(n int) string {
	return strconv.Itoa(n)
}

// =============================================================================
// Pointer Helpers
// =============================================================================

func boolPtr(b bool) *bool {
	return &b
}

// =============================================================================
// Test Fixture Builders
// =============================================================================

// MemoBuilder provides a fluent API for creating test memos.
type MemoBuilder struct {
	memo *store.Memo
}

// NewMemoBuilder creates a new memo builder with required fields.
func NewMemoBuilder(uid string, creatorID int32) *MemoBuilder {
	return &MemoBuilder{
		memo: &store.Memo{
			UID:        uid,
			CreatorID:  creatorID,
			Visibility: store.Public,
		},
	}
}

func (b *MemoBuilder) Content(content string) *MemoBuilder {
	b.memo.Content = content
	return b
}

func (b *MemoBuilder) Visibility(v store.Visibility) *MemoBuilder {
	b.memo.Visibility = v
	return b
}

func (b *MemoBuilder) Tags(tags ...string) *MemoBuilder {
	if b.memo.Payload == nil {
		b.memo.Payload = &storepb.MemoPayload{}
	}
	b.memo.Payload.Tags = tags
	return b
}

func (b *MemoBuilder) Property(fn func(*storepb.MemoPayload_Property)) *MemoBuilder {
	if b.memo.Payload == nil {
		b.memo.Payload = &storepb.MemoPayload{}
	}
	if b.memo.Payload.Property == nil {
		b.memo.Payload.Property = &storepb.MemoPayload_Property{}
	}
	fn(b.memo.Payload.Property)
	return b
}

func (b *MemoBuilder) Build() *store.Memo {
	return b.memo
}

// AttachmentBuilder provides a fluent API for creating test attachments.
type AttachmentBuilder struct {
	attachment *store.Attachment
}

// NewAttachmentBuilder creates a new attachment builder with required fields.
func NewAttachmentBuilder(creatorID int32) *AttachmentBuilder {
	return &AttachmentBuilder{
		attachment: &store.Attachment{
			UID:       shortuuid.New(),
			CreatorID: creatorID,
			Blob:      []byte("test"),
			Size:      1000,
		},
	}
}

func (b *AttachmentBuilder) Filename(filename string) *AttachmentBuilder {
	b.attachment.Filename = filename
	return b
}

func (b *AttachmentBuilder) MimeType(mimeType string) *AttachmentBuilder {
	b.attachment.Type = mimeType
	return b
}

func (b *AttachmentBuilder) MemoID(memoID *int32) *AttachmentBuilder {
	b.attachment.MemoID = memoID
	return b
}

func (b *AttachmentBuilder) Size(size int64) *AttachmentBuilder {
	b.attachment.Size = size
	return b
}

func (b *AttachmentBuilder) Build() *store.Attachment {
	return b.attachment
}

// =============================================================================
// Test Context Helpers
// =============================================================================

// MemoFilterTestContext holds common test dependencies for memo filter tests.
type MemoFilterTestContext struct {
	Ctx   context.Context
	T     *testing.T
	Store *store.Store
	User  *store.User
}

// NewMemoFilterTestContext creates a new test context with store and user.
func NewMemoFilterTestContext(t *testing.T) *MemoFilterTestContext {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	return &MemoFilterTestContext{
		Ctx:   ctx,
		T:     t,
		Store: ts,
		User:  user,
	}
}

// CreateMemo creates a memo using the builder pattern.
func (tc *MemoFilterTestContext) CreateMemo(b *MemoBuilder) *store.Memo {
	memo, err := tc.Store.CreateMemo(tc.Ctx, b.Build())
	require.NoError(tc.T, err)
	return memo
}

// PinMemo pins a memo by ID.
func (tc *MemoFilterTestContext) PinMemo(memoID int32) {
	err := tc.Store.UpdateMemo(tc.Ctx, &store.UpdateMemo{
		ID:     memoID,
		Pinned: boolPtr(true),
	})
	require.NoError(tc.T, err)
}

// ListWithFilter lists memos with the given filter and returns the count.
func (tc *MemoFilterTestContext) ListWithFilter(filter string) []*store.Memo {
	memos, err := tc.Store.ListMemos(tc.Ctx, &store.FindMemo{
		Filters: []string{filter},
	})
	require.NoError(tc.T, err)
	return memos
}

// ListWithFilters lists memos with multiple filters and returns the count.
func (tc *MemoFilterTestContext) ListWithFilters(filters ...string) []*store.Memo {
	memos, err := tc.Store.ListMemos(tc.Ctx, &store.FindMemo{
		Filters: filters,
	})
	require.NoError(tc.T, err)
	return memos
}

// Close closes the test store.
func (tc *MemoFilterTestContext) Close() {
	tc.Store.Close()
}

// AttachmentFilterTestContext holds common test dependencies for attachment filter tests.
type AttachmentFilterTestContext struct {
	Ctx       context.Context
	T         *testing.T
	Store     *store.Store
	User      *store.User
	CreatorID int32
}

// NewAttachmentFilterTestContext creates a new test context for attachments.
func NewAttachmentFilterTestContext(t *testing.T) *AttachmentFilterTestContext {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	return &AttachmentFilterTestContext{
		Ctx:       ctx,
		T:         t,
		Store:     ts,
		CreatorID: 101,
	}
}

// NewAttachmentFilterTestContextWithUser creates a new test context with a user.
func NewAttachmentFilterTestContextWithUser(t *testing.T) *AttachmentFilterTestContext {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	return &AttachmentFilterTestContext{
		Ctx:       ctx,
		T:         t,
		Store:     ts,
		User:      user,
		CreatorID: user.ID,
	}
}

// CreateAttachment creates an attachment using the builder pattern.
func (tc *AttachmentFilterTestContext) CreateAttachment(b *AttachmentBuilder) *store.Attachment {
	attachment, err := tc.Store.CreateAttachment(tc.Ctx, b.Build())
	require.NoError(tc.T, err)
	return attachment
}

// CreateMemo creates a memo (for attachment tests that need memos).
func (tc *AttachmentFilterTestContext) CreateMemo(uid, content string) *store.Memo {
	memo, err := tc.Store.CreateMemo(tc.Ctx, &store.Memo{
		UID:        uid,
		CreatorID:  tc.CreatorID,
		Content:    content,
		Visibility: store.Public,
	})
	require.NoError(tc.T, err)
	return memo
}

// ListWithFilter lists attachments with the given filter.
func (tc *AttachmentFilterTestContext) ListWithFilter(filter string) []*store.Attachment {
	attachments, err := tc.Store.ListAttachments(tc.Ctx, &store.FindAttachment{
		CreatorID: &tc.CreatorID,
		Filters:   []string{filter},
	})
	require.NoError(tc.T, err)
	return attachments
}

// ListWithFilters lists attachments with multiple filters.
func (tc *AttachmentFilterTestContext) ListWithFilters(filters ...string) []*store.Attachment {
	attachments, err := tc.Store.ListAttachments(tc.Ctx, &store.FindAttachment{
		CreatorID: &tc.CreatorID,
		Filters:   filters,
	})
	require.NoError(tc.T, err)
	return attachments
}

// Close closes the test store.
func (tc *AttachmentFilterTestContext) Close() {
	tc.Store.Close()
}

// =============================================================================
// Filter Test Case Definition
// =============================================================================

// FilterTestCase defines a single filter test case for table-driven tests.
type FilterTestCase struct {
	Name          string
	Filter        string
	ExpectedCount int
}
