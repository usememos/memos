package store

import (
	"net/mail"
	"strings"

	"github.com/pkg/errors"
)

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
