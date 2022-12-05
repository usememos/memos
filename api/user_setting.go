package api

import (
	"encoding/json"
	"fmt"
)

type UserSettingKey string

const (
	// UserSettingLocaleKey is the key type for user locale.
	UserSettingLocaleKey UserSettingKey = "locale"
	// UserSettingAppearanceKey is the key type for user appearance.
	UserSettingAppearanceKey UserSettingKey = "appearance"
	// UserSettingMemoVisibilityKey is the key type for user preference memo default visibility.
	UserSettingMemoVisibilityKey UserSettingKey = "memoVisibility"
	// UserSettingMemoDisplayTsOptionKey is the key type for memo display ts option.
	UserSettingMemoDisplayTsOptionKey UserSettingKey = "memoDisplayTsOption"
)

// String returns the string format of UserSettingKey type.
func (key UserSettingKey) String() string {
	switch key {
	case UserSettingLocaleKey:
		return "locale"
	case UserSettingAppearanceKey:
		return "appearance"
	case UserSettingMemoVisibilityKey:
		return "memoVisibility"
	case UserSettingMemoDisplayTsOptionKey:
		return "memoDisplayTsOption"
	}
	return ""
}

var (
	UserSettingLocaleValue                 = []string{"en", "zh", "vi", "fr", "sv", "de"}
	UserSettingAppearanceValue             = []string{"system", "light", "dark"}
	UserSettingMemoVisibilityValue         = []Visibility{Private, Protected, Public}
	UserSettingMemoDisplayTsOptionKeyValue = []string{"created_ts", "updated_ts"}
)

type UserSetting struct {
	UserID int
	Key    UserSettingKey `json:"key"`
	// Value is a JSON string with basic value
	Value string `json:"value"`
}

type UserSettingUpsert struct {
	UserID int
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

		invalid := true
		for _, value := range UserSettingLocaleValue {
			if localeValue == value {
				invalid = false
				break
			}
		}
		if invalid {
			return fmt.Errorf("invalid user setting locale value")
		}
	} else if upsert.Key == UserSettingAppearanceKey {
		appearanceValue := "light"
		err := json.Unmarshal([]byte(upsert.Value), &appearanceValue)
		if err != nil {
			return fmt.Errorf("failed to unmarshal user setting appearance value")
		}

		invalid := true
		for _, value := range UserSettingAppearanceValue {
			if appearanceValue == value {
				invalid = false
				break
			}
		}
		if invalid {
			return fmt.Errorf("invalid user setting appearance value")
		}
	} else if upsert.Key == UserSettingMemoVisibilityKey {
		memoVisibilityValue := Private
		err := json.Unmarshal([]byte(upsert.Value), &memoVisibilityValue)
		if err != nil {
			return fmt.Errorf("failed to unmarshal user setting memo visibility value")
		}

		invalid := true
		for _, value := range UserSettingMemoVisibilityValue {
			if memoVisibilityValue == value {
				invalid = false
				break
			}
		}
		if invalid {
			return fmt.Errorf("invalid user setting memo visibility value")
		}
	} else if upsert.Key == UserSettingMemoDisplayTsOptionKey {
		memoDisplayTsOption := "created_ts"
		err := json.Unmarshal([]byte(upsert.Value), &memoDisplayTsOption)
		if err != nil {
			return fmt.Errorf("failed to unmarshal user setting memo display ts option")
		}

		invalid := true
		for _, value := range UserSettingMemoDisplayTsOptionKeyValue {
			if memoDisplayTsOption == value {
				invalid = false
				break
			}
		}
		if invalid {
			return fmt.Errorf("invalid user setting memo display ts option value")
		}
	} else {
		return fmt.Errorf("invalid user setting key")
	}

	return nil
}

type UserSettingFind struct {
	UserID int

	Key *UserSettingKey `json:"key"`
}

type UserSettingDelete struct {
	UserID int
}
