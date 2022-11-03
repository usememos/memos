package api

import "github.com/usememos/memos/server/profile"

type SystemStatus struct {
	Host    *User            `json:"host"`
	Profile *profile.Profile `json:"profile"`
	// System settings
	AllowSignUp bool `json:"allowSignUp"`
}
