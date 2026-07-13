package store

import (
	"context"
	"time"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/encoding/protojson"

	storepb "github.com/usememos/memos/proto/gen/store"
)

const authenticationMutationMaxAttempts = 3

// ErrUnsafeAuthenticationConfiguration indicates a mutation would lock regular users out.
var ErrUnsafeAuthenticationConfiguration = errors.New("password authentication for regular users cannot be disabled without an effective identity provider")

// AuthenticationConfigState is the stored authentication configuration read inside a transaction.
type AuthenticationConfigState struct {
	GeneralSetting    *InstanceSetting
	IdentityProviders []*IdentityProvider
}

// AuthenticationConfigMutation validates and applies one stored authentication mutation atomically.
type AuthenticationConfigMutation struct {
	UpsertGeneralSetting     *InstanceSetting
	DeleteIdentityProviderID *int32
	Validate                 func(*AuthenticationConfigState) error
}

// UpsertInstanceGeneralSettingSafely validates and stores GENERAL as one serialized operation.
func (s *Store) UpsertInstanceGeneralSettingSafely(ctx context.Context, setting *storepb.InstanceSetting) (*storepb.InstanceSetting, error) {
	if setting == nil || setting.Key != storepb.InstanceSettingKey_GENERAL || setting.GetGeneralSetting() == nil {
		return nil, errors.New("GENERAL instance setting is required")
	}
	value, err := protojson.Marshal(setting.GetGeneralSetting())
	if err != nil {
		return nil, errors.Wrap(err, "failed to marshal GENERAL instance setting")
	}
	raw := &InstanceSetting{Name: storepb.InstanceSettingKey_GENERAL.String(), Value: string(value)}
	mutation := &AuthenticationConfigMutation{
		UpsertGeneralSetting: raw,
		Validate: func(state *AuthenticationConfigState) error {
			return s.validateAuthenticationMutationState(state, setting.GetGeneralSetting(), nil)
		},
	}
	if err := s.applyAuthenticationConfigMutation(ctx, mutation); err != nil {
		return nil, err
	}
	result := cloneInstanceSetting(setting)
	s.cacheInstanceSetting(ctx, result)
	return result, nil
}

// DeleteIdentityProviderSafely validates and deletes an IdP as one serialized operation.
func (s *Store) DeleteIdentityProviderSafely(ctx context.Context, delete *DeleteIdentityProvider) error {
	if delete == nil {
		return errors.New("identity provider deletion is required")
	}
	mutation := &AuthenticationConfigMutation{
		DeleteIdentityProviderID: &delete.ID,
		Validate: func(state *AuthenticationConfigState) error {
			return s.validateAuthenticationMutationState(state, nil, &delete.ID)
		},
	}
	return s.applyAuthenticationConfigMutation(ctx, mutation)
}

func (s *Store) applyAuthenticationConfigMutation(ctx context.Context, mutation *AuthenticationConfigMutation) error {
	s.authConfigMu.Lock()
	defer s.authConfigMu.Unlock()

	var err error
	for attempt := 0; attempt < authenticationMutationMaxAttempts; attempt++ {
		err = s.driver.ApplyAuthenticationConfigMutation(ctx, mutation)
		if err == nil || !s.driver.IsRetryableAuthenticationMutationError(err) {
			return err
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(time.Duration(attempt+1) * 10 * time.Millisecond):
		}
	}
	return errors.Wrap(err, "authentication configuration mutation failed after retries")
}

func (s *Store) validateAuthenticationMutationState(state *AuthenticationConfigState, proposedGeneral *storepb.InstanceGeneralSetting, deletedProviderID *int32) error {
	var storedGeneral *storepb.InstanceGeneralSetting
	if state.GeneralSetting != nil {
		stored, err := convertInstanceSettingFromRaw(state.GeneralSetting)
		if err != nil {
			return errors.Wrap(err, "failed to decode stored GENERAL setting")
		}
		storedGeneral = stored.GetGeneralSetting()
	}

	storedUIDs := make(map[string]struct{}, len(state.IdentityProviders))
	for _, provider := range state.IdentityProviders {
		storedUIDs[provider.UID] = struct{}{}
	}
	effectiveUIDs := make(map[string]struct{}, len(state.IdentityProviders))
	for _, provider := range state.IdentityProviders {
		if deletedProviderID != nil && provider.ID == *deletedProviderID {
			continue
		}
		effectiveUIDs[provider.UID] = struct{}{}
	}
	for _, provider := range s.listDeploymentIdentityProviders() {
		effectiveUIDs[provider.Uid] = struct{}{}
	}

	configuredGeneral := s.getDeploymentInstanceSetting(storepb.InstanceSettingKey_GENERAL)
	if proposedGeneral != nil && configuredGeneral != nil {
		// A deployment-managed GENERAL setting keeps the proposal from becoming
		// effective now, but the stored fallback must not move from safe to unsafe
		// if the deployment file is removed later.
		if isUnsafeAuthenticationState(proposedGeneral, storedUIDs) && !isUnsafeAuthenticationState(storedGeneral, storedUIDs) {
			return ErrUnsafeAuthenticationConfiguration
		}
		return nil
	}

	oldGeneral := storedGeneral
	if configuredGeneral != nil {
		oldGeneral = configuredGeneral.GetGeneralSetting()
	}
	newGeneral := oldGeneral
	if proposedGeneral != nil {
		newGeneral = proposedGeneral
	}

	oldEffectiveUIDs := make(map[string]struct{}, len(storedUIDs))
	for uid := range storedUIDs {
		oldEffectiveUIDs[uid] = struct{}{}
	}
	for _, provider := range s.listDeploymentIdentityProviders() {
		oldEffectiveUIDs[provider.Uid] = struct{}{}
	}
	if isUnsafeAuthenticationState(newGeneral, effectiveUIDs) && !isUnsafeAuthenticationState(oldGeneral, oldEffectiveUIDs) {
		return ErrUnsafeAuthenticationConfiguration
	}
	return nil
}

func isUnsafeAuthenticationState(general *storepb.InstanceGeneralSetting, providerUIDs map[string]struct{}) bool {
	return general != nil && general.DisallowPasswordAuth && len(providerUIDs) == 0
}
