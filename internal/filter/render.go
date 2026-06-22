package filter

import (
	"fmt"
	"strings"

	"github.com/pkg/errors"
)

type renderer struct {
	schema             Schema
	dialect            DialectName
	placeholderOffset  int
	placeholderCounter int
	args               []any
}

type renderResult struct {
	sql           string
	trivial       bool
	unsatisfiable bool
}

func newRenderer(schema Schema, opts RenderOptions) *renderer {
	return &renderer{
		schema:            schema,
		dialect:           opts.Dialect,
		placeholderOffset: opts.PlaceholderOffset,
	}
}

func (r *renderer) Render(cond Condition) (Statement, error) {
	result, err := r.renderCondition(cond)
	if err != nil {
		return Statement{}, err
	}
	args := r.args
	if args == nil {
		args = []any{}
	}

	switch {
	case result.unsatisfiable:
		return Statement{
			SQL:  "1 = 0",
			Args: args,
		}, nil
	case result.trivial:
		return Statement{
			SQL:  "",
			Args: args,
		}, nil
	default:
		return Statement{
			SQL:  result.sql,
			Args: args,
		}, nil
	}
}

func (r *renderer) renderCondition(cond Condition) (renderResult, error) {
	switch c := cond.(type) {
	case *LogicalCondition:
		return r.renderLogicalCondition(c)
	case *NotCondition:
		return r.renderNotCondition(c)
	case *FieldPredicateCondition:
		return r.renderFieldPredicate(c)
	case *ComparisonCondition:
		return r.renderComparison(c)
	case *InCondition:
		return r.renderInCondition(c)
	case *ElementInCondition:
		return r.renderElementInCondition(c)
	case *TextMatchCondition:
		return r.renderTextMatch(c)
	case *RegexCondition:
		return r.renderRegex(c)
	case *ListComprehensionCondition:
		return r.renderListComprehension(c)
	case *ConstantCondition:
		if c.Value {
			return renderResult{trivial: true}, nil
		}
		return renderResult{sql: "1 = 0", unsatisfiable: true}, nil
	default:
		return renderResult{}, errors.Errorf("unsupported condition type %T", c)
	}
}

func (r *renderer) renderLogicalCondition(cond *LogicalCondition) (renderResult, error) {
	left, err := r.renderCondition(cond.Left)
	if err != nil {
		return renderResult{}, err
	}
	right, err := r.renderCondition(cond.Right)
	if err != nil {
		return renderResult{}, err
	}

	switch cond.Operator {
	case LogicalAnd:
		return combineAnd(left, right), nil
	case LogicalOr:
		return combineOr(left, right), nil
	default:
		return renderResult{}, errors.Errorf("unsupported logical operator %s", cond.Operator)
	}
}

func (r *renderer) renderNotCondition(cond *NotCondition) (renderResult, error) {
	child, err := r.renderCondition(cond.Expr)
	if err != nil {
		return renderResult{}, err
	}

	if child.trivial {
		return renderResult{sql: "1 = 0", unsatisfiable: true}, nil
	}
	if child.unsatisfiable {
		return renderResult{trivial: true}, nil
	}
	return renderResult{
		sql: fmt.Sprintf("NOT (%s)", child.sql),
	}, nil
}

func (r *renderer) renderFieldPredicate(cond *FieldPredicateCondition) (renderResult, error) {
	field, ok := r.schema.Field(cond.Field)
	if !ok {
		return renderResult{}, errors.Errorf("unknown field %q", cond.Field)
	}

	switch field.Kind {
	case FieldKindBoolColumn:
		column := qualifyColumn(r.dialect, field.Column)
		return renderResult{
			sql: fmt.Sprintf("%s IS TRUE", column),
		}, nil
	case FieldKindJSONBool:
		sql, err := r.jsonBoolPredicate(field)
		if err != nil {
			return renderResult{}, err
		}
		return renderResult{sql: sql}, nil
	default:
		return renderResult{}, errors.Errorf("field %q cannot be used as a predicate", cond.Field)
	}
}

func (r *renderer) renderComparison(cond *ComparisonCondition) (renderResult, error) {
	switch left := cond.Left.(type) {
	case *FieldRef:
		field, ok := r.schema.Field(left.Name)
		if !ok {
			return renderResult{}, errors.Errorf("unknown field %q", left.Name)
		}
		switch field.Kind {
		case FieldKindBoolColumn:
			return r.renderBoolColumnComparison(field, cond.Operator, cond.Right)
		case FieldKindJSONBool:
			return r.renderJSONBoolComparison(field, cond.Operator, cond.Right)
		case FieldKindScalar:
			return r.renderScalarComparison(field, cond.Operator, cond.Right)
		default:
			return renderResult{}, errors.Errorf("field %q does not support comparison", field.Name)
		}
	case *FunctionValue:
		return r.renderFunctionComparison(left, cond.Operator, cond.Right)
	case *FieldAccessorValue:
		return r.renderAccessorComparison(left, cond.Operator, cond.Right)
	default:
		return renderResult{}, errors.New("comparison must start with a field reference or supported function")
	}
}

// accessorSpec maps a CEL timestamp accessor to per-dialect SQL date-part tokens
// and the offset to subtract so the result matches CEL's base (e.g. CEL months
// are 0-based but every dialect reports 1-based, so off=1). off is indexed
// [sqlite, postgres, mysql].
type accessorSpec struct {
	sqlite string // strftime format specifier
	pg     string // EXTRACT field
	mysql  string // function name
	off    [3]int
}

var accessorSpecs = map[string]accessorSpec{
	"getFullYear":   {"%Y", "YEAR", "YEAR", [3]int{0, 0, 0}},
	"getMonth":      {"%m", "MONTH", "MONTH", [3]int{1, 1, 1}},
	"getDate":       {"%d", "DAY", "DAYOFMONTH", [3]int{0, 0, 0}},
	"getDayOfMonth": {"%d", "DAY", "DAYOFMONTH", [3]int{1, 1, 1}},
	"getDayOfWeek":  {"%w", "DOW", "DAYOFWEEK", [3]int{0, 0, 1}},
	"getDayOfYear":  {"%j", "DOY", "DAYOFYEAR", [3]int{1, 1, 1}},
	"getHours":      {"%H", "HOUR", "HOUR", [3]int{0, 0, 0}},
	"getMinutes":    {"%M", "MINUTE", "MINUTE", [3]int{0, 0, 0}},
	"getSeconds":    {"%S", "SECOND", "SECOND", [3]int{0, 0, 0}},
}

func (r *renderer) renderAccessorComparison(acc *FieldAccessorValue, op ComparisonOperator, right ValueExpr) (renderResult, error) {
	field, ok := r.schema.Field(acc.Field)
	if !ok {
		return renderResult{}, errors.Errorf("unknown field %q", acc.Field)
	}
	value, err := expectNumericLiteral(right)
	if err != nil {
		return renderResult{}, err
	}
	expr, err := r.timestampAccessorExpr(field, acc.Accessor)
	if err != nil {
		return renderResult{}, err
	}
	placeholder := r.addArg(value)
	return renderResult{
		sql: fmt.Sprintf("%s %s %s", expr, sqlOperator(op), placeholder),
	}, nil
}

// timestampAccessorExpr builds a dialect-specific integer expression for a CEL
// timestamp accessor. Extraction is UTC on SQLite/Postgres (epoch columns); on
// MySQL the TIMESTAMP column is read in the server session time zone.
func (r *renderer) timestampAccessorExpr(field Field, accessor string) (string, error) {
	spec, ok := accessorSpecs[accessor]
	if !ok {
		return "", errors.Errorf("unsupported timestamp accessor %q", accessor)
	}
	col := qualifyColumn(r.dialect, field.Column)
	var base string
	var off int
	switch r.dialect {
	case DialectSQLite:
		base = fmt.Sprintf("CAST(strftime('%s', %s, 'unixepoch') AS INTEGER)", spec.sqlite, col)
		off = spec.off[0]
	case DialectPostgres:
		base = fmt.Sprintf("CAST(EXTRACT(%s FROM to_timestamp(%s) AT TIME ZONE 'UTC') AS INTEGER)", spec.pg, col)
		off = spec.off[1]
	case DialectMySQL:
		base = fmt.Sprintf("%s(%s)", spec.mysql, col)
		off = spec.off[2]
	default:
		return "", errors.Errorf("unsupported dialect %q", r.dialect)
	}
	if off != 0 {
		base = fmt.Sprintf("(%s - %d)", base, off)
	}
	return base, nil
}

func (r *renderer) renderFunctionComparison(fn *FunctionValue, op ComparisonOperator, right ValueExpr) (renderResult, error) {
	if fn.Name != "size" {
		return renderResult{}, errors.Errorf("unsupported function %s in comparison", fn.Name)
	}
	if len(fn.Args) != 1 {
		return renderResult{}, errors.New("size() expects one argument")
	}
	fieldArg, ok := fn.Args[0].(*FieldRef)
	if !ok {
		return renderResult{}, errors.New("size() argument must be a field")
	}

	field, ok := r.schema.Field(fieldArg.Name)
	if !ok {
		return renderResult{}, errors.Errorf("unknown field %q", fieldArg.Name)
	}
	if field.Kind == FieldKindVirtualAlias {
		field, ok = r.schema.ResolveAlias(fieldArg.Name)
		if !ok {
			return renderResult{}, errors.Errorf("invalid alias %q", fieldArg.Name)
		}
	}

	value, err := expectNumericLiteral(right)
	if err != nil {
		return renderResult{}, err
	}

	var expr string
	switch {
	case field.Kind == FieldKindJSONList:
		expr = jsonArrayLengthExpr(r.dialect, field)
	case field.Kind == FieldKindScalar && field.Type == FieldTypeString:
		expr = stringLengthExpr(r.dialect, field.columnExpr(r.dialect))
	default:
		return renderResult{}, errors.Errorf("size() does not support field %q", field.Name)
	}

	placeholder := r.addArg(value)
	return renderResult{
		sql: fmt.Sprintf("%s %s %s", expr, sqlOperator(op), placeholder),
	}, nil
}

// stringLengthExpr returns the character-count expression for a string column.
// MySQL's LENGTH counts bytes, so CHAR_LENGTH is used to count characters and
// match CEL's size() code-point semantics; SQLite/Postgres LENGTH already counts
// characters.
func stringLengthExpr(d DialectName, colExpr string) string {
	if d == DialectMySQL {
		return fmt.Sprintf("CHAR_LENGTH(%s)", colExpr)
	}
	return fmt.Sprintf("LENGTH(%s)", colExpr)
}

func (r *renderer) renderScalarComparison(field Field, op ComparisonOperator, right ValueExpr) (renderResult, error) {
	lit, err := expectLiteral(right)
	if err != nil {
		return renderResult{}, err
	}

	columnExpr := field.columnExpr(r.dialect)
	if lit == nil {
		switch op {
		case CompareEq:
			return renderResult{sql: fmt.Sprintf("%s IS NULL", columnExpr)}, nil
		case CompareNeq:
			return renderResult{sql: fmt.Sprintf("%s IS NOT NULL", columnExpr)}, nil
		default:
			return renderResult{}, errors.Errorf("operator %s not supported for null comparison", op)
		}
	}

	placeholder := ""
	switch field.Type {
	case FieldTypeString:
		value, ok := lit.(string)
		if !ok {
			return renderResult{}, errors.Errorf("field %q expects string value", field.Name)
		}
		placeholder = r.addArg(value)
	case FieldTypeInt, FieldTypeTimestamp:
		num, err := toInt64(lit)
		if err != nil {
			return renderResult{}, errors.Wrapf(err, "field %q expects integer value", field.Name)
		}
		placeholder = r.addArg(num)
	default:
		return renderResult{}, errors.Errorf("unsupported data type %q for field %s", field.Type, field.Name)
	}

	return renderResult{
		sql: fmt.Sprintf("%s %s %s", columnExpr, sqlOperator(op), placeholder),
	}, nil
}

func (r *renderer) renderBoolColumnComparison(field Field, op ComparisonOperator, right ValueExpr) (renderResult, error) {
	value, err := expectBool(right)
	if err != nil {
		return renderResult{}, err
	}
	placeholder := r.addBoolArg(value)
	column := qualifyColumn(r.dialect, field.Column)
	return renderResult{
		sql: fmt.Sprintf("%s %s %s", column, sqlOperator(op), placeholder),
	}, nil
}

func (r *renderer) renderJSONBoolComparison(field Field, op ComparisonOperator, right ValueExpr) (renderResult, error) {
	value, err := expectBool(right)
	if err != nil {
		return renderResult{}, err
	}

	jsonExpr := jsonExtractExpr(r.dialect, field)
	switch r.dialect {
	case DialectSQLite:
		switch op {
		case CompareEq:
			if field.Name == "has_task_list" {
				target := "0"
				if value {
					target = "1"
				}
				return renderResult{sql: fmt.Sprintf("%s = %s", jsonExpr, target)}, nil
			}
			if value {
				return renderResult{sql: fmt.Sprintf("%s IS TRUE", jsonExpr)}, nil
			}
			return renderResult{sql: fmt.Sprintf("NOT(%s IS TRUE)", jsonExpr)}, nil
		case CompareNeq:
			if field.Name == "has_task_list" {
				target := "0"
				if value {
					target = "1"
				}
				return renderResult{sql: fmt.Sprintf("%s != %s", jsonExpr, target)}, nil
			}
			if value {
				return renderResult{sql: fmt.Sprintf("NOT(%s IS TRUE)", jsonExpr)}, nil
			}
			return renderResult{sql: fmt.Sprintf("%s IS TRUE", jsonExpr)}, nil
		default:
			return renderResult{}, errors.Errorf("operator %s not supported for boolean JSON field", op)
		}
	case DialectMySQL:
		boolStr := "false"
		if value {
			boolStr = "true"
		}
		return renderResult{
			sql: fmt.Sprintf("%s %s CAST('%s' AS JSON)", jsonExpr, sqlOperator(op), boolStr),
		}, nil
	case DialectPostgres:
		placeholder := r.addArg(value)
		return renderResult{
			sql: fmt.Sprintf("(%s)::boolean %s %s", jsonExpr, sqlOperator(op), placeholder),
		}, nil
	default:
		return renderResult{}, errors.Errorf("unsupported dialect %s", r.dialect)
	}
}

func (r *renderer) renderInCondition(cond *InCondition) (renderResult, error) {
	fieldRef, ok := cond.Left.(*FieldRef)
	if !ok {
		return renderResult{}, errors.New("IN operator requires a field on the left-hand side")
	}

	if fieldRef.Name == "tag" {
		return r.renderTagInList(cond.Values)
	}

	field, ok := r.schema.Field(fieldRef.Name)
	if !ok {
		return renderResult{}, errors.Errorf("unknown field %q", fieldRef.Name)
	}

	if field.Kind != FieldKindScalar {
		return renderResult{}, errors.Errorf("field %q does not support IN()", fieldRef.Name)
	}

	return r.renderScalarInCondition(field, cond.Values)
}

func (r *renderer) renderTagInList(values []ValueExpr) (renderResult, error) {
	field, ok := r.schema.ResolveAlias("tag")
	if !ok {
		return renderResult{}, errors.New("tag attribute is not configured")
	}

	conditions := make([]string, 0, len(values))
	for _, v := range values {
		lit, err := expectLiteral(v)
		if err != nil {
			return renderResult{}, err
		}
		str, ok := lit.(string)
		if !ok {
			return renderResult{}, errors.New("tags must be compared with string literals")
		}

		switch r.dialect {
		case DialectSQLite:
			// Support hierarchical tags: match exact tag OR tags with this prefix (e.g., "book" matches "book" and "book/something")
			exactMatch := fmt.Sprintf("%s LIKE %s", jsonArrayExpr(r.dialect, field), r.addArg(fmt.Sprintf(`%%"%s"%%`, str)))
			prefixMatch := fmt.Sprintf("%s LIKE %s", jsonArrayExpr(r.dialect, field), r.addArg(fmt.Sprintf(`%%"%s/%%`, str)))
			expr := fmt.Sprintf("(%s OR %s)", exactMatch, prefixMatch)
			conditions = append(conditions, expr)
		case DialectMySQL:
			// Support hierarchical tags: match exact tag OR tags with this prefix
			exactMatch := fmt.Sprintf("JSON_CONTAINS(%s, %s)", jsonArrayExpr(r.dialect, field), r.addArg(fmt.Sprintf(`"%s"`, str)))
			prefixMatch := fmt.Sprintf("%s LIKE %s", jsonArrayExpr(r.dialect, field), r.addArg(fmt.Sprintf(`%%"%s/%%`, str)))
			expr := fmt.Sprintf("(%s OR %s)", exactMatch, prefixMatch)
			conditions = append(conditions, expr)
		case DialectPostgres:
			// Support hierarchical tags: match exact tag OR tags with this prefix
			exactMatch := fmt.Sprintf("%s @> jsonb_build_array(%s::json)", jsonArrayExpr(r.dialect, field), r.addArg(fmt.Sprintf(`"%s"`, str)))
			prefixMatch := fmt.Sprintf("(%s)::text LIKE %s", jsonArrayExpr(r.dialect, field), r.addArg(fmt.Sprintf(`%%"%s/%%`, str)))
			expr := fmt.Sprintf("(%s OR %s)", exactMatch, prefixMatch)
			conditions = append(conditions, expr)
		default:
			return renderResult{}, errors.Errorf("unsupported dialect %s", r.dialect)
		}
	}

	if len(conditions) == 1 {
		return renderResult{sql: conditions[0]}, nil
	}
	return renderResult{
		sql: fmt.Sprintf("(%s)", strings.Join(conditions, " OR ")),
	}, nil
}

func (r *renderer) renderElementInCondition(cond *ElementInCondition) (renderResult, error) {
	field, ok := r.schema.Field(cond.Field)
	if !ok {
		return renderResult{}, errors.Errorf("unknown field %q", cond.Field)
	}
	if field.Kind != FieldKindJSONList {
		return renderResult{}, errors.Errorf("field %q is not a tag list", cond.Field)
	}

	lit, err := expectLiteral(cond.Element)
	if err != nil {
		return renderResult{}, err
	}
	str, ok := lit.(string)
	if !ok {
		return renderResult{}, errors.New("tags membership requires string literal")
	}

	switch r.dialect {
	case DialectSQLite:
		sql := fmt.Sprintf("%s LIKE %s", jsonArrayExpr(r.dialect, field), r.addArg(fmt.Sprintf(`%%"%s"%%`, str)))
		return renderResult{sql: sql}, nil
	case DialectMySQL:
		sql := fmt.Sprintf("JSON_CONTAINS(%s, %s)", jsonArrayExpr(r.dialect, field), r.addArg(fmt.Sprintf(`"%s"`, str)))
		return renderResult{sql: sql}, nil
	case DialectPostgres:
		sql := fmt.Sprintf("%s @> jsonb_build_array(%s::json)", jsonArrayExpr(r.dialect, field), r.addArg(fmt.Sprintf(`"%s"`, str)))
		return renderResult{sql: sql}, nil
	default:
		return renderResult{}, errors.Errorf("unsupported dialect %s", r.dialect)
	}
}

func (r *renderer) renderScalarInCondition(field Field, values []ValueExpr) (renderResult, error) {
	placeholders := make([]string, 0, len(values))

	for _, v := range values {
		lit, err := expectLiteral(v)
		if err != nil {
			return renderResult{}, err
		}
		switch field.Type {
		case FieldTypeString:
			str, ok := lit.(string)
			if !ok {
				return renderResult{}, errors.Errorf("field %q expects string values", field.Name)
			}
			placeholders = append(placeholders, r.addArg(str))
		case FieldTypeInt:
			num, err := toInt64(lit)
			if err != nil {
				return renderResult{}, err
			}
			placeholders = append(placeholders, r.addArg(num))
		default:
			return renderResult{}, errors.Errorf("field %q does not support IN() comparisons", field.Name)
		}
	}

	column := field.columnExpr(r.dialect)
	return renderResult{
		sql: fmt.Sprintf("%s IN (%s)", column, strings.Join(placeholders, ",")),
	}, nil
}

func (r *renderer) renderTextMatch(cond *TextMatchCondition) (renderResult, error) {
	field, ok := r.schema.Field(cond.Field)
	if !ok {
		return renderResult{}, errors.Errorf("unknown field %q", cond.Field)
	}
	column := field.columnExpr(r.dialect)
	pattern := likePattern(cond.Mode, cond.Value)
	return renderResult{sql: r.foldedLike(column, pattern)}, nil
}

func (r *renderer) renderRegex(cond *RegexCondition) (renderResult, error) {
	field, ok := r.schema.Field(cond.Field)
	if !ok {
		return renderResult{}, errors.Errorf("unknown field %q", cond.Field)
	}
	column := field.columnExpr(r.dialect)
	switch r.dialect {
	case DialectPostgres:
		// POSIX regex match operator.
		return renderResult{sql: fmt.Sprintf("%s ~ %s", column, r.addArg(cond.Pattern))}, nil
	case DialectMySQL, DialectSQLite:
		// MySQL has a native REGEXP operator; SQLite uses the registered regexp() function.
		return renderResult{sql: fmt.Sprintf("%s REGEXP %s", column, r.addArg(cond.Pattern))}, nil
	default:
		return renderResult{}, errors.Errorf("unsupported dialect %s", r.dialect)
	}
}

// foldedLike renders a case-insensitive LIKE comparison of colExpr against a
// (already metacharacter-escaped) pattern, using each dialect's case-folding.
func (r *renderer) foldedLike(colExpr, pattern string) string {
	switch r.dialect {
	case DialectSQLite:
		// memos_unicode_lower gives Unicode-aware folding; ESCAPE '\' is required
		// because SQLite has no default LIKE escape character.
		return fmt.Sprintf(`memos_unicode_lower(%s) LIKE memos_unicode_lower(%s) ESCAPE '\'`, colExpr, r.addArg(pattern))
	case DialectPostgres:
		// ILIKE is case-insensitive; backslash is the default escape character.
		return fmt.Sprintf("%s ILIKE %s", colExpr, r.addArg(pattern))
	default: // MySQL: default collation is case-insensitive; backslash is the default escape.
		return fmt.Sprintf("%s LIKE %s", colExpr, r.addArg(pattern))
	}
}

// likePattern escapes LIKE metacharacters in value and wraps it for the mode.
func likePattern(mode TextMatchMode, value string) string {
	escaped := escapeLikeLiteral(value)
	switch mode {
	case TextMatchPrefix:
		return escaped + "%"
	case TextMatchSuffix:
		return "%" + escaped
	default:
		return "%" + escaped + "%"
	}
}

// escapeLikeLiteral escapes the LIKE metacharacters \, %, and _ so user input
// is matched literally. Backslash is the escape character on all three dialects.
func escapeLikeLiteral(s string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(s)
}

func (r *renderer) renderListComprehension(cond *ListComprehensionCondition) (renderResult, error) {
	field, ok := r.schema.Field(cond.Field)
	if !ok {
		return renderResult{}, errors.Errorf("unknown field %q", cond.Field)
	}

	if field.Kind != FieldKindJSONList {
		return renderResult{}, errors.Errorf("field %q is not a JSON list", cond.Field)
	}

	if cond.Kind == ComprehensionAll {
		return r.renderTagAll(field, cond.Predicate)
	}

	if cond.Kind == ComprehensionExistsOne {
		return r.renderTagExistsOne(field, cond.Predicate)
	}

	// Render based on predicate type
	switch pred := cond.Predicate.(type) {
	case *EqualsPredicate:
		return r.renderTagEquals(field, pred.Value, cond.Kind)
	case *StartsWithPredicate:
		return r.renderTagStartsWith(field, pred.Prefix, cond.Kind)
	case *EndsWithPredicate:
		return r.renderTagEndsWith(field, pred.Suffix, cond.Kind)
	case *ContainsPredicate:
		return r.renderTagContains(field, pred.Substring, cond.Kind)
	default:
		return renderResult{}, errors.Errorf("unsupported predicate type %T in comprehension", pred)
	}
}

// renderTagAll renders tags.all(t, <pred>): the array is non-empty AND no element
// fails the predicate. Element predicates use plain CEL semantics (case-insensitive
// for startsWith/endsWith/contains, case-sensitive for ==), evaluated per element.
func (r *renderer) renderTagAll(field Field, pred PredicateExpr) (renderResult, error) {
	arrayExpr := jsonArrayExpr(r.dialect, field)
	elemCond, err := r.elementPredicateSQL(pred)
	if err != nil {
		return renderResult{}, err
	}
	switch r.dialect {
	case DialectSQLite:
		nonEmpty := fmt.Sprintf("%s IS NOT NULL AND %s != '[]'", arrayExpr, arrayExpr)
		sub := fmt.Sprintf("NOT EXISTS (SELECT 1 FROM json_each(%s) WHERE NOT (%s))", arrayExpr, elemCond)
		return renderResult{sql: fmt.Sprintf("(%s AND %s)", nonEmpty, sub)}, nil
	case DialectMySQL:
		nonEmpty := fmt.Sprintf("%s IS NOT NULL AND JSON_LENGTH(%s) > 0", arrayExpr, arrayExpr)
		sub := fmt.Sprintf("NOT EXISTS (SELECT 1 FROM JSON_TABLE(%s, '$[*]' COLUMNS (value VARCHAR(512) PATH '$')) AS elem WHERE NOT (%s))", arrayExpr, elemCond)
		return renderResult{sql: fmt.Sprintf("(%s AND %s)", nonEmpty, sub)}, nil
	case DialectPostgres:
		nonEmpty := fmt.Sprintf("%s IS NOT NULL AND jsonb_array_length(%s) > 0", arrayExpr, arrayExpr)
		sub := fmt.Sprintf("NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(%s) AS elem(value) WHERE NOT (%s))", arrayExpr, elemCond)
		return renderResult{sql: fmt.Sprintf("(%s AND %s)", nonEmpty, sub)}, nil
	default:
		return renderResult{}, errors.Errorf("unsupported dialect %s", r.dialect)
	}
}

// renderTagExistsOne renders tags.exists_one(t, <pred>): exactly one element
// satisfies the predicate, via a COUNT(...) = 1 subquery. A null or empty array
// yields COUNT 0, which is correctly not equal to 1.
func (r *renderer) renderTagExistsOne(field Field, pred PredicateExpr) (renderResult, error) {
	arrayExpr := jsonArrayExpr(r.dialect, field)
	elemCond, err := r.elementPredicateSQL(pred)
	if err != nil {
		return renderResult{}, err
	}
	switch r.dialect {
	case DialectSQLite:
		return renderResult{sql: fmt.Sprintf("(SELECT COUNT(*) FROM json_each(%s) WHERE %s) = 1", arrayExpr, elemCond)}, nil
	case DialectMySQL:
		return renderResult{sql: fmt.Sprintf("(SELECT COUNT(*) FROM JSON_TABLE(%s, '$[*]' COLUMNS (value VARCHAR(512) PATH '$')) AS elem WHERE %s) = 1", arrayExpr, elemCond)}, nil
	case DialectPostgres:
		return renderResult{sql: fmt.Sprintf("(SELECT COUNT(*) FROM jsonb_array_elements_text(%s) AS elem(value) WHERE %s) = 1", arrayExpr, elemCond)}, nil
	default:
		return renderResult{}, errors.Errorf("unsupported dialect %s", r.dialect)
	}
}

// elementPredicateSQL builds the per-element SQL condition for an all() predicate.
// The iterated element is exposed as the unqualified column `value` on all dialects
// (json_each.value / JSON_TABLE column / elem(value)).
func (r *renderer) elementPredicateSQL(pred PredicateExpr) (string, error) {
	switch p := pred.(type) {
	case *EqualsPredicate:
		return fmt.Sprintf("value = %s", r.addArg(p.Value)), nil
	case *StartsWithPredicate:
		return r.foldedLike("value", likePattern(TextMatchPrefix, p.Prefix)), nil
	case *EndsWithPredicate:
		return r.foldedLike("value", likePattern(TextMatchSuffix, p.Suffix)), nil
	case *ContainsPredicate:
		return r.foldedLike("value", likePattern(TextMatchContains, p.Substring)), nil
	default:
		return "", errors.Errorf("unsupported predicate %T in all()", pred)
	}
}

// renderTagEquals generates SQL for tags.exists(t, t == "value").
func (r *renderer) renderTagEquals(field Field, value string, _ ComprehensionKind) (renderResult, error) {
	arrayExpr := jsonArrayExpr(r.dialect, field)

	switch r.dialect {
	case DialectSQLite, DialectMySQL:
		exactMatch := r.buildJSONArrayLike(arrayExpr, fmt.Sprintf(`%%"%s"%%`, value))
		return renderResult{sql: r.wrapWithNullCheck(arrayExpr, exactMatch)}, nil
	case DialectPostgres:
		exactMatch := fmt.Sprintf("%s @> jsonb_build_array(%s::json)", arrayExpr, r.addArg(fmt.Sprintf(`"%s"`, value)))
		return renderResult{sql: r.wrapWithNullCheck(arrayExpr, exactMatch)}, nil
	default:
		return renderResult{}, errors.Errorf("unsupported dialect %s", r.dialect)
	}
}

// renderTagStartsWith generates SQL for tags.exists(t, t.startsWith("prefix")).
func (r *renderer) renderTagStartsWith(field Field, prefix string, _ ComprehensionKind) (renderResult, error) {
	arrayExpr := jsonArrayExpr(r.dialect, field)

	switch r.dialect {
	case DialectSQLite, DialectMySQL:
		// Match exact tag or tags with this prefix (hierarchical support)
		exactMatch := r.buildJSONArrayLike(arrayExpr, fmt.Sprintf(`%%"%s"%%`, prefix))
		prefixMatch := r.buildJSONArrayLike(arrayExpr, fmt.Sprintf(`%%"%s%%`, prefix))
		condition := fmt.Sprintf("(%s OR %s)", exactMatch, prefixMatch)
		return renderResult{sql: r.wrapWithNullCheck(arrayExpr, condition)}, nil

	case DialectPostgres:
		// Use PostgreSQL's powerful JSON operators
		exactMatch := fmt.Sprintf("%s @> jsonb_build_array(%s::json)", arrayExpr, r.addArg(fmt.Sprintf(`"%s"`, prefix)))
		prefixMatch := fmt.Sprintf("(%s)::text LIKE %s", arrayExpr, r.addArg(fmt.Sprintf(`%%"%s%%`, prefix)))
		condition := fmt.Sprintf("(%s OR %s)", exactMatch, prefixMatch)
		return renderResult{sql: r.wrapWithNullCheck(arrayExpr, condition)}, nil

	default:
		return renderResult{}, errors.Errorf("unsupported dialect %s", r.dialect)
	}
}

// renderTagEndsWith generates SQL for tags.exists(t, t.endsWith("suffix")).
func (r *renderer) renderTagEndsWith(field Field, suffix string, _ ComprehensionKind) (renderResult, error) {
	arrayExpr := jsonArrayExpr(r.dialect, field)
	pattern := fmt.Sprintf(`%%%s"%%`, suffix)

	likeExpr := r.buildJSONArrayLike(arrayExpr, pattern)
	return renderResult{sql: r.wrapWithNullCheck(arrayExpr, likeExpr)}, nil
}

// renderTagContains generates SQL for tags.exists(t, t.contains("substring")).
func (r *renderer) renderTagContains(field Field, substring string, _ ComprehensionKind) (renderResult, error) {
	arrayExpr := jsonArrayExpr(r.dialect, field)
	pattern := fmt.Sprintf(`%%%s%%`, substring)

	likeExpr := r.buildJSONArrayLike(arrayExpr, pattern)
	return renderResult{sql: r.wrapWithNullCheck(arrayExpr, likeExpr)}, nil
}

// buildJSONArrayLike builds a LIKE expression for matching within a JSON array.
// Returns the LIKE clause without NULL/empty checks.
func (r *renderer) buildJSONArrayLike(arrayExpr, pattern string) string {
	switch r.dialect {
	case DialectSQLite, DialectMySQL:
		return fmt.Sprintf("%s LIKE %s", arrayExpr, r.addArg(pattern))
	case DialectPostgres:
		return fmt.Sprintf("(%s)::text LIKE %s", arrayExpr, r.addArg(pattern))
	default:
		return ""
	}
}

// wrapWithNullCheck wraps a condition with NULL and empty array checks.
// This ensures we don't match against NULL or empty JSON arrays.
func (r *renderer) wrapWithNullCheck(arrayExpr, condition string) string {
	var nullCheck string
	switch r.dialect {
	case DialectSQLite:
		nullCheck = fmt.Sprintf("%s IS NOT NULL AND %s != '[]'", arrayExpr, arrayExpr)
	case DialectMySQL:
		nullCheck = fmt.Sprintf("%s IS NOT NULL AND JSON_LENGTH(%s) > 0", arrayExpr, arrayExpr)
	case DialectPostgres:
		nullCheck = fmt.Sprintf("%s IS NOT NULL AND jsonb_array_length(%s) > 0", arrayExpr, arrayExpr)
	default:
		return condition
	}
	return fmt.Sprintf("(%s AND %s)", condition, nullCheck)
}

func (r *renderer) jsonBoolPredicate(field Field) (string, error) {
	expr := jsonExtractExpr(r.dialect, field)
	switch r.dialect {
	case DialectSQLite:
		return fmt.Sprintf("%s IS TRUE", expr), nil
	case DialectMySQL:
		return fmt.Sprintf("COALESCE(%s, CAST('false' AS JSON)) = CAST('true' AS JSON)", expr), nil
	case DialectPostgres:
		return fmt.Sprintf("(%s)::boolean IS TRUE", expr), nil
	default:
		return "", errors.Errorf("unsupported dialect %s", r.dialect)
	}
}

func combineAnd(left, right renderResult) renderResult {
	if left.unsatisfiable || right.unsatisfiable {
		return renderResult{sql: "1 = 0", unsatisfiable: true}
	}
	if left.trivial {
		return right
	}
	if right.trivial {
		return left
	}
	return renderResult{
		sql: fmt.Sprintf("(%s AND %s)", left.sql, right.sql),
	}
}

func combineOr(left, right renderResult) renderResult {
	if left.trivial || right.trivial {
		return renderResult{trivial: true}
	}
	if left.unsatisfiable {
		return right
	}
	if right.unsatisfiable {
		return left
	}
	return renderResult{
		sql: fmt.Sprintf("(%s OR %s)", left.sql, right.sql),
	}
}

func (r *renderer) addArg(value any) string {
	r.placeholderCounter++
	r.args = append(r.args, value)
	if r.dialect == DialectPostgres {
		return fmt.Sprintf("$%d", r.placeholderOffset+r.placeholderCounter)
	}
	return "?"
}

func (r *renderer) addBoolArg(value bool) string {
	var v any
	switch r.dialect {
	case DialectSQLite:
		if value {
			v = 1
		} else {
			v = 0
		}
	default:
		v = value
	}
	return r.addArg(v)
}

func expectLiteral(expr ValueExpr) (any, error) {
	lit, ok := expr.(*LiteralValue)
	if !ok {
		return nil, errors.New("expression must be a literal")
	}
	return lit.Value, nil
}

func expectBool(expr ValueExpr) (bool, error) {
	lit, err := expectLiteral(expr)
	if err != nil {
		return false, err
	}
	value, ok := lit.(bool)
	if !ok {
		return false, errors.New("boolean literal required")
	}
	return value, nil
}

func expectNumericLiteral(expr ValueExpr) (int64, error) {
	lit, err := expectLiteral(expr)
	if err != nil {
		return 0, err
	}
	return toInt64(lit)
}

func toInt64(value any) (int64, error) {
	switch v := value.(type) {
	case int:
		return int64(v), nil
	case int32:
		return int64(v), nil
	case int64:
		return v, nil
	case uint32:
		return int64(v), nil
	case uint64:
		return int64(v), nil
	case float32:
		return int64(v), nil
	case float64:
		return int64(v), nil
	default:
		return 0, errors.Errorf("cannot convert %T to int64", value)
	}
}

func sqlOperator(op ComparisonOperator) string {
	return string(op)
}

func qualifyColumn(d DialectName, col Column) string {
	switch d {
	case DialectPostgres:
		return fmt.Sprintf("%s.%s", col.Table, col.Name)
	default:
		return fmt.Sprintf("`%s`.`%s`", col.Table, col.Name)
	}
}

func jsonPath(field Field) string {
	return "$." + strings.Join(field.JSONPath, ".")
}

func jsonExtractExpr(d DialectName, field Field) string {
	column := qualifyColumn(d, field.Column)
	switch d {
	case DialectSQLite, DialectMySQL:
		return fmt.Sprintf("JSON_EXTRACT(%s, '%s')", column, jsonPath(field))
	case DialectPostgres:
		return buildPostgresJSONAccessor(column, field.JSONPath, true)
	default:
		return ""
	}
}

func jsonArrayExpr(d DialectName, field Field) string {
	column := qualifyColumn(d, field.Column)
	switch d {
	case DialectSQLite, DialectMySQL:
		return fmt.Sprintf("JSON_EXTRACT(%s, '%s')", column, jsonPath(field))
	case DialectPostgres:
		return buildPostgresJSONAccessor(column, field.JSONPath, false)
	default:
		return ""
	}
}

func jsonArrayLengthExpr(d DialectName, field Field) string {
	arrayExpr := jsonArrayExpr(d, field)
	switch d {
	case DialectSQLite:
		return fmt.Sprintf("JSON_ARRAY_LENGTH(COALESCE(%s, JSON_ARRAY()))", arrayExpr)
	case DialectMySQL:
		return fmt.Sprintf("JSON_LENGTH(COALESCE(%s, JSON_ARRAY()))", arrayExpr)
	case DialectPostgres:
		return fmt.Sprintf("jsonb_array_length(COALESCE(%s, '[]'::jsonb))", arrayExpr)
	default:
		return ""
	}
}

func buildPostgresJSONAccessor(base string, path []string, terminalText bool) string {
	expr := base
	for idx, part := range path {
		if idx == len(path)-1 && terminalText {
			expr = fmt.Sprintf("%s->>'%s'", expr, part)
		} else {
			expr = fmt.Sprintf("%s->'%s'", expr, part)
		}
	}
	return expr
}
