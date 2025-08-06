package postgres

import (
	"testing"
	"time"

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
			want:   "(memo.payload->'tags' @> jsonb_build_array($1::json) OR memo.payload->'tags' @> jsonb_build_array($2::json))",
			args:   []any{`"tag1"`, `"tag2"`},
		},
		{
			filter: `!(tag in ["tag1", "tag2"])`,
			want:   "NOT ((memo.payload->'tags' @> jsonb_build_array($1::json) OR memo.payload->'tags' @> jsonb_build_array($2::json)))",
			args:   []any{`"tag1"`, `"tag2"`},
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
			want:   "(memo.payload->'tags' @> jsonb_build_array($1::json) OR memo.content ILIKE $2)",
			args:   []any{`"tag1"`, "%hello%"},
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
			want:   "EXTRACT(EPOCH FROM TO_TIMESTAMP(memo.created_ts)) > $1",
			args:   []any{time.Now().Unix() - 60*60*24},
		},
		{
			filter: `size(tags) == 0`,
			want:   "jsonb_array_length(COALESCE(memo.payload->'tags', '[]'::jsonb)) = $1",
			args:   []any{int64(0)},
		},
		{
			filter: `size(tags) > 0`,
			want:   "jsonb_array_length(COALESCE(memo.payload->'tags', '[]'::jsonb)) > $1",
			args:   []any{int64(0)},
		},
		{
			filter: `"work" in tags`,
			want:   "memo.payload->'tags' @> jsonb_build_array($1::json)",
			args:   []any{"work"},
		},
		{
			filter: `size(tags) == 2`,
			want:   "jsonb_array_length(COALESCE(memo.payload->'tags', '[]'::jsonb)) = $1",
			args:   []any{int64(2)},
		},
		{
			filter: `has_link == true`,
			want:   "(memo.payload->'property'->>'hasLink')::boolean = $1",
			args:   []any{true},
		},
		{
			filter: `has_code == false`,
			want:   "(memo.payload->'property'->>'hasCode')::boolean = $1",
			args:   []any{false},
		},
		{
			filter: `has_incomplete_tasks != false`,
			want:   "(memo.payload->'property'->>'hasIncompleteTasks')::boolean != $1",
			args:   []any{false},
		},
		{
			filter: `has_link`,
			want:   "(memo.payload->'property'->>'hasLink')::boolean IS TRUE",
			args:   []any{},
		},
		{
			filter: `has_code`,
			want:   "(memo.payload->'property'->>'hasCode')::boolean IS TRUE",
			args:   []any{},
		},
		{
			filter: `has_incomplete_tasks`,
			want:   "(memo.payload->'property'->>'hasIncompleteTasks')::boolean IS TRUE",
			args:   []any{},
		},
	}

	for _, tt := range tests {
		parsedExpr, err := filter.Parse(tt.filter, filter.MemoFilterCELAttributes...)
		require.NoError(t, err)
		convertCtx := filter.NewConvertContext()
		converter := filter.NewCommonSQLConverterWithOffset(&filter.PostgreSQLDialect{}, convertCtx.ArgsOffset+len(convertCtx.Args))
		err = converter.ConvertExprToSQL(convertCtx, parsedExpr.GetExpr())
		require.NoError(t, err)
		require.Equal(t, tt.want, convertCtx.Buffer.String())
		require.Equal(t, tt.args, convertCtx.Args)
	}
}
