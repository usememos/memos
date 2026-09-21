package version

// Version is set by release builds and defaults to a development build marker.
var Version = "dev"

// Commit is set by CI builds and defaults to an unknown revision marker.
var Commit = "unknown"

func GetCurrentVersion() string {
	return Version
}
