package mysql

import (
	"fmt"
	"slices"
	"strings"

	"github.com/pkg/errors"
	exprv1 "google.golang.org/genproto/googleapis/api/expr/v1alpha1"

	"github.com/usememos/memos/plugin/filter"
)

func (d *DB) ConvertExprToSQL(ctx *filter.ConvertContext, expr *exprv1.Expr) error {
	if v, ok := expr.ExprKind.(*exprv1.Expr_CallExpr); ok {
		switch v.CallExpr.Function {
		case "_||_", "_&&_":
			if len(v.CallExpr.Args) != 2 {
				return errors.Errorf("invalid number of arguments for %s", v.CallExpr.Function)
			}
			if _, err := ctx.Buffer.WriteString("("); err != nil {
				return err
			}
			if err := d.ConvertExprToSQL(ctx, v.CallExpr.Args[0]); err != nil {
				return err
			}
			operator := "AND"
			if v.CallExpr.Function == "_||_" {
				operator = "OR"
			}
			if _, err := ctx.Buffer.WriteString(fmt.Sprintf(" %s ", operator)); err != nil {
				return err
			}
			if err := d.ConvertExprToSQL(ctx, v.CallExpr.Args[1]); err != nil {
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
			if err := d.ConvertExprToSQL(ctx, v.CallExpr.Args[0]); err != nil {
				return err
			}
			if _, err := ctx.Buffer.WriteString(")"); err != nil {
				return err
			}
		case "_==_", "_!=_", "_<_", "_>_", "_<=_", "_>=_":
			if len(v.CallExpr.Args) != 2 {
				return errors.Errorf("invalid number of arguments for %s", v.CallExpr.Function)
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
			operator := "="
			switch v.CallExpr.Function {
			case "_==_":
				operator = "="
			case "_!=_":
				operator = "!="
			case "_<_":
				operator = "<"
			case "_>_":
				operator = ">"
			case "_<=_":
				operator = "<="
			case "_>=_":
				operator = ">="
			}

			if identifier == "created_ts" || identifier == "updated_ts" {
				timestampInt, ok := value.(int64)
				if !ok {
					return errors.New("invalid timestamp value")
				}

				var factor string
				if identifier == "created_ts" {
					factor = "UNIX_TIMESTAMP(`memo`.`created_ts`)"
				} else if identifier == "updated_ts" {
					factor = "UNIX_TIMESTAMP(`memo`.`updated_ts`)"
				}
				if _, err := ctx.Buffer.WriteString(fmt.Sprintf("%s %s ?", factor, operator)); err != nil {
					return err
				}
				ctx.Args = append(ctx.Args, timestampInt)
			} else if identifier == "visibility" || identifier == "content" {
				if operator != "=" && operator != "!=" {
					return errors.Errorf("invalid operator for %s", v.CallExpr.Function)
				}
				valueStr, ok := value.(string)
				if !ok {
					return errors.New("invalid string value")
				}

				var factor string
				if identifier == "visibility" {
					factor = "`memo`.`visibility`"
				} else if identifier == "content" {
					factor = "`memo`.`content`"
				}
				if _, err := ctx.Buffer.WriteString(fmt.Sprintf("%s %s ?", factor, operator)); err != nil {
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

				var factor string
				if identifier == "creator_id" {
					factor = "`memo`.`creator_id`"
				}
				if _, err := ctx.Buffer.WriteString(fmt.Sprintf("%s %s ?", factor, operator)); err != nil {
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

				// In MySQL, we can use JSON_EXTRACT to get the value and compare it to 'true' or 'false'
				compareValue := "false"
				if valueBool {
					compareValue = "true"
				}

				// MySQL uses -> as a shorthand for JSON_EXTRACT
				if _, err := ctx.Buffer.WriteString(fmt.Sprintf("JSON_EXTRACT(`memo`.`payload`, '$.property.hasTaskList') %s CAST('%s' AS JSON)", operator, compareValue)); err != nil {
					return err
				}
			}
		case "@in":
			if len(v.CallExpr.Args) != 2 {
				return errors.Errorf("invalid number of arguments for %s", v.CallExpr.Function)
			}
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
				subcodition := []string{}
				args := []any{}
				for _, v := range values {
					subcodition, args = append(subcodition, "JSON_CONTAINS(JSON_EXTRACT(`memo`.`payload`, '$.tags'), ?)"), append(args, v)
				}
				if len(subcodition) == 1 {
					if _, err := ctx.Buffer.WriteString(subcodition[0]); err != nil {
						return err
					}
				} else {
					if _, err := ctx.Buffer.WriteString(fmt.Sprintf("(%s)", strings.Join(subcodition, " OR "))); err != nil {
						return err
					}
				}
				ctx.Args = append(ctx.Args, args...)
			} else if identifier == "visibility" {
				placeholder := []string{}
				for range values {
					placeholder = append(placeholder, "?")
				}
				if _, err := ctx.Buffer.WriteString(fmt.Sprintf("`memo`.`visibility` IN (%s)", strings.Join(placeholder, ","))); err != nil {
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
			if _, err := ctx.Buffer.WriteString("`memo`.`content` LIKE ?"); err != nil {
				return err
			}
			ctx.Args = append(ctx.Args, fmt.Sprintf("%%%s%%", arg))
		}
	} else if v, ok := expr.ExprKind.(*exprv1.Expr_IdentExpr); ok {
		identifier := v.IdentExpr.GetName()
		if !slices.Contains([]string{"pinned", "has_task_list"}, identifier) {
			return errors.Errorf("invalid identifier for %s", identifier)
		}
		if identifier == "pinned" {
			if _, err := ctx.Buffer.WriteString("`memo`.`pinned` IS TRUE"); err != nil {
				return err
			}
		} else if identifier == "has_task_list" {
			if _, err := ctx.Buffer.WriteString("JSON_EXTRACT(`memo`.`payload`, '$.property.hasTaskList') = CAST('true' AS JSON)"); err != nil {
				return err
			}
		}
	}
	return nil
}
