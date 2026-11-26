package api

import (
	"context"
	"net/http"
	"time"

	"github.com/pkg/errors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/provider/ai"
)

// aiConnectionCheckTimeout bounds the check of one provider during a save.
const aiConnectionCheckTimeout = 30 * time.Second

// checkAIProviderConnections lists the models of every provider whose
// connection the update changes: a new provider, or a changed type, endpoint or
// key. Unchanged providers are not contacted, so editing a capability does not
// depend on every provider being up.
//
// Only an answer that proves the connection is unusable refuses the save: a
// rejected key, an endpoint that cannot be reached or redirects, or no answer in
// time. Anything else is the provider's state rather than the configuration's,
// or says nothing about the key, so it is logged and the save goes ahead.
func (s *APIService) checkAIProviderConnections(ctx context.Context, setting *storepb.InstanceAISetting) error {
	stored, err := s.Store.GetInstanceAISetting(ctx)
	if err != nil {
		return status.Errorf(codes.Internal, "failed to get existing AI setting: %v", err)
	}
	storedProviders := map[string]*storepb.AIProviderConfig{}
	for _, provider := range stored.GetProviders() {
		storedProviders[provider.GetId()] = provider
	}
	for _, provider := range setting.GetProviders() {
		previous := storedProviders[provider.GetId()]
		if sameAIConnection(provider, previous) && previous.GetApiKey() == provider.GetApiKey() {
			continue
		}
		if err := checkAIProviderConnection(ctx, convertAIProviderConfigFromStore(provider)); err != nil {
			return err
		}
	}
	return nil
}

func checkAIProviderConnection(ctx context.Context, provider ai.ProviderConfig) error {
	ctx, cancel := context.WithTimeout(ctx, aiConnectionCheckTimeout)
	defer cancel()
	// The save reports the first answer: no SDK retries.
	err := ai.TestConnection(ai.WithSingleAttempt(ctx), provider)
	if err == nil {
		return nil
	}
	if ctx.Err() != nil && !errors.Is(ctx.Err(), context.DeadlineExceeded) {
		return status.FromContextError(ctx.Err()).Err()
	}
	failure := ai.ClassifyFailure(err)
	logAIFailure("check_provider", provider, "", failure)
	switch failure.Kind {
	case ai.FailureAuth:
		if modelListUnavailable(provider, failure) {
			return nil
		}
	case ai.FailureUnreachable, ai.FailureRedirected, ai.FailureTimeout:
	default:
		return nil
	}
	return newAIFailureError("provider \""+provider.Title+"\": ", failure)
}

// modelListUnavailable reports whether a failed listing says nothing about the
// key: an OpenAI key can be allowed to call models but not to list them.
func modelListUnavailable(provider ai.ProviderConfig, failure ai.Failure) bool {
	return failure.Status == http.StatusForbidden && provider.Type == ai.ProviderOpenAI
}
