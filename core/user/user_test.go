package user

import (
	"strings"
	"testing"
)

func TestValidateUsername(t *testing.T) {
	tests := []struct {
		name      string
		username  string
		wantError bool
	}{
		{
			name:     "lowercase",
			username: "alice",
		},
		{
			name:     "mixed case",
			username: "Alice",
		},
		{
			name:     "hyphenated",
			username: "alice-smith",
		},
		{
			name:     "one character",
			username: "a",
		},
		{
			name:     "maximum length",
			username: "a" + strings.Repeat("b", 35),
		},
		{
			name:      "too long",
			username:  "a" + strings.Repeat("b", 36),
			wantError: true,
		},
		{
			name:     "digit first",
			username: "1alice",
		},
		{
			name:      "hyphen last",
			username:  "alice-",
			wantError: true,
		},
		{
			name:      "empty",
			username:  "",
			wantError: true,
		},
		{
			name:     "numeric",
			username: "123",
		},
		{
			name:      "email",
			username:  "alice@example.com",
			wantError: true,
		},
		{
			name:      "underscore",
			username:  "alice_smith",
			wantError: true,
		},
		{
			name:      "space",
			username:  "alice smith",
			wantError: true,
		},
		{
			name:      "slash",
			username:  "alice/smith",
			wantError: true,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := ValidateUsername(test.username)
			if test.wantError && err == nil {
				t.Fatalf("ValidateUsername(%q) succeeded, want error", test.username)
			}
			if !test.wantError && err != nil {
				t.Fatalf("ValidateUsername(%q) returned error: %v", test.username, err)
			}
		})
	}
}

func TestValidatePassword(t *testing.T) {
	if err := ValidatePassword(""); err == nil {
		t.Fatal("ValidatePassword(\"\") succeeded, want error")
	}
	if err := ValidatePassword("secret"); err != nil {
		t.Fatalf("ValidatePassword(\"secret\") returned error: %v", err)
	}
}
