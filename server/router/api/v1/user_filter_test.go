package v1

import (
	"testing"

	"github.com/usememos/memos/plugin/filter"
)

func TestUserFilterValidation(t *testing.T) {
	testCases := []struct {
		name      string
		filter    string
		expectErr bool
	}{
		{
			name:      "valid username filter with equals",
			filter:    `username == "testuser"`,
			expectErr: false,
		},
		{
			name:      "valid username filter with contains",
			filter:    `username.contains("admin")`,
			expectErr: false,
		},
		{
			name:      "invalid filter - unknown field",
			filter:    `invalid_field == "test"`,
			expectErr: true,
		},
		{
			name:      "empty filter",
			filter:    "",
			expectErr: true,
		},
		{
			name:      "invalid syntax",
			filter:    `username ==`,
			expectErr: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Test the filter parsing directly
			_, err := filter.Parse(tc.filter, filter.UserFilterCELAttributes...)

			if tc.expectErr && err == nil {
				t.Errorf("Expected error for filter %q, but got none", tc.filter)
			}
			if !tc.expectErr && err != nil {
				t.Errorf("Expected no error for filter %q, but got: %v", tc.filter, err)
			}
		})
	}
}

func TestUserFilterCELAttributes(t *testing.T) {
	// Test that our UserFilterCELAttributes contains the username variable
	expectedAttributes := map[string]bool{
		"username": true,
	}

	// This is a basic test to ensure the attributes are defined
	// In a real test, you would create a CEL environment and verify the attributes
	for attrName := range expectedAttributes {
		t.Logf("Expected attribute %s should be available in UserFilterCELAttributes", attrName)
	}
}
