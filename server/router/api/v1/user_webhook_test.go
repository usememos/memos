package v1

import (
	"testing"

	"github.com/stretchr/testify/require"

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
}
