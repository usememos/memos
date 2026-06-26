package v1

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// TestConvertUserWebhookFromUserSettingOmitsSigningSecret guards the core security
// invariant of the signing-secret feature: the secret is INPUT_ONLY and must never
// be copied into an API response, even though it is persisted in the user setting.
func TestConvertUserWebhookFromUserSettingOmitsSigningSecret(t *testing.T) {
	user := &store.User{Username: "alice"}
	stored := &storepb.WebhooksUserSetting_Webhook{
		Id:            "webhook-id",
		Title:         "My Webhook",
		Url:           "https://example.com/postreceive",
		SigningSecret: "whsec_super-secret-value",
	}

	apiWebhook := convertUserWebhookFromUserSetting(stored, user)

	require.Equal(t, "My Webhook", apiWebhook.DisplayName)
	require.Equal(t, "https://example.com/postreceive", apiWebhook.Url)
	require.Empty(t, apiWebhook.SigningSecret, "signing secret must never be returned in API responses")
	require.True(t, apiWebhook.SigningSecretSet, "signing_secret_set must be true when secret is configured")
}

// TestUserWebhookSigningSecretLifecycle covers the reveal-later flow: a webhook
// created without a secret is auto-assigned one server-side (exposed only via the
// signing_secret_set flag), the owner can reveal the value, and a non-owner cannot.
func TestUserWebhookSigningSecretLifecycle(t *testing.T) {
	svc := newIntegrationService(t)
	ctx := context.Background()

	// First user initializes the store as host/admin; the test actors are regular users.
	_, err := svc.Store.CreateUser(ctx, &store.User{Username: "host", Role: store.RoleAdmin, Email: "host@example.com"})
	require.NoError(t, err)
	owner, err := svc.Store.CreateUser(ctx, &store.User{Username: "owner", Role: store.RoleUser, Email: "owner@example.com"})
	require.NoError(t, err)
	other, err := svc.Store.CreateUser(ctx, &store.User{Username: "other", Role: store.RoleUser, Email: "other@example.com"})
	require.NoError(t, err)

	ownerCtx := userCtx(ctx, owner.ID)
	otherCtx := userCtx(ctx, other.ID)

	// Create without supplying a secret -> the server generates one.
	created, err := svc.CreateUserWebhook(ownerCtx, &v1pb.CreateUserWebhookRequest{
		Parent:  "users/owner",
		Webhook: &v1pb.UserWebhook{DisplayName: "deploy", Url: "https://example.com/postreceive"},
	})
	require.NoError(t, err)
	require.True(t, created.SigningSecretSet, "create must auto-generate a signing secret")
	require.Empty(t, created.SigningSecret, "create response must never carry the secret value")

	// The owner can reveal the generated value.
	revealed, err := svc.GetUserWebhookSigningSecret(ownerCtx, &v1pb.GetUserWebhookSigningSecretRequest{Name: created.Name})
	require.NoError(t, err)
	require.True(t, strings.HasPrefix(revealed.SigningSecret, "whsec_"), "revealed secret must be in whsec_ form")

	// A non-owner, non-admin user cannot reveal it.
	_, err = svc.GetUserWebhookSigningSecret(otherCtx, &v1pb.GetUserWebhookSigningSecretRequest{Name: created.Name})
	require.Error(t, err)
	require.Equal(t, codes.PermissionDenied, status.Code(err), "non-owner must be denied")
}
