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
		{name: "maximum length", provided: "a" + strings.Repeat("b", 62)},
		{name: "digit first", provided: "1-memo", wantError: true},
		{name: "uppercase", provided: "Memo", wantError: true},
		{name: "too long", provided: "a" + strings.Repeat("b", 63), wantError: true},
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
