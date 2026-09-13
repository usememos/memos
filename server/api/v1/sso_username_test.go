package v1

import (
	"testing"
)

func TestDeriveSSOUsername(t *testing.T) {
	username, err := deriveSSOUsername()
	if err != nil {
		t.Fatalf("deriveSSOUsername() returned error: %v", err)
	}
	if len(username) != 36 {
		t.Fatalf("deriveSSOUsername() = %q, want a 36-character UUID", username)
	}
	if err := validateWritableUsername(username); err != nil {
		t.Fatalf("deriveSSOUsername() produced invalid username %q: %v", username, err)
	}
}
