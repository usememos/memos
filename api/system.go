package api

import "memos/common"

type SystemStatus struct {
	Owner   *User           `json:"owner"`
	Profile *common.Profile `json:"profile"`
}
