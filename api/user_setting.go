package api

import (
	"encoding/json"
	"fmt"
	"strconv"

	"golang.org/x/exp/slices"
)

type UserSettingKey string

const (
	// UserSettingLocaleKey is the key type for user locale.
	UserSettingLocaleKey UserSettingKey = "locale"
	// UserSettingAppearanceKey is the key type for user appearance.
	UserSettingAppearanceKey UserSettingKey = "appearance"
	// UserSettingMemoVisibilityKey is the key type for user preference memo default visibility.
	UserSettingMemoVisibilityKey UserSettingKey = "memo-visibility"
	// UserSettingTelegramUserID is the key type for telegram UserID of memos user.
	UserSettingTelegramUserIDKey UserSettingKey = "telegram-user-id"
)

// String returns the string format of UserSettingKey type.
func (key UserSettingKey) String() string {
	switch key {
	case UserSettingLocaleKey:
		return "locale"
	case UserSettingAppearanceKey:
		return "appearance"
	case UserSettingMemoVisibilityKey:
		return "memo-visibility"
	case UserSettingTelegramUserIDKey:
		return "telegram-user-id"
	}
	return ""
}

var (
	UserSettingLocaleValue = []string{
		"de",
		"en",
		"es",
		"fr",
		"it",
		"ja",
		"ko",
		"nl",
		"pl",
		"pt-BR",
		"ru",
		"sl",
		"sv",
		"tr",
		"uk",
		"vi",
		"zh-Hans",
		"zh-Hant",
	}
	UserSettingAppearanceValue     = []string{"system", "light", "dark"}
	UserSettingMemoVisibilityValue = []Visibility{Private, Protected, Public}
)

type UserSetting struct {
	UserID int
	Key    UserSettingKey `json:"key"`
	// Value is a JSON string with basic value
	Value string `json:"value"`
}

type UserSettingUpsert struct {
	UserID int            `json:"-"`
	Key    UserSettingKey `json:"key"`
	Value  string         `json:"value"`
}

func (upsert UserSettingUpsert) Validate() error {
	if upsert.Key == UserSettingLocaleKey {
		localeValue := "en"
		err := json.Unmarshal([]byte(upsert.Value), &localeValue)
		if err != nil {
			return fmt.Errorf("failed to unmarshal user setting locale value")
		}
		if !slices.Contains(UserSettingLocaleValue, localeValue) {
			return fmt.Errorf("invalid user setting locale value")
		}
	} else if upsert.Key == UserSettingAppearanceKey {
		appearanceValue := "system"
		err := json.Unmarshal([]byte(upsert.Value), &appearanceValue)
		if err != nil {
			return fmt.Errorf("failed to unmarshal user setting appearance value")
		}
		if !slices.Contains(UserSettingAppearanceValue, appearanceValue) {
			return fmt.Errorf("invalid user setting appearance value")
		}
	} else if upsert.Key == UserSettingMemoVisibilityKey {
		memoVisibilityValue := Private
		err := json.Unmarshal([]byte(upsert.Value), &memoVisibilityValue)
		if err != nil {
			return fmt.Errorf("failed to unmarshal user setting memo visibility value")
		}
		if !slices.Contains(UserSettingMemoVisibilityValue, memoVisibilityValue) {
			return fmt.Errorf("invalid user setting memo visibility value")
		}
	} else if upsert.Key == UserSettingTelegramUserIDKey {
		var s string
		err := json.Unmarshal([]byte(upsert.Value), &s)
		if err != nil {
			return fmt.Errorf("invalid user setting telegram user id value")
		}

		if s == "" {
			return nil
		}
		if _, err := strconv.Atoi(s); err != nil {
			return fmt.Errorf("invalid user setting telegram user id value")
		}
	} else {
		return fmt.Errorf("invalid user setting key")
	}

	return nil
}

type UserSettingFind struct {
	UserID *int

	Key UserSettingKey `json:"key"`
}

type UserSettingDelete struct {
	UserID int
}
