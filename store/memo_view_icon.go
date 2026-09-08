package store

import (
	"github.com/pkg/errors"

	storepb "github.com/usememos/memos/proto/gen/store"
)

// ValidateMemoViewIcon validates optional display metadata for a saved view.
func ValidateMemoViewIcon(icon *storepb.MemoViewsUserSetting_MemoView_Icon) error {
	if icon == nil {
		return nil
	}
	switch value := icon.Value.(type) {
	case *storepb.MemoViewsUserSetting_MemoView_Icon_Emoji:
		return validateEmojiIcon(value.Emoji)
	case *storepb.MemoViewsUserSetting_MemoView_Icon_Lucide:
		return validateLucideIcon(value.Lucide)
	default:
		return errors.New("view icon must specify emoji or lucide")
	}
}
