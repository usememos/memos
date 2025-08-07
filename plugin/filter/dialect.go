package filter

import (
	"fmt"
	"strings"
)

// SQLDialect defines database-specific SQL generation methods.
type SQLDialect interface {
	// Basic field access
	GetTablePrefix(entityName string) string
	GetParameterPlaceholder(index int) string

	// JSON operations
	GetJSONExtract(path string) string
	GetJSONArrayLength(path string) string
	GetJSONContains(path, element string) string
	GetJSONLike(path, pattern string) string

	// Boolean operations
	GetBooleanValue(value bool) interface{}
	GetBooleanComparison(path string, value bool) string
	GetBooleanCheck(path string) string

	// Timestamp operations
	GetTimestampComparison(field string) string
	GetCurrentTimestamp() string
}

// DatabaseType represents the type of database.
type DatabaseType string

const (
	SQLite     DatabaseType = "sqlite"
	MySQL      DatabaseType = "mysql"
	PostgreSQL DatabaseType = "postgres"
)

// GetDialect returns the appropriate dialect for the database type.
func GetDialect(dbType DatabaseType) SQLDialect {
	switch dbType {
	case SQLite:
		return &SQLiteDialect{}
	case MySQL:
		return &MySQLDialect{}
	case PostgreSQL:
		return &PostgreSQLDialect{}
	default:
		return &SQLiteDialect{} // default fallback
	}
}

// SQLiteDialect implements SQLDialect for SQLite.
type SQLiteDialect struct{}

func (*SQLiteDialect) GetTablePrefix(entityName string) string {
	return fmt.Sprintf("`%s`", entityName)
}

func (*SQLiteDialect) GetParameterPlaceholder(_ int) string {
	return "?"
}

func (d *SQLiteDialect) GetJSONExtract(path string) string {
	return fmt.Sprintf("JSON_EXTRACT(%s.`payload`, '%s')", d.GetTablePrefix("memo"), path)
}

func (d *SQLiteDialect) GetJSONArrayLength(path string) string {
	return fmt.Sprintf("JSON_ARRAY_LENGTH(COALESCE(%s, JSON_ARRAY()))", d.GetJSONExtract(path))
}

func (d *SQLiteDialect) GetJSONContains(path, _ string) string {
	return fmt.Sprintf("%s LIKE ?", d.GetJSONExtract(path))
}

func (d *SQLiteDialect) GetJSONLike(path, _ string) string {
	return fmt.Sprintf("%s LIKE ?", d.GetJSONExtract(path))
}

func (*SQLiteDialect) GetBooleanValue(value bool) interface{} {
	if value {
		return 1
	}
	return 0
}

func (d *SQLiteDialect) GetBooleanComparison(path string, value bool) string {
	if value {
		return fmt.Sprintf("%s = 1", d.GetJSONExtract(path))
	}
	return fmt.Sprintf("%s = 0", d.GetJSONExtract(path))
}

func (d *SQLiteDialect) GetBooleanCheck(path string) string {
	return fmt.Sprintf("%s IS TRUE", d.GetJSONExtract(path))
}

func (d *SQLiteDialect) GetTimestampComparison(field string) string {
	return fmt.Sprintf("%s.`%s`", d.GetTablePrefix("memo"), field)
}

func (*SQLiteDialect) GetCurrentTimestamp() string {
	return "strftime('%s', 'now')"
}

// MySQLDialect implements SQLDialect for MySQL.
type MySQLDialect struct{}

func (*MySQLDialect) GetTablePrefix(entityName string) string {
	return fmt.Sprintf("`%s`", entityName)
}

func (*MySQLDialect) GetParameterPlaceholder(_ int) string {
	return "?"
}

func (d *MySQLDialect) GetJSONExtract(path string) string {
	return fmt.Sprintf("JSON_EXTRACT(%s.`payload`, '%s')", d.GetTablePrefix("memo"), path)
}

func (d *MySQLDialect) GetJSONArrayLength(path string) string {
	return fmt.Sprintf("JSON_LENGTH(COALESCE(%s, JSON_ARRAY()))", d.GetJSONExtract(path))
}

func (d *MySQLDialect) GetJSONContains(path, _ string) string {
	return fmt.Sprintf("JSON_CONTAINS(%s, ?)", d.GetJSONExtract(path))
}

func (d *MySQLDialect) GetJSONLike(path, _ string) string {
	return fmt.Sprintf("%s LIKE ?", d.GetJSONExtract(path))
}

func (*MySQLDialect) GetBooleanValue(value bool) interface{} {
	return value
}

func (d *MySQLDialect) GetBooleanComparison(path string, value bool) string {
	if value {
		return fmt.Sprintf("%s = CAST('true' AS JSON)", d.GetJSONExtract(path))
	}
	return fmt.Sprintf("%s != CAST('true' AS JSON)", d.GetJSONExtract(path))
}

func (d *MySQLDialect) GetBooleanCheck(path string) string {
	return fmt.Sprintf("%s = CAST('true' AS JSON)", d.GetJSONExtract(path))
}

func (d *MySQLDialect) GetTimestampComparison(field string) string {
	return fmt.Sprintf("UNIX_TIMESTAMP(%s.`%s`)", d.GetTablePrefix("memo"), field)
}

func (*MySQLDialect) GetCurrentTimestamp() string {
	return "UNIX_TIMESTAMP()"
}

// PostgreSQLDialect implements SQLDialect for PostgreSQL.
type PostgreSQLDialect struct{}

func (*PostgreSQLDialect) GetTablePrefix(entityName string) string {
	return entityName
}

func (*PostgreSQLDialect) GetParameterPlaceholder(index int) string {
	return fmt.Sprintf("$%d", index)
}

func (d *PostgreSQLDialect) GetJSONExtract(path string) string {
	// Convert $.property.hasTaskList to memo.payload->'property'->>'hasTaskList'
	parts := strings.Split(strings.TrimPrefix(path, "$."), ".")
	result := fmt.Sprintf("%s.payload", d.GetTablePrefix("memo"))
	for i, part := range parts {
		if i == len(parts)-1 {
			result += fmt.Sprintf("->>'%s'", part)
		} else {
			result += fmt.Sprintf("->'%s'", part)
		}
	}
	return result
}

func (d *PostgreSQLDialect) GetJSONArrayLength(path string) string {
	jsonPath := strings.Replace(path, "$.tags", "payload->'tags'", 1)
	return fmt.Sprintf("jsonb_array_length(COALESCE(%s.%s, '[]'::jsonb))", d.GetTablePrefix("memo"), jsonPath)
}

func (d *PostgreSQLDialect) GetJSONContains(path, _ string) string {
	jsonPath := strings.Replace(path, "$.tags", "payload->'tags'", 1)
	return fmt.Sprintf("%s.%s @> jsonb_build_array(?::json)", d.GetTablePrefix("memo"), jsonPath)
}

func (d *PostgreSQLDialect) GetJSONLike(path, _ string) string {
	jsonPath := strings.Replace(path, "$.tags", "payload->'tags'", 1)
	return fmt.Sprintf("%s.%s @> jsonb_build_array(?::json)", d.GetTablePrefix("memo"), jsonPath)
}

func (*PostgreSQLDialect) GetBooleanValue(value bool) interface{} {
	return value
}

func (d *PostgreSQLDialect) GetBooleanComparison(path string, _ bool) string {
	// Note: The parameter placeholder will be replaced by the caller
	return fmt.Sprintf("(%s)::boolean = ?", d.GetJSONExtract(path))
}

func (d *PostgreSQLDialect) GetBooleanCheck(path string) string {
	return fmt.Sprintf("(%s)::boolean IS TRUE", d.GetJSONExtract(path))
}

func (d *PostgreSQLDialect) GetTimestampComparison(field string) string {
	return fmt.Sprintf("EXTRACT(EPOCH FROM TO_TIMESTAMP(%s.%s))", d.GetTablePrefix("memo"), field)
}

func (*PostgreSQLDialect) GetCurrentTimestamp() string {
	return "EXTRACT(EPOCH FROM NOW())"
}
