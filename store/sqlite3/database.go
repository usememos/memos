package sqlite3

import (
	"database/sql"

	"github.com/usememos/memos/store"
)

type Database struct {
	db *sql.DB
}

func New(db *sql.DB) store.Database {
	return &Database{db: db}
}
