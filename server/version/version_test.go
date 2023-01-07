package version

import "testing"

func TestIsVersionGreaterOrEqualThan(t *testing.T) {
	tests := []struct {
		version string
		target  string
		want    bool
	}{
		{
			version: "0.9.1",
			target:  "0.9.1",
			want:    true,
		},
		{
			version: "0.10.0",
			target:  "0.9.1",
			want:    true,
		},
		{
			version: "0.9.0",
			target:  "0.9.1",
			want:    false,
		},
	}
	for _, test := range tests {
		result := IsVersionGreaterOrEqualThan(test.version, test.target)
		if result != test.want {
			t.Errorf("got result %v, want %v.", result, test.want)
		}
	}
}
