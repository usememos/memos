package api

import (
	"encoding/json"
	"fmt"

	"golang.org/x/exp/slices"
)

type SystemSettingName string

const (
	// SystemSettingServerIDName is the name of server id.
	SystemSettingServerIDName SystemSettingName = "server-id"
	// SystemSettingSecretSessionName is the name of secret session.
	SystemSettingSecretSessionName SystemSettingName = "secret-session"
	// SystemSettingAllowSignUpName is the name of allow signup setting.
	SystemSettingAllowSignUpName SystemSettingName = "allow-signup"
	// SystemSettingIgnoreUpgradeName is the name of ignore upgrade.
	SystemSettingIgnoreUpgradeName SystemSettingName = "ignore-upgrade"
	// SystemSettingDisablePublicMemosName is the name of disable public memos setting.
	SystemSettingDisablePublicMemosName SystemSettingName = "disable-public-memos"
	// SystemSettingMaxUploadSizeMiBName is the name of max upload size setting.
	SystemSettingMaxUploadSizeMiBName SystemSettingName = "max-upload-size-mib"
	// SystemSettingAdditionalStyleName is the name of additional style.
	SystemSettingAdditionalStyleName SystemSettingName = "additional-style"
	// SystemSettingAdditionalScriptName is the name of additional script.
	SystemSettingAdditionalScriptName SystemSettingName = "additional-script"
	// SystemSettingCustomizedProfileName is the name of customized server profile.
	SystemSettingCustomizedProfileName SystemSettingName = "customized-profile"
	// SystemSettingStorageServiceIDName is the name of storage service ID.
	SystemSettingStorageServiceIDName SystemSettingName = "storage-service-id"
	// SystemSettingLocalStoragePathName is the name of local storage path.
	SystemSettingLocalStoragePathName SystemSettingName = "local-storage-path"
	// SystemSettingOpenAIConfigName is the name of OpenAI config.
	SystemSettingOpenAIConfigName SystemSettingName = "openai-config"
)

// CustomizedProfile is the struct definition for SystemSettingCustomizedProfileName system setting item.
type CustomizedProfile struct {
	// Name is the server name, default is `memos`
	Name string `json:"name"`
	// LogoURL is the url of logo image.
	LogoURL string `json:"logoUrl"`
	// Description is the server description.
	Description string `json:"description"`
	// Locale is the server default locale.
	Locale string `json:"locale"`
	// Appearance is the server default appearance.
	Appearance string `json:"appearance"`
	// ExternalURL is the external url of server. e.g. https://usermemos.com
	ExternalURL string `json:"externalUrl"`
}

type OpenAIConfig struct {
	Key  string `json:"key"`
	Host string `json:"host"`
}

func (key SystemSettingName) String() string {
	switch key {
	case SystemSettingServerIDName:
		return "server-id"
	case SystemSettingSecretSessionName:
		return "secret-session"
	case SystemSettingAllowSignUpName:
		return "allow-signup"
	case SystemSettingIgnoreUpgradeName:
		return "ignore-upgrade"
	case SystemSettingDisablePublicMemosName:
		return "disable-public-memos"
	case SystemSettingMaxUploadSizeMiBName:
		return "max-upload-size-mib"
	case SystemSettingAdditionalStyleName:
		return "additional-style"
	case SystemSettingAdditionalScriptName:
		return "additional-script"
	case SystemSettingCustomizedProfileName:
		return "customized-profile"
	case SystemSettingStorageServiceIDName:
		return "storage-service-id"
	case SystemSettingLocalStoragePathName:
		return "local-storage-path"
	case SystemSettingOpenAIConfigName:
		return "openai-config"
	}
	return ""
}

type SystemSetting struct {
	Name SystemSettingName `json:"name"`
	// Value is a JSON string with basic value.
	Value       string `json:"value"`
	Description string `json:"description"`
}

type SystemSettingUpsert struct {
	Name        SystemSettingName `json:"name"`
	Value       string            `json:"value"`
	Description string            `json:"description"`
}

const systemSettingUnmarshalError = `failed to unmarshal value from system setting "%v"`

func (upsert SystemSettingUpsert) Validate() error {
	switch settingName := upsert.Name; settingName {
	case SystemSettingServerIDName:
		return fmt.Errorf("updating %v is not allowed", settingName)

	case SystemSettingAllowSignUpName:
		var value bool
		if err := json.Unmarshal([]byte(upsert.Value), &value); err != nil {
			return fmt.Errorf(systemSettingUnmarshalError, settingName)
		}

	case SystemSettingIgnoreUpgradeName:
		var value bool
		if err := json.Unmarshal([]byte(upsert.Value), &value); err != nil {
			return fmt.Errorf(systemSettingUnmarshalError, settingName)
		}

	case SystemSettingDisablePublicMemosName:
		var value bool
		if err := json.Unmarshal([]byte(upsert.Value), &value); err != nil {
			return fmt.Errorf(systemSettingUnmarshalError, settingName)
		}

	case SystemSettingMaxUploadSizeMiBName:
		var value int
		if err := json.Unmarshal([]byte(upsert.Value), &value); err != nil {
			return fmt.Errorf(systemSettingUnmarshalError, settingName)
		}

	case SystemSettingAdditionalStyleName:
		var value string
		if err := json.Unmarshal([]byte(upsert.Value), &value); err != nil {
			return fmt.Errorf(systemSettingUnmarshalError, settingName)
		}

	case SystemSettingAdditionalScriptName:
		var value string
		if err := json.Unmarshal([]byte(upsert.Value), &value); err != nil {
			return fmt.Errorf(systemSettingUnmarshalError, settingName)
		}

	case SystemSettingCustomizedProfileName:
		customizedProfile := CustomizedProfile{
			Name:        "memos",
			LogoURL:     "",
			Description: "",
			Locale:      "en",
			Appearance:  "system",
			ExternalURL: "",
		}

		if err := json.Unmarshal([]byte(upsert.Value), &customizedProfile); err != nil {
			return fmt.Errorf(systemSettingUnmarshalError, settingName)
		}
		if !slices.Contains(UserSettingLocaleValue, customizedProfile.Locale) {
			return fmt.Errorf(`invalid locale value for system setting "%v"`, settingName)
		}
		if !slices.Contains(UserSettingAppearanceValue, customizedProfile.Appearance) {
			return fmt.Errorf(`invalid appearance value for system setting "%v"`, settingName)
		}

	case SystemSettingStorageServiceIDName:
		value := DatabaseStorage
		if err := json.Unmarshal([]byte(upsert.Value), &value); err != nil {
			return fmt.Errorf(systemSettingUnmarshalError, settingName)
		}
		return nil

	case SystemSettingLocalStoragePathName:
		value := ""
		if err := json.Unmarshal([]byte(upsert.Value), &value); err != nil {
			return fmt.Errorf(systemSettingUnmarshalError, settingName)
		}

	case SystemSettingOpenAIConfigName:
		value := OpenAIConfig{}
		if err := json.Unmarshal([]byte(upsert.Value), &value); err != nil {
			return fmt.Errorf(systemSettingUnmarshalError, settingName)
		}

	default:
		return fmt.Errorf("invalid system setting name")
	}

	return nil
}

type SystemSettingFind struct {
	Name SystemSettingName `json:"name"`
}
