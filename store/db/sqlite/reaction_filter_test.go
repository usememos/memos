package sqlite

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/plugin/filter"
)

func TestReactionConvertExprToSQL(t *testing.T) {
	tests := []struct {
		filter string
		want   string
		args   []any
	}{
		{
			filter: `content_id in ["memos/5atZAj8GcvkSuUA3X2KLaY"]`,
			want:   "`reaction`.`content_id` IN (?)",
			args:   []any{"memos/5atZAj8GcvkSuUA3X2KLaY"},
		},
		{
			filter: `content_id in ["memos/5atZAj8GcvkSuUA3X2KLaY", "memos/4EN8aEpcJ3MaK4ExHTpiTE"]`,
			want:   "`reaction`.`content_id` IN (?,?)",
			args:   []any{"memos/5atZAj8GcvkSuUA3X2KLaY", "memos/4EN8aEpcJ3MaK4ExHTpiTE"},
		},
	}

	for _, tt := range tests {
		parsedExpr, err := filter.Parse(tt.filter, filter.ReactionFilterCELAttributes...)
		require.NoError(t, err)
		convertCtx := filter.NewConvertContext()
		converter := filter.NewCommonSQLConverter(&filter.SQLiteDialect{})
		err = converter.ConvertExprToSQL(convertCtx, parsedExpr.GetExpr())
		require.NoError(t, err)
		require.Equal(t, tt.want, convertCtx.Buffer.String())
		require.Equal(t, tt.args, convertCtx.Args)
	}
}
