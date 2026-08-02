package base

import (
	"strings"
	"testing"
)

func TestIsValidUsername(t *testing.T) {
	tests := []struct {
		username string
		want     bool
	}{
		{username: "alice", want: true},
		{username: "Alice-2", want: true},
		{username: "1alice", want: true},
		{username: "a--b", want: true},
		{username: "a---b", want: true},
		{username: "a" + strings.Repeat("b", MaxUsernameLength-1), want: true},
		{username: ""},
		{username: strings.Repeat("a", MaxUsernameLength+1)},
		{username: "123", want: true},
		{username: "123-456", want: true},
		{username: "00000000-0000-0000-0000-000000000000", want: true},
		{username: "-"},
		{username: "---"},
		{username: "-alice"},
		{username: "alice-"},
		{username: "alice_smith"},
		{username: "alice@example.com"},
		{username: " alice "},
		{username: "alice smith"},
		{username: "álîçé"},
		{username: "张三"},
	}

	for _, test := range tests {
		t.Run(test.username, func(t *testing.T) {
			if got := IsValidUsername(test.username); got != test.want {
				t.Fatalf("IsValidUsername(%q) = %t, want %t", test.username, got, test.want)
			}
		})
	}
}
