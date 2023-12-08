package store

import (
	"fmt"
)

func getUserSettingV1CacheKey(userID int32, key string) string {
	return fmt.Sprintf("%d-%s-v1", userID, key)
}
