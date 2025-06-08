package postgres

import (
	"testing"
	"time"

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
			want:   "(memo.payload->'tags' @> jsonb_build_array($1) OR memo.payload->'tags' @> jsonb_build_array($2))",
			args:   []any{"tag1", "tag2"},
		},
		{
			filter: `!(tag in ["tag1", "tag2"])`,
			want:   `NOT ((memo.payload->'tags' @> jsonb_build_array($1) OR memo.payload->'tags' @> jsonb_build_array($2)))`,
			args:   []any{"tag1", "tag2"},
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
			filter: `tag in ['tag1'] || content.contains('hello')`,
			want:   "(memo.payload->'tags' @> jsonb_build_array($1) OR memo.content ILIKE $2)",
			args:   []any{"tag1", "%hello%"},
		},
		{
			filter: `1`,
			want:   "",
			args:   []any{},
		},
		{
			filter: `pinned`,
			want:   "memo.pinned IS TRUE",
			args:   []any{},
		},
		{
			filter: `has_task_list`,
			want:   "(memo.payload->'property'->>'hasTaskList')::boolean IS TRUE",
			args:   []any{},
		},
		{
			filter: `has_task_list == true`,
			want:   "(memo.payload->'property'->>'hasTaskList')::boolean = $1",
			args:   []any{true},
		},
		{
			filter: `has_task_list != false`,
			want:   "(memo.payload->'property'->>'hasTaskList')::boolean != $1",
			args:   []any{false},
		},
		{
			filter: `has_task_list == false`,
			want:   "(memo.payload->'property'->>'hasTaskList')::boolean = $1",
			args:   []any{false},
		},
		{
			filter: `!has_task_list`,
			want:   "NOT ((memo.payload->'property'->>'hasTaskList')::boolean IS TRUE)",
			args:   []any{},
		},
		{
			filter: `has_task_list && pinned`,
			want:   "((memo.payload->'property'->>'hasTaskList')::boolean IS TRUE AND memo.pinned IS TRUE)",
			args:   []any{},
		},
		{
			filter: `has_task_list && content.contains("todo")`,
			want:   "((memo.payload->'property'->>'hasTaskList')::boolean IS TRUE AND memo.content ILIKE $1)",
			args:   []any{"%todo%"},
		},
		{
			filter: `created_ts > now() - 60 * 60 * 24`,
			want:   "EXTRACT(EPOCH FROM memo.created_ts) > $1",
			args:   []any{time.Now().Unix() - 60*60*24},
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
