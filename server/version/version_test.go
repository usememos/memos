package version

import (
	"sort"
	"testing"

	"github.com/stretchr/testify/assert"
)

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

func TestIsVersionGreaterThan(t *testing.T) {
	tests := []struct {
		version string
		target  string
		want    bool
	}{
		{
			version: "0.9.1",
			target:  "0.9.1",
			want:    false,
		},
		{
			version: "0.10.0",
			target:  "0.8.0",
			want:    true,
		},
		{
			version: "0.23",
			target:  "0.22",
			want:    true,
		},
		{
			version: "0.8.0",
			target:  "0.10.0",
			want:    false,
		},
		{
			version: "0.9.0",
			target:  "0.9.1",
			want:    false,
		},
		{
			version: "0.22",
			target:  "0.22",
			want:    false,
		},
	}
	for _, test := range tests {
		result := IsVersionGreaterThan(test.version, test.target)
		if result != test.want {
			t.Errorf("got result %v, want %v.", result, test.want)
		}
	}
}

func TestSortVersion(t *testing.T) {
	tests := []struct {
		versionList []string
		want        []string
	}{
		{
			versionList: []string{"0.9.1", "0.10.0", "0.8.0"},
			want:        []string{"0.8.0", "0.9.1", "0.10.0"},
		},
		{
			versionList: []string{"1.9.1", "0.9.1", "0.10.0", "0.8.0"},
			want:        []string{"0.8.0", "0.9.1", "0.10.0", "1.9.1"},
		},
	}
	for _, test := range tests {
		sort.Sort(SortVersion(test.versionList))
		assert.Equal(t, test.versionList, test.want)
	}
}
