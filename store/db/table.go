package db

import (
	"fmt"
	"strings"
)

type Table struct {
	Name string
	SQL  string
}

func findTable(db *DB, tableName string) (*Table, error) {
	where, args := []string{"1 = 1"}, []interface{}{}

	where, args = append(where, "type = ?"), append(args, "table")
	where, args = append(where, "name = ?"), append(args, tableName)

	rows, err := db.Db.Query(`
		SELECT
			tbl_name,
			sql
		FROM sqlite_schema
		WHERE `+strings.Join(where, " AND "),
		args...,
	)
	if err != nil {
		return nil, FormatError(err)
	}
	defer rows.Close()

	tableList := make([]*Table, 0)
	for rows.Next() {
		var table Table
		if err := rows.Scan(
			&table.Name,
			&table.SQL,
		); err != nil {
			return nil, FormatError(err)
		}

		tableList = append(tableList, &table)
	}

	if err := rows.Err(); err != nil {
		return nil, FormatError(err)
	}

	if len(tableList) == 0 {
		return nil, nil
	} else {
		return tableList[0], nil
	}
}

func createTable(db *DB, sql string) error {
	result, err := db.Db.Exec(sql)

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("failed to create table with %s", sql)
	}

	return err
}
