package base

import "regexp"

var (
	UIDMatcher = regexp.MustCompile("^[a-zA-Z0-9]([a-zA-Z0-9-]{0,34}[a-zA-Z0-9])?$")
)
