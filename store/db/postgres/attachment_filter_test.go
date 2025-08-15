package postgres

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/plugin/filter"
)

func TestAttachmentConvertExprToSQL(t *testing.T) {
	tests := []struct {
		filter string
		want   string
		args   []any
	}{
		{
			filter: `memo_id in ["5atZAj8GcvkSuUA3X2KLaY"]`,
			want:   "resource.memo_id IN ($1)",
			args:   []any{"5atZAj8GcvkSuUA3X2KLaY"},
		},
		{
			filter: `memo_id in ["5atZAj8GcvkSuUA3X2KLaY", "4EN8aEpcJ3MaK4ExHTpiTE"]`,
			want:   "resource.memo_id IN ($1,$2)",
			args:   []any{"5atZAj8GcvkSuUA3X2KLaY", "4EN8aEpcJ3MaK4ExHTpiTE"},
		},
	}

	for _, tt := range tests {
		parsedExpr, err := filter.Parse(tt.filter, filter.AttachmentFilterCELAttributes...)
		require.NoError(t, err)
		convertCtx := filter.NewConvertContext()
		converter := filter.NewCommonSQLConverter(&filter.PostgreSQLDialect{})
		err = converter.ConvertExprToSQL(convertCtx, parsedExpr.GetExpr())
		require.NoError(t, err)
		require.Equal(t, tt.want, convertCtx.Buffer.String())
		require.Equal(t, tt.args, convertCtx.Args)
	}
}
