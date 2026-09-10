package store

import (
	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/markdown/parser"
)

func validateEmojiIcon(emoji string) error {
	if !parser.IsEmoji(emoji) {
		return errors.New("icon must contain one fully qualified emoji")
	}
	return nil
}

func validateLucideIcon(name string) error {
	if len(name) == 0 || len(name) > 128 {
		return errors.New("icon name must contain 1 to 128 bytes")
	}
	for _, part := range strings.Split(name, "-") {
		if part == "" {
			return errors.New("icon name must use lowercase kebab-case")
		}
		for _, char := range part {
			if (char < 'a' || char > 'z') && (char < '0' || char > '9') {
				return errors.New("icon name must use lowercase kebab-case")
			}
		}
	}
	return nil
}
