package store

import (
	"github.com/pkg/errors"

	storepb "github.com/usememos/memos/proto/gen/store"
)

// ValidateSpaceIcon validates display metadata without depending on a client's
// installed Lucide catalog. A nil icon requests the default Space mark.
func ValidateSpaceIcon(icon *storepb.SpacePayload_Icon) error {
	if icon == nil {
		return nil
	}
	switch value := icon.Value.(type) {
	case *storepb.SpacePayload_Icon_Emoji:
		return validateEmojiIcon(value.Emoji)
	case *storepb.SpacePayload_Icon_Lucide:
		return validateLucideIcon(value.Lucide)
	default:
		return errors.New("space icon must specify emoji or lucide")
	}
}
