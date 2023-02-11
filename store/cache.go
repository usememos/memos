package store

import (
	"fmt"

	"github.com/usememos/memos/api"
)

func getUserSettingCacheKey(userSetting userSettingRaw) string {
	return fmt.Sprintf("%d-%s", userSetting.UserID, userSetting.Key.String())
}

func getUserSettingFindCacheKey(userSettingFind *api.UserSettingFind) string {
	return fmt.Sprintf("%d-%s", userSettingFind.UserID, userSettingFind.Key.String())
}
