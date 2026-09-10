package parser

// IsEmoji reports whether value is one fully qualified Unicode emoji sequence.
func IsEmoji(value string) bool {
	_, ok := emoji17FullyQualified[value]
	return ok
}
