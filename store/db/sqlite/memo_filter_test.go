package sqlite

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/plugin/filter"
)

func TestRestoreExprToSQL(t *testing.T) {
	tests := []struct {
		filter string
		want   string
	}{
		{
			filter: `tag in ["tag1", "tag2"]`,
			want:   "(JSON_EXTRACT(`memo`.`payload`, '$.tags') LIKE '%\"tag1\"%' OR JSON_EXTRACT(`memo`.`payload`, '$.tags') LIKE '%\"tag2\"%')",
		},
		{
			filter: `!(tag in ["tag1", "tag2"])`,
			want:   "NOT ((JSON_EXTRACT(`memo`.`payload`, '$.tags') LIKE '%\"tag1\"%' OR JSON_EXTRACT(`memo`.`payload`, '$.tags') LIKE '%\"tag2\"%'))",
		},
		{
			filter: `tag in ["tag1", "tag2"] || tag in ["tag3", "tag4"]`,
			want:   "((JSON_EXTRACT(`memo`.`payload`, '$.tags') LIKE '%\"tag1\"%' OR JSON_EXTRACT(`memo`.`payload`, '$.tags') LIKE '%\"tag2\"%') OR (JSON_EXTRACT(`memo`.`payload`, '$.tags') LIKE '%\"tag3\"%' OR JSON_EXTRACT(`memo`.`payload`, '$.tags') LIKE '%\"tag4\"%'))",
		},
		{
			filter: `content.contains("memos")`,
			want:   "`memo`.`content` LIKE '%memos%'",
		},
		{
			filter: `visibility in ["PUBLIC"]`,
			want:   "`memo`.`visibility` = \"PUBLIC\"",
		},
		{
			filter: `visibility in ["PUBLIC", "PRIVATE"]`,
			want:   "`memo`.`visibility` IN (\"PUBLIC\",\"PRIVATE\")",
		},
		{
			filter: `create_time == "2006-01-02T15:04:05+07:00"`,
			want:   "`memo`.`created_ts` = 1136189045",
		},
		{
			filter: `tag in ['tag1'] || content.contains('hello')`,
			want:   "(JSON_EXTRACT(`memo`.`payload`, '$.tags') LIKE '%\"tag1\"%' OR `memo`.`content` LIKE '%hello%')",
		},
	}

	for _, tt := range tests {
		parsedExpr, err := filter.Parse(tt.filter, filter.MemoFilterCELAttributes...)
		require.NoError(t, err)
		result, err := RestoreExprToSQL(parsedExpr.GetExpr())
		require.NoError(t, err)
		require.Equal(t, tt.want, result)
	}
}
