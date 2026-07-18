package base

import "regexp"

var (
	// ResourceIDMatcher matches new user-provided resource IDs per AIP-122.
	ResourceIDMatcher = regexp.MustCompile(`^[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$`)
	// UIDMatcher also accepts the previous 36-character format so existing
	// generated and persisted UIDs remain writable by the store layer.
	UIDMatcher = regexp.MustCompile(`^(?:[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?|[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,34}[a-zA-Z0-9])?)$`)
)
