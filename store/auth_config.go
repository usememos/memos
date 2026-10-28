package store

import (
	"context"
	"database/sql"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"

	storepb "github.com/usememos/memos/proto/gen/store"
)

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
			return validateAuthenticationMutationState(state, setting.GetGeneralSetting(), nil)
		},
	}
	if err := s.applyAuthenticationConfigMutation(ctx, mutation); err != nil {
		return nil, err
	}
	result := proto.CloneOf(setting)
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
			return validateAuthenticationMutationState(state, nil, &delete.ID)
		},
	}
	return s.applyAuthenticationConfigMutation(ctx, mutation)
}

func (s *Store) applyAuthenticationConfigMutation(ctx context.Context, mutation *AuthenticationConfigMutation) error {
	s.authConfigMu.Lock()
	defer s.authConfigMu.Unlock()

	return s.runSerializable(ctx, func(tx *sql.Tx) error {
		return s.driver.ApplyAuthenticationConfigMutationTx(ctx, tx, mutation)
	})
}

func validateAuthenticationMutationState(state *AuthenticationConfigState, proposedGeneral *storepb.InstanceGeneralSetting, deletedProviderID *int32) error {
	var storedGeneral *storepb.InstanceGeneralSetting
	if state.GeneralSetting != nil {
		stored, err := convertInstanceSettingFromRaw(state.GeneralSetting)
		if err != nil {
			return errors.Wrap(err, "failed to decode stored GENERAL setting")
		}
		storedGeneral = stored.GetGeneralSetting()
	}

	oldUIDs := make(map[string]struct{}, len(state.IdentityProviders))
	newUIDs := make(map[string]struct{}, len(state.IdentityProviders))
	for _, provider := range state.IdentityProviders {
		oldUIDs[provider.UID] = struct{}{}
		if deletedProviderID != nil && provider.ID == *deletedProviderID {
			continue
		}
		newUIDs[provider.UID] = struct{}{}
	}

	newGeneral := storedGeneral
	if proposedGeneral != nil {
		newGeneral = proposedGeneral
	}
	if isUnsafeAuthenticationState(newGeneral, newUIDs) && !isUnsafeAuthenticationState(storedGeneral, oldUIDs) {
		return ErrUnsafeAuthenticationConfiguration
	}
	return nil
}

func isUnsafeAuthenticationState(general *storepb.InstanceGeneralSetting, providerUIDs map[string]struct{}) bool {
	return general != nil && general.DisallowPasswordAuth && len(providerUIDs) == 0
}
