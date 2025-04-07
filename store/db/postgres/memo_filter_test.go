package postgres

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/plugin/filter"
)

func TestRestoreExprToSQL(t *testing.T) {
	tests := []struct {
		filter string
		want   string
		args   []any
	}{
		{
			filter: `tag in ["tag1", "tag2"]`,
			want:   "(memo.payload->'tags' @> $1::jsonb OR memo.payload->'tags' @> $2::jsonb)",
			args:   []any{[]any{"tag1"}, []any{"tag2"}},
		},
		{
			filter: `!(tag in ["tag1", "tag2"])`,
			want:   `NOT ((memo.payload->'tags' @> $1::jsonb OR memo.payload->'tags' @> $2::jsonb))`,
			args:   []any{[]any{"tag1"}, []any{"tag2"}},
		},
		{
			filter: `content.contains("memos")`,
			want:   "memo.content ILIKE $1",
			args:   []any{"%memos%"},
		},
		{
			filter: `visibility in ["PUBLIC"]`,
			want:   "memo.visibility IN ($1)",
			args:   []any{"PUBLIC"},
		},
		{
			filter: `visibility in ["PUBLIC", "PRIVATE"]`,
			want:   "memo.visibility IN ($1,$2)",
			args:   []any{"PUBLIC", "PRIVATE"},
		},
		{
			filter: `create_time == "2006-01-02T15:04:05+07:00"`,
			want:   "memo.created_ts = $1",
			args:   []any{int64(1136189045)},
		},
		{
			filter: `tag in ['tag1'] || content.contains('hello')`,
			want:   "(memo.payload->'tags' @> $1::jsonb OR memo.content ILIKE $2)",
			args:   []any{[]any{"tag1"}, "%hello%"},
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
