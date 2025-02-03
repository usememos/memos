package filter

import (
	"strings"
)

type ConvertContext struct {
	Buffer strings.Builder
	Args   []any
	// The offset of the next argument in the condition string.
	// Mainly using for PostgreSQL.
	ArgsOffset int
}

func NewConvertContext() *ConvertContext {
	return &ConvertContext{
		Buffer: strings.Builder{},
		Args:   []any{},
	}
}
