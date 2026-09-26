package store

import (
	"github.com/pkg/errors"

	storepb "github.com/usememos/memos/proto/gen/store"
)

// ValidateUserTagIcon validates the optional display icon of a user tag rule.
// A nil icon means the client falls back to a leading emoji in the tag name, then the hash mark.
func ValidateUserTagIcon(icon *storepb.UserTagMetadata_Icon) error {
	if icon == nil {
		return nil
	}
	switch value := icon.Value.(type) {
	case *storepb.UserTagMetadata_Icon_Emoji:
		return validateEmojiIcon(value.Emoji)
	case *storepb.UserTagMetadata_Icon_Lucide:
		return validateLucideIcon(value.Lucide)
	default:
		return errors.New("tag icon must specify emoji or lucide")
	}
}
