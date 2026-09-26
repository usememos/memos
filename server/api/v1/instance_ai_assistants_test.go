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
	// The write-only API key must also survive a save that omits it.
	assert.Equal(t, "sk-test", reStored.GetProviders()[0].GetApiKey())
}
