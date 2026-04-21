package idp

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestApplyIdentifierTransform(t *testing.T) {
	tests := []struct {
		name        string
		expression  string
		identifier  string
		want        string
		wantErr     bool
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
