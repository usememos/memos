package mcp

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"
	"time"
	"unsafe"

	"github.com/labstack/echo/v5"
	"github.com/lithammer/shortuuid/v4"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/internal/profile"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/server/auth"
	apiv1service "github.com/usememos/memos/server/router/api/v1"
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

	profile := &profile.Profile{
		Driver:      "sqlite",
		InstanceURL: "https://notes.example.com",
	}
	apiV1Service := apiv1service.NewAPIV1Service("test-secret", profile, stores)
	svc := NewMCPService(profile, stores, "test-secret", apiV1Service)
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

func initializeMCPHTTP(t *testing.T, e *echo.Echo, path string, headers map[string]string) string {
	t.Helper()
	payload := map[string]any{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "initialize",
		"params": map[string]any{
			"protocolVersion": "2025-06-18",
			"capabilities":    map[string]any{},
			"clientInfo": map[string]any{
				"name":    "mcp-test",
				"version": "1.0.0",
			},
		},
	}
	resp := postMCPHTTP(t, e, path, "", headers, payload)
	require.Equal(t, http.StatusOK, resp.Code, resp.Body.String())
	sessionID := resp.Header().Get("Mcp-Session-Id")
	require.NotEmpty(t, sessionID)
	return sessionID
}

func callMCPHTTP(t *testing.T, e *echo.Echo, path string, sessionID string, headers map[string]string, method string, params any) map[string]any {
	t.Helper()
	payload := map[string]any{
		"jsonrpc": "2.0",
		"id":      2,
		"method":  method,
	}
	if params != nil {
		payload["params"] = params
	}
	resp := postMCPHTTP(t, e, path, sessionID, headers, payload)
	require.Equal(t, http.StatusOK, resp.Code, resp.Body.String())
	var decoded map[string]any
	require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &decoded))
	return decoded
}

func postMCPHTTP(t *testing.T, e *echo.Echo, path string, sessionID string, headers map[string]string, payload map[string]any) *httptest.ResponseRecorder {
	t.Helper()
	body, err := json.Marshal(payload)
	require.NoError(t, err)
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if sessionID != "" {
		req.Header.Set("Mcp-Session-Id", sessionID)
	}
	for key, value := range headers {
		req.Header.Set(key, value)
	}
	resp := httptest.NewRecorder()
	e.ServeHTTP(resp, req)
	return resp
}

func toolNamesFromListResponse(t *testing.T, response map[string]any) map[string]struct{} {
	t.Helper()
	result, ok := response["result"].(map[string]any)
	require.True(t, ok, "missing result: %#v", response)
	rawTools, ok := result["tools"].([]any)
	require.True(t, ok, "missing tools: %#v", result)
	names := map[string]struct{}{}
	for _, rawTool := range rawTools {
		tool, ok := rawTool.(map[string]any)
		require.True(t, ok)
		name, ok := tool["name"].(string)
		require.True(t, ok)
		names[name] = struct{}{}
	}
	return names
}

func requireToolPresent(t *testing.T, names map[string]struct{}, name string) {
	t.Helper()
	_, ok := names[name]
	require.True(t, ok, "expected tool %q to be present in %#v", name, names)
}

func requireToolAbsent(t *testing.T, names map[string]struct{}, name string) {
	t.Helper()
	_, ok := names[name]
	require.False(t, ok, "expected tool %q to be absent in %#v", name, names)
}

func nextSSEEvent(t *testing.T, client *apiv1service.SSEClient) *apiv1service.SSEEvent {
	t.Helper()
	events := sseClientEvents(t, client)
	var data []byte
	select {
	case eventData, ok := <-events:
		require.True(t, ok, "SSE client channel closed")
		data = eventData
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for SSE event")
	}
	var event apiv1service.SSEEvent
	require.NoError(t, json.Unmarshal(data, &event))
	return &event
}

func requireNoSSEEvent(t *testing.T, client *apiv1service.SSEClient) {
	t.Helper()
	select {
	case eventData, ok := <-sseClientEvents(t, client):
		require.True(t, ok, "SSE client channel closed")
		t.Fatalf("unexpected SSE event received: %s", string(eventData))
	case <-time.After(150 * time.Millisecond):
	}
}

func sseClientEvents(t *testing.T, client *apiv1service.SSEClient) <-chan []byte {
	t.Helper()
	field := reflect.ValueOf(client).Elem().FieldByName("events")
	events, ok := reflect.NewAt(field.Type(), unsafe.Pointer(field.UnsafeAddr())).Elem().Interface().(chan []byte)
	require.True(t, ok)
	return events
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

func TestMCPToolFilteringRoutesAndHeaders(t *testing.T) {
	ts := newTestMCPService(t)
	e := echo.New()
	ts.service.RegisterRoutes(e)

	t.Run("default endpoint lists all tools", func(t *testing.T) {
		sessionID := initializeMCPHTTP(t, e, "/mcp", nil)
		response := callMCPHTTP(t, e, "/mcp", sessionID, nil, "tools/list", map[string]any{})
		names := toolNamesFromListResponse(t, response)
		require.Len(t, names, len(allMCPToolNames))
		requireToolPresent(t, names, "create_memo")
		requireToolPresent(t, names, "list_tags")
		requireToolPresent(t, names, "upsert_reaction")
	})

	t.Run("readonly header hides and blocks mutation tools", func(t *testing.T) {
		headers := map[string]string{headerMCPReadonly: "true"}
		sessionID := initializeMCPHTTP(t, e, "/mcp", nil)
		response := callMCPHTTP(t, e, "/mcp", sessionID, headers, "tools/list", map[string]any{})
		names := toolNamesFromListResponse(t, response)
		requireToolPresent(t, names, "list_memos")
		requireToolPresent(t, names, "list_tags")
		requireToolAbsent(t, names, "create_memo")
		requireToolAbsent(t, names, "delete_memo")

		callResponse := callMCPHTTP(t, e, "/mcp", sessionID, headers, "tools/call", map[string]any{
			"name":      "create_memo",
			"arguments": map[string]any{"content": "blocked"},
		})
		result, ok := callResponse["result"].(map[string]any)
		require.True(t, ok)
		require.Equal(t, true, result["isError"])
		rawContent, ok := result["content"].([]any)
		require.True(t, ok)
		content, ok := rawContent[0].(map[string]any)
		require.True(t, ok)
		require.Contains(t, content["text"], "not enabled")
	})

	t.Run("readonly alias applies path config", func(t *testing.T) {
		sessionID := initializeMCPHTTP(t, e, "/mcp/readonly", nil)
		response := callMCPHTTP(t, e, "/mcp/readonly", sessionID, nil, "tools/list", map[string]any{})
		names := toolNamesFromListResponse(t, response)
		requireToolPresent(t, names, "get_memo")
		requireToolAbsent(t, names, "create_memo")
		requireToolAbsent(t, names, "upsert_reaction")
	})

	t.Run("toolsets include and exclude compose", func(t *testing.T) {
		headers := map[string]string{
			headerMCPToolsets:     "memos",
			headerMCPTools:        "list_tags",
			headerMCPExcludeTools: "get_memo",
		}
		sessionID := initializeMCPHTTP(t, e, "/mcp", nil)
		response := callMCPHTTP(t, e, "/mcp", sessionID, headers, "tools/list", map[string]any{})
		names := toolNamesFromListResponse(t, response)
		requireToolPresent(t, names, "list_memos")
		requireToolPresent(t, names, "list_tags")
		requireToolAbsent(t, names, "get_memo")
		requireToolAbsent(t, names, "list_attachments")
	})

	t.Run("path toolsets and readonly compose", func(t *testing.T) {
		sessionID := initializeMCPHTTP(t, e, "/mcp/x/memos,tags/readonly", nil)
		response := callMCPHTTP(t, e, "/mcp/x/memos,tags/readonly", sessionID, nil, "tools/list", map[string]any{})
		names := toolNamesFromListResponse(t, response)
		requireToolPresent(t, names, "list_memos")
		requireToolPresent(t, names, "list_tags")
		requireToolAbsent(t, names, "create_memo")
		requireToolAbsent(t, names, "list_attachments")
	})

	t.Run("unknown toolset returns empty tool list", func(t *testing.T) {
		sessionID := initializeMCPHTTP(t, e, "/mcp/x/notreal", nil)
		response := callMCPHTTP(t, e, "/mcp/x/notreal", sessionID, nil, "tools/list", map[string]any{})
		names := toolNamesFromListResponse(t, response)
		require.Empty(t, names)
	})
}

func TestMCPMemoAndReactionMutationsEmitSSEEvents(t *testing.T) {
	ts := newTestMCPService(t)
	user := ts.createUser(t, "author")
	ctx := withUser(context.Background(), user.ID)
	client := ts.service.apiV1Service.SSEHub.Subscribe(user.ID, store.RoleUser)
	defer ts.service.apiV1Service.SSEHub.Unsubscribe(client)

	createResult, err := ts.service.handleCreateMemo(ctx, toolRequest("create_memo", map[string]any{
		"content":    "created from MCP",
		"visibility": "PRIVATE",
	}))
	require.NoError(t, err)
	require.False(t, createResult.IsError)
	createEvent := nextSSEEvent(t, client)
	require.Equal(t, apiv1service.SSEEventMemoCreated, createEvent.Type)

	var created memoJSON
	require.NoError(t, json.Unmarshal([]byte(firstText(t, createResult)), &created))

	updateResult, err := ts.service.handleUpdateMemo(ctx, toolRequest("update_memo", map[string]any{
		"name":    created.Name,
		"content": "updated from MCP",
	}))
	require.NoError(t, err)
	require.False(t, updateResult.IsError)
	updateEvent := nextSSEEvent(t, client)
	require.Equal(t, apiv1service.SSEEventMemoUpdated, updateEvent.Type)

	commentResult, err := ts.service.handleCreateMemoComment(ctx, toolRequest("create_memo_comment", map[string]any{
		"name":    created.Name,
		"content": "comment from MCP",
	}))
	require.NoError(t, err)
	require.False(t, commentResult.IsError)
	commentEvent := nextSSEEvent(t, client)
	require.Equal(t, apiv1service.SSEEventMemoCommentCreated, commentEvent.Type)
	require.Equal(t, created.Name, commentEvent.Name)

	upsertReactionResult, err := ts.service.handleUpsertReaction(ctx, toolRequest("upsert_reaction", map[string]any{
		"name":          created.Name,
		"reaction_type": "👍",
	}))
	require.NoError(t, err)
	require.False(t, upsertReactionResult.IsError)
	reactionEvent := nextSSEEvent(t, client)
	require.Equal(t, apiv1service.SSEEventReactionUpserted, reactionEvent.Type)

	var reaction reactionJSON
	require.NoError(t, json.Unmarshal([]byte(firstText(t, upsertReactionResult)), &reaction))
	deleteReactionResult, err := ts.service.handleDeleteReaction(ctx, toolRequest("delete_reaction", map[string]any{
		"id": float64(reaction.ID),
	}))
	require.NoError(t, err)
	require.False(t, deleteReactionResult.IsError)
	deleteReactionEvent := nextSSEEvent(t, client)
	require.Equal(t, apiv1service.SSEEventReactionDeleted, deleteReactionEvent.Type)

	deleteResult, err := ts.service.handleDeleteMemo(ctx, toolRequest("delete_memo", map[string]any{
		"name": created.Name,
	}))
	require.NoError(t, err)
	require.False(t, deleteResult.IsError)
	deleteEvent := nextSSEEvent(t, client)
	require.Equal(t, apiv1service.SSEEventMemoDeleted, deleteEvent.Type)
}

func TestMCPRelationAndAttachmentMutationsEmitMemoUpdated(t *testing.T) {
	ts := newTestMCPService(t)
	user := ts.createUser(t, "owner")
	ctx := withUser(context.Background(), user.ID)
	source := ts.createMemo(t, user.ID, store.Private, "source")
	target := ts.createMemo(t, user.ID, store.Private, "target")
	attachment := ts.createAttachment(t, user.ID, nil)
	client := ts.service.apiV1Service.SSEHub.Subscribe(user.ID, store.RoleUser)
	defer ts.service.apiV1Service.SSEHub.Unsubscribe(client)

	relationResult, err := ts.service.handleCreateMemoRelation(ctx, toolRequest("create_memo_relation", map[string]any{
		"name":         "memos/" + source.UID,
		"related_memo": "memos/" + target.UID,
	}))
	require.NoError(t, err)
	require.False(t, relationResult.IsError)
	relationEvent := nextSSEEvent(t, client)
	require.Equal(t, apiv1service.SSEEventMemoUpdated, relationEvent.Type)
	require.Equal(t, "memos/"+source.UID, relationEvent.Name)

	duplicateRelationResult, err := ts.service.handleCreateMemoRelation(ctx, toolRequest("create_memo_relation", map[string]any{
		"name":         "memos/" + source.UID,
		"related_memo": "memos/" + target.UID,
	}))
	require.NoError(t, err)
	require.False(t, duplicateRelationResult.IsError)
	requireNoSSEEvent(t, client)

	selfRelationResult, err := ts.service.handleCreateMemoRelation(ctx, toolRequest("create_memo_relation", map[string]any{
		"name":         "memos/" + source.UID,
		"related_memo": "memos/" + source.UID,
	}))
	require.NoError(t, err)
	require.True(t, selfRelationResult.IsError)
	require.Contains(t, firstText(t, selfRelationResult), "itself")

	linkResult, err := ts.service.handleLinkAttachmentToMemo(ctx, toolRequest("link_attachment_to_memo", map[string]any{
		"name": "attachments/" + attachment.UID,
		"memo": "memos/" + source.UID,
	}))
	require.NoError(t, err)
	require.False(t, linkResult.IsError)
	attachmentEvent := nextSSEEvent(t, client)
	require.Equal(t, apiv1service.SSEEventMemoUpdated, attachmentEvent.Type)
	require.Equal(t, "memos/"+source.UID, attachmentEvent.Name)

	relinkResult, err := ts.service.handleLinkAttachmentToMemo(ctx, toolRequest("link_attachment_to_memo", map[string]any{
		"name": "attachments/" + attachment.UID,
		"memo": "memos/" + source.UID,
	}))
	require.NoError(t, err)
	require.False(t, relinkResult.IsError)
	requireNoSSEEvent(t, client)
}
