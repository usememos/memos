package sqlite

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
			want:   "(JSON_EXTRACT(`memo`.`payload`, '$.tags') LIKE ? OR JSON_EXTRACT(`memo`.`payload`, '$.tags') LIKE ?)",
			args:   []any{`%"tag1"%`, `%"tag2"%`},
		},
		{
			filter: `!(tag in ["tag1", "tag2"])`,
			want:   "NOT ((JSON_EXTRACT(`memo`.`payload`, '$.tags') LIKE ? OR JSON_EXTRACT(`memo`.`payload`, '$.tags') LIKE ?))",
			args:   []any{`%"tag1"%`, `%"tag2"%`},
		},
		{
			filter: `tag in ["tag1", "tag2"] || tag in ["tag3", "tag4"]`,
			want:   "((JSON_EXTRACT(`memo`.`payload`, '$.tags') LIKE ? OR JSON_EXTRACT(`memo`.`payload`, '$.tags') LIKE ?) OR (JSON_EXTRACT(`memo`.`payload`, '$.tags') LIKE ? OR JSON_EXTRACT(`memo`.`payload`, '$.tags') LIKE ?))",
			args:   []any{`%"tag1"%`, `%"tag2"%`, `%"tag3"%`, `%"tag4"%`},
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
			want:   "`memo`.`created_ts` = ?",
			args:   []any{int64(1136189045)},
		},
		{
			filter: `tag in ['tag1'] || content.contains('hello')`,
			want:   "(JSON_EXTRACT(`memo`.`payload`, '$.tags') LIKE ? OR `memo`.`content` LIKE ?)",
			args:   []any{`%"tag1"%`, "%hello%"},
		},
		{
			filter: `1`,
			want:   "",
			args:   []any{},
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
