package db

import (
	"context"
	"database/sql"
	"strings"
)

type Table struct {
	Name string
	SQL  string
}

//lint:ignore U1000 Ignore unused function temporarily for debugging
//nolint:all
func findTable(ctx context.Context, tx *sql.Tx, tableName string) (*Table, error) {
	where, args := []string{"1 = 1"}, []interface{}{}

	where, args = append(where, "type = ?"), append(args, "table")
	where, args = append(where, "name = ?"), append(args, tableName)

	query := `
		SELECT
			tbl_name,
			sql
		FROM sqlite_schema
		WHERE ` + strings.Join(where, " AND ")
	rows, err := tx.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tableList := make([]*Table, 0)
	for rows.Next() {
		var table Table
		if err := rows.Scan(
			&table.Name,
			&table.SQL,
		); err != nil {
			return nil, err
		}

		tableList = append(tableList, &table)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	if len(tableList) == 0 {
		return nil, nil
	} else {
		return tableList[0], nil
	}
}

func createTable(ctx context.Context, tx *sql.Tx, stmt string) error {
	_, err := tx.ExecContext(ctx, stmt)
	if err != nil {
		return err
	}

	return nil
}
