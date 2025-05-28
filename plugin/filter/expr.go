package filter

import (
	"errors"
	"time"

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

// GetFunctionValue evaluates CEL function calls and returns their value.
// This is specifically for time functions like now().
func GetFunctionValue(expr *exprv1.Expr) (any, error) {
	callExpr, ok := expr.ExprKind.(*exprv1.Expr_CallExpr)
	if !ok {
		return nil, errors.New("invalid function call expression")
	}

	switch callExpr.CallExpr.Function {
	case "now":
		if len(callExpr.CallExpr.Args) != 0 {
			return nil, errors.New("now() function takes no arguments")
		}
		return time.Now().Unix(), nil
	case "_-_":
		// Handle subtraction for expressions like "now() - 60 * 60 * 24"
		if len(callExpr.CallExpr.Args) != 2 {
			return nil, errors.New("subtraction requires exactly two arguments")
		}
		left, err := GetExprValue(callExpr.CallExpr.Args[0])
		if err != nil {
			return nil, err
		}
		right, err := GetExprValue(callExpr.CallExpr.Args[1])
		if err != nil {
			return nil, err
		}
		leftInt, ok1 := left.(int64)
		rightInt, ok2 := right.(int64)
		if !ok1 || !ok2 {
			return nil, errors.New("subtraction operands must be integers")
		}
		return leftInt - rightInt, nil
	case "_*_":
		// Handle multiplication for expressions like "60 * 60 * 24"
		if len(callExpr.CallExpr.Args) != 2 {
			return nil, errors.New("multiplication requires exactly two arguments")
		}
		left, err := GetExprValue(callExpr.CallExpr.Args[0])
		if err != nil {
			return nil, err
		}
		right, err := GetExprValue(callExpr.CallExpr.Args[1])
		if err != nil {
			return nil, err
		}
		leftInt, ok1 := left.(int64)
		rightInt, ok2 := right.(int64)
		if !ok1 || !ok2 {
			return nil, errors.New("multiplication operands must be integers")
		}
		return leftInt * rightInt, nil
	case "_+_":
		// Handle addition
		if len(callExpr.CallExpr.Args) != 2 {
			return nil, errors.New("addition requires exactly two arguments")
		}
		left, err := GetExprValue(callExpr.CallExpr.Args[0])
		if err != nil {
			return nil, err
		}
		right, err := GetExprValue(callExpr.CallExpr.Args[1])
		if err != nil {
			return nil, err
		}
		leftInt, ok1 := left.(int64)
		rightInt, ok2 := right.(int64)
		if !ok1 || !ok2 {
			return nil, errors.New("addition operands must be integers")
		}
		return leftInt + rightInt, nil
	default:
		return nil, errors.New("unsupported function: " + callExpr.CallExpr.Function)
	}
}

// GetExprValue attempts to get a value from an expression, trying constants first, then functions.
func GetExprValue(expr *exprv1.Expr) (any, error) {
	// Try to get constant value first
	if constValue, err := GetConstValue(expr); err == nil {
		return constValue, nil
	}

	// If not a constant, try to evaluate as a function
	return GetFunctionValue(expr)
}
