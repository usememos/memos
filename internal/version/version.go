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

// buildVersion matches release tags YY.MM.N[-rc.K] and development builds
// YY.MM.D-dev.<sha7>; scripts/release_version.sh accepts the same release tags.
var buildVersion = regexp.MustCompile(`^[1-9][0-9]\.(0[1-9]|1[0-2])\.(0|[1-9][0-9]*)(-rc\.[1-9][0-9]*|-dev\.[0-9a-f]{7})?$`)

func init() {
	if info, ok := debug.ReadBuildInfo(); ok {
		Version, Commit = resolveBuild(Version, Commit, info.Settings)
	}
}

// resolveBuild fills the version and commit from Go build settings. Without an
// injected version it derives YY.MM.D-dev.<sha7> from the commit time in UTC and
// the commit revision, matching scripts/release_version.sh development-version.
func resolveBuild(version, commit string, settings []debug.BuildSetting) (string, string) {
	var date, revision string
	for _, setting := range settings {
		switch setting.Key {
		case "vcs.time":
			if timestamp, err := time.Parse(time.RFC3339, setting.Value); err == nil {
				date = timestamp.UTC().Format("06.01.2")
			}
		case "vcs.revision":
			revision = setting.Value
			if commit == "" || commit == "unknown" {
				commit = revision
			}
		default:
		}
	}
	if version == "" && date != "" && len(revision) >= 7 {
		version = date + "-dev." + revision[:7]
	}
	return version, commit
}

// Validate checks that the build has a calendar version before it is exposed.
func Validate() error {
	if Version == "" {
		return errors.New("missing build version: use go run -buildvcs=true ./cmd/memos or inject internal/version.Version with -ldflags")
	}
	if !buildVersion.MatchString(Version) {
		return errors.Errorf("invalid build version %q: expected YY.MM.N[-rc.K] or YY.MM.D-dev.<sha7>", Version)
	}
	return nil
}

// GetCurrentVersion returns the application version.
func GetCurrentVersion() string {
	return Version
}
