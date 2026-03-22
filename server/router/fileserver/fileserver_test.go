package fileserver

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v5"
	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/internal/profile"
	"github.com/usememos/memos/plugin/markdown"
	apiv1 "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/server/auth"
	apiv1service "github.com/usememos/memos/server/router/api/v1"
	"github.com/usememos/memos/store"
	teststore "github.com/usememos/memos/store/test"
)

func TestServeAttachmentFile_ShareTokenAllowsDirectMemoAttachment(t *testing.T) {
	ctx := context.Background()
	svc, fs, _, cleanup := newShareAttachmentTestServices(ctx, t)
	defer cleanup()

	creator, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "share-parent-owner",
		Role:     store.RoleUser,
		Email:    "share-parent-owner@example.com",
	})
	require.NoError(t, err)

	creatorCtx := context.WithValue(ctx, auth.UserIDContextKey, creator.ID)

	attachment, err := svc.CreateAttachment(creatorCtx, &apiv1.CreateAttachmentRequest{
		Attachment: &apiv1.Attachment{
			Filename: "memo.txt",
			Type:     "text/plain",
			Content:  []byte("memo attachment"),
		},
	})
	require.NoError(t, err)

	parentMemo, err := svc.CreateMemo(creatorCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			Content:    "shared parent",
			Visibility: apiv1.Visibility_PROTECTED,
			Attachments: []*apiv1.Attachment{
				{Name: attachment.Name},
			},
		},
	})
	require.NoError(t, err)

	share, err := svc.CreateMemoShare(creatorCtx, &apiv1.CreateMemoShareRequest{
		Parent:    parentMemo.Name,
		MemoShare: &apiv1.MemoShare{},
	})
	require.NoError(t, err)
	shareToken := share.Name[strings.LastIndex(share.Name, "/")+1:]

	e := echo.New()
	fs.RegisterRoutes(e)

	req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/file/%s/%s?share_token=%s", attachment.Name, attachment.Filename, shareToken), nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, "memo attachment", rec.Body.String())
}

func TestServeAttachmentFile_ShareTokenRejectsCommentAttachment(t *testing.T) {
	ctx := context.Background()
	svc, fs, _, cleanup := newShareAttachmentTestServices(ctx, t)
	defer cleanup()

	creator, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "private-parent-owner",
		Role:     store.RoleUser,
		Email:    "private-parent-owner@example.com",
	})
	require.NoError(t, err)

	creatorCtx := context.WithValue(ctx, auth.UserIDContextKey, creator.ID)
	commenter, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "share-commenter",
		Role:     store.RoleUser,
		Email:    "share-commenter@example.com",
	})
	require.NoError(t, err)
	commenterCtx := context.WithValue(ctx, auth.UserIDContextKey, commenter.ID)

	parentMemo, err := svc.CreateMemo(creatorCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			Content:    "shared parent",
			Visibility: apiv1.Visibility_PROTECTED,
		},
	})
	require.NoError(t, err)

	commentAttachment, err := svc.CreateAttachment(commenterCtx, &apiv1.CreateAttachmentRequest{
		Attachment: &apiv1.Attachment{
			Filename: "comment.txt",
			Type:     "text/plain",
			Content:  []byte("comment attachment"),
		},
	})
	require.NoError(t, err)

	_, err = svc.CreateMemoComment(commenterCtx, &apiv1.CreateMemoCommentRequest{
		Name: parentMemo.Name,
		Comment: &apiv1.Memo{
			Content:    "comment with attachment",
			Visibility: apiv1.Visibility_PROTECTED,
			Attachments: []*apiv1.Attachment{
				{Name: commentAttachment.Name},
			},
		},
	})
	require.NoError(t, err)

	share, err := svc.CreateMemoShare(creatorCtx, &apiv1.CreateMemoShareRequest{
		Parent:    parentMemo.Name,
		MemoShare: &apiv1.MemoShare{},
	})
	require.NoError(t, err)
	shareToken := share.Name[strings.LastIndex(share.Name, "/")+1:]

	e := echo.New()
	fs.RegisterRoutes(e)

	req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/file/%s/%s?share_token=%s", commentAttachment.Name, commentAttachment.Filename, shareToken), nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	require.Equal(t, http.StatusUnauthorized, rec.Code)
}

func newShareAttachmentTestServices(ctx context.Context, t *testing.T) (*apiv1service.APIV1Service, *FileServerService, *store.Store, func()) {
	t.Helper()

	testStore := teststore.NewTestingStore(ctx, t)
	testProfile := &profile.Profile{
		Demo:        true,
		Version:     "test-1.0.0",
		InstanceURL: "http://localhost:8080",
		Driver:      "sqlite",
		DSN:         ":memory:",
		Data:        t.TempDir(),
	}
	secret := "test-secret"
	markdownService := markdown.NewService(markdown.WithTagExtension())
	apiService := &apiv1service.APIV1Service{
		Secret:          secret,
		Profile:         testProfile,
		Store:           testStore,
		MarkdownService: markdownService,
		SSEHub:          apiv1service.NewSSEHub(),
	}
	fileService := NewFileServerService(testProfile, testStore, secret)

	return apiService, fileService, testStore, func() {
		testStore.Close()
	}
}
