package sqlite

import (
	"fmt"
	"slices"
	"strings"

	"github.com/pkg/errors"
	exprv1 "google.golang.org/genproto/googleapis/api/expr/v1alpha1"

	"github.com/usememos/memos/plugin/filter"
)

func (d *DB) ConvertExprToSQL(ctx *filter.ConvertContext, expr *exprv1.Expr) error {
	return d.convertWithTemplates(ctx, expr)
}

func (d *DB) convertWithTemplates(ctx *filter.ConvertContext, expr *exprv1.Expr) error {
	const dbType = filter.SQLiteTemplate

	if v, ok := expr.ExprKind.(*exprv1.Expr_CallExpr); ok {
		switch v.CallExpr.Function {
		case "_||_", "_&&_":
			if len(v.CallExpr.Args) != 2 {
				return errors.Errorf("invalid number of arguments for %s", v.CallExpr.Function)
			}
			if _, err := ctx.Buffer.WriteString("("); err != nil {
				return err
			}
			if err := d.convertWithTemplates(ctx, v.CallExpr.Args[0]); err != nil {
				return err
			}
			operator := "AND"
			if v.CallExpr.Function == "_||_" {
				operator = "OR"
			}
			if _, err := ctx.Buffer.WriteString(fmt.Sprintf(" %s ", operator)); err != nil {
				return err
			}
			if err := d.convertWithTemplates(ctx, v.CallExpr.Args[1]); err != nil {
				return err
			}
			if _, err := ctx.Buffer.WriteString(")"); err != nil {
				return err
			}
		case "!_":
			if len(v.CallExpr.Args) != 1 {
				return errors.Errorf("invalid number of arguments for %s", v.CallExpr.Function)
			}
			if _, err := ctx.Buffer.WriteString("NOT ("); err != nil {
				return err
			}
			if err := d.convertWithTemplates(ctx, v.CallExpr.Args[0]); err != nil {
				return err
			}
			if _, err := ctx.Buffer.WriteString(")"); err != nil {
				return err
			}
		case "_==_", "_!=_", "_<_", "_>_", "_<=_", "_>=_":
			if len(v.CallExpr.Args) != 2 {
				return errors.Errorf("invalid number of arguments for %s", v.CallExpr.Function)
			}
			// Check if the left side is a function call like size(tags)
			if leftCallExpr, ok := v.CallExpr.Args[0].ExprKind.(*exprv1.Expr_CallExpr); ok {
				if leftCallExpr.CallExpr.Function == "size" {
					// Handle size(tags) comparison
					if len(leftCallExpr.CallExpr.Args) != 1 {
						return errors.New("size function requires exactly one argument")
					}
					identifier, err := filter.GetIdentExprName(leftCallExpr.CallExpr.Args[0])
					if err != nil {
						return err
					}
					if identifier != "tags" {
						return errors.Errorf("size function only supports 'tags' identifier, got: %s", identifier)
					}
					value, err := filter.GetExprValue(v.CallExpr.Args[1])
					if err != nil {
						return err
					}
					valueInt, ok := value.(int64)
					if !ok {
						return errors.New("size comparison value must be an integer")
					}
					operator := d.getComparisonOperator(v.CallExpr.Function)

					if _, err := ctx.Buffer.WriteString(fmt.Sprintf("%s %s ?",
						filter.GetSQL("json_array_length", dbType), operator)); err != nil {
						return err
					}
					ctx.Args = append(ctx.Args, valueInt)
					return nil
				}
			}

			identifier, err := filter.GetIdentExprName(v.CallExpr.Args[0])
			if err != nil {
				return err
			}
			if !slices.Contains([]string{"creator_id", "created_ts", "updated_ts", "visibility", "content", "has_task_list"}, identifier) {
				return errors.Errorf("invalid identifier for %s", v.CallExpr.Function)
			}
			value, err := filter.GetExprValue(v.CallExpr.Args[1])
			if err != nil {
				return err
			}
			operator := d.getComparisonOperator(v.CallExpr.Function)

			if identifier == "created_ts" || identifier == "updated_ts" {
				valueInt, ok := value.(int64)
				if !ok {
					return errors.New("invalid integer timestamp value")
				}

				timestampSQL := fmt.Sprintf(filter.GetSQL("timestamp_field", dbType), identifier)
				if _, err := ctx.Buffer.WriteString(fmt.Sprintf("%s %s ?", timestampSQL, operator)); err != nil {
					return err
				}
				ctx.Args = append(ctx.Args, valueInt)
			} else if identifier == "visibility" || identifier == "content" {
				if operator != "=" && operator != "!=" {
					return errors.Errorf("invalid operator for %s", v.CallExpr.Function)
				}
				valueStr, ok := value.(string)
				if !ok {
					return errors.New("invalid string value")
				}

				var sqlTemplate string
				if identifier == "visibility" {
					sqlTemplate = filter.GetSQL("table_prefix", dbType) + ".`visibility`"
				} else if identifier == "content" {
					sqlTemplate = filter.GetSQL("table_prefix", dbType) + ".`content`"
				}
				if _, err := ctx.Buffer.WriteString(fmt.Sprintf("%s %s ?", sqlTemplate, operator)); err != nil {
					return err
				}
				ctx.Args = append(ctx.Args, valueStr)
			} else if identifier == "creator_id" {
				if operator != "=" && operator != "!=" {
					return errors.Errorf("invalid operator for %s", v.CallExpr.Function)
				}
				valueInt, ok := value.(int64)
				if !ok {
					return errors.New("invalid int value")
				}

				sqlTemplate := filter.GetSQL("table_prefix", dbType) + ".`creator_id`"
				if _, err := ctx.Buffer.WriteString(fmt.Sprintf("%s %s ?", sqlTemplate, operator)); err != nil {
					return err
				}
				ctx.Args = append(ctx.Args, valueInt)
			} else if identifier == "has_task_list" {
				if operator != "=" && operator != "!=" {
					return errors.Errorf("invalid operator for %s", v.CallExpr.Function)
				}
				valueBool, ok := value.(bool)
				if !ok {
					return errors.New("invalid boolean value for has_task_list")
				}
				// Use template for boolean comparison
				var sqlTemplate string
				if operator == "=" {
					if valueBool {
						sqlTemplate = filter.GetSQL("boolean_true", dbType)
					} else {
						sqlTemplate = filter.GetSQL("boolean_false", dbType)
					}
				} else { // operator == "!="
					if valueBool {
						sqlTemplate = filter.GetSQL("boolean_not_true", dbType)
					} else {
						sqlTemplate = filter.GetSQL("boolean_not_false", dbType)
					}
				}
				if _, err := ctx.Buffer.WriteString(sqlTemplate); err != nil {
					return err
				}
			}
		case "@in":
			if len(v.CallExpr.Args) != 2 {
				return errors.Errorf("invalid number of arguments for %s", v.CallExpr.Function)
			}

			// Check if this is "element in collection" syntax
			if identifier, err := filter.GetIdentExprName(v.CallExpr.Args[1]); err == nil {
				// This is "element in collection" - the second argument is the collection
				if !slices.Contains([]string{"tags"}, identifier) {
					return errors.Errorf("invalid collection identifier for %s: %s", v.CallExpr.Function, identifier)
				}

				if identifier == "tags" {
					// Handle "element" in tags
					element, err := filter.GetConstValue(v.CallExpr.Args[0])
					if err != nil {
						return errors.Errorf("first argument must be a constant value for 'element in tags': %v", err)
					}
					if _, err := ctx.Buffer.WriteString(filter.GetSQL("json_contains_element", dbType)); err != nil {
						return err
					}
					ctx.Args = append(ctx.Args, filter.GetParameterValue(dbType, "json_contains_element", element))
				}
				return nil
			}

			// Original logic for "identifier in [list]" syntax
			identifier, err := filter.GetIdentExprName(v.CallExpr.Args[0])
			if err != nil {
				return err
			}
			if !slices.Contains([]string{"tag", "visibility"}, identifier) {
				return errors.Errorf("invalid identifier for %s", v.CallExpr.Function)
			}

			values := []any{}
			for _, element := range v.CallExpr.Args[1].GetListExpr().Elements {
				value, err := filter.GetConstValue(element)
				if err != nil {
					return err
				}
				values = append(values, value)
			}
			if identifier == "tag" {
				subconditions := []string{}
				args := []any{}
				for _, v := range values {
					subconditions = append(subconditions, filter.GetSQL("json_contains_tag", dbType))
					args = append(args, filter.GetParameterValue(dbType, "json_contains_tag", v))
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
			} else if identifier == "visibility" {
				placeholders := filter.FormatPlaceholders(dbType, len(values), 1)
				visibilitySQL := fmt.Sprintf(filter.GetSQL("visibility_in", dbType), strings.Join(placeholders, ","))
				if _, err := ctx.Buffer.WriteString(visibilitySQL); err != nil {
					return err
				}
				ctx.Args = append(ctx.Args, values...)
			}
		case "contains":
			if len(v.CallExpr.Args) != 1 {
				return errors.Errorf("invalid number of arguments for %s", v.CallExpr.Function)
			}
			identifier, err := filter.GetIdentExprName(v.CallExpr.Target)
			if err != nil {
				return err
			}
			if identifier != "content" {
				return errors.Errorf("invalid identifier for %s", v.CallExpr.Function)
			}
			arg, err := filter.GetConstValue(v.CallExpr.Args[0])
			if err != nil {
				return err
			}
			if _, err := ctx.Buffer.WriteString(filter.GetSQL("content_like", dbType)); err != nil {
				return err
			}
			ctx.Args = append(ctx.Args, fmt.Sprintf("%%%s%%", arg))
		}
	} else if v, ok := expr.ExprKind.(*exprv1.Expr_IdentExpr); ok {
		identifier := v.IdentExpr.GetName()
		if !slices.Contains([]string{"pinned", "has_task_list"}, identifier) {
			return errors.Errorf("invalid identifier %s", identifier)
		}
		if identifier == "pinned" {
			if _, err := ctx.Buffer.WriteString(filter.GetSQL("table_prefix", dbType) + ".`pinned` IS TRUE"); err != nil {
				return err
			}
		} else if identifier == "has_task_list" {
			// Handle has_task_list as a standalone boolean identifier
			if _, err := ctx.Buffer.WriteString(filter.GetSQL("boolean_check", dbType)); err != nil {
				return err
			}
		}
	}
	return nil
}

func (*DB) getComparisonOperator(function string) string {
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
