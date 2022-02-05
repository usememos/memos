package common

import (
	"strings"

	"github.com/google/uuid"
)

// HasPrefixes returns true if the string s has any of the given prefixes.
func HasPrefixes(src string, prefixes ...string) bool {
	for _, prefix := range prefixes {
		if strings.HasPrefix(src, prefix) {
			return true
		}
	}
	return false
}

func GenUUID() string {
	return uuid.New().String()
}
