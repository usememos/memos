package v1

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func aiSettingWithAssistants(assistants ...*storepb.AIAssistantConfig) *storepb.InstanceAISetting {
	return &storepb.InstanceAISetting{
		Providers: []*storepb.AIProviderConfig{{
			Id:     "provider-1",
			Title:  "OpenAI",
			Type:   storepb.AIProviderType_OPENAI,
			ApiKey: "sk-test",
		}},
		Assistants: &storepb.AssistantsConfig{Enabled: true, Assistants: assistants},
	}
}

func TestPrepareAssistantsConfigProvisionsBotAccount(t *testing.T) {
	ctx := context.Background()
	svc := newIntegrationService(t)

	setting := aiSettingWithAssistants(&storepb.AIAssistantConfig{
		Id:         "reading",
		Title:      "Reading partner",
		Icon:       "📗",
		ProviderId: "provider-1",
		Enabled:    true,
	})
	require.NoError(t, svc.prepareInstanceAISettingForUpdate(ctx, setting))

	assistant := setting.GetAssistants().GetAssistants()[0]
	require.Positive(t, assistant.GetBotUserId(), "an enabled assistant must get a bot account")

	username := assistantBotUsername("reading")
	botUser, err := svc.Store.GetUser(ctx, &store.FindUser{Username: &username})
	require.NoError(t, err)
	require.NotNil(t, botUser)
	assert.Equal(t, assistant.GetBotUserId(), botUser.ID)
	assert.Equal(t, "Reading partner", botUser.Nickname)
	assert.Equal(t, store.RoleUser, botUser.Role)
	// The stored hash is not a bcrypt hash, so password sign-in can never match.
	assert.Equal(t, assistantBotPasswordHash, botUser.PasswordHash)
	assert.NotEmpty(t, botUser.AvatarURL, "the configured emoji becomes the avatar")
}

func TestPrepareAssistantsConfigReusesAndRenamesBotAccount(t *testing.T) {
	ctx := context.Background()
	svc := newIntegrationService(t)

	first := aiSettingWithAssistants(&storepb.AIAssistantConfig{
		Id: "reading", Title: "Reading partner", ProviderId: "provider-1", Enabled: true,
	})
	require.NoError(t, svc.prepareInstanceAISettingForUpdate(ctx, first))
	originalBotID := first.GetAssistants().GetAssistants()[0].GetBotUserId()
	_, err := svc.Store.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key:   storepb.InstanceSettingKey_AI,
		Value: &storepb.InstanceSetting_AiSetting{AiSetting: first},
	})
	require.NoError(t, err)

	// Renaming the assistant must rename the same account rather than create a
	// second one, so existing comments keep their author.
	second := aiSettingWithAssistants(&storepb.AIAssistantConfig{
		Id: "reading", Title: "Book buddy", ProviderId: "provider-1", Enabled: true,
	})
	require.NoError(t, svc.prepareInstanceAISettingForUpdate(ctx, second))

	assistant := second.GetAssistants().GetAssistants()[0]
	assert.Equal(t, originalBotID, assistant.GetBotUserId())

	botUser, err := svc.Store.GetUser(ctx, &store.FindUser{ID: &originalBotID})
	require.NoError(t, err)
	require.NotNil(t, botUser)
	assert.Equal(t, "Book buddy", botUser.Nickname)
}

func TestPrepareAssistantsConfigSkipsDisabledAssistant(t *testing.T) {
	ctx := context.Background()
	svc := newIntegrationService(t)

	setting := aiSettingWithAssistants(&storepb.AIAssistantConfig{
		Id: "draft", Title: "Draft", Enabled: false,
	})
	require.NoError(t, svc.prepareInstanceAISettingForUpdate(ctx, setting))

	// A disabled draft may stay half-configured and must not leave an account.
	username := assistantBotUsername("draft")
	botUser, err := svc.Store.GetUser(ctx, &store.FindUser{Username: &username})
	require.NoError(t, err)
	assert.Nil(t, botUser)
}

func TestPrepareAssistantsConfigValidation(t *testing.T) {
	tests := []struct {
		name      string
		assistant *storepb.AIAssistantConfig
	}{
		{name: "missing title", assistant: &storepb.AIAssistantConfig{Id: "a", ProviderId: "provider-1", Enabled: true}},
		{name: "missing id", assistant: &storepb.AIAssistantConfig{Title: "A", ProviderId: "provider-1", Enabled: true}},
		{name: "enabled without provider", assistant: &storepb.AIAssistantConfig{Id: "a", Title: "A", Enabled: true}},
		{name: "unknown provider", assistant: &storepb.AIAssistantConfig{Id: "a", Title: "A", ProviderId: "nope", Enabled: true}},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			svc := newIntegrationService(t)
			err := svc.prepareInstanceAISettingForUpdate(context.Background(), aiSettingWithAssistants(test.assistant))
			require.Error(t, err)
		})
	}
}

func TestPrepareAssistantsConfigAppliesContextDefaults(t *testing.T) {
	ctx := context.Background()
	svc := newIntegrationService(t)

	setting := aiSettingWithAssistants(
		&storepb.AIAssistantConfig{
			Id: "recent", Title: "Recent", ProviderId: "provider-1", Enabled: true,
			ContextScope: storepb.AIAssistantContextScope_RECENT_MEMOS,
		},
		&storepb.AIAssistantConfig{
			Id: "single", Title: "Single", ProviderId: "provider-1", Enabled: true,
			ContextScope: storepb.AIAssistantContextScope_CURRENT_MEMO_ONLY, ContextLimit: 25,
		},
	)
	require.NoError(t, svc.prepareInstanceAISettingForUpdate(ctx, setting))

	assistants := setting.GetAssistants().GetAssistants()
	// A background scope without an explicit limit gets the default.
	assert.Equal(t, int32(defaultAssistantContextLimit), assistants[0].GetContextLimit())
	// A single-memo scope ignores any limit so stale values cannot linger.
	assert.Zero(t, assistants[1].GetContextLimit())
}

func TestUpdateInstanceSettingRoundTripsAssistants(t *testing.T) {
	ctx := context.Background()
	svc := newIntegrationService(t)

	admin, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "admin", Role: store.RoleAdmin, Email: "admin@example.com",
	})
	require.NoError(t, err)
	adminCtx := userCtx(ctx, admin.ID)

	_, err = svc.UpdateInstanceSetting(adminCtx, &v1pb.UpdateInstanceSettingRequest{
		Setting: &v1pb.InstanceSetting{
			Name: InstanceSettingNamePrefix + v1pb.InstanceSetting_AI.String(),
			Value: &v1pb.InstanceSetting_AiSetting{AiSetting: &v1pb.InstanceSetting_AISetting{
				Providers: []*v1pb.InstanceSetting_AIProviderConfig{{
					Id: "provider-1", Title: "OpenAI",
					Type: v1pb.InstanceSetting_OPENAI, ApiKey: "sk-test",
				}},
				Assistants: &v1pb.InstanceSetting_AssistantsConfig{
					Enabled: true,
					Assistants: []*v1pb.InstanceSetting_AIAssistantConfig{{
						Id: "reading", Title: "Reading partner", Icon: "📗",
						Prompt: "Ask one good question.", Tags: []string{"#book"},
						ProviderId: "provider-1", Model: "gpt-4o-mini",
						ContextScope: v1pb.InstanceSetting_SAME_TAG_MEMOS,
						ContextLimit: 5, Enabled: true,
					}},
				},
			}},
		},
	})
	require.NoError(t, err)

	stored, err := svc.Store.GetInstanceAISetting(ctx)
	require.NoError(t, err)
	require.Len(t, stored.GetAssistants().GetAssistants(), 1)

	assistant := stored.GetAssistants().GetAssistants()[0]
	assert.Equal(t, "Reading partner", assistant.GetTitle())
	assert.Equal(t, "📗", assistant.GetIcon())
	// The submitted "#book" is normalized to its bare form for matching.
	assert.Equal(t, []string{"book"}, assistant.GetTags())
	assert.Equal(t, storepb.AIAssistantContextScope_SAME_TAG_MEMOS, assistant.GetContextScope())
	assert.Positive(t, assistant.GetBotUserId())

	// bot_user_id must survive a later save even though the API never carries it.
	read, err := svc.GetInstanceSetting(adminCtx, &v1pb.GetInstanceSettingRequest{
		Name: InstanceSettingNamePrefix + v1pb.InstanceSetting_AI.String(),
	})
	require.NoError(t, err)
	readAssistants := read.GetAiSetting().GetAssistants().GetAssistants()
	require.Len(t, readAssistants, 1)

	_, err = svc.UpdateInstanceSetting(adminCtx, &v1pb.UpdateInstanceSettingRequest{
		Setting: &v1pb.InstanceSetting{
			Name:  InstanceSettingNamePrefix + v1pb.InstanceSetting_AI.String(),
			Value: &v1pb.InstanceSetting_AiSetting{AiSetting: read.GetAiSetting()},
		},
	})
	require.NoError(t, err)

	reStored, err := svc.Store.GetInstanceAISetting(ctx)
	require.NoError(t, err)
	assert.Equal(t, assistant.GetBotUserId(), reStored.GetAssistants().GetAssistants()[0].GetBotUserId())
	// The write-only API key must also survive a save that omits it.
	assert.Equal(t, "sk-test", reStored.GetProviders()[0].GetApiKey())
}
