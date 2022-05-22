package api

import "memos/server/profile"

type SystemStatus struct {
	Owner   *User            `json:"owner"`
	Profile *profile.Profile `json:"profile"`
}
