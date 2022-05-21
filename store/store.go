package store

import (
	"database/sql"
	"memos/common"
)

// Store provides database access to all raw objects
type Store struct {
	db      *sql.DB
	profile *common.Profile
}

// New creates a new instance of Store
func New(db *sql.DB, profile *common.Profile) *Store {
	return &Store{
		db:      db,
		profile: profile,
	}
}
