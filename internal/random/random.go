// Package random generates identifiers and secrets from a cryptographically
// secure source.
package random

import (
	"crypto/rand"
	"math/big"
	"strings"
	"uuid"
)

// UUID returns a new random (version 4) UUID in its canonical string form.
func UUID() string {
	return uuid.NewV4().String()
}

var alphabet = []rune("0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")

// String returns a random alphanumeric string of length n.
func String(n int) (string, error) {
	var sb strings.Builder
	sb.Grow(n)
	for i := 0; i < n; i++ {
		index, err := rand.Int(rand.Reader, big.NewInt(int64(len(alphabet))))
		if err != nil {
			return "", err
		}
		if _, err := sb.WriteRune(alphabet[index.Uint64()]); err != nil {
			return "", err
		}
	}
	return sb.String(), nil
}
