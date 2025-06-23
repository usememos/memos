package sqlite

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
			filter: `tag in ['tag1'] || content.contains('hello')`,
			want:   "(JSON_EXTRACT(`memo`.`payload`, '$.tags') LIKE ? OR `memo`.`content` LIKE ?)",
			args:   []any{`%"tag1"%`, "%hello%"},
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
			filter: `!pinned`,
			want:   "NOT (`memo`.`pinned` IS TRUE)",
			args:   []any{},
		},
		{
			filter: `creator_id == 101 || visibility in ["PUBLIC", "PRIVATE"]`,
			want:   "(`memo`.`creator_id` = ? OR `memo`.`visibility` IN (?,?))",
			args:   []any{int64(101), "PUBLIC", "PRIVATE"},
		},
		{
			filter: `has_task_list`,
			want:   "JSON_EXTRACT(`memo`.`payload`, '$.property.hasTaskList') IS TRUE",
			args:   []any{},
		},
		{
			filter: `has_task_list == true`,
			want:   "JSON_EXTRACT(`memo`.`payload`, '$.property.hasTaskList') = 1",
			args:   []any{},
		},
		{
			filter: `has_task_list != false`,
			want:   "JSON_EXTRACT(`memo`.`payload`, '$.property.hasTaskList') != 0",
			args:   []any{},
		},
		{
			filter: `has_task_list == false`,
			want:   "JSON_EXTRACT(`memo`.`payload`, '$.property.hasTaskList') = 0",
			args:   []any{},
		},
		{
			filter: `!has_task_list`,
			want:   "NOT (JSON_EXTRACT(`memo`.`payload`, '$.property.hasTaskList') IS TRUE)",
			args:   []any{},
		},
		{
			filter: `has_task_list && pinned`,
			want:   "(JSON_EXTRACT(`memo`.`payload`, '$.property.hasTaskList') IS TRUE AND `memo`.`pinned` IS TRUE)",
			args:   []any{},
		},
		{
			filter: `has_task_list && content.contains("todo")`,
			want:   "(JSON_EXTRACT(`memo`.`payload`, '$.property.hasTaskList') IS TRUE AND `memo`.`content` LIKE ?)",
			args:   []any{"%todo%"},
		},
		{
			filter: `created_ts > now() - 60 * 60 * 24`,
			want:   "`memo`.`created_ts` > ?",
			args:   []any{time.Now().Unix() - 60*60*24},
		},
		{
			filter: `size(tags) == 0`,
			want:   "JSON_ARRAY_LENGTH(COALESCE(JSON_EXTRACT(`memo`.`payload`, '$.tags'), JSON_ARRAY())) = ?",
			args:   []any{int64(0)},
		},
		{
			filter: `size(tags) > 0`,
			want:   "JSON_ARRAY_LENGTH(COALESCE(JSON_EXTRACT(`memo`.`payload`, '$.tags'), JSON_ARRAY())) > ?",
			args:   []any{int64(0)},
		},
		{
			filter: `"work" in tags`,
			want:   "JSON_EXTRACT(`memo`.`payload`, '$.tags') LIKE ?",
			args:   []any{`%"work"%`},
		},
		{
			filter: `size(tags) == 2`,
			want:   "JSON_ARRAY_LENGTH(COALESCE(JSON_EXTRACT(`memo`.`payload`, '$.tags'), JSON_ARRAY())) = ?",
			args:   []any{int64(2)},
		},
	}

	for _, tt := range tests {
		db := &DB{}
		parsedExpr, err := filter.Parse(tt.filter, filter.MemoFilterCELAttributes...)
		if err != nil {
			t.Logf("Failed to parse filter: %s, error: %v", tt.filter, err)
		}
		require.NoError(t, err)
		convertCtx := filter.NewConvertContext()
		err = db.ConvertExprToSQL(convertCtx, parsedExpr.GetExpr())
		if err != nil {
			t.Logf("Failed to convert filter: %s, error: %v", tt.filter, err)
		}
		require.NoError(t, err)
		require.Equal(t, tt.want, convertCtx.Buffer.String())
		require.Equal(t, tt.args, convertCtx.Args)
	}
}
