package db

import (
	"database/sql"
	"strings"
)

type Table struct {
	Name string
	SQL  string
}

//lint:ignore U1000 Ignore unused function temporarily for debugging
func findTable(db *sql.DB, tableName string) (*Table, error) {
	where, args := []string{"1 = 1"}, []interface{}{}

	where, args = append(where, "type = ?"), append(args, "table")
	where, args = append(where, "name = ?"), append(args, tableName)

	rows, err := db.Query(`
		SELECT
			tbl_name,
			sql
		FROM sqlite_schema
		WHERE `+strings.Join(where, " AND "),
		args...,
	)
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

func createTable(db *sql.DB, sql string) error {
	result, err := db.Exec(sql)
	if err != nil {
		return err
	}

	_, err = result.RowsAffected()

	return err
}
