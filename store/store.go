package store

// Store provides database access to all raw objects
type Store struct {
	db *DB
}

// New creates a new instance of Store
func New(db *DB) *Store {
	return &Store{
		db: db,
	}
}
