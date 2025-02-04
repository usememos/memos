package mysql

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/plugin/filter"
)

func TestConvertExprToSQL(t *testing.T) {
	tests := []struct {
		filter string
		want   string
		args   []any
	}{
		{
			filter: `tag in ["tag1", "tag2"]`,
			want:   "(JSON_CONTAINS(JSON_EXTRACT(`memo`.`payload`, '$.tags'), ?) OR JSON_CONTAINS(JSON_EXTRACT(`memo`.`payload`, '$.tags'), ?))",
			args:   []any{"tag1", "tag2"},
		},
		{
			filter: `!(tag in ["tag1", "tag2"])`,
			want:   "NOT ((JSON_CONTAINS(JSON_EXTRACT(`memo`.`payload`, '$.tags'), ?) OR JSON_CONTAINS(JSON_EXTRACT(`memo`.`payload`, '$.tags'), ?)))",
			args:   []any{"tag1", "tag2"},
		},
		{
			filter: `content.contains("memos")`,
			want:   "`memo`.`content` LIKE ?",
			args:   []any{"%memos%"},
		},
		{
			filter: `visibility in ["PUBLIC"]`,
			want:   "`memo`.`visibility` IN (?)",
			args:   []any{"PUBLIC"},
		},
		{
			filter: `visibility in ["PUBLIC", "PRIVATE"]`,
			want:   "`memo`.`visibility` IN (?,?)",
			args:   []any{"PUBLIC", "PRIVATE"},
		},
		{
			filter: `create_time == "2006-01-02T15:04:05+07:00"`,
			want:   "UNIX_TIMESTAMP(`memo`.`created_ts`) = ?",
			args:   []any{int64(1136189045)},
		},
		{
			filter: `tag in ['tag1'] || content.contains('hello')`,
			want:   "(JSON_CONTAINS(JSON_EXTRACT(`memo`.`payload`, '$.tags'), ?) OR `memo`.`content` LIKE ?)",
			args:   []any{"tag1", "%hello%"},
		},
	}

	for _, tt := range tests {
		db := &DB{}
		parsedExpr, err := filter.Parse(tt.filter, filter.MemoFilterCELAttributes...)
		require.NoError(t, err)
		convertCtx := filter.NewConvertContext()
		err = db.ConvertExprToSQL(convertCtx, parsedExpr.GetExpr())
		require.NoError(t, err)
		require.Equal(t, tt.want, convertCtx.Buffer.String())
		require.Equal(t, tt.args, convertCtx.Args)
	}
}
