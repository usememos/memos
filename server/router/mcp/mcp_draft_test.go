package mcp

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/lithammer/shortuuid/v4"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

// createDraftMemo seeds a DRAFT memo directly in the store, mirroring the
// existing createMemo helper but with RowStatus=Draft.
func (s *testMCPService) createDraftMemo(t *testing.T, creatorID int32, visibility store.Visibility, content string) *store.Memo {
	t.Helper()
	memo, err := s.store.CreateMemo(context.Background(), &store.Memo{
		UID:        shortuuid.New(),
		CreatorID:  creatorID,
		RowStatus:  store.Draft,
		Visibility: visibility,
		Content:    content,
	})
	require.NoError(t, err)
	return memo
}

// Added-guard surface: MCP get_memo / read_resource must deny another user's
// PUBLIC-visibility DRAFT.
//
// RED today: checkMemoAccess (mcp/access.go:17-35) only rejects Archived for a
// non-creator; a PUBLIC draft passes the visibility switch and leaks.
func TestMCPGetMemoAndReadResourceDenyDraftToNonCreator(t *testing.T) {
	ts := newTestMCPService(t)
	owner := ts.createUser(t, "draft-owner")
	other := ts.createUser(t, "draft-other")

	draft := ts.createDraftMemo(t, owner.ID, store.Public, "public-visibility draft")

	ctx := withUser(context.Background(), other.ID)
	result, err := ts.service.handleGetMemo(ctx, toolRequest("get_memo", map[string]any{
		"name": "memos/" + draft.UID,
	}))
	require.NoError(t, err)
	require.True(t, result.IsError, "MCP get_memo must deny a non-creator access to a PUBLIC draft")
	require.Contains(t, firstText(t, result), "permission denied")

	_, err = ts.service.handleReadMemoResource(ctx, mcp.ReadResourceRequest{
		Params: mcp.ReadResourceParams{URI: "memo://memos/" + draft.UID},
	})
	require.ErrorContains(t, err, "permission denied",
		"MCP read_resource must deny a non-creator access to a PUBLIC draft")
}

// Added-guard surface: MCP list_memos must not surface another user's DRAFT,
// and applyVisibilityFilter must exclude DRAFT when listing the default NORMAL
// state.
//
// RED today: parseRowStatus rejects "DRAFT" so a creator cannot even ask for
// drafts; and because applyVisibilityFilter has no DRAFT constraint, the path
// is unguarded for that surface. We assert the creator-only contract directly.
func TestMCPListMemosDraftIsCreatorOnly(t *testing.T) {
	ts := newTestMCPService(t)
	owner := ts.createUser(t, "list-draft-owner")
	other := ts.createUser(t, "list-draft-other")

	ownerDraft := ts.createDraftMemo(t, owner.ID, store.Public, "owner draft")
	_ = ts.createDraftMemo(t, other.ID, store.Public, "other draft")

	result, err := ts.service.handleListMemos(withUser(context.Background(), owner.ID), toolRequest("list_memos", map[string]any{
		"state": "DRAFT",
	}))
	require.NoError(t, err)
	require.False(t, result.IsError, "a creator must be able to list their own drafts via MCP")

	var payload struct {
		Memos []memoJSON `json:"memos"`
	}
	require.NoError(t, json.Unmarshal([]byte(firstText(t, result)), &payload))
	require.Len(t, payload.Memos, 1, "MCP list_memos{state:DRAFT} must return only the caller's own drafts")
	require.Equal(t, "memos/"+ownerDraft.UID, payload.Memos[0].Name)
}

// Regression pin (already-safe surface): default MCP list_memos (state defaults
// to NORMAL) must exclude drafts. This PASSES today because the default
// RowStatus filter is NORMAL, and must STAY green.
func TestMCPListMemosDefaultExcludesDraftRegressionPin(t *testing.T) {
	ts := newTestMCPService(t)
	owner := ts.createUser(t, "default-list-owner")

	normal := ts.createMemo(t, owner.ID, store.Public, "normal memo")
	_ = ts.createDraftMemo(t, owner.ID, store.Public, "draft must not appear in default list")

	result, err := ts.service.handleListMemos(withUser(context.Background(), owner.ID), toolRequest("list_memos", map[string]any{}))
	require.NoError(t, err)
	require.False(t, result.IsError)

	var payload struct {
		Memos []memoJSON `json:"memos"`
	}
	require.NoError(t, json.Unmarshal([]byte(firstText(t, result)), &payload))
	require.Len(t, payload.Memos, 1)
	require.Equal(t, "memos/"+normal.UID, payload.Memos[0].Name)
}

// Regression pin (already-safe surface): MCP search_memos pins RowStatus=Normal
// so a DRAFT is never searchable. PASSES today, must STAY green.
func TestMCPSearchMemosExcludesDraftRegressionPin(t *testing.T) {
	ts := newTestMCPService(t)
	owner := ts.createUser(t, "search-owner")

	_ = ts.createMemo(t, owner.ID, store.Public, "findable normal needle")
	_ = ts.createDraftMemo(t, owner.ID, store.Public, "secret draft needle")

	result, err := ts.service.handleSearchMemos(withUser(context.Background(), owner.ID), toolRequest("search_memos", map[string]any{
		"query": "needle",
	}))
	require.NoError(t, err)
	require.False(t, result.IsError)

	// handleSearchMemos returns a bare JSON array of memoJSON.
	var memos []memoJSON
	require.NoError(t, json.Unmarshal([]byte(firstText(t, result)), &memos))
	require.Len(t, memos, 1, "search_memos must never return a DRAFT memo")
	require.Contains(t, memos[0].Content, "findable normal needle")
}
