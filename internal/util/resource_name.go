package util

import "regexp"

var (
	UIDMatcher = regexp.MustCompile("^[a-zA-Z0-9]([a-zA-Z0-9-]{0,30}[a-zA-Z0-9])?$")
)
