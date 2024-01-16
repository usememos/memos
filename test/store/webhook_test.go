package teststore

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func TestWebhookStore(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	webhook, err := ts.CreateWebhook(ctx, &storepb.Webhook{
		CreatorId: user.ID,
		Name:      "test_webhook",
		Url:       "https://example.com",
		RowStatus: storepb.RowStatus_NORMAL,
	})
	require.NoError(t, err)
	require.Equal(t, "test_webhook", webhook.Name)
	require.Equal(t, user.ID, webhook.CreatorId)
	webhooks, err := ts.ListWebhooks(ctx, &store.FindWebhook{
		CreatorID: &user.ID,
	})
	require.NoError(t, err)
	require.Equal(t, 1, len(webhooks))
	require.Equal(t, webhook, webhooks[0])
	newName := "test_webhook_new"
	updatedWebhook, err := ts.UpdateWebhook(ctx, &store.UpdateWebhook{
		ID:   webhook.Id,
		Name: &newName,
	})
	require.NoError(t, err)
	require.Equal(t, newName, updatedWebhook.Name)
	require.Equal(t, webhook.CreatorId, updatedWebhook.CreatorId)
	err = ts.DeleteWebhook(ctx, &store.DeleteWebhook{
		ID: webhook.Id,
	})
	require.NoError(t, err)
	webhooks, err = ts.ListWebhooks(ctx, &store.FindWebhook{
		CreatorID: &user.ID,
	})
	require.NoError(t, err)
	require.Equal(t, 0, len(webhooks))
	ts.Close()
}
