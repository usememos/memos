package sqlite

import (
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/pkg/errors"
	exprv1 "google.golang.org/genproto/googleapis/api/expr/v1alpha1"

	"github.com/usememos/memos/plugin/filter"
)

func RestoreExprToSQL(expr *exprv1.Expr) (string, error) {
	var condition string
	switch v := expr.ExprKind.(type) {
	case *exprv1.Expr_CallExpr:
		switch v.CallExpr.Function {
		case "_||_", "_&&_":
			for _, arg := range v.CallExpr.Args {
				left, err := RestoreExprToSQL(arg)
				if err != nil {
					return "", err
				}
				right, err := RestoreExprToSQL(arg)
				if err != nil {
					return "", err
				}
				operator := "AND"
				if v.CallExpr.Function == "_||_" {
					operator = "OR"
				}
				condition = fmt.Sprintf("(%s %s %s)", left, operator, right)
			}
		case "_==_", "_!=_", "_<_", "_>_", "_<=_", "_>=_":
			if len(v.CallExpr.Args) != 2 {
				return "", errors.Errorf("invalid number of arguments for %s", v.CallExpr.Function)
			}
			identifier := v.CallExpr.Args[0].GetIdentExpr().GetName()
			if !slices.Contains([]string{"create_time", "update_time"}, identifier) {
				return "", errors.Errorf("invalid identifier for %s", v.CallExpr.Function)
			}
			value, err := filter.GetConstValue(v.CallExpr.Args[1])
			if err != nil {
				return "", err
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

			if identifier == "create_time" || identifier == "update_time" {
				timestampStr, ok := value.(string)
				if !ok {
					return "", errors.New("invalid timestamp value")
				}
				timestamp, err := time.Parse(time.RFC3339, timestampStr)
				if err != nil {
					return "", errors.Wrap(err, "failed to parse timestamp")
				}

				if identifier == "create_time" {
					condition = fmt.Sprintf("`memo`.`created_ts` %s %d", operator, timestamp.Unix())
				} else if identifier == "update_time" {
					condition = fmt.Sprintf("`memo`.`updated_ts` %s %d", operator, timestamp.Unix())
				}
			}
		case "@in":
			if len(v.CallExpr.Args) != 2 {
				return "", errors.Errorf("invalid number of arguments for %s", v.CallExpr.Function)
			}
			identifier := v.CallExpr.Args[0].GetIdentExpr().GetName()
			if !slices.Contains([]string{"tag", "visibility"}, identifier) {
				return "", errors.Errorf("invalid identifier for %s", v.CallExpr.Function)
			}

			values := []any{}
			for _, element := range v.CallExpr.Args[1].GetListExpr().Elements {
				value, err := filter.GetConstValue(element)
				if err != nil {
					return "", err
				}
				values = append(values, value)
			}
			if identifier == "tag" {
				subcodition := []string{}
				for _, v := range values {
					subcodition = append(subcodition, fmt.Sprintf("JSON_EXTRACT(`memo`.`payload`, '$.tags') LIKE %s", fmt.Sprintf(`%%"%s"%%`, v)))
				}
				if len(subcodition) == 1 {
					condition = subcodition[0]
				} else {
					condition = fmt.Sprintf("(%s)", strings.Join(subcodition, " OR "))
				}
			} else if identifier == "visibility" {
				vs := []string{}
				for _, v := range values {
					vs = append(vs, fmt.Sprintf(`"%s"`, v))
				}
				if len(vs) == 1 {
					condition = fmt.Sprintf("`memo`.`visibility` = %s", vs[0])
				} else {
					condition = fmt.Sprintf("`memo`.`visibility` IN (%s)", strings.Join(vs, ","))
				}
			}
		case "contains":
			if len(v.CallExpr.Args) != 1 {
				return "", errors.Errorf("invalid number of arguments for %s", v.CallExpr.Function)
			}
			identifier, err := RestoreExprToSQL(v.CallExpr.Target)
			if err != nil {
				return "", err
			}
			if identifier != "content" {
				return "", errors.Errorf("invalid identifier for %s", v.CallExpr.Function)
			}
			arg, err := filter.GetConstValue(v.CallExpr.Args[0])
			if err != nil {
				return "", err
			}
			condition = fmt.Sprintf("`memo`.`content` LIKE %s", fmt.Sprintf(`%%"%s"%%`, arg))
		case "!_":
			if len(v.CallExpr.Args) != 1 {
				return "", errors.Errorf("invalid number of arguments for %s", v.CallExpr.Function)
			}
			arg, err := RestoreExprToSQL(v.CallExpr.Args[0])
			if err != nil {
				return "", err
			}
			condition = fmt.Sprintf("NOT (%s)", arg)
		}
	case *exprv1.Expr_IdentExpr:
		return v.IdentExpr.GetName(), nil
	}
	return condition, nil
}
