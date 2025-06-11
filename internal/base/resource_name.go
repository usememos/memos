package base

import "regexp"

var (
	UIDMatcher = regexp.MustCompile("^[a-zA-Z0-9]([a-zA-Z0-9-_\.]{0,30}[a-zA-Z0-9])?$")
)
