package api

import "github.com/usememos/memos/server/profile"

type SystemStatus struct {
	Host    *User            `json:"host"`
	Profile *profile.Profile `json:"profile"`
	DBSize  int64            `json:"dbSize"`

	// System settings
	// Allow sign up.
	AllowSignUp bool `json:"allowSignUp"`
	// Additional style.
	AdditionalStyle string `json:"additionalStyle"`
	// Additional script.
	AdditionalScript string `json:"additionalScript"`
}
