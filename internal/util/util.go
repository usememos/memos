package util //nolint:revive // util namespace is intentional for shared helpers

import (
	"crypto/rand"
	"math/big"
	"net/mail"
	"strconv"
	"strings"
	"uuid"

	"github.com/pkg/errors"
)

// ConvertStringToInt32 converts a string to int32.
func ConvertStringToInt32(src string) (int32, error) {
	parsed, err := strconv.ParseInt(src, 10, 32)
	if err != nil {
		return 0, err
	}
	return int32(parsed), nil
}

// HasPrefixes returns true if the string s has any of the given prefixes.
func HasPrefixes(src string, prefixes ...string) bool {
	for _, prefix := range prefixes {
		if strings.HasPrefix(src, prefix) {
			return true
		}
	}
	return false
}

// maxEmailLength is the longest address accepted for storage. RFC 5321 caps a
// forward path at 256 octets including the angle brackets, so 254 is the
// widely used practical limit.
const maxEmailLength = 254

// NormalizeEmail validates an email address and returns its canonical stored
// form: surrounding whitespace removed and every character lowercased. An
// empty input (after trimming) is valid and returns "", meaning no address.
//
// Display-name forms such as "Alice <alice@example.com>" are rejected even
// though the mail parser accepts them, because the stored value must be the
// bare address. The local part is lowercased along with the domain: every
// mainstream provider treats it case-insensitively, and folding both halves
// is what makes the instance-wide uniqueness rule match what users expect.
func NormalizeEmail(email string) (string, error) {
	email = strings.TrimSpace(email)
	if email == "" {
		return "", nil
	}
	if len(email) > maxEmailLength {
		return "", errors.Errorf("email must be at most %d characters", maxEmailLength)
	}
	address, err := mail.ParseAddress(email)
	if err != nil {
		return "", errors.New("email is not a valid address")
	}
	if address.Address != email {
		return "", errors.New("email must be a bare address without a display name")
	}
	return strings.ToLower(email), nil
}

func GenUUID() string {
	return uuid.NewV4().String()
}

var letters = []rune("0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")

// RandomString returns a random string with length n.
func RandomString(n int) (string, error) {
	var sb strings.Builder
	sb.Grow(n)
	for i := 0; i < n; i++ {
		// The reason for using crypto/rand instead of math/rand is that
		// the former relies on hardware to generate random numbers and
		// thus has a stronger source of random numbers.
		randNum, err := rand.Int(rand.Reader, big.NewInt(int64(len(letters))))
		if err != nil {
			return "", err
		}
		if _, err := sb.WriteRune(letters[randNum.Uint64()]); err != nil {
			return "", err
		}
	}
	return sb.String(), nil
}

// ReplaceString replaces all occurrences of old in slice with new.
func ReplaceString(slice []string, old, new string) []string {
	for i, s := range slice {
		if s == old {
			slice[i] = new
		}
	}
	return slice
}
