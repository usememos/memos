package version

import (
	"strconv"
	"strings"
)

// Version is the service current released version.
// Semantic versioning: https://semver.org/
var Version = "0.4.4"

// DevVersion is the service current development version.
var DevVersion = "0.4.4"

func GetCurrentVersion(mode string) string {
	if mode == "dev" {
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

func GetSchemaVersion(version string) string {
	minorVersion := GetMinorVersion(version)

	return minorVersion + ".0"
}

// convSemanticVersionToInt converts version string to int.
func convSemanticVersionToInt(version string) int {
	versionList := strings.Split(version, ".")

	if len(versionList) < 3 {
		return 0
	}
	major, err := strconv.Atoi(versionList[0])
	if err != nil {
		return 0
	}
	minor, err := strconv.Atoi(versionList[1])
	if err != nil {
		return 0
	}
	patch, err := strconv.Atoi(versionList[2])
	if err != nil {
		return 0
	}

	return major*10000 + minor*100 + patch
}

// IsVersionGreaterThanOrEqualTo returns true if version is greater than or equal to target.
func IsVersionGreaterOrEqualThan(version, target string) bool {
	return convSemanticVersionToInt(version) >= convSemanticVersionToInt(target)
}

// IsVersionGreaterThan returns true if version is greater than target.
func IsVersionGreaterThan(version, target string) bool {
	return convSemanticVersionToInt(version) > convSemanticVersionToInt(target)
}
