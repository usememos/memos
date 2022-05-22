package store

import (
	"database/sql"
	"memos/server/profile"
)

// Store provides database access to all raw objects
type Store struct {
	db      *sql.DB
	profile *profile.Profile
}

// New creates a new instance of Store
func New(db *sql.DB, profile *profile.Profile) *Store {
	return &Store{
		db:      db,
		profile: profile,
	}
}
