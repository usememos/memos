package mysql

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
			want:   "(JSON_CONTAINS(JSON_EXTRACT(`memo`.`payload`, '$.tags'), ?) OR JSON_CONTAINS(JSON_EXTRACT(`memo`.`payload`, '$.tags'), ?))",
			args:   []any{`"tag1"`, `"tag2"`},
		},
		{
			filter: `!(tag in ["tag1", "tag2"])`,
			want:   "NOT ((JSON_CONTAINS(JSON_EXTRACT(`memo`.`payload`, '$.tags'), ?) OR JSON_CONTAINS(JSON_EXTRACT(`memo`.`payload`, '$.tags'), ?)))",
			args:   []any{`"tag1"`, `"tag2"`},
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
			filter: `tag in ['tag1'] || content.contains('hello')`,
			want:   "(JSON_CONTAINS(JSON_EXTRACT(`memo`.`payload`, '$.tags'), ?) OR `memo`.`content` LIKE ?)",
			args:   []any{`"tag1"`, "%hello%"},
		},
		{
			filter: `1`,
			want:   "",
			args:   []any{},
		},
		{
			filter: `pinned`,
			want:   "`memo`.`pinned` IS TRUE",
			args:   []any{},
		},
		{
			filter: `has_task_list`,
			want:   "JSON_EXTRACT(`memo`.`payload`, '$.property.hasTaskList') = CAST('true' AS JSON)",
			args:   []any{},
		},
		{
			filter: `has_task_list == true`,
			want:   "JSON_EXTRACT(`memo`.`payload`, '$.property.hasTaskList') = CAST('true' AS JSON)",
			args:   []any{},
		},
		{
			filter: `has_task_list != false`,
			want:   "JSON_EXTRACT(`memo`.`payload`, '$.property.hasTaskList') != CAST('false' AS JSON)",
			args:   []any{},
		},
		{
			filter: `has_task_list == false`,
			want:   "JSON_EXTRACT(`memo`.`payload`, '$.property.hasTaskList') = CAST('false' AS JSON)",
			args:   []any{},
		},
		{
			filter: `!has_task_list`,
			want:   "NOT (JSON_EXTRACT(`memo`.`payload`, '$.property.hasTaskList') = CAST('true' AS JSON))",
			args:   []any{},
		},
		{
			filter: `has_task_list && pinned`,
			want:   "(JSON_EXTRACT(`memo`.`payload`, '$.property.hasTaskList') = CAST('true' AS JSON) AND `memo`.`pinned` IS TRUE)",
			args:   []any{},
		},
		{
			filter: `has_task_list && content.contains("todo")`,
			want:   "(JSON_EXTRACT(`memo`.`payload`, '$.property.hasTaskList') = CAST('true' AS JSON) AND `memo`.`content` LIKE ?)",
			args:   []any{"%todo%"},
		},
		{
			filter: `created_ts > now() - 60 * 60 * 24`,
			want:   "UNIX_TIMESTAMP(`memo`.`created_ts`) > ?",
			args:   []any{time.Now().Unix() - 60*60*24},
		},
		{
			filter: `size(tags) == 0`,
			want:   "JSON_LENGTH(COALESCE(JSON_EXTRACT(`memo`.`payload`, '$.tags'), JSON_ARRAY())) = ?",
			args:   []any{int64(0)},
		},
		{
			filter: `size(tags) > 0`,
			want:   "JSON_LENGTH(COALESCE(JSON_EXTRACT(`memo`.`payload`, '$.tags'), JSON_ARRAY())) > ?",
			args:   []any{int64(0)},
		},
		{
			filter: `"work" in tags`,
			want:   "JSON_CONTAINS(JSON_EXTRACT(`memo`.`payload`, '$.tags'), ?)",
			args:   []any{"work"},
		},
		{
			filter: `size(tags) == 2`,
			want:   "JSON_LENGTH(COALESCE(JSON_EXTRACT(`memo`.`payload`, '$.tags'), JSON_ARRAY())) = ?",
			args:   []any{int64(2)},
		},
		{
			filter: `has_link == true`,
			want:   "JSON_EXTRACT(`memo`.`payload`, '$.property.hasLink') = CAST('true' AS JSON)",
			args:   []any{},
		},
		{
			filter: `has_code == false`,
			want:   "JSON_EXTRACT(`memo`.`payload`, '$.property.hasCode') = CAST('false' AS JSON)",
			args:   []any{},
		},
		{
			filter: `has_incomplete_tasks != false`,
			want:   "JSON_EXTRACT(`memo`.`payload`, '$.property.hasIncompleteTasks') != CAST('false' AS JSON)",
			args:   []any{},
		},
		{
			filter: `has_link`,
			want:   "JSON_EXTRACT(`memo`.`payload`, '$.property.hasLink') = CAST('true' AS JSON)",
			args:   []any{},
		},
		{
			filter: `has_code`,
			want:   "JSON_EXTRACT(`memo`.`payload`, '$.property.hasCode') = CAST('true' AS JSON)",
			args:   []any{},
		},
		{
			filter: `has_incomplete_tasks`,
			want:   "JSON_EXTRACT(`memo`.`payload`, '$.property.hasIncompleteTasks') = CAST('true' AS JSON)",
			args:   []any{},
		},
	}

	for _, tt := range tests {
		parsedExpr, err := filter.Parse(tt.filter, filter.MemoFilterCELAttributes...)
		require.NoError(t, err)
		convertCtx := filter.NewConvertContext()
		converter := filter.NewCommonSQLConverter(&filter.MySQLDialect{})
		err = converter.ConvertExprToSQL(convertCtx, parsedExpr.GetExpr())
		require.NoError(t, err)
		require.Equal(t, tt.want, convertCtx.Buffer.String())
		require.Equal(t, tt.args, convertCtx.Args)
	}
}
