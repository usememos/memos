package mcp

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/lithammer/shortuuid/v4"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/internal/profile"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/server/auth"
	"github.com/usememos/memos/store"
	teststore "github.com/usememos/memos/store/test"
)

type testMCPService struct {
	service *MCPService
	store   *store.Store
}

func newTestMCPService(t *testing.T) *testMCPService {
	t.Helper()

	ctx := context.Background()
	stores := teststore.NewTestingStore(ctx, t)
	t.Cleanup(func() {
		require.NoError(t, stores.Close())
	})

	svc := NewMCPService(&profile.Profile{
		Driver:      "sqlite",
		InstanceURL: "https://notes.example.com",
	}, stores, "test-secret")
	return &testMCPService{
		service: svc,
		store:   stores,
	}
}

func (s *testMCPService) createUser(t *testing.T, username string) *store.User {
	t.Helper()

	user, err := s.store.CreateUser(context.Background(), &store.User{
		Username: username,
		Role:     store.RoleUser,
		Email:    username + "@example.com",
	})
	require.NoError(t, err)
	return user
}

func (s *testMCPService) createMemo(t *testing.T, creatorID int32, visibility store.Visibility, content string) *store.Memo {
	t.Helper()

	memo, err := s.store.CreateMemo(context.Background(), &store.Memo{
		UID:        shortuuid.New(),
		CreatorID:  creatorID,
		RowStatus:  store.Normal,
		Visibility: visibility,
		Content:    content,
	})
	require.NoError(t, err)
	return memo
}

func (s *testMCPService) archiveMemo(t *testing.T, memoID int32) {
	t.Helper()

	rowStatus := store.Archived
	require.NoError(t, s.store.UpdateMemo(context.Background(), &store.UpdateMemo{
		ID:        memoID,
		RowStatus: &rowStatus,
	}))
}

func (s *testMCPService) createAttachment(t *testing.T, creatorID int32, memoID *int32) *store.Attachment {
	t.Helper()

	attachment, err := s.store.CreateAttachment(context.Background(), &store.Attachment{
		UID:         shortuuid.New(),
		CreatorID:   creatorID,
		Filename:    "note.txt",
		Type:        "text/plain",
		Size:        4,
		StorageType: storepb.AttachmentStorageType_ATTACHMENT_STORAGE_TYPE_UNSPECIFIED,
		Reference:   "db://attachment/note.txt",
		MemoID:      memoID,
	})
	require.NoError(t, err)
	return attachment
}

func withUser(ctx context.Context, userID int32) context.Context {
	return context.WithValue(ctx, auth.UserIDContextKey, userID)
}

func toolRequest(name string, arguments map[string]any) mcp.CallToolRequest {
	return mcp.CallToolRequest{
		Params: mcp.CallToolParams{
			Name:      name,
			Arguments: arguments,
		},
	}
}

func firstText(t *testing.T, result *mcp.CallToolResult) string {
	t.Helper()
	require.NotEmpty(t, result.Content)
	text, ok := result.Content[0].(mcp.TextContent)
	require.True(t, ok)
	return text.Text
}

func TestHandleGetMemoAndReadResourceDenyArchivedMemoToNonCreator(t *testing.T) {
	ts := newTestMCPService(t)
	owner := ts.createUser(t, "owner")
	other := ts.createUser(t, "other")

	memo := ts.createMemo(t, owner.ID, store.Public, "archived")
	ts.archiveMemo(t, memo.ID)

	ctx := withUser(context.Background(), other.ID)
	result, err := ts.service.handleGetMemo(ctx, toolRequest("get_memo", map[string]any{
		"name": "memos/" + memo.UID,
	}))
	require.NoError(t, err)
	require.True(t, result.IsError)
	require.Contains(t, firstText(t, result), "permission denied")

	_, err = ts.service.handleReadMemoResource(ctx, mcp.ReadResourceRequest{
		Params: mcp.ReadResourceParams{
			URI: "memo://memos/" + memo.UID,
		},
	})
	require.ErrorContains(t, err, "permission denied")
}

func TestHandleListMemosArchivedOnlyReturnsCreatorMemos(t *testing.T) {
	ts := newTestMCPService(t)
	owner := ts.createUser(t, "owner")
	other := ts.createUser(t, "other")

	ownerMemo := ts.createMemo(t, owner.ID, store.Public, "owner archived")
	ts.archiveMemo(t, ownerMemo.ID)
	otherMemo := ts.createMemo(t, other.ID, store.Public, "other archived")
	ts.archiveMemo(t, otherMemo.ID)

	result, err := ts.service.handleListMemos(withUser(context.Background(), owner.ID), toolRequest("list_memos", map[string]any{
		"state": "ARCHIVED",
	}))
	require.NoError(t, err)
	require.False(t, result.IsError)

	var payload struct {
		Memos []memoJSON `json:"memos"`
	}
	require.NoError(t, json.Unmarshal([]byte(firstText(t, result)), &payload))
	require.Len(t, payload.Memos, 1)
	require.Equal(t, "memos/"+ownerMemo.UID, payload.Memos[0].Name)

	anonResult, err := ts.service.handleListMemos(context.Background(), toolRequest("list_memos", map[string]any{
		"state": "ARCHIVED",
	}))
	require.NoError(t, err)
	require.NoError(t, json.Unmarshal([]byte(firstText(t, anonResult)), &payload))
	require.Empty(t, payload.Memos)
}

func TestHandleListMemoRelationsFiltersUnreadableTargets(t *testing.T) {
	ts := newTestMCPService(t)
	owner := ts.createUser(t, "owner")
	privateUser := ts.createUser(t, "private-user")
	publicUser := ts.createUser(t, "public-user")

	source := ts.createMemo(t, owner.ID, store.Public, "source")
	privateTarget := ts.createMemo(t, privateUser.ID, store.Private, "private")
	publicTarget := ts.createMemo(t, publicUser.ID, store.Public, "public")

	_, err := ts.store.UpsertMemoRelation(context.Background(), &store.MemoRelation{
		MemoID:        source.ID,
		RelatedMemoID: privateTarget.ID,
		Type:          store.MemoRelationReference,
	})
	require.NoError(t, err)
	_, err = ts.store.UpsertMemoRelation(context.Background(), &store.MemoRelation{
		MemoID:        source.ID,
		RelatedMemoID: publicTarget.ID,
		Type:          store.MemoRelationReference,
	})
	require.NoError(t, err)

	result, err := ts.service.handleListMemoRelations(context.Background(), toolRequest("list_memo_relations", map[string]any{
		"name": "memos/" + source.UID,
	}))
	require.NoError(t, err)
	require.False(t, result.IsError)

	var relations []relationJSON
	require.NoError(t, json.Unmarshal([]byte(firstText(t, result)), &relations))
	require.Len(t, relations, 1)
	require.Equal(t, "memos/"+publicTarget.UID, relations[0].RelatedMemo)

	denied, err := ts.service.handleListMemoRelations(context.Background(), toolRequest("list_memo_relations", map[string]any{
		"name": "memos/" + privateTarget.UID,
	}))
	require.NoError(t, err)
	require.True(t, denied.IsError)
	require.Contains(t, firstText(t, denied), "permission denied")
}

func TestHandleLinkAttachmentToMemoRequiresMemoOwnership(t *testing.T) {
	ts := newTestMCPService(t)
	attachmentOwner := ts.createUser(t, "attachment-owner")
	memoOwner := ts.createUser(t, "memo-owner")

	attachment := ts.createAttachment(t, attachmentOwner.ID, nil)
	memo := ts.createMemo(t, memoOwner.ID, store.Public, "target")

	result, err := ts.service.handleLinkAttachmentToMemo(withUser(context.Background(), attachmentOwner.ID), toolRequest("link_attachment_to_memo", map[string]any{
		"name": "attachments/" + attachment.UID,
		"memo": "memos/" + memo.UID,
	}))
	require.NoError(t, err)
	require.True(t, result.IsError)
	require.Contains(t, firstText(t, result), "permission denied")
}

func TestHandleGetAttachmentDeniesArchivedLinkedMemoToNonCreator(t *testing.T) {
	ts := newTestMCPService(t)
	owner := ts.createUser(t, "owner")
	other := ts.createUser(t, "other")

	memo := ts.createMemo(t, owner.ID, store.Public, "memo")
	ts.archiveMemo(t, memo.ID)
	attachment := ts.createAttachment(t, owner.ID, &memo.ID)

	result, err := ts.service.handleGetAttachment(withUser(context.Background(), other.ID), toolRequest("get_attachment", map[string]any{
		"name": "attachments/" + attachment.UID,
	}))
	require.NoError(t, err)
	require.True(t, result.IsError)
	require.Contains(t, firstText(t, result), "permission denied")
}

func TestIsAllowedOrigin(t *testing.T) {
	ts := newTestMCPService(t)

	t.Run("allow missing origin", func(t *testing.T) {
		req := httptest.NewRequest("POST", "http://localhost:5230/mcp", nil)
		require.True(t, ts.service.isAllowedOrigin(req))
	})

	t.Run("allow same origin as request host", func(t *testing.T) {
		req := httptest.NewRequest("POST", "http://localhost:5230/mcp", nil)
		req.Header.Set("Origin", "http://localhost:5230")
		require.True(t, ts.service.isAllowedOrigin(req))
	})

	t.Run("allow configured instance origin", func(t *testing.T) {
		req := httptest.NewRequest("POST", "http://127.0.0.1:5230/mcp", nil)
		req.Host = "127.0.0.1:5230"
		req.Header.Set("Origin", "https://notes.example.com")
		require.True(t, ts.service.isAllowedOrigin(req))
	})

	t.Run("reject cross origin", func(t *testing.T) {
		req := httptest.NewRequest("POST", "http://localhost:5230/mcp", nil)
		req.Header.Set("Origin", "https://evil.example.com")
		require.False(t, ts.service.isAllowedOrigin(req))
	})
}
