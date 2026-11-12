package api

import (
	"testing"
)

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
