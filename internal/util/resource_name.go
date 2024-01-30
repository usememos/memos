package util

import "regexp"

var (
	ResourceNameMatcher = regexp.MustCompile("^[a-zA-Z0-9]([a-zA-Z0-9-]{1,30}[a-zA-Z0-9])$")
)
