package sqlite

import (
	"fmt"
	"slices"
	"strings"

	"github.com/pkg/errors"
	"github.com/usememos/memos/plugin/filter"
	exprv1 "google.golang.org/genproto/googleapis/api/expr/v1alpha1"
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
			// TODO(j): Implement this part.
		case "@in":
			if len(v.CallExpr.Args) != 2 {
				return "", errors.Errorf("invalid number of arguments for %s", v.CallExpr.Function)
			}
			factor := v.CallExpr.Args[0].GetIdentExpr().Name
			if !slices.Contains([]string{"tag"}, factor) {
				return "", errors.Errorf("invalid factor for %s", v.CallExpr.Function)
			}
			values := []any{}
			for _, element := range v.CallExpr.Args[1].GetListExpr().Elements {
				value, err := filter.GetConstValue(element)
				if err != nil {
					return "", err
				}
				values = append(values, value)
			}
			if factor == "tag" {
				t := []string{}
				for _, v := range values {
					t = append(t, fmt.Sprintf("JSON_EXTRACT(`memo`.`payload`, '$.tags') LIKE %s", fmt.Sprintf(`%%"%s"%%`, v)))
				}
				if len(t) == 1 {
					condition = t[0]
				} else {
					condition = fmt.Sprintf("(%s)", strings.Join(t, " OR "))
				}
			}
		case "contains":
			if len(v.CallExpr.Args) != 1 {
				return "", errors.Errorf("invalid number of arguments for %s", v.CallExpr.Function)
			}
			factor, err := RestoreExprToSQL(v.CallExpr.Target)
			if err != nil {
				return "", err
			}
			if factor != "content" {
				return "", errors.Errorf("invalid factor for %s", v.CallExpr.Function)
			}
			arg, err := filter.GetConstValue(v.CallExpr.Args[0])
			if err != nil {
				return "", err
			}
			condition = fmt.Sprintf("JSON_EXTRACT(`memo`.`payload`, '$.content') LIKE %s", fmt.Sprintf(`%%"%s"%%`, arg))
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
