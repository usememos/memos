package api

import (
	"encoding/json"
	"fmt"
)

type SystemSettingName string

const (
	// SystemSettingAllowSignUpName is the key type of allow signup setting.
	SystemSettingAllowSignUpName SystemSettingName = "allowSignUp"
	// SystemSettingAdditionalStyleName is the key type of additional style.
	SystemSettingAdditionalStyleName SystemSettingName = "additionalStyle"
	// SystemSettingAdditionalScriptName is the key type of additional script.
	SystemSettingAdditionalScriptName SystemSettingName = "additionalScript"
)

func (key SystemSettingName) String() string {
	switch key {
	case SystemSettingAllowSignUpName:
		return "allowSignUp"
	case SystemSettingAdditionalStyleName:
		return "additionalStyle"
	case SystemSettingAdditionalScriptName:
		return "additionalScript"
	}
	return ""
}

var (
	SystemSettingAllowSignUpValue = []bool{true, false}
)

type SystemSetting struct {
	Name SystemSettingName
	// Value is a JSON string with basic value
	Value       string
	Description string
}

type SystemSettingUpsert struct {
	Name        SystemSettingName `json:"name"`
	Value       string            `json:"value"`
	Description string            `json:"description"`
}

func (upsert SystemSettingUpsert) Validate() error {
	if upsert.Name == SystemSettingAllowSignUpName {
		value := false
		err := json.Unmarshal([]byte(upsert.Value), &value)
		if err != nil {
			return fmt.Errorf("failed to unmarshal system setting allow signup value")
		}

		invalid := true
		for _, v := range SystemSettingAllowSignUpValue {
			if value == v {
				invalid = false
				break
			}
		}
		if invalid {
			return fmt.Errorf("invalid system setting allow signup value")
		}
	} else if upsert.Name == SystemSettingAdditionalStyleName {
		value := ""
		err := json.Unmarshal([]byte(upsert.Value), &value)
		if err != nil {
			return fmt.Errorf("failed to unmarshal system setting additional style value")
		}
	} else if upsert.Name == SystemSettingAdditionalScriptName {
		value := ""
		err := json.Unmarshal([]byte(upsert.Value), &value)
		if err != nil {
			return fmt.Errorf("failed to unmarshal system setting additional script value")
		}
	} else {
		return fmt.Errorf("invalid system setting name")
	}

	return nil
}

type SystemSettingFind struct {
	Name *SystemSettingName `json:"name"`
}
