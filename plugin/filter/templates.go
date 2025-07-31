package filter

import (
	"fmt"
)

// SQLTemplate holds database-specific SQL fragments.
type SQLTemplate struct {
	SQLite     string
	MySQL      string
	PostgreSQL string
}

// TemplateDBType represents the database type for templates.
type TemplateDBType string

const (
	SQLiteTemplate     TemplateDBType = "sqlite"
	MySQLTemplate      TemplateDBType = "mysql"
	PostgreSQLTemplate TemplateDBType = "postgres"
)

// SQLTemplates contains common SQL patterns for different databases.
var SQLTemplates = map[string]SQLTemplate{
	"json_extract": {
		SQLite:     "JSON_EXTRACT(`memo`.`payload`, '%s')",
		MySQL:      "JSON_EXTRACT(`memo`.`payload`, '%s')",
		PostgreSQL: "memo.payload%s",
	},
	"json_array_length": {
		SQLite:     "JSON_ARRAY_LENGTH(COALESCE(JSON_EXTRACT(`memo`.`payload`, '$.tags'), JSON_ARRAY()))",
		MySQL:      "JSON_LENGTH(COALESCE(JSON_EXTRACT(`memo`.`payload`, '$.tags'), JSON_ARRAY()))",
		PostgreSQL: "jsonb_array_length(COALESCE(memo.payload->'tags', '[]'::jsonb))",
	},
	"json_contains_element": {
		SQLite:     "JSON_EXTRACT(`memo`.`payload`, '$.tags') LIKE ?",
		MySQL:      "JSON_CONTAINS(JSON_EXTRACT(`memo`.`payload`, '$.tags'), ?)",
		PostgreSQL: "memo.payload->'tags' @> jsonb_build_array(?)",
	},
	"json_contains_tag": {
		SQLite:     "JSON_EXTRACT(`memo`.`payload`, '$.tags') LIKE ?",
		MySQL:      "JSON_CONTAINS(JSON_EXTRACT(`memo`.`payload`, '$.tags'), ?)",
		PostgreSQL: "memo.payload->'tags' @> jsonb_build_array(?)",
	},
	"boolean_true": {
		SQLite:     "JSON_EXTRACT(`memo`.`payload`, '$.property.hasTaskList') = 1",
		MySQL:      "JSON_EXTRACT(`memo`.`payload`, '$.property.hasTaskList') = CAST('true' AS JSON)",
		PostgreSQL: "(memo.payload->'property'->>'hasTaskList')::boolean = true",
	},
	"boolean_false": {
		SQLite:     "JSON_EXTRACT(`memo`.`payload`, '$.property.hasTaskList') = 0",
		MySQL:      "JSON_EXTRACT(`memo`.`payload`, '$.property.hasTaskList') = CAST('false' AS JSON)",
		PostgreSQL: "(memo.payload->'property'->>'hasTaskList')::boolean = false",
	},
	"boolean_not_true": {
		SQLite:     "JSON_EXTRACT(`memo`.`payload`, '$.property.hasTaskList') != 1",
		MySQL:      "JSON_EXTRACT(`memo`.`payload`, '$.property.hasTaskList') != CAST('true' AS JSON)",
		PostgreSQL: "(memo.payload->'property'->>'hasTaskList')::boolean != true",
	},
	"boolean_not_false": {
		SQLite:     "JSON_EXTRACT(`memo`.`payload`, '$.property.hasTaskList') != 0",
		MySQL:      "JSON_EXTRACT(`memo`.`payload`, '$.property.hasTaskList') != CAST('false' AS JSON)",
		PostgreSQL: "(memo.payload->'property'->>'hasTaskList')::boolean != false",
	},
	"boolean_compare": {
		SQLite:     "JSON_EXTRACT(`memo`.`payload`, '$.property.hasTaskList') %s ?",
		MySQL:      "JSON_EXTRACT(`memo`.`payload`, '$.property.hasTaskList') %s CAST(? AS JSON)",
		PostgreSQL: "(memo.payload->'property'->>'hasTaskList')::boolean %s ?",
	},
	"boolean_check": {
		SQLite:     "JSON_EXTRACT(`memo`.`payload`, '$.property.hasTaskList') IS TRUE",
		MySQL:      "JSON_EXTRACT(`memo`.`payload`, '$.property.hasTaskList') = CAST('true' AS JSON)",
		PostgreSQL: "(memo.payload->'property'->>'hasTaskList')::boolean IS TRUE",
	},
	"table_prefix": {
		SQLite:     "`memo`",
		MySQL:      "`memo`",
		PostgreSQL: "memo",
	},
	"timestamp_field": {
		SQLite:     "`memo`.`%s`",
		MySQL:      "UNIX_TIMESTAMP(`memo`.`%s`)",
		PostgreSQL: "EXTRACT(EPOCH FROM memo.%s)",
	},
	"content_like": {
		SQLite:     "`memo`.`content` LIKE ?",
		MySQL:      "`memo`.`content` LIKE ?",
		PostgreSQL: "memo.content ILIKE ?",
	},
	"visibility_in": {
		SQLite:     "`memo`.`visibility` IN (%s)",
		MySQL:      "`memo`.`visibility` IN (%s)",
		PostgreSQL: "memo.visibility IN (%s)",
	},
}

// GetSQL returns the appropriate SQL for the given template and database type.
func GetSQL(templateName string, dbType TemplateDBType) string {
	template, exists := SQLTemplates[templateName]
	if !exists {
		return ""
	}

	switch dbType {
	case SQLiteTemplate:
		return template.SQLite
	case MySQLTemplate:
		return template.MySQL
	case PostgreSQLTemplate:
		return template.PostgreSQL
	default:
		return template.SQLite
	}
}

// GetParameterPlaceholder returns the appropriate parameter placeholder for the database.
func GetParameterPlaceholder(dbType TemplateDBType, index int) string {
	switch dbType {
	case PostgreSQLTemplate:
		return fmt.Sprintf("$%d", index)
	default:
		return "?"
	}
}

// GetParameterValue returns the appropriate parameter value for the database.
func GetParameterValue(dbType TemplateDBType, templateName string, value interface{}) interface{} {
	switch templateName {
	case "json_contains_element", "json_contains_tag":
		if dbType == SQLiteTemplate {
			return fmt.Sprintf(`%%"%s"%%`, value)
		}
		return value
	default:
		return value
	}
}

// FormatPlaceholders formats a list of placeholders for the given database type.
func FormatPlaceholders(dbType TemplateDBType, count int, startIndex int) []string {
	placeholders := make([]string, count)
	for i := 0; i < count; i++ {
		placeholders[i] = GetParameterPlaceholder(dbType, startIndex+i)
	}
	return placeholders
}
