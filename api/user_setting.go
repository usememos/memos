package api

type UserSettingKey string

const (
	// UserSettingLocaleKey is the key type for user locale
	UserSettingLocaleKey UserSettingKey = "locale"
)

// String returns the string format of UserSettingKey type.
func (key UserSettingKey) String() string {
	switch key {
	case UserSettingLocaleKey:
		return "locale"
	}
	return ""
}

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

type UserSettingFind struct {
	UserID int
}
