package idp

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestApplyIdentifierTransform(t *testing.T) {
	tests := []struct {
		name       string
		expression string
		identifier string
		want       string
		wantErr    bool
	}{
		{
			name:       "empty expression returns identifier unchanged",
			expression: "",
			identifier: "jane@gmail.com",
			want:       "jane@gmail.com",
		},
		{
			name:       "extract local part and lowercase",
			expression: `lower(split(identifier, "@")[0])`,
			identifier: "Jane.Doe@Gmail.com",
			want:       "jane.doe",
		},
		{
			name:       "replace dots with dashes",
			expression: `replace(lower(split(identifier, "@")[0]), ".", "-")`,
			identifier: "jane.doe@gmail.com",
			want:       "jane-doe",
		},
		{
			name:       "passthrough sub claim (no @ present)",
			expression: `identifier`,
			identifier: "abc-123-def",
			want:       "abc-123-def",
		},
		{
			name:       "expression returning empty string is an error",
			expression: `""`,
			identifier: "jane@gmail.com",
			wantErr:    true,
		},
		{
			name:       "runtime error propagates",
			expression: `split(identifier, "@")[5]`,
			identifier: "jane@gmail.com",
			wantErr:    true,
		},
		{
			name:       "invalid expression is an error",
			expression: `unknownFunc(identifier)`,
			identifier: "jane@gmail.com",
			wantErr:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ApplyIdentifierTransform(tt.expression, tt.identifier)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tt.want, got)
		})
	}
}

func TestValidateIdentifierTransform(t *testing.T) {
	require.NoError(t, ValidateIdentifierTransform(""))
	require.NoError(t, ValidateIdentifierTransform(`lower(split(identifier, "@")[0])`))
	require.Error(t, ValidateIdentifierTransform(`unknownFunc(identifier)`))
	require.Error(t, ValidateIdentifierTransform(`123 +`))
}

func TestApplyIdentifierTransform_RejectsOversizedExpression(t *testing.T) {
	oversized := `identifier + "` + strings.Repeat("x", maxIdentifierTransformLength) + `"`
	require.Greater(t, len(oversized), maxIdentifierTransformLength)

	_, err := ApplyIdentifierTransform(oversized, "jane")
	require.Error(t, err)
	require.Contains(t, err.Error(), "exceeds maximum length")

	require.Error(t, ValidateIdentifierTransform(oversized))
	require.Contains(t, ValidateIdentifierTransform(oversized).Error(), "exceeds maximum length")
}

func TestApplyIdentifierTransform_RejectsOversizedOutput(t *testing.T) {
	// Build an expression well within the input length cap that produces an
	// output larger than maxTransformOutputLength. repeat() is a standard
	// expr-lang built-in and safe to call at compile time.
	expression := `repeat(identifier, 100)`

	_, err := ApplyIdentifierTransform(expression, "abcdefghij")
	require.Error(t, err)
	require.Contains(t, err.Error(), "output exceeds maximum length")
}

func TestApplyIdentifierTransform_RejectsComplexExpression(t *testing.T) {
	// MaxNodes caps AST size. Build an expression that intentionally exceeds
	// maxIdentifierTransformNodes so the compile step rejects it.
	var b strings.Builder
	b.WriteString("identifier")
	for i := 0; i < maxIdentifierTransformNodes; i++ {
		b.WriteString(` + "x"`)
	}
	expression := b.String()
	require.LessOrEqual(t, len(expression), maxIdentifierTransformLength)

	_, err := ApplyIdentifierTransform(expression, "a")
	require.Error(t, err)
	require.Contains(t, err.Error(), "invalid identifier transform expression")
}
