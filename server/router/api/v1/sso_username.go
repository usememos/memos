package v1

import (
	"context"
	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/idp"
	"github.com/usememos/memos/internal/util"
	"github.com/usememos/memos/store"
)

const (
	ssoUsernameMaxLength     = 36
	ssoUsernameSuffixLength  = 6
	ssoUsernameSuffixRetries = 8
	ssoUsernameFallbackTries = 5
	// ssoUserCreateMaxAttempts bounds how many times resolveSSOUser retries
	// CreateUser after a UNIQUE(username) violation racing past deriveSSOUsername's
	// availability probe. Each retry re-derives the username from scratch.
	ssoUserCreateMaxAttempts = 5
)

// deriveSSOUsername produces a valid local username for a new SSO-created user,
// preferring display-oriented profile fields over the external identifier so that
// User.Username remains independent of the external-identity subject.
//
// Candidates are tried in order: DisplayName, Email, Identifier. Each candidate
// is normalized to the local username alphabet ([a-zA-Z0-9-], 1-36 chars, must
// start and end with alphanumeric). If the normalized base is already taken, up
// to N suffixed variants are tried. When every candidate is exhausted, a purely
// random "user-xxxxxxxxxx" fallback is used.
func deriveSSOUsername(ctx context.Context, stores *store.Store, userInfo *idp.IdentityProviderUserInfo) (string, error) {
	candidates := []string{userInfo.DisplayName, userInfo.Email, userInfo.Identifier}
	for _, candidate := range candidates {
		base := normalizeToUsername(candidate)
		if base == "" {
			continue
		}
		if err := validateUsername(base); err != nil {
			continue
		}
		unique, err := isUsernameAvailable(ctx, stores, base)
		if err != nil {
			return "", err
		}
		if unique {
			return base, nil
		}
		for i := 0; i < ssoUsernameSuffixRetries; i++ {
			suffix, err := util.RandomString(ssoUsernameSuffixLength)
			if err != nil {
				return "", errors.Wrap(err, "failed to generate username suffix")
			}
			// Reserve room for "-<suffix>" while keeping the total within the 36-char limit.
			maxBaseLen := ssoUsernameMaxLength - 1 - len(suffix)
			trimmed := trimTrailingDashes(truncate(base, maxBaseLen))
			if trimmed == "" {
				break
			}
			next := trimmed + "-" + suffix
			if err := validateUsername(next); err != nil {
				continue
			}
			unique, err := isUsernameAvailable(ctx, stores, next)
			if err != nil {
				return "", err
			}
			if unique {
				return next, nil
			}
		}
	}
	// Fallback: fully random username.
	for i := 0; i < ssoUsernameFallbackTries; i++ {
		suffix, err := util.RandomString(10)
		if err != nil {
			return "", errors.Wrap(err, "failed to generate fallback username")
		}
		name := "user-" + suffix
		if err := validateUsername(name); err != nil {
			continue
		}
		unique, err := isUsernameAvailable(ctx, stores, name)
		if err != nil {
			return "", err
		}
		if unique {
			return name, nil
		}
	}
	return "", errors.New("failed to derive a unique SSO username after retries")
}

// normalizeToUsername lowercases the input, replaces any non-alphanumeric run with a
// single dash, trims dashes off the ends, truncates to ssoUsernameMaxLength, and
// returns "" when the result would fail validateUsername (empty or fully numeric).
func normalizeToUsername(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}
	var b strings.Builder
	b.Grow(len(s))
	lastDash := true
	for _, r := range s {
		switch {
		case r >= 'A' && r <= 'Z':
			b.WriteRune(r + ('a' - 'A'))
			lastDash = false
		case (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9'):
			b.WriteRune(r)
			lastDash = false
		default:
			if !lastDash {
				b.WriteByte('-')
				lastDash = true
			}
		}
	}
	out := strings.Trim(b.String(), "-")
	out = truncate(out, ssoUsernameMaxLength)
	out = trimTrailingDashes(out)
	if out == "" {
		return ""
	}
	if isNumericUsername(out) {
		return ""
	}
	return out
}

func truncate(s string, n int) string {
	if n <= 0 {
		return ""
	}
	if len(s) <= n {
		return s
	}
	return s[:n]
}

func trimTrailingDashes(s string) string {
	return strings.TrimRight(strings.TrimLeft(s, "-"), "-")
}

func isUsernameAvailable(ctx context.Context, stores *store.Store, username string) (bool, error) {
	existing, err := stores.GetUser(ctx, &store.FindUser{Username: &username})
	if err != nil {
		return false, errors.Wrap(err, "failed to check username availability")
	}
	return existing == nil, nil
}
