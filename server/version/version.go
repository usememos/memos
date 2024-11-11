package version

import (
	"fmt"
	"strings"

	"golang.org/x/mod/semver"
)

// Version is the service current released version.
// Semantic versioning: https://semver.org/
var Version = "0.23.0"

// DevVersion is the service current development version.
var DevVersion = "0.23.0"

func GetCurrentVersion(mode string) string {
	if mode == "dev" || mode == "demo" {
		return DevVersion
	}
	return Version
}

func GetMinorVersion(version string) string {
	versionList := strings.Split(version, ".")
	if len(versionList) < 3 {
		return ""
	}
	return versionList[0] + "." + versionList[1]
}

// IsVersionGreaterOrEqualThan returns true if version is greater than or equal to target.
func IsVersionGreaterOrEqualThan(version, target string) bool {
	return semver.Compare(fmt.Sprintf("v%s", version), fmt.Sprintf("v%s", target)) > -1
}

// IsVersionGreaterThan returns true if version is greater than target.
func IsVersionGreaterThan(version, target string) bool {
	return semver.Compare(fmt.Sprintf("v%s", version), fmt.Sprintf("v%s", target)) > 0
}

type SortVersion []string

func (s SortVersion) Len() int {
	return len(s)
}

func (s SortVersion) Swap(i, j int) {
	s[i], s[j] = s[j], s[i]
}

func (s SortVersion) Less(i, j int) bool {
	v1 := fmt.Sprintf("v%s", s[i])
	v2 := fmt.Sprintf("v%s", s[j])
	return semver.Compare(v1, v2) == -1
}
