package v1

import (
	"testing"
)

func TestValidateWritableUsername(t *testing.T) {
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
			name:     "uuid",
			username: "550e8400-e29b-41d4-a716-446655440000",
		},
		{
			name:      "empty",
			username:  "",
			wantError: true,
		},
		{
			name:      "numeric",
			username:  "123",
			wantError: true,
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
			err := validateWritableUsername(test.username)
			if test.wantError && err == nil {
				t.Fatalf("validateWritableUsername(%q) succeeded, want error", test.username)
			}
			if !test.wantError && err != nil {
				t.Fatalf("validateWritableUsername(%q) returned error: %v", test.username, err)
			}
		})
	}
}

func TestParseUsernameFromNameAllowsLegacyUsernames(t *testing.T) {
	tests := []struct {
		name     string
		want     string
		wantFail bool
	}{
		{
			name: "users/alice",
			want: "alice",
		},
		{
			name: "users/alice@example.com",
			want: "alice@example.com",
		},
		{
			name: "users/alice_smith",
			want: "alice_smith",
		},
		{
			name:     "users/",
			wantFail: true,
		},
		{
			name:     "invalid/alice",
			wantFail: true,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, err := parseUsernameFromName(test.name)
			if test.wantFail && err == nil {
				t.Fatalf("parseUsernameFromName(%q) succeeded, want error", test.name)
			}
			if !test.wantFail && err != nil {
				t.Fatalf("parseUsernameFromName(%q) returned error: %v", test.name, err)
			}
			if got != test.want {
				t.Fatalf("parseUsernameFromName(%q) = %q, want %q", test.name, got, test.want)
			}
		})
	}
}
