package sqlite

import (
	"database/sql"

	"github.com/usememos/memos/store"
)

type Driver struct {
	db *sql.DB
}

func NewDriver(db *sql.DB) store.Driver {
	return &Driver{db: db}
}
