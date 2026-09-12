package util //nolint:revive // util is an appropriate package name for utility functions

import (
	"strings"
	"testing"
)

func TestNormalizeEmail(t *testing.T) {
	tests := []struct {
		name    string
		email   string
		want    string
		wantErr bool
	}{
		{name: "plain", email: "t@gmail.com", want: "t@gmail.com"},
		{name: "empty means none", email: "", want: ""},
		{name: "whitespace only means none", email: "   ", want: ""},
		{name: "trims and lowercases", email: "  Alice@Example.COM ", want: "alice@example.com"},
		{name: "local part is folded", email: "First.Last@example.com", want: "first.last@example.com"},
		{name: "plus address kept", email: "a+tag@example.com", want: "a+tag@example.com"},
		{name: "dotless domain allowed", email: "1@gmail", want: "1@gmail"},
		{name: "missing local part", email: "@usememos.com", wantErr: true},
		{name: "missing at sign", email: "usememos.com", wantErr: true},
		{name: "display name form", email: "Alice <alice@example.com>", wantErr: true},
		{name: "angle brackets only", email: "<alice@example.com>", wantErr: true},
		{name: "two at signs", email: "alice@example.com@example.com", wantErr: true},
		{name: "interior whitespace", email: "alice @example.com", wantErr: true},
		{name: "too long", email: strings.Repeat("a", 250) + "@x.io", wantErr: true},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, err := NormalizeEmail(test.email)
			if test.wantErr {
				if err == nil {
					t.Fatalf("NormalizeEmail(%q) = %q, want error", test.email, got)
				}
				return
			}
			if err != nil {
				t.Fatalf("NormalizeEmail(%q) unexpected error: %v", test.email, err)
			}
			if got != test.want {
				t.Fatalf("NormalizeEmail(%q) = %q, want %q", test.email, got, test.want)
			}
		})
	}
}
