package v1

import (
	"strings"
	"testing"
)

func TestDeriveSSOUsername(t *testing.T) {
	username, err := deriveSSOUsername()
	if err != nil {
		t.Fatalf("deriveSSOUsername() returned error: %v", err)
	}
	if !strings.HasPrefix(username, "user-") {
		t.Fatalf("deriveSSOUsername() = %q, want user- prefix", username)
	}
	if err := validateWritableUsername(username); err != nil {
		t.Fatalf("deriveSSOUsername() produced invalid username %q: %v", username, err)
	}
}
