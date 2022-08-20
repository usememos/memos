package api

import (
	"encoding/json"
	"fmt"
)

type UserSettingKey string

const (
	// UserSettingLocaleKey is the key type for user locale.
	UserSettingLocaleKey UserSettingKey = "locale"
	// UserSettingMemoVisibilityKey is the key type for user perference memo default visibility.
	UserSettingMemoVisibilityKey UserSettingKey = "memoVisibility"
)

// String returns the string format of UserSettingKey type.
func (key UserSettingKey) String() string {
	switch key {
	case UserSettingLocaleKey:
		return "locale"
	case UserSettingMemoVisibilityKey:
		return "memoVisibility"
	}
	return ""
}

var (
	UserSettingLocaleValue         = []string{"en", "zh"}
	UserSettingMemoVisibilityValue = []Visibility{Privite, Protected, Public}
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
		var localeValue string
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
	} else if upsert.Key == UserSettingMemoVisibilityKey {
		var memoVisibilityValue Visibility
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
	} else {
		return fmt.Errorf("invalid user setting key")
	}

	return nil
}

type UserSettingFind struct {
	UserID int

	Key *UserSettingKey `json:"key"`
}
