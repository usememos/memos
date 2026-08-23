package v1

import (
	"strings"
	"testing"
)

func TestValidateAndGenerateUIDValidatesUserProvidedResourceIDs(t *testing.T) {
	tests := []struct {
		name      string
		provided  string
		wantError bool
	}{
		{name: "lowercase", provided: "memo-1"},
		{name: "UUID", provided: "21ec98aa-9a8f-458c-a2a3-c7dc69b6f591"},
		{name: "maximum length", provided: "a" + strings.Repeat("b", 35)},
		{name: "digit first", provided: "1-memo"},
		{name: "uppercase", provided: "Memo"},
		{name: "too long", provided: "a" + strings.Repeat("b", 36), wantError: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			uid, err := ValidateAndGenerateUID(test.provided)
			if test.wantError {
				if err == nil {
					t.Fatalf("ValidateAndGenerateUID(%q) succeeded, want error", test.provided)
				}
				return
			}
			if err != nil {
				t.Fatalf("ValidateAndGenerateUID(%q) returned error: %v", test.provided, err)
			}
			if uid != test.provided {
				t.Fatalf("ValidateAndGenerateUID(%q) = %q", test.provided, uid)
			}
		})
	}
}

func TestExtractSpaceUIDFromName(t *testing.T) {
	uid, err := ExtractSpaceUIDFromName("spaces/team-notes")
	if err != nil {
		t.Fatalf("ExtractSpaceUIDFromName() returned error: %v", err)
	}
	if uid != "team-notes" {
		t.Fatalf("ExtractSpaceUIDFromName() = %q, want %q", uid, "team-notes")
	}
	for _, name := range []string{"", "spaces/", "memos/team-notes", "spaces/team/members/alice"} {
		if _, err := ExtractSpaceUIDFromName(name); err == nil {
			t.Errorf("ExtractSpaceUIDFromName(%q) succeeded, want error", name)
		}
	}
}

func TestExtractSpaceMemberTokensFromName(t *testing.T) {
	spaceUID, username, err := ExtractSpaceMemberTokensFromName("spaces/team-notes/members/alice")
	if err != nil {
		t.Fatalf("ExtractSpaceMemberTokensFromName() returned error: %v", err)
	}
	if spaceUID != "team-notes" || username != "alice" {
		t.Fatalf("ExtractSpaceMemberTokensFromName() = (%q, %q)", spaceUID, username)
	}
	for _, name := range []string{"spaces/team-notes", "spaces/team-notes/users/alice", "spaces//members/alice", "spaces/team-notes/members/"} {
		if _, _, err := ExtractSpaceMemberTokensFromName(name); err == nil {
			t.Errorf("ExtractSpaceMemberTokensFromName(%q) succeeded, want error", name)
		}
	}
}
