package api

type SystemSettingName string

const (
	// SystemSettingServerIDName is the name of server id.
	SystemSettingServerIDName SystemSettingName = "server-id"
	// SystemSettingSecretSessionName is the name of secret session.
	SystemSettingSecretSessionName SystemSettingName = "secret-session"
	// SystemSettingAllowSignUpName is the name of allow signup setting.
	SystemSettingAllowSignUpName SystemSettingName = "allow-signup"
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
	// SystemSettingTelegramBotToken is the name of Telegram Bot Token.
	SystemSettingTelegramBotTokenName         SystemSettingName = "telegram-bot-token"
	SystemSettingMemoDisplayWithUpdatedTsName SystemSettingName = "memo-display-with-updated-ts"
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

func (key SystemSettingName) String() string {
	switch key {
	case SystemSettingServerIDName:
		return "server-id"
	case SystemSettingSecretSessionName:
		return "secret-session"
	case SystemSettingAllowSignUpName:
		return "allow-signup"
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
	case SystemSettingTelegramBotTokenName:
		return "telegram-bot-token"
	case SystemSettingMemoDisplayWithUpdatedTsName:
		return "memo-display-with-updated-ts"
	}
	return ""
}

type SystemSetting struct {
	Name SystemSettingName `json:"name"`
	// Value is a JSON string with basic value.
	Value       string `json:"value"`
	Description string `json:"description"`
}

type SystemSettingFind struct {
	Name SystemSettingName `json:"name"`
}
