package memoarchive

import (
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/identifier"
)

// sha256Pattern is a lowercase hexadecimal SHA-256 digest.
var sha256Pattern = regexp.MustCompile(`^[0-9a-f]{64}$`)

// mediaTypePattern is an RFC 6838 type/subtype pair without parameters.
var mediaTypePattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]{0,126}/[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]{0,126}$`)

// reservedWindowsNames are device names that Windows refuses as filenames.
var reservedWindowsNames = map[string]struct{}{
	"CON": {}, "PRN": {}, "AUX": {}, "NUL": {},
	"COM1": {}, "COM2": {}, "COM3": {}, "COM4": {}, "COM5": {}, "COM6": {}, "COM7": {}, "COM8": {}, "COM9": {},
	"LPT1": {}, "LPT2": {}, "LPT3": {}, "LPT4": {}, "LPT5": {}, "LPT6": {}, "LPT7": {}, "LPT8": {}, "LPT9": {},
}

// ValidateEntryName applies the container rules to a ZIP entry name or a
// record path member. It never repairs a name: a violation is an error so
// that an unsafe archive is rejected whole.
func ValidateEntryName(name string) error {
	if name == "" {
		return errors.New("entry name is empty")
	}
	if !utf8.ValidString(name) {
		return errors.Errorf("entry name %q is not valid UTF-8", name)
	}
	if strings.HasPrefix(name, "/") {
		return errors.Errorf("entry name %q is absolute", name)
	}
	if strings.HasSuffix(name, "/") {
		return errors.Errorf("entry name %q is a directory", name)
	}
	for _, r := range name {
		if r < 0x20 || r == '\\' || r == ':' || r == 0x7f {
			return errors.Errorf("entry name %q contains a forbidden character", name)
		}
	}
	for segment := range strings.SplitSeq(name, "/") {
		if segment == "" {
			return errors.Errorf("entry name %q contains an empty segment", name)
		}
		if segment == "." || segment == ".." {
			return errors.Errorf("entry name %q contains a dot segment", name)
		}
	}
	return nil
}

// ValidateUID checks the public resource UID grammar shared by memos,
// attachments, and Spaces.
func ValidateUID(uid string) error {
	if !identifier.UIDMatcher.MatchString(uid) {
		return errors.Errorf("invalid uid %q", uid)
	}
	return nil
}

// SafeFilename maps an attachment's original filename onto the final path
// segment of its archive entry. The mapping is deterministic so that a
// re-export of the same attachment lands at the same entry name.
func SafeFilename(filename string) string {
	var builder strings.Builder
	for _, r := range filename {
		switch {
		case r == '/' || r == '\\' || r == ':' || r < 0x20 || r == 0x7f || r == utf8.RuneError:
			builder.WriteByte('_')
		default:
			builder.WriteRune(r)
		}
	}
	safe := strings.Trim(builder.String(), " .")
	if safe == "" {
		return "file"
	}
	stem := safe
	if index := strings.IndexByte(stem, '.'); index >= 0 {
		stem = stem[:index]
	}
	if _, reserved := reservedWindowsNames[strings.ToUpper(stem)]; reserved {
		return "_" + safe
	}
	return safe
}
