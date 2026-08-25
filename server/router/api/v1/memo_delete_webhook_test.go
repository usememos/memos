package v1

import (
	"context"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/usememos/memos/internal/webhook"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

func TestDeleteMemoWebhooksRespectCurrentReadAccess(t *testing.T) {
	ctx := context.Background()
	service := newIntegrationService(t)
	owner := createSpaceTestUser(ctx, t, service, "delete-webhook-owner", store.RoleUser)
	successor := createSpaceTestUser(ctx, t, service, "delete-webhook-successor", store.RoleUser)
	ownerCtx := userCtx(ctx, owner.ID)
	successorCtx := userCtx(ctx, successor.ID)

	space, err := service.CreateSpace(ownerCtx, &v1pb.CreateSpaceRequest{
		SpaceId: "delete-webhook-space",
		Space:   &v1pb.Space{Title: "Delete webhook space"},
	})
	require.NoError(t, err)
	inviteAndAcceptSpaceTestUser(ctx, t, service, owner, successor, space, v1pb.SpaceMember_ADMIN)

	assignedSpace := space.Name
	hiddenMemo, err := service.CreateMemo(ownerCtx, &v1pb.CreateMemoRequest{
		Memo: &v1pb.Memo{
			Content:    "must not leave through a webhook",
			Visibility: v1pb.Visibility_SPACE,
			Space:      &assignedSpace,
		},
	})
	require.NoError(t, err)
	readableMemo, err := service.CreateMemo(ownerCtx, &v1pb.CreateMemoRequest{
		Memo: &v1pb.Memo{
			Content:    "readable deletion payload",
			Visibility: v1pb.Visibility_PRIVATE,
		},
	})
	require.NoError(t, err)

	_, err = service.DeleteSpaceMember(successorCtx, &v1pb.DeleteSpaceMemberRequest{
		Name: buildSpaceMemberName("delete-webhook-space", owner.Username),
	})
	require.NoError(t, err)
	_, err = service.GetMemo(ownerCtx, &v1pb.GetMemoRequest{Name: hiddenMemo.Name})
	require.Equal(t, codes.PermissionDenied, status.Code(err))

	received := make(chan []byte, 4)
	receiver := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, readErr := io.ReadAll(r.Body)
		if readErr != nil {
			http.Error(w, readErr.Error(), http.StatusBadRequest)
			return
		}
		received <- body
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"code":0}`))
	}))
	defer receiver.Close()

	receiverHost, _, err := net.SplitHostPort(receiver.Listener.Addr().String())
	require.NoError(t, err)
	require.NoError(t, webhook.ConfigurePrivateDestinationAllowlist([]string{receiverHost}))
	defer func() {
		require.NoError(t, webhook.ConfigurePrivateDestinationAllowlist(nil))
	}()
	_, err = service.CreateUserWebhook(ownerCtx, &v1pb.CreateUserWebhookRequest{
		Parent: BuildUserName(owner.Username),
		Webhook: &v1pb.UserWebhook{
			DisplayName: "delete-capture",
			Url:         receiver.URL,
		},
	})
	require.NoError(t, err)

	_, err = service.DeleteMemo(ownerCtx, &v1pb.DeleteMemoRequest{Name: hiddenMemo.Name})
	require.NoError(t, err, "the author retains narrow lifecycle authority after losing membership")
	select {
	case body := <-received:
		require.Failf(t, "unreadable memo leaked through webhook", "received %s", body)
	case <-time.After(500 * time.Millisecond):
	}

	_, err = service.DeleteMemo(ownerCtx, &v1pb.DeleteMemoRequest{Name: readableMemo.Name})
	require.NoError(t, err)
	var body []byte
	select {
	case body = <-received:
	case <-time.After(3 * time.Second):
		require.FailNow(t, "readable memo deletion webhook was not delivered")
	}
	payload := &webhook.WebhookRequestPayload{}
	require.NoError(t, json.Unmarshal(body, payload))
	require.Equal(t, "memos.memo.deleted", payload.ActivityType)
	require.NotNil(t, payload.Memo)
	require.Equal(t, readableMemo.Name, payload.Memo.Name)
	require.Equal(t, "readable deletion payload", payload.Memo.Content)
	require.NotContains(t, string(body), hiddenMemo.Content)

	select {
	case extra := <-received:
		require.Failf(t, "unexpected additional deletion webhook", "received %s", extra)
	case <-time.After(200 * time.Millisecond):
	}
}
