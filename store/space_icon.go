package store

import (
	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/markdown/parser"
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
		if !parser.IsEmoji(value.Emoji) {
			return errors.New("space icon must contain one fully qualified emoji")
		}
	case *storepb.SpacePayload_Icon_Lucide:
		if len(value.Lucide) == 0 || len(value.Lucide) > 128 {
			return errors.New("space icon name must contain 1 to 128 bytes")
		}
		for _, part := range strings.Split(value.Lucide, "-") {
			if part == "" {
				return errors.New("space icon name must use lowercase kebab-case")
			}
			for _, char := range part {
				if (char < 'a' || char > 'z') && (char < '0' || char > '9') {
					return errors.New("space icon name must use lowercase kebab-case")
				}
			}
		}
	default:
		return errors.New("space icon must specify emoji or lucide")
	}
	return nil
}
