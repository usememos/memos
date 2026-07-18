package base

import (
	"strings"
	"testing"
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
		{"123e4567-e89b-12d3-a456-426614174000", true},   // UUID v4 from IDP
		{"a123456789012345678901234567890123456", true},  // New AIP-compatible IDs can exceed the legacy limit.
		{"A123456789012345678901234567890123456", false}, // Legacy uppercase IDs remain capped at 36 characters.
	}

	for _, test := range tests {
		t.Run(test.input, func(*testing.T) {
			result := UIDMatcher.MatchString(test.input)
			if result != test.expected {
				t.Errorf("For input '%s', expected %v but got %v", test.input, test.expected, result)
			}
		})
	}
}

func TestResourceIDMatcher(t *testing.T) {
	tests := []struct {
		input    string
		expected bool
	}{
		{"a", true},
		{"abc-123", true},
		{"a" + strings.Repeat("b", 62), true},
		{"a" + strings.Repeat("b", 63), false},
		{"1abc", false},
		{"Abc", false},
		{"abc-", false},
		{"abc_def", false},
	}

	for _, test := range tests {
		t.Run(test.input, func(t *testing.T) {
			if got := ResourceIDMatcher.MatchString(test.input); got != test.expected {
				t.Errorf("ResourceIDMatcher.MatchString(%q) = %v, want %v", test.input, got, test.expected)
			}
		})
	}
}
