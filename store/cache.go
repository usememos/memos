package store

import (
	"fmt"
)

func getUserSettingCacheKey(userID int32, key string) string {
	return fmt.Sprintf("%d-%s", userID, key)
}

func getUserSettingV1CacheKey(userID int32, key string) string {
	return fmt.Sprintf("%d-%s-v1", userID, key)
}
