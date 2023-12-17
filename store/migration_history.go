package store

type MigrationHistory struct {
	Version   string
	CreatedTs int64
}

type UpsertMigrationHistory struct {
	Version string
}

type FindMigrationHistory struct {
}
