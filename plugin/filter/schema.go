package filter

import (
	"fmt"
	"time"

	"github.com/google/cel-go/cel"
	"github.com/google/cel-go/common/types"
	"github.com/google/cel-go/common/types/ref"
)

// DialectName enumerates supported SQL dialects.
type DialectName string

const (
	DialectSQLite   DialectName = "sqlite"
	DialectMySQL    DialectName = "mysql"
	DialectPostgres DialectName = "postgres"
)

// FieldType represents the logical type of a field.
type FieldType string

const (
	FieldTypeString    FieldType = "string"
	FieldTypeInt       FieldType = "int"
	FieldTypeBool      FieldType = "bool"
	FieldTypeTimestamp FieldType = "timestamp"
)

// FieldKind describes how a field is stored.
type FieldKind string

const (
	FieldKindScalar       FieldKind = "scalar"
	FieldKindBoolColumn   FieldKind = "bool_column"
	FieldKindJSONBool     FieldKind = "json_bool"
	FieldKindJSONList     FieldKind = "json_list"
	FieldKindVirtualAlias FieldKind = "virtual_alias"
)

// Column identifies the backing table column.
type Column struct {
	Table string
	Name  string
}

// Field captures the schema metadata for an exposed CEL identifier.
type Field struct {
	Name                 string
	Kind                 FieldKind
	Type                 FieldType
	Column               Column
	JSONPath             []string
	AliasFor             string
	SupportsContains     bool
	Expressions          map[DialectName]string
	AllowedComparisonOps map[ComparisonOperator]bool
}

// Schema collects CEL environment options and field metadata.
type Schema struct {
	Name       string
	Fields     map[string]Field
	EnvOptions []cel.EnvOption
}

// Field returns the field metadata if present.
func (s Schema) Field(name string) (Field, bool) {
	f, ok := s.Fields[name]
	return f, ok
}

// ResolveAlias resolves a virtual alias to its target field.
func (s Schema) ResolveAlias(name string) (Field, bool) {
	field, ok := s.Fields[name]
	if !ok {
		return Field{}, false
	}
	if field.Kind == FieldKindVirtualAlias {
		target, ok := s.Fields[field.AliasFor]
		if !ok {
			return Field{}, false
		}
		return target, true
	}
	return field, true
}

var nowFunction = cel.Function("now",
	cel.Overload("now",
		[]*cel.Type{},
		cel.IntType,
		cel.FunctionBinding(func(_ ...ref.Val) ref.Val {
			return types.Int(time.Now().Unix())
		}),
	),
)

// NewSchema constructs the memo filter schema and CEL environment.
func NewSchema() Schema {
	fields := map[string]Field{
		"content": {
			Name:             "content",
			Kind:             FieldKindScalar,
			Type:             FieldTypeString,
			Column:           Column{Table: "memo", Name: "content"},
			SupportsContains: true,
			Expressions:      map[DialectName]string{},
		},
		"creator_id": {
			Name:        "creator_id",
			Kind:        FieldKindScalar,
			Type:        FieldTypeInt,
			Column:      Column{Table: "memo", Name: "creator_id"},
			Expressions: map[DialectName]string{},
			AllowedComparisonOps: map[ComparisonOperator]bool{
				CompareEq:  true,
				CompareNeq: true,
			},
		},
		"created_ts": {
			Name:   "created_ts",
			Kind:   FieldKindScalar,
			Type:   FieldTypeTimestamp,
			Column: Column{Table: "memo", Name: "created_ts"},
			Expressions: map[DialectName]string{
				// MySQL stores created_ts as TIMESTAMP, needs conversion to epoch
				DialectMySQL: "UNIX_TIMESTAMP(%s)",
				// PostgreSQL and SQLite store created_ts as BIGINT (epoch), no conversion needed
				DialectPostgres: "%s",
				DialectSQLite:   "%s",
			},
		},
		"updated_ts": {
			Name:   "updated_ts",
			Kind:   FieldKindScalar,
			Type:   FieldTypeTimestamp,
			Column: Column{Table: "memo", Name: "updated_ts"},
			Expressions: map[DialectName]string{
				// MySQL stores updated_ts as TIMESTAMP, needs conversion to epoch
				DialectMySQL: "UNIX_TIMESTAMP(%s)",
				// PostgreSQL and SQLite store updated_ts as BIGINT (epoch), no conversion needed
				DialectPostgres: "%s",
				DialectSQLite:   "%s",
			},
		},
		"pinned": {
			Name:        "pinned",
			Kind:        FieldKindBoolColumn,
			Type:        FieldTypeBool,
			Column:      Column{Table: "memo", Name: "pinned"},
			Expressions: map[DialectName]string{},
			AllowedComparisonOps: map[ComparisonOperator]bool{
				CompareEq:  true,
				CompareNeq: true,
			},
		},
		"visibility": {
			Name:        "visibility",
			Kind:        FieldKindScalar,
			Type:        FieldTypeString,
			Column:      Column{Table: "memo", Name: "visibility"},
			Expressions: map[DialectName]string{},
			AllowedComparisonOps: map[ComparisonOperator]bool{
				CompareEq:  true,
				CompareNeq: true,
			},
		},
		"tags": {
			Name:     "tags",
			Kind:     FieldKindJSONList,
			Type:     FieldTypeString,
			Column:   Column{Table: "memo", Name: "payload"},
			JSONPath: []string{"tags"},
		},
		"tag": {
			Name:     "tag",
			Kind:     FieldKindVirtualAlias,
			Type:     FieldTypeString,
			AliasFor: "tags",
		},
		"has_task_list": {
			Name:     "has_task_list",
			Kind:     FieldKindJSONBool,
			Type:     FieldTypeBool,
			Column:   Column{Table: "memo", Name: "payload"},
			JSONPath: []string{"property", "hasTaskList"},
			AllowedComparisonOps: map[ComparisonOperator]bool{
				CompareEq:  true,
				CompareNeq: true,
			},
		},
		"has_link": {
			Name:     "has_link",
			Kind:     FieldKindJSONBool,
			Type:     FieldTypeBool,
			Column:   Column{Table: "memo", Name: "payload"},
			JSONPath: []string{"property", "hasLink"},
			AllowedComparisonOps: map[ComparisonOperator]bool{
				CompareEq:  true,
				CompareNeq: true,
			},
		},
		"has_code": {
			Name:     "has_code",
			Kind:     FieldKindJSONBool,
			Type:     FieldTypeBool,
			Column:   Column{Table: "memo", Name: "payload"},
			JSONPath: []string{"property", "hasCode"},
			AllowedComparisonOps: map[ComparisonOperator]bool{
				CompareEq:  true,
				CompareNeq: true,
			},
		},
		"has_incomplete_tasks": {
			Name:     "has_incomplete_tasks",
			Kind:     FieldKindJSONBool,
			Type:     FieldTypeBool,
			Column:   Column{Table: "memo", Name: "payload"},
			JSONPath: []string{"property", "hasIncompleteTasks"},
			AllowedComparisonOps: map[ComparisonOperator]bool{
				CompareEq:  true,
				CompareNeq: true,
			},
		},
	}

	envOptions := []cel.EnvOption{
		cel.Variable("content", cel.StringType),
		cel.Variable("creator_id", cel.IntType),
		cel.Variable("created_ts", cel.IntType),
		cel.Variable("updated_ts", cel.IntType),
		cel.Variable("pinned", cel.BoolType),
		cel.Variable("tag", cel.StringType),
		cel.Variable("tags", cel.ListType(cel.StringType)),
		cel.Variable("visibility", cel.StringType),
		cel.Variable("has_task_list", cel.BoolType),
		cel.Variable("has_link", cel.BoolType),
		cel.Variable("has_code", cel.BoolType),
		cel.Variable("has_incomplete_tasks", cel.BoolType),
		nowFunction,
	}

	return Schema{
		Name:       "memo",
		Fields:     fields,
		EnvOptions: envOptions,
	}
}

// NewAttachmentSchema constructs the attachment filter schema and CEL environment.
func NewAttachmentSchema() Schema {
	fields := map[string]Field{
		"filename": {
			Name:             "filename",
			Kind:             FieldKindScalar,
			Type:             FieldTypeString,
			Column:           Column{Table: "attachment", Name: "filename"},
			SupportsContains: true,
			Expressions:      map[DialectName]string{},
		},
		"mime_type": {
			Name:        "mime_type",
			Kind:        FieldKindScalar,
			Type:        FieldTypeString,
			Column:      Column{Table: "attachment", Name: "type"},
			Expressions: map[DialectName]string{},
		},
		"create_time": {
			Name:   "create_time",
			Kind:   FieldKindScalar,
			Type:   FieldTypeTimestamp,
			Column: Column{Table: "attachment", Name: "created_ts"},
			Expressions: map[DialectName]string{
				// MySQL stores created_ts as TIMESTAMP, needs conversion to epoch
				DialectMySQL: "UNIX_TIMESTAMP(%s)",
				// PostgreSQL and SQLite store created_ts as BIGINT (epoch), no conversion needed
				DialectPostgres: "%s",
				DialectSQLite:   "%s",
			},
		},
		"memo_id": {
			Name:        "memo_id",
			Kind:        FieldKindScalar,
			Type:        FieldTypeInt,
			Column:      Column{Table: "attachment", Name: "memo_id"},
			Expressions: map[DialectName]string{},
			AllowedComparisonOps: map[ComparisonOperator]bool{
				CompareEq:  true,
				CompareNeq: true,
			},
		},
	}

	envOptions := []cel.EnvOption{
		cel.Variable("filename", cel.StringType),
		cel.Variable("mime_type", cel.StringType),
		cel.Variable("create_time", cel.IntType),
		cel.Variable("memo_id", cel.AnyType),
		nowFunction,
	}

	return Schema{
		Name:       "attachment",
		Fields:     fields,
		EnvOptions: envOptions,
	}
}

// columnExpr returns the field expression for the given dialect, applying
// any schema-specific overrides (e.g. UNIX timestamp conversions).
func (f Field) columnExpr(d DialectName) string {
	base := qualifyColumn(d, f.Column)
	if expr, ok := f.Expressions[d]; ok && expr != "" {
		return fmt.Sprintf(expr, base)
	}
	return base
}
