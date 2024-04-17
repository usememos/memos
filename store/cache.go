package store

import (
	"fmt"
)

func getUserSettingCacheKey(userID int32, key string) string {
	return fmt.Sprintf("%d-%s-v1", userID, key)
}
