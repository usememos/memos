package store

import (
	"fmt"
)

func getUserSettingCacheKeyV1(userID int, key string) string {
	return fmt.Sprintf("%d-%s", userID, key)
}
