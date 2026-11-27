package test

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/internal/profile"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// webhookSettingDriver stubs only the user-setting calls used by the webhook
// store methods, so a test can inject persistence failures and slow writes.
type webhookSettingDriver struct {
	store.Driver

	raw         *store.UserSetting
	fail        bool
	block       bool
	reads       atomic.Int32
	entered     chan struct{}
	read2       chan struct{}
	release     chan struct{}
	listEntered chan struct{}
	listRelease chan struct{}
	firstRaw    *store.UserSetting
}

func (*webhookSettingDriver) Close() error { return nil }

func (d *webhookSettingDriver) UpsertUserSetting(_ context.Context, upsert *store.UserSetting) (*store.UserSetting, error) {
	if d.fail {
		return nil, errors.New("injected upsert failure")
	}
	if d.block {
		d.block = false
		close(d.entered)
		<-d.release
	}
	d.raw = upsert
	return upsert, nil
}

func (d *webhookSettingDriver) ListUserSettings(_ context.Context, _ *store.FindUserSetting) ([]*store.UserSetting, error) {
	read := d.reads.Add(1)
	if d.read2 != nil && read == 2 {
		close(d.read2)
	}
	if read == 1 && d.listEntered != nil {
		close(d.listEntered)
		<-d.listRelease
		if d.firstRaw != nil {
			return []*store.UserSetting{d.firstRaw}, nil
		}
	}
	if d.raw == nil {
		return nil, nil
	}
	return []*store.UserSetting{d.raw}, nil
}

func newWebhookTestStore(driver *webhookSettingDriver) *store.Store {
	return store.New(driver, &profile.Profile{})
}

func TestUserWebhookFailedUpdateDoesNotMutateCachedSetting(t *testing.T) {
	ctx := context.Background()
	driver := &webhookSettingDriver{}
	ts := newWebhookTestStore(driver)

	require.NoError(t, ts.AddUserWebhook(ctx, 1, &storepb.WebhooksUserSetting_Webhook{Id: "hook-1", Title: "original"}))

	driver.fail = true
	err := ts.UpdateUserWebhook(ctx, 1, &storepb.WebhooksUserSetting_Webhook{Id: "hook-1", Title: "updated"})
	require.Error(t, err)

	webhooks, err := ts.GetUserWebhooks(ctx, 1)
	require.NoError(t, err)
	require.Len(t, webhooks, 1)
	require.Equal(t, "original", webhooks[0].Title)
}

func TestUserWebhookReadersCannotMutateCachedSetting(t *testing.T) {
	ctx := context.Background()
	driver := &webhookSettingDriver{}
	ts := newWebhookTestStore(driver)

	require.NoError(t, ts.AddUserWebhook(ctx, 1, &storepb.WebhooksUserSetting_Webhook{Id: "hook-1", Title: "original"}))

	webhooks, err := ts.GetUserWebhooks(ctx, 1)
	require.NoError(t, err)
	require.Len(t, webhooks, 1)
	webhooks[0].Title = "mutated by caller"

	again, err := ts.GetUserWebhooks(ctx, 1)
	require.NoError(t, err)
	require.Len(t, again, 1)
	require.Equal(t, "original", again[0].Title)
}

func TestUserWebhookConcurrentAddsAreSerialized(t *testing.T) {
	ctx := context.Background()
	driver := &webhookSettingDriver{
		entered: make(chan struct{}),
		read2:   make(chan struct{}),
		release: make(chan struct{}),
		block:   true,
	}
	ts := newWebhookTestStore(driver)

	var wg sync.WaitGroup
	errs := make(chan error, 2)
	wg.Go(func() {
		errs <- ts.AddUserWebhook(ctx, 1, &storepb.WebhooksUserSetting_Webhook{Id: "hook-1"})
	})

	select {
	case <-driver.entered:
	case <-time.After(5 * time.Second):
		t.Fatal("first webhook add never reached persistence")
	}

	wg.Go(func() {
		errs <- ts.AddUserWebhook(ctx, 1, &storepb.WebhooksUserSetting_Webhook{Id: "hook-2"})
	})

	// Without a mutex the second add reads stale state while the first write is
	// blocked. With a mutex it waits for the first write and never gets here.
	select {
	case <-driver.read2:
	case <-time.After(300 * time.Millisecond):
	}
	close(driver.release)
	wg.Wait()
	require.NoError(t, <-errs)
	require.NoError(t, <-errs)

	webhooks, err := ts.GetUserWebhooks(ctx, 1)
	require.NoError(t, err)
	ids := make([]string, 0, len(webhooks))
	for _, webhook := range webhooks {
		ids = append(ids, webhook.Id)
	}
	require.ElementsMatch(t, []string{"hook-1", "hook-2"}, ids)
}

func TestUserWebhookStaleCacheFillCannotOverwriteMutation(t *testing.T) {
	ctx := context.Background()
	seedDriver := &webhookSettingDriver{}
	seedStore := newWebhookTestStore(seedDriver)
	_, err := seedStore.UpsertUserSetting(ctx, &storepb.UserSetting{
		UserId: 1,
		Key:    storepb.UserSetting_WEBHOOKS,
		Value: &storepb.UserSetting_Webhooks{
			Webhooks: &storepb.WebhooksUserSetting{
				Webhooks: []*storepb.WebhooksUserSetting_Webhook{{Id: "hook-old"}},
			},
		},
	})
	require.NoError(t, err)
	staleRaw := seedDriver.raw

	driver := &webhookSettingDriver{
		raw:         staleRaw,
		firstRaw:    staleRaw,
		listEntered: make(chan struct{}),
		listRelease: make(chan struct{}),
	}
	ts := newWebhookTestStore(driver)
	userID := int32(1)

	readErr := make(chan error, 1)
	readDone := make(chan struct{})
	go func() {
		defer close(readDone)
		_, err := ts.ListUserSettings(ctx, &store.FindUserSetting{UserID: &userID, Key: storepb.UserSetting_WEBHOOKS})
		readErr <- err
	}()

	select {
	case <-driver.listEntered:
	case <-time.After(5 * time.Second):
		t.Fatal("stale read never reached persistence")
	}

	addDone := make(chan error, 1)
	go func() {
		addDone <- ts.AddUserWebhook(ctx, userID, &storepb.WebhooksUserSetting_Webhook{Id: "hook-new"})
	}()

	addFinished := false
	select {
	case err := <-addDone:
		require.NoError(t, err)
		addFinished = true
	case <-time.After(200 * time.Millisecond):
	}

	close(driver.listRelease)
	<-readDone
	require.NoError(t, <-readErr)

	if !addFinished {
		select {
		case err := <-addDone:
			require.NoError(t, err)
		case <-time.After(5 * time.Second):
			t.Fatal("webhook add never finished")
		}
	}

	webhooks, err := ts.GetUserWebhooks(ctx, userID)
	require.NoError(t, err)
	ids := make([]string, 0, len(webhooks))
	for _, webhook := range webhooks {
		ids = append(ids, webhook.Id)
	}
	require.Contains(t, ids, "hook-new")
}
