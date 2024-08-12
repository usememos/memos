package util

import (
	"testing"
)

func TestValidateEmail(t *testing.T) {
	tests := []struct {
		email string
		want  bool
	}{
		{
			email: "t@gmail.com",
			want:  true,
		},
		{
			email: "@usememos.com",
			want:  false,
		},
		{
			email: "1@gmail",
			want:  true,
		},
	}
	for _, test := range tests {
		result := ValidateEmail(test.email)
		if result != test.want {
			t.Errorf("Validate Email %s: got result %v, want %v.", test.email, result, test.want)
		}
	}
}
