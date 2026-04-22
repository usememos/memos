package store

import (
	"context"
	"encoding/json"
	"time"

	"github.com/pkg/errors"
	storepb "github.com/usememos/memos/proto/gen/store"
)

const (
	// UserSettingKeyPasskeys stores WebAuthn passkeys for a user.
	UserSettingKeyPasskeys storepb.UserSetting_Key = 100

	userSettingKeyPasskeysString = "PASSKEYS"
)

// Passkey stores a user's WebAuthn credential metadata.
type Passkey struct {
	ID           string   `json:"id"`
	Label        string   `json:"label"`
	CredentialID string   `json:"credentialId"`
	PublicKey    string   `json:"publicKey"`
	Algorithm    int32    `json:"algorithm"`
	SignCount    uint32   `json:"signCount"`
	Transports   []string `json:"transports,omitempty"`
	AddedTs      int64    `json:"addedTs"`
	LastUsedTs   int64    `json:"lastUsedTs,omitempty"`
}

type passkeysUserSetting struct {
	Passkeys []*Passkey `json:"passkeys"`
}

// UserSettingKeyString converts a user setting key to the persisted database value.
func UserSettingKeyString(key storepb.UserSetting_Key) string {
	if key == UserSettingKeyPasskeys {
		return userSettingKeyPasskeysString
	}
	return key.String()
}

// ParseUserSettingKey converts a persisted database value back to a user setting key.
func ParseUserSettingKey(key string) storepb.UserSetting_Key {
	if key == userSettingKeyPasskeysString {
		return UserSettingKeyPasskeys
	}
	return storepb.UserSetting_Key(storepb.UserSetting_Key_value[key])
}

// GetUserPasskeys returns the passkeys registered for the user.
func (s *Store) GetUserPasskeys(ctx context.Context, userID int32) ([]*Passkey, error) {
	cacheKey := getUserSettingCacheKey(userID, userSettingKeyPasskeysString)
	if cache, ok := s.userSettingCache.Get(ctx, cacheKey); ok {
		if passkeys, ok := cache.([]*Passkey); ok {
			return clonePasskeys(passkeys), nil
		}
	}

	settings, err := s.driver.ListUserSettings(ctx, &FindUserSetting{
		UserID: &userID,
		Key:    UserSettingKeyPasskeys,
	})
	if err != nil {
		return nil, err
	}
	if len(settings) == 0 {
		s.userSettingCache.Set(ctx, cacheKey, []*Passkey{})
		return []*Passkey{}, nil
	}
	if len(settings) > 1 {
		return nil, errors.Errorf("expected 1 passkey setting, got %d", len(settings))
	}

	passkeys, err := unmarshalPasskeys(settings[0].Value)
	if err != nil {
		return nil, err
	}
	s.userSettingCache.Set(ctx, cacheKey, clonePasskeys(passkeys))
	return passkeys, nil
}

// AddUserPasskey stores a new passkey for the user.
func (s *Store) AddUserPasskey(ctx context.Context, userID int32, passkey *Passkey) error {
	passkeys, err := s.GetUserPasskeys(ctx, userID)
	if err != nil {
		return err
	}

	passkeys = append(passkeys, clonePasskey(passkey))
	return s.upsertUserPasskeys(ctx, userID, passkeys)
}

// UpdateUserPasskey updates an existing passkey for the user.
func (s *Store) UpdateUserPasskey(ctx context.Context, userID int32, passkey *Passkey) error {
	passkeys, err := s.GetUserPasskeys(ctx, userID)
	if err != nil {
		return err
	}

	updated := false
	for i, existing := range passkeys {
		if existing.ID == passkey.ID {
			passkeys[i] = clonePasskey(passkey)
			updated = true
			break
		}
	}
	if !updated {
		return errors.Errorf("passkey %s not found", passkey.ID)
	}

	return s.upsertUserPasskeys(ctx, userID, passkeys)
}

// DeleteUserPasskey deletes a passkey for the user.
func (s *Store) DeleteUserPasskey(ctx context.Context, userID int32, passkeyID string) error {
	passkeys, err := s.GetUserPasskeys(ctx, userID)
	if err != nil {
		return err
	}

	filtered := make([]*Passkey, 0, len(passkeys))
	deleted := false
	for _, existing := range passkeys {
		if existing.ID == passkeyID {
			deleted = true
			continue
		}
		filtered = append(filtered, clonePasskey(existing))
	}
	if !deleted {
		return errors.Errorf("passkey %s not found", passkeyID)
	}

	return s.upsertUserPasskeys(ctx, userID, filtered)
}

func (s *Store) upsertUserPasskeys(ctx context.Context, userID int32, passkeys []*Passkey) error {
	value, err := json.Marshal(&passkeysUserSetting{
		Passkeys: clonePasskeys(passkeys),
	})
	if err != nil {
		return errors.Wrap(err, "failed to marshal passkeys")
	}

	if _, err := s.driver.UpsertUserSetting(ctx, &UserSetting{
		UserID: userID,
		Key:    UserSettingKeyPasskeys,
		Value:  string(value),
	}); err != nil {
		return err
	}

	s.userSettingCache.Set(ctx, getUserSettingCacheKey(userID, userSettingKeyPasskeysString), clonePasskeys(passkeys))
	return nil
}

func unmarshalPasskeys(value string) ([]*Passkey, error) {
	setting := &passkeysUserSetting{}
	if value == "" {
		return []*Passkey{}, nil
	}
	if err := json.Unmarshal([]byte(value), setting); err != nil {
		return nil, errors.Wrap(err, "failed to unmarshal passkeys")
	}
	if setting.Passkeys == nil {
		return []*Passkey{}, nil
	}
	return clonePasskeys(setting.Passkeys), nil
}

func clonePasskeys(passkeys []*Passkey) []*Passkey {
	cloned := make([]*Passkey, 0, len(passkeys))
	for _, passkey := range passkeys {
		cloned = append(cloned, clonePasskey(passkey))
	}
	return cloned
}

func clonePasskey(passkey *Passkey) *Passkey {
	if passkey == nil {
		return nil
	}
	cloned := *passkey
	cloned.Transports = append([]string(nil), passkey.Transports...)
	return &cloned
}

// NewDefaultPasskeyLabel returns the default label for a newly created passkey.
func NewDefaultPasskeyLabel(now time.Time) string {
	return "Passkey " + now.Format("2006-01-02 15:04")
}
