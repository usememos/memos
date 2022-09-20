package api

import (
	"encoding/json"
	"fmt"
)

type UserSettingKey string

const (
	// UserSettingLocaleKey is the key type for user locale.
	UserSettingLocaleKey UserSettingKey = "locale"
	// UserSettingMemoVisibilityKey is the key type for user preference memo default visibility.
	UserSettingMemoVisibilityKey UserSettingKey = "memoVisibility"
	// UserSettingEditorFontStyleKey is the key type for editor font style.
	UserSettingEditorFontStyleKey UserSettingKey = "editorFontStyle"
	// UserSettingEditorFontStyleKey is the key type for mobile editor style.
	UserSettingMobileEditorStyleKey UserSettingKey = "mobileEditorStyle"
)

// String returns the string format of UserSettingKey type.
func (key UserSettingKey) String() string {
	switch key {
	case UserSettingLocaleKey:
		return "locale"
	case UserSettingMemoVisibilityKey:
		return "memoVisibility"
	case UserSettingEditorFontStyleKey:
		return "editorFontFamily"
	case UserSettingMobileEditorStyleKey:
		return "mobileEditorStyle"
	}
	return ""
}

var (
	UserSettingLocaleValue            = []string{"en", "zh", "vi"}
	UserSettingMemoVisibilityValue    = []Visibility{Privite, Protected, Public}
	UserSettingEditorFontStyleValue   = []string{"normal", "mono"}
	UserSettingMobileEditorStyleValue = []string{"normal", "float"}
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
	} else if upsert.Key == UserSettingMemoVisibilityKey {
		memoVisibilityValue := Privite
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
	} else if upsert.Key == UserSettingEditorFontStyleKey {
		editorFontStyleValue := "normal"
		err := json.Unmarshal([]byte(upsert.Value), &editorFontStyleValue)
		if err != nil {
			return fmt.Errorf("failed to unmarshal user setting editor font style")
		}

		invalid := true
		for _, value := range UserSettingEditorFontStyleValue {
			if editorFontStyleValue == value {
				invalid = false
				break
			}
		}
		if invalid {
			return fmt.Errorf("invalid user setting editor font style value")
		}
	} else if upsert.Key == UserSettingMobileEditorStyleKey {
		mobileEditorStyleValue := "normal"
		err := json.Unmarshal([]byte(upsert.Value), &mobileEditorStyleValue)
		if err != nil {
			return fmt.Errorf("failed to unmarshal user setting mobile editor style")
		}

		invalid := true
		for _, value := range UserSettingMobileEditorStyleValue {
			if mobileEditorStyleValue == value {
				invalid = false
				break
			}
		}
		if invalid {
			return fmt.Errorf("invalid user setting mobile editor style value")
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
