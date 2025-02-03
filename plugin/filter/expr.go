package filter

import (
	"errors"

	exprv1 "google.golang.org/genproto/googleapis/api/expr/v1alpha1"
)

// GetConstValue returns the constant value of the expression.
func GetConstValue(expr *exprv1.Expr) (any, error) {
	v, ok := expr.ExprKind.(*exprv1.Expr_ConstExpr)
	if !ok {
		return nil, errors.New("invalid constant expression")
	}

	switch v.ConstExpr.ConstantKind.(type) {
	case *exprv1.Constant_StringValue:
		return v.ConstExpr.GetStringValue(), nil
	case *exprv1.Constant_Int64Value:
		return v.ConstExpr.GetInt64Value(), nil
	case *exprv1.Constant_Uint64Value:
		return v.ConstExpr.GetUint64Value(), nil
	case *exprv1.Constant_DoubleValue:
		return v.ConstExpr.GetDoubleValue(), nil
	case *exprv1.Constant_BoolValue:
		return v.ConstExpr.GetBoolValue(), nil
	default:
		return nil, errors.New("unexpected constant type")
	}
}

// GetIdentExprName returns the name of the identifier expression.
func GetIdentExprName(expr *exprv1.Expr) (string, error) {
	_, ok := expr.ExprKind.(*exprv1.Expr_IdentExpr)
	if !ok {
		return "", errors.New("invalid identifier expression")
	}
	return expr.GetIdentExpr().GetName(), nil
}
