package store

// MigrationHistory represents a record in the migration_history table.
// NOTE: The migration_history table is deprecated in favor of storing schema version
// in workspace_setting (BASIC setting). This is kept for backward compatibility only.
// Migration from migration_history to workspace_setting happens automatically during startup.
type MigrationHistory struct {
	Version   string
	CreatedTs int64
}

// UpsertMigrationHistory is used to insert or update a migration history record.
// NOTE: This is deprecated along with the migration_history table.
type UpsertMigrationHistory struct {
	Version string
}

// FindMigrationHistory is used to query migration history records.
// NOTE: This is deprecated along with the migration_history table.
type FindMigrationHistory struct {
}
