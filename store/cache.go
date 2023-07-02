package store

import (
	"fmt"
)

func getUserSettingCacheKey(userID int, key string) string {
	return fmt.Sprintf("%d-%s", userID, key)
}
