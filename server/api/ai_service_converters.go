package api

import (
	apipb "github.com/usememos/memos/proto/gen/api"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/provider/ai"
)

// convertAIProviderConfigFromStore returns the callable form of a stored
// provider, with its endpoint resolved to the type's default when empty.
func convertAIProviderConfigFromStore(provider *storepb.AIProviderConfig) ai.ProviderConfig {
	return ai.ProviderConfig{
		ID:       provider.GetId(),
		Title:    provider.GetTitle(),
		Type:     ai.TypeFromStore(provider.GetType()),
		Endpoint: ai.ResolveEndpoint(provider),
		APIKey:   provider.GetApiKey(),
	}
}

func convertAIProviderSpecToProto(spec ai.ProviderSpec) *apipb.AIProviderTypeInfo {
	info := &apipb.AIProviderTypeInfo{
		Type:            apipb.InstanceSetting_AIProviderType(apipb.InstanceSetting_AIProviderType_value[string(spec.Type)]),
		DefaultEndpoint: spec.DefaultEndpoint,
		ApiKeyRequired:  spec.APIKeyRequired,
		ApiKeyUrl:       spec.APIKeyURL,
		Local:           spec.Local,
	}
	for _, capability := range spec.Capabilities {
		info.Capabilities = append(info.Capabilities, &apipb.AICapability{
			Kind:           convertAICapabilityToProto(capability.Capability),
			SuggestedModel: capability.SuggestedModel,
		})
	}
	return info
}

func convertAICapabilityToProto(capability ai.Capability) apipb.AICapabilityKind {
	switch capability {
	case ai.CapabilityTextGeneration:
		return apipb.AICapabilityKind_TEXT_GENERATION
	case ai.CapabilityTranscription:
		return apipb.AICapabilityKind_TRANSCRIPTION
	default:
		return apipb.AICapabilityKind_AI_CAPABILITY_KIND_UNSPECIFIED
	}
}
