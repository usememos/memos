package teststore

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

func TestWebhookStore(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	webhook, err := ts.CreateWebhook(ctx, &store.Webhook{
		CreatorID: user.ID,
		Name:      "test_webhook",
		URL:       "https://example.com",
	})
	require.NoError(t, err)
	require.Equal(t, "test_webhook", webhook.Name)
	require.Equal(t, user.ID, webhook.CreatorID)
	webhooks, err := ts.ListWebhooks(ctx, &store.FindWebhook{
		CreatorID: &user.ID,
	})
	require.NoError(t, err)
	require.Equal(t, 1, len(webhooks))
	require.Equal(t, webhook, webhooks[0])
	newName := "test_webhook_new"
	updatedWebhook, err := ts.UpdateWebhook(ctx, &store.UpdateWebhook{
		ID:   webhook.ID,
		Name: &newName,
	})
	require.NoError(t, err)
	require.Equal(t, newName, updatedWebhook.Name)
	require.Equal(t, webhook.CreatorID, updatedWebhook.CreatorID)
	err = ts.DeleteWebhook(ctx, &store.DeleteWebhook{
		ID: webhook.ID,
	})
	require.NoError(t, err)
	webhooks, err = ts.ListWebhooks(ctx, &store.FindWebhook{
		CreatorID: &user.ID,
	})
	require.NoError(t, err)
	require.Equal(t, 0, len(webhooks))
	ts.Close()
}
