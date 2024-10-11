package util_test

import (
	"testing"

	"github.com/usememos/memos/internal/util"
)

func TestUIDMatcher(t *testing.T) {
	tests := []struct {
		input    string
		expected bool
	}{
		{"", false},
		{"-abc123", false},
		{"012345678901234567890123456789", true},
		{"1abc-123", true},
		{"A123B456C789", true},
		{"a", true},
		{"ab", true},
		{"a*b&c", false},
		{"a--b", true},
		{"a-1b-2c", true},
		{"a1234567890123456789012345678901", true},
		{"abc123", true},
		{"abc123-", false},
	}

	for _, test := range tests {
		t.Run(test.input, func(*testing.T) {
			result := util.UIDMatcher.MatchString(test.input)
			if result != test.expected {
				t.Errorf("For input '%s', expected %v but got %v", test.input, test.expected, result)
			}
		})
	}
}
