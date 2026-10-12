package version

import (
	"regexp"
	"runtime/debug"
	"time"

	"github.com/pkg/errors"
)

// Version is injected by release builds or derived from the embedded commit date.
var Version string

// Commit is injected by CI or read from build metadata, falling back to unknown.
var Commit = "unknown"

// calendarVersion matches YY.MM[.N][-rc.N]; scripts/release_version.sh accepts the same tags.
var calendarVersion = regexp.MustCompile(`^[1-9][0-9]\.(0[1-9]|1[0-2])(\.[1-9][0-9]*)?(-rc\.[1-9][0-9]*)?$`)

func init() {
	if info, ok := debug.ReadBuildInfo(); ok {
		Version, Commit = resolveBuild(Version, Commit, info.Settings)
	}
}

func resolveBuild(version, commit string, settings []debug.BuildSetting) (string, string) {
	for _, setting := range settings {
		switch setting.Key {
		case "vcs.time":
			if version == "" {
				if timestamp, err := time.Parse(time.RFC3339, setting.Value); err == nil {
					version = timestamp.UTC().Format("06.01")
				}
			}
		case "vcs.revision":
			if commit == "" || commit == "unknown" {
				commit = setting.Value
			}
		default:
		}
	}
	return version, commit
}

// Validate checks that the build has a calendar version before it is exposed.
func Validate() error {
	if Version == "" {
		return errors.New("missing build version: use go run -buildvcs=true ./cmd/memos or inject internal/version.Version with -ldflags")
	}
	if !calendarVersion.MatchString(Version) {
		return errors.Errorf("invalid build version %q: expected YY.MM[.N][-rc.N]", Version)
	}
	return nil
}

// GetCurrentVersion returns the application version.
func GetCurrentVersion() string {
	return Version
}
