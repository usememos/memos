package store

import (
	"context"
	"database/sql"
	"log/slog"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"

	storepb "github.com/usememos/memos/proto/gen/store"
)

// The state record is one system_setting row. It is state, not a setting: the
// instance setting reads skip it, because convertInstanceSettingFromRaw has no
// case for its key.
var configurationStateName = storepb.InstanceSettingKey_CONFIGURATION_STATE.String()

// GetConfigurationState returns the declarative configuration state record,
// read from the database without the instance setting cache. Before any apply
// has changed something, it is an empty record with serial 0.
func (s *Store) GetConfigurationState(ctx context.Context) (*storepb.InstanceConfigurationState, error) {
	list, err := s.driver.ListInstanceSettings(ctx, &FindInstanceSetting{Name: configurationStateName})
	if err != nil {
		return nil, errors.Wrap(err, "failed to read configuration state")
	}
	if len(list) == 0 {
		return &storepb.InstanceConfigurationState{}, nil
	}
	return decodeConfigurationState(list[0])
}

// ConfigurationTransaction is one serializable transaction over declarative
// configuration, opened by RunConfigurationTransaction. Its reads see what the
// transaction has written, and its writes apply the same normalization and
// checks as the store's own writes; caches are invalidated once it commits.
type ConfigurationTransaction struct {
	store *Store
	tx    *sql.Tx
	state *storepb.InstanceConfigurationState

	settingNames     []string
	userIDs          []int32
	passwordsChanged []int32
}

// State returns the state record as read at the start of the transaction.
func (t *ConfigurationTransaction) State() *storepb.InstanceConfigurationState {
	return proto.CloneOf(t.state)
}

// GetConfigurationState is State, so a transaction can be read like a store.
func (t *ConfigurationTransaction) GetConfigurationState(context.Context) (*storepb.InstanceConfigurationState, error) {
	return t.State(), nil
}

// ListIdentityProviders reads identity providers within the transaction.
func (t *ConfigurationTransaction) ListIdentityProviders(ctx context.Context, find *FindIdentityProvider) ([]*storepb.IdentityProvider, error) {
	list, err := t.store.driver.ListIdentityProvidersTx(ctx, t.tx, find)
	if err != nil {
		return nil, err
	}
	providers := make([]*storepb.IdentityProvider, 0, len(list))
	for _, raw := range list {
		provider, err := convertIdentityProviderFromRaw(raw)
		if err != nil {
			return nil, err
		}
		providers = append(providers, provider)
	}
	return providers, nil
}

// GetUncachedInstanceSetting reads one setting within the transaction.
func (t *ConfigurationTransaction) GetUncachedInstanceSetting(ctx context.Context, find *FindInstanceSetting) (*storepb.InstanceSetting, error) {
	raw, err := t.store.driver.GetInstanceSettingTx(ctx, t.tx, find.Name)
	if err != nil || raw == nil {
		return nil, err
	}
	return convertInstanceSettingFromRaw(raw)
}

// ListUsers reads users within the transaction.
func (t *ConfigurationTransaction) ListUsers(ctx context.Context, find *FindUser) ([]*User, error) {
	return t.store.driver.ListUsersTx(ctx, t.tx, find)
}

// CreateIdentityProvider creates an identity provider within the transaction.
func (t *ConfigurationTransaction) CreateIdentityProvider(ctx context.Context, provider *storepb.IdentityProvider) error {
	raw, err := convertIdentityProviderToRaw(provider)
	if err != nil {
		return err
	}
	if _, err := t.store.driver.CreateIdentityProviderTx(ctx, t.tx, raw); err != nil {
		return errors.Wrapf(err, "failed to create identity provider %s", provider.Uid)
	}
	return nil
}

// ReplaceIdentityProvider writes every field of the identity provider with id.
func (t *ConfigurationTransaction) ReplaceIdentityProvider(ctx context.Context, id int32, provider *storepb.IdentityProvider) error {
	config, err := convertIdentityProviderConfigToRaw(provider.Type, provider.Config)
	if err != nil {
		return err
	}
	name, filter := provider.Name, provider.IdentifierFilter
	if _, err := t.store.driver.UpdateIdentityProviderTx(ctx, t.tx, &UpdateIdentityProvider{
		ID: id, Name: &name, IdentifierFilter: &filter, Config: &config,
	}); err != nil {
		return errors.Wrapf(err, "failed to update identity provider %s", provider.Uid)
	}
	return nil
}

// DeleteIdentityProvider deletes the identity provider with id.
func (t *ConfigurationTransaction) DeleteIdentityProvider(ctx context.Context, id int32) error {
	if err := t.store.driver.DeleteIdentityProviderTx(ctx, t.tx, &DeleteIdentityProvider{ID: id}); err != nil {
		return errors.Wrap(err, "failed to delete identity provider")
	}
	return nil
}

// UpsertInstanceSetting writes a setting within the transaction.
func (t *ConfigurationTransaction) UpsertInstanceSetting(ctx context.Context, setting *storepb.InstanceSetting) error {
	raw, err := encodeInstanceSetting(setting)
	if err != nil {
		return err
	}
	if err := t.store.driver.UpsertInstanceSettingTx(ctx, t.tx, raw); err != nil {
		return errors.Wrapf(err, "failed to write instance setting %s", raw.Name)
	}
	t.settingNames = append(t.settingNames, raw.Name)
	return nil
}

// DeleteInstanceSetting deletes a setting, so its defaults apply again.
func (t *ConfigurationTransaction) DeleteInstanceSetting(ctx context.Context, key storepb.InstanceSettingKey) error {
	if err := t.store.driver.DeleteInstanceSettingTx(ctx, t.tx, &DeleteInstanceSetting{Name: key.String()}); err != nil {
		return errors.Wrapf(err, "failed to delete instance setting %s", key)
	}
	t.settingNames = append(t.settingNames, key.String())
	return nil
}

// CreateUser creates a user within the transaction.
func (t *ConfigurationTransaction) CreateUser(ctx context.Context, create *User) (*User, error) {
	email, err := normalizeUserEmail(create.Email)
	if err != nil {
		return nil, err
	}
	create.Email = email
	user, err := t.store.driver.CreateUserTx(ctx, t.tx, create)
	if err != nil {
		if uniqueErr := classifyUserUniqueViolation(err); uniqueErr != nil {
			return nil, uniqueErr
		}
		return nil, errors.Wrapf(err, "failed to create user %s", create.Username)
	}
	t.userIDs = append(t.userIDs, user.ID)
	return user, nil
}

// UpdateUser updates a user within the transaction, keeping the last active
// administrator as the store's own update does.
func (t *ConfigurationTransaction) UpdateUser(ctx context.Context, update *UpdateUser) error {
	if update.Email != nil {
		email, err := normalizeUserEmail(*update.Email)
		if err != nil {
			return err
		}
		update.Email = &email
	}
	if _, err := t.store.driver.UpdateUserTx(ctx, t.tx, update); err != nil {
		if uniqueErr := classifyUserUniqueViolation(err); uniqueErr != nil {
			return uniqueErr
		}
		return errors.Wrap(err, "failed to update user")
	}
	t.userIDs = append(t.userIDs, update.ID)
	if update.PasswordHash != nil {
		t.passwordsChanged = append(t.passwordsChanged, update.ID)
	}
	return nil
}

// afterCommit drops what the committed writes made stale. A new password ends
// every session of that user, as an administrator's password reset does.
func (t *ConfigurationTransaction) afterCommit(ctx context.Context) {
	s := t.store
	for _, name := range t.settingNames {
		s.instanceSettingCache.Delete(ctx, name)
		if name == storepb.InstanceSettingKey_STORAGE.String() {
			s.resetStorageDriverCache()
		}
	}
	for _, userID := range t.userIDs {
		s.userCache.Delete(ctx, userCacheKey(userID))
	}
	for _, userID := range t.passwordsChanged {
		if err := s.RemoveUserRefreshTokensExcept(ctx, userID, ""); err != nil {
			slog.Warn("failed to revoke sessions after a configured password change", "user_id", userID, "error", err)
		}
	}
}

// RunConfigurationTransaction runs fn in one serializable transaction that
// starts by reading, and where the database supports it locking, the state
// record. fn returns the record to store, or nil when nothing changed; a
// returned record is written with the next serial, whatever serial it carries.
// fn runs again when the transaction conflicts with a concurrent one, so it
// must derive what it writes from what it reads through tx. The result is the
// record as stored when the transaction commits.
func (s *Store) RunConfigurationTransaction(
	ctx context.Context,
	fn func(ctx context.Context, tx *ConfigurationTransaction) (*storepb.InstanceConfigurationState, error),
) (*storepb.InstanceConfigurationState, error) {
	var result *storepb.InstanceConfigurationState
	var committed *ConfigurationTransaction
	err := s.runSerializable(ctx, func(tx *sql.Tx) error {
		raw, err := s.driver.GetInstanceSettingTx(ctx, tx, configurationStateName)
		if err != nil {
			return errors.Wrap(err, "failed to read configuration state")
		}
		current := &storepb.InstanceConfigurationState{}
		if raw != nil {
			if current, err = decodeConfigurationState(raw); err != nil {
				return err
			}
		}

		transaction := &ConfigurationTransaction{store: s, tx: tx, state: current}
		committed = transaction
		next, err := fn(ctx, transaction)
		if err != nil {
			return err
		}
		if next == nil {
			result = current
			return nil
		}
		next = proto.CloneOf(next)
		next.Serial = current.Serial + 1
		value, err := protojson.Marshal(next)
		if err != nil {
			return errors.Wrap(err, "failed to encode configuration state")
		}

		// The write is conditional on the row read above, so a concurrent apply
		// that slipped past the database's isolation still cannot be overwritten.
		var written bool
		if raw == nil {
			written, err = s.driver.CreateInstanceSettingIfNotExistsTx(ctx, tx, &InstanceSetting{Name: configurationStateName, Value: string(value)})
		} else {
			written, err = s.driver.UpdateInstanceSettingIfUnchangedTx(ctx, tx, configurationStateName, raw.Value, string(value))
		}
		if err != nil {
			return errors.Wrap(err, "failed to write configuration state")
		}
		if !written {
			return errTransactionConflict
		}
		result = next
		return nil
	})
	if err != nil {
		return nil, err
	}
	committed.afterCommit(ctx)
	return result, nil
}

func decodeConfigurationState(raw *InstanceSetting) (*storepb.InstanceConfigurationState, error) {
	state := &storepb.InstanceConfigurationState{}
	if err := protojsonUnmarshaler.Unmarshal([]byte(raw.Value), state); err != nil {
		return nil, errors.Wrap(err, "failed to decode configuration state")
	}
	return state, nil
}
