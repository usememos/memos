package api

import (
	"testing"

	coreuser "github.com/usememos/memos/core/user"
)

func TestDeriveSSOUsername(t *testing.T) {
	username, err := deriveSSOUsername()
	if err != nil {
		t.Fatalf("deriveSSOUsername() returned error: %v", err)
	}
	if len(username) != 36 {
		t.Fatalf("deriveSSOUsername() = %q, want a 36-character UUID", username)
	}
	if err := coreuser.ValidateUsername(username); err != nil {
		t.Fatalf("deriveSSOUsername() produced invalid username %q: %v", username, err)
	}
}
