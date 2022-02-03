//go:build !release
// +build !release

package cmd

import (
	"fmt"
)

// GetDevProfile will return a profile for dev.
func GetDevProfile(dataDir string) Profile {
	return Profile{
		mode: "8080",
		port: 1234,
		dsn:  fmt.Sprintf("file:%s/memos_dev.db", dataDir),
	}
}
