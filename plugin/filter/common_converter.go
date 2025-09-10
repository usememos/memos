package filter

import (
	"fmt"
	"slices"
	"strings"

	"github.com/pkg/errors"
	exprv1 "google.golang.org/genproto/googleapis/api/expr/v1alpha1"
)

// CommonSQLConverter handles the common CEL to SQL conversion logic.
type CommonSQLConverter struct {
	dialect       SQLDialect
	paramIndex    int
	allowedFields []string
	entityType    string
}

// NewCommonSQLConverter creates a new converter with the specified dialect for memo filters.
func NewCommonSQLConverter(dialect SQLDialect) *CommonSQLConverter {
	return &CommonSQLConverter{
		dialect:       dialect,
		paramIndex:    1,
		allowedFields: []string{"creator_id", "created_ts", "updated_ts", "visibility", "content", "pinned", "has_task_list", "has_link", "has_code", "has_incomplete_tasks"},
		entityType:    "memo",
	}
}

// NewCommonSQLConverterWithOffset creates a new converter with the specified dialect and parameter offset for memo filters.
func NewCommonSQLConverterWithOffset(dialect SQLDialect, offset int) *CommonSQLConverter {
	return &CommonSQLConverter{
		dialect:       dialect,
		paramIndex:    offset + 1,
		allowedFields: []string{"creator_id", "created_ts", "updated_ts", "visibility", "content", "pinned", "has_task_list", "has_link", "has_code", "has_incomplete_tasks"},
		entityType:    "memo",
	}
}

// NewUserSQLConverter creates a new converter for user filters.
func NewUserSQLConverter(dialect SQLDialect) *CommonSQLConverter {
	return &CommonSQLConverter{
		dialect:       dialect,
		paramIndex:    1,
		allowedFields: []string{"username"},
		entityType:    "user",
	}
}

// ConvertExprToSQL converts a CEL expression to SQL using the configured dialect.
func (c *CommonSQLConverter) ConvertExprToSQL(ctx *ConvertContext, expr *exprv1.Expr) error {
	if v, ok := expr.ExprKind.(*exprv1.Expr_CallExpr); ok {
		switch v.CallExpr.Function {
		case "_||_", "_&&_":
			return c.handleLogicalOperator(ctx, v.CallExpr)
		case "!_":
			return c.handleNotOperator(ctx, v.CallExpr)
		case "_==_", "_!=_", "_<_", "_>_", "_<=_", "_>=_":
			return c.handleComparisonOperator(ctx, v.CallExpr)
		case "@in":
			return c.handleInOperator(ctx, v.CallExpr)
		case "contains":
			return c.handleContainsOperator(ctx, v.CallExpr)
		default:
			return errors.Errorf("unsupported call expression function: %s", v.CallExpr.Function)
		}
	} else if v, ok := expr.ExprKind.(*exprv1.Expr_IdentExpr); ok {
		return c.handleIdentifier(ctx, v.IdentExpr)
	}
	return nil
}

func (c *CommonSQLConverter) handleLogicalOperator(ctx *ConvertContext, callExpr *exprv1.Expr_Call) error {
	if len(callExpr.Args) != 2 {
		return errors.Errorf("invalid number of arguments for %s", callExpr.Function)
	}

	if _, err := ctx.Buffer.WriteString("("); err != nil {
		return err
	}

	if err := c.ConvertExprToSQL(ctx, callExpr.Args[0]); err != nil {
		return err
	}

	operator := "AND"
	if callExpr.Function == "_||_" {
		operator = "OR"
	}

	if _, err := ctx.Buffer.WriteString(fmt.Sprintf(" %s ", operator)); err != nil {
		return err
	}

	if err := c.ConvertExprToSQL(ctx, callExpr.Args[1]); err != nil {
		return err
	}

	if _, err := ctx.Buffer.WriteString(")"); err != nil {
		return err
	}

	return nil
}

func (c *CommonSQLConverter) handleNotOperator(ctx *ConvertContext, callExpr *exprv1.Expr_Call) error {
	if len(callExpr.Args) != 1 {
		return errors.Errorf("invalid number of arguments for %s", callExpr.Function)
	}

	if _, err := ctx.Buffer.WriteString("NOT ("); err != nil {
		return err
	}

	if err := c.ConvertExprToSQL(ctx, callExpr.Args[0]); err != nil {
		return err
	}

	if _, err := ctx.Buffer.WriteString(")"); err != nil {
		return err
	}

	return nil
}

func (c *CommonSQLConverter) handleComparisonOperator(ctx *ConvertContext, callExpr *exprv1.Expr_Call) error {
	if len(callExpr.Args) != 2 {
		return errors.Errorf("invalid number of arguments for %s", callExpr.Function)
	}

	// Check if the left side is a function call like size(tags)
	if leftCallExpr, ok := callExpr.Args[0].ExprKind.(*exprv1.Expr_CallExpr); ok {
		if leftCallExpr.CallExpr.Function == "size" {
			return c.handleSizeComparison(ctx, callExpr, leftCallExpr.CallExpr)
		}
	}

	identifier, err := GetIdentExprName(callExpr.Args[0])
	if err != nil {
		return err
	}

	if !slices.Contains(c.allowedFields, identifier) {
		return errors.Errorf("invalid identifier for %s", callExpr.Function)
	}

	value, err := GetExprValue(callExpr.Args[1])
	if err != nil {
		return err
	}

	operator := c.getComparisonOperator(callExpr.Function)

	// Handle memo fields
	if c.entityType == "memo" {
		switch identifier {
		case "created_ts", "updated_ts":
			return c.handleTimestampComparison(ctx, identifier, operator, value)
		case "visibility", "content":
			return c.handleStringComparison(ctx, identifier, operator, value)
		case "creator_id":
			return c.handleIntComparison(ctx, identifier, operator, value)
		case "pinned":
			return c.handlePinnedComparison(ctx, operator, value)
		case "has_task_list", "has_link", "has_code", "has_incomplete_tasks":
			return c.handleBooleanComparison(ctx, identifier, operator, value)
		default:
			return errors.Errorf("unsupported identifier in comparison: %s", identifier)
		}
	}

	// Handle user fields
	if c.entityType == "user" {
		switch identifier {
		case "username":
			return c.handleUserStringComparison(ctx, identifier, operator, value)
		default:
			return errors.Errorf("unsupported user identifier in comparison: %s", identifier)
		}
	}

	return errors.Errorf("unsupported entity type: %s", c.entityType)
}

func (c *CommonSQLConverter) handleSizeComparison(ctx *ConvertContext, callExpr *exprv1.Expr_Call, sizeCall *exprv1.Expr_Call) error {
	if len(sizeCall.Args) != 1 {
		return errors.New("size function requires exactly one argument")
	}

	identifier, err := GetIdentExprName(sizeCall.Args[0])
	if err != nil {
		return err
	}

	if identifier != "tags" {
		return errors.Errorf("size function only supports 'tags' identifier, got: %s", identifier)
	}

	value, err := GetExprValue(callExpr.Args[1])
	if err != nil {
		return err
	}

	valueInt, ok := value.(int64)
	if !ok {
		return errors.New("size comparison value must be an integer")
	}

	operator := c.getComparisonOperator(callExpr.Function)

	if _, err := ctx.Buffer.WriteString(fmt.Sprintf("%s %s %s",
		c.dialect.GetJSONArrayLength("$.tags"),
		operator,
		c.dialect.GetParameterPlaceholder(c.paramIndex))); err != nil {
		return err
	}

	ctx.Args = append(ctx.Args, valueInt)
	c.paramIndex++

	return nil
}

func (c *CommonSQLConverter) handleInOperator(ctx *ConvertContext, callExpr *exprv1.Expr_Call) error {
	if len(callExpr.Args) != 2 {
		return errors.Errorf("invalid number of arguments for %s", callExpr.Function)
	}

	// Check if this is "element in collection" syntax
	if identifier, err := GetIdentExprName(callExpr.Args[1]); err == nil {
		if identifier == "tags" {
			return c.handleElementInTags(ctx, callExpr.Args[0])
		}
		return errors.Errorf("invalid collection identifier for %s: %s", callExpr.Function, identifier)
	}

	// Original logic for "identifier in [list]" syntax
	identifier, err := GetIdentExprName(callExpr.Args[0])
	if err != nil {
		return err
	}

	if !slices.Contains([]string{"tag", "visibility", "content_id", "memo_id"}, identifier) {
		return errors.Errorf("invalid identifier for %s", callExpr.Function)
	}

	values := []any{}
	for _, element := range callExpr.Args[1].GetListExpr().Elements {
		value, err := GetConstValue(element)
		if err != nil {
			return err
		}
		values = append(values, value)
	}

	if identifier == "tag" {
		return c.handleTagInList(ctx, values)
	} else if identifier == "visibility" {
		return c.handleVisibilityInList(ctx, values)
	} else if identifier == "content_id" {
		return c.handleContentIDInList(ctx, values)
	} else if identifier == "memo_id" {
		return c.handleMemoIDInList(ctx, values)
	}

	return nil
}

func (c *CommonSQLConverter) handleElementInTags(ctx *ConvertContext, elementExpr *exprv1.Expr) error {
	element, err := GetConstValue(elementExpr)
	if err != nil {
		return errors.Errorf("first argument must be a constant value for 'element in tags': %v", err)
	}

	// Use dialect-specific JSON contains logic
	template := c.dialect.GetJSONContains("$.tags", "element")
	sqlExpr := strings.Replace(template, "?", c.dialect.GetParameterPlaceholder(c.paramIndex), 1)
	if _, err := ctx.Buffer.WriteString(sqlExpr); err != nil {
		return err
	}

	// Handle args based on dialect
	if _, ok := c.dialect.(*SQLiteDialect); ok {
		// SQLite uses LIKE with pattern
		ctx.Args = append(ctx.Args, fmt.Sprintf(`%%"%s"%%`, element))
	} else {
		// MySQL and PostgreSQL expect plain values
		ctx.Args = append(ctx.Args, element)
	}
	c.paramIndex++

	return nil
}

func (c *CommonSQLConverter) handleTagInList(ctx *ConvertContext, values []any) error {
	subconditions := []string{}
	args := []any{}

	for _, v := range values {
		if _, ok := c.dialect.(*SQLiteDialect); ok {
			subconditions = append(subconditions, c.dialect.GetJSONLike("$.tags", "pattern"))
			args = append(args, fmt.Sprintf(`%%"%s"%%`, v))
		} else {
			// Replace ? with proper placeholder for each dialect
			template := c.dialect.GetJSONContains("$.tags", "element")
			sql := strings.Replace(template, "?", c.dialect.GetParameterPlaceholder(c.paramIndex), 1)
			subconditions = append(subconditions, sql)
			args = append(args, fmt.Sprintf(`"%s"`, v))
		}
		c.paramIndex++
	}

	if len(subconditions) == 1 {
		if _, err := ctx.Buffer.WriteString(subconditions[0]); err != nil {
			return err
		}
	} else {
		if _, err := ctx.Buffer.WriteString(fmt.Sprintf("(%s)", strings.Join(subconditions, " OR "))); err != nil {
			return err
		}
	}

	ctx.Args = append(ctx.Args, args...)
	return nil
}

func (c *CommonSQLConverter) handleVisibilityInList(ctx *ConvertContext, values []any) error {
	placeholders := []string{}
	for range values {
		placeholders = append(placeholders, c.dialect.GetParameterPlaceholder(c.paramIndex))
		c.paramIndex++
	}

	tablePrefix := c.dialect.GetTablePrefix("memo")
	if _, ok := c.dialect.(*PostgreSQLDialect); ok {
		if _, err := ctx.Buffer.WriteString(fmt.Sprintf("%s.visibility IN (%s)", tablePrefix, strings.Join(placeholders, ","))); err != nil {
			return err
		}
	} else {
		if _, err := ctx.Buffer.WriteString(fmt.Sprintf("%s.`visibility` IN (%s)", tablePrefix, strings.Join(placeholders, ","))); err != nil {
			return err
		}
	}

	ctx.Args = append(ctx.Args, values...)
	return nil
}

func (c *CommonSQLConverter) handleContentIDInList(ctx *ConvertContext, values []any) error {
	placeholders := []string{}
	for range values {
		placeholders = append(placeholders, c.dialect.GetParameterPlaceholder(c.paramIndex))
		c.paramIndex++
	}

	tablePrefix := c.dialect.GetTablePrefix("reaction")
	if _, ok := c.dialect.(*PostgreSQLDialect); ok {
		if _, err := ctx.Buffer.WriteString(fmt.Sprintf("%s.content_id IN (%s)", tablePrefix, strings.Join(placeholders, ","))); err != nil {
			return err
		}
	} else {
		if _, err := ctx.Buffer.WriteString(fmt.Sprintf("%s.`content_id` IN (%s)", tablePrefix, strings.Join(placeholders, ","))); err != nil {
			return err
		}
	}

	ctx.Args = append(ctx.Args, values...)
	return nil
}

func (c *CommonSQLConverter) handleMemoIDInList(ctx *ConvertContext, values []any) error {
	placeholders := []string{}
	for range values {
		placeholders = append(placeholders, c.dialect.GetParameterPlaceholder(c.paramIndex))
		c.paramIndex++
	}

	tablePrefix := c.dialect.GetTablePrefix("resource")
	if _, ok := c.dialect.(*PostgreSQLDialect); ok {
		if _, err := ctx.Buffer.WriteString(fmt.Sprintf("%s.memo_id IN (%s)", tablePrefix, strings.Join(placeholders, ","))); err != nil {
			return err
		}
	} else {
		if _, err := ctx.Buffer.WriteString(fmt.Sprintf("%s.`memo_id` IN (%s)", tablePrefix, strings.Join(placeholders, ","))); err != nil {
			return err
		}
	}

	ctx.Args = append(ctx.Args, values...)
	return nil
}

func (c *CommonSQLConverter) handleContainsOperator(ctx *ConvertContext, callExpr *exprv1.Expr_Call) error {
	if len(callExpr.Args) != 1 {
		return errors.Errorf("invalid number of arguments for %s", callExpr.Function)
	}

	identifier, err := GetIdentExprName(callExpr.Target)
	if err != nil {
		return err
	}

	if identifier != "content" {
		return errors.Errorf("invalid identifier for %s", callExpr.Function)
	}

	arg, err := GetConstValue(callExpr.Args[0])
	if err != nil {
		return err
	}

	tablePrefix := c.dialect.GetTablePrefix("memo")

	// PostgreSQL uses ILIKE and no backticks
	if _, ok := c.dialect.(*PostgreSQLDialect); ok {
		if _, err := ctx.Buffer.WriteString(fmt.Sprintf("%s.content ILIKE %s", tablePrefix, c.dialect.GetParameterPlaceholder(c.paramIndex))); err != nil {
			return err
		}
	} else {
		if _, err := ctx.Buffer.WriteString(fmt.Sprintf("%s.`content` LIKE %s", tablePrefix, c.dialect.GetParameterPlaceholder(c.paramIndex))); err != nil {
			return err
		}
	}

	ctx.Args = append(ctx.Args, fmt.Sprintf("%%%s%%", arg))
	c.paramIndex++

	return nil
}

func (c *CommonSQLConverter) handleIdentifier(ctx *ConvertContext, identExpr *exprv1.Expr_Ident) error {
	identifier := identExpr.GetName()

	// Only memo entity has boolean identifiers that can be used standalone
	if c.entityType != "memo" {
		return errors.Errorf("invalid identifier %s for entity type %s", identifier, c.entityType)
	}

	if !slices.Contains([]string{"pinned", "has_task_list", "has_link", "has_code", "has_incomplete_tasks"}, identifier) {
		return errors.Errorf("invalid identifier %s", identifier)
	}

	if identifier == "pinned" {
		tablePrefix := c.dialect.GetTablePrefix("memo")
		if _, ok := c.dialect.(*PostgreSQLDialect); ok {
			if _, err := ctx.Buffer.WriteString(fmt.Sprintf("%s.pinned IS TRUE", tablePrefix)); err != nil {
				return err
			}
		} else {
			if _, err := ctx.Buffer.WriteString(fmt.Sprintf("%s.`pinned` IS TRUE", tablePrefix)); err != nil {
				return err
			}
		}
	} else if identifier == "has_task_list" {
		if _, err := ctx.Buffer.WriteString(c.dialect.GetBooleanCheck("$.property.hasTaskList")); err != nil {
			return err
		}
	} else if identifier == "has_link" {
		if _, err := ctx.Buffer.WriteString(c.dialect.GetBooleanCheck("$.property.hasLink")); err != nil {
			return err
		}
	} else if identifier == "has_code" {
		if _, err := ctx.Buffer.WriteString(c.dialect.GetBooleanCheck("$.property.hasCode")); err != nil {
			return err
		}
	} else if identifier == "has_incomplete_tasks" {
		if _, err := ctx.Buffer.WriteString(c.dialect.GetBooleanCheck("$.property.hasIncompleteTasks")); err != nil {
			return err
		}
	}

	return nil
}

func (c *CommonSQLConverter) handleTimestampComparison(ctx *ConvertContext, field, operator string, value interface{}) error {
	valueInt, ok := value.(int64)
	if !ok {
		return errors.New("invalid integer timestamp value")
	}

	timestampField := c.dialect.GetTimestampComparison(field)
	if _, err := ctx.Buffer.WriteString(fmt.Sprintf("%s %s %s", timestampField, operator, c.dialect.GetParameterPlaceholder(c.paramIndex))); err != nil {
		return err
	}

	ctx.Args = append(ctx.Args, valueInt)
	c.paramIndex++

	return nil
}

func (c *CommonSQLConverter) handleStringComparison(ctx *ConvertContext, field, operator string, value interface{}) error {
	if operator != "=" && operator != "!=" {
		return errors.Errorf("invalid operator for %s", field)
	}

	valueStr, ok := value.(string)
	if !ok {
		return errors.New("invalid string value")
	}

	tablePrefix := c.dialect.GetTablePrefix("memo")

	if _, ok := c.dialect.(*PostgreSQLDialect); ok {
		// PostgreSQL doesn't use backticks
		if _, err := ctx.Buffer.WriteString(fmt.Sprintf("%s.%s %s %s", tablePrefix, field, operator, c.dialect.GetParameterPlaceholder(c.paramIndex))); err != nil {
			return err
		}
	} else {
		// MySQL and SQLite use backticks
		fieldName := field
		if field == "visibility" {
			fieldName = "`visibility`"
		} else if field == "content" {
			fieldName = "`content`"
		}
		if _, err := ctx.Buffer.WriteString(fmt.Sprintf("%s.%s %s %s", tablePrefix, fieldName, operator, c.dialect.GetParameterPlaceholder(c.paramIndex))); err != nil {
			return err
		}
	}

	ctx.Args = append(ctx.Args, valueStr)
	c.paramIndex++

	return nil
}

func (c *CommonSQLConverter) handleUserStringComparison(ctx *ConvertContext, field, operator string, value interface{}) error {
	if operator != "=" && operator != "!=" {
		return errors.Errorf("invalid operator for %s", field)
	}

	valueStr, ok := value.(string)
	if !ok {
		return errors.New("invalid string value")
	}

	tablePrefix := c.dialect.GetTablePrefix("user")

	if _, ok := c.dialect.(*PostgreSQLDialect); ok {
		// PostgreSQL doesn't use backticks
		if _, err := ctx.Buffer.WriteString(fmt.Sprintf("%s.%s %s %s", tablePrefix, field, operator, c.dialect.GetParameterPlaceholder(c.paramIndex))); err != nil {
			return err
		}
	} else {
		// MySQL and SQLite use backticks
		if _, err := ctx.Buffer.WriteString(fmt.Sprintf("%s.`%s` %s %s", tablePrefix, field, operator, c.dialect.GetParameterPlaceholder(c.paramIndex))); err != nil {
			return err
		}
	}

	ctx.Args = append(ctx.Args, valueStr)
	c.paramIndex++

	return nil
}

func (c *CommonSQLConverter) handleIntComparison(ctx *ConvertContext, field, operator string, value interface{}) error {
	if operator != "=" && operator != "!=" {
		return errors.Errorf("invalid operator for %s", field)
	}

	valueInt, ok := value.(int64)
	if !ok {
		return errors.New("invalid int value")
	}

	tablePrefix := c.dialect.GetTablePrefix("memo")

	if _, ok := c.dialect.(*PostgreSQLDialect); ok {
		// PostgreSQL doesn't use backticks
		if _, err := ctx.Buffer.WriteString(fmt.Sprintf("%s.%s %s %s", tablePrefix, field, operator, c.dialect.GetParameterPlaceholder(c.paramIndex))); err != nil {
			return err
		}
	} else {
		// MySQL and SQLite use backticks
		if _, err := ctx.Buffer.WriteString(fmt.Sprintf("%s.`%s` %s %s", tablePrefix, field, operator, c.dialect.GetParameterPlaceholder(c.paramIndex))); err != nil {
			return err
		}
	}

	ctx.Args = append(ctx.Args, valueInt)
	c.paramIndex++

	return nil
}

func (c *CommonSQLConverter) handlePinnedComparison(ctx *ConvertContext, operator string, value interface{}) error {
	if operator != "=" && operator != "!=" {
		return errors.Errorf("invalid operator for pinned field")
	}

	valueBool, ok := value.(bool)
	if !ok {
		return errors.New("invalid boolean value for pinned field")
	}

	tablePrefix := c.dialect.GetTablePrefix("memo")

	var sqlExpr string
	if _, ok := c.dialect.(*PostgreSQLDialect); ok {
		sqlExpr = fmt.Sprintf("%s.pinned %s %s", tablePrefix, operator, c.dialect.GetParameterPlaceholder(c.paramIndex))
	} else {
		sqlExpr = fmt.Sprintf("%s.`pinned` %s %s", tablePrefix, operator, c.dialect.GetParameterPlaceholder(c.paramIndex))
	}

	if _, err := ctx.Buffer.WriteString(sqlExpr); err != nil {
		return err
	}

	ctx.Args = append(ctx.Args, c.dialect.GetBooleanValue(valueBool))
	c.paramIndex++

	return nil
}

func (c *CommonSQLConverter) handleBooleanComparison(ctx *ConvertContext, field, operator string, value interface{}) error {
	if operator != "=" && operator != "!=" {
		return errors.Errorf("invalid operator for %s", field)
	}

	valueBool, ok := value.(bool)
	if !ok {
		return errors.Errorf("invalid boolean value for %s", field)
	}

	// Map field name to JSON path
	var jsonPath string
	switch field {
	case "has_task_list":
		jsonPath = "$.property.hasTaskList"
	case "has_link":
		jsonPath = "$.property.hasLink"
	case "has_code":
		jsonPath = "$.property.hasCode"
	case "has_incomplete_tasks":
		jsonPath = "$.property.hasIncompleteTasks"
	default:
		return errors.Errorf("unsupported boolean field: %s", field)
	}

	// Special handling for SQLite based on field
	if _, ok := c.dialect.(*SQLiteDialect); ok {
		if field == "has_task_list" {
			// has_task_list uses = 1 / = 0 / != 1 / != 0
			var sqlExpr string
			if operator == "=" {
				if valueBool {
					sqlExpr = fmt.Sprintf("%s = 1", c.dialect.GetJSONExtract(jsonPath))
				} else {
					sqlExpr = fmt.Sprintf("%s = 0", c.dialect.GetJSONExtract(jsonPath))
				}
			} else { // operator == "!="
				if valueBool {
					sqlExpr = fmt.Sprintf("%s != 1", c.dialect.GetJSONExtract(jsonPath))
				} else {
					sqlExpr = fmt.Sprintf("%s != 0", c.dialect.GetJSONExtract(jsonPath))
				}
			}
			if _, err := ctx.Buffer.WriteString(sqlExpr); err != nil {
				return err
			}
			return nil
		}
		// Other fields use IS TRUE / NOT(... IS TRUE)
		var sqlExpr string
		if operator == "=" {
			if valueBool {
				sqlExpr = fmt.Sprintf("%s IS TRUE", c.dialect.GetJSONExtract(jsonPath))
			} else {
				sqlExpr = fmt.Sprintf("NOT(%s IS TRUE)", c.dialect.GetJSONExtract(jsonPath))
			}
		} else { // operator == "!="
			if valueBool {
				sqlExpr = fmt.Sprintf("NOT(%s IS TRUE)", c.dialect.GetJSONExtract(jsonPath))
			} else {
				sqlExpr = fmt.Sprintf("%s IS TRUE", c.dialect.GetJSONExtract(jsonPath))
			}
		}
		if _, err := ctx.Buffer.WriteString(sqlExpr); err != nil {
			return err
		}
		return nil
	}

	// Special handling for MySQL - use raw operator with CAST
	if _, ok := c.dialect.(*MySQLDialect); ok {
		var sqlExpr string
		boolStr := "false"
		if valueBool {
			boolStr = "true"
		}
		sqlExpr = fmt.Sprintf("%s %s CAST('%s' AS JSON)", c.dialect.GetJSONExtract(jsonPath), operator, boolStr)
		if _, err := ctx.Buffer.WriteString(sqlExpr); err != nil {
			return err
		}
		return nil
	}

	// Handle PostgreSQL differently - it uses the raw operator
	if _, ok := c.dialect.(*PostgreSQLDialect); ok {
		jsonExtract := c.dialect.GetJSONExtract(jsonPath)

		sqlExpr := fmt.Sprintf("(%s)::boolean %s %s",
			jsonExtract,
			operator,
			c.dialect.GetParameterPlaceholder(c.paramIndex))
		if _, err := ctx.Buffer.WriteString(sqlExpr); err != nil {
			return err
		}
		ctx.Args = append(ctx.Args, valueBool)
		c.paramIndex++
		return nil
	}

	// Handle other dialects
	if operator == "!=" {
		valueBool = !valueBool
	}

	sqlExpr := c.dialect.GetBooleanComparison(jsonPath, valueBool)
	if _, err := ctx.Buffer.WriteString(sqlExpr); err != nil {
		return err
	}

	return nil
}

func (*CommonSQLConverter) getComparisonOperator(function string) string {
	switch function {
	case "_==_":
		return "="
	case "_!=_":
		return "!="
	case "_<_":
		return "<"
	case "_>_":
		return ">"
	case "_<=_":
		return "<="
	case "_>=_":
		return ">="
	default:
		return "="
	}
}
