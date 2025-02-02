package filter

import (
	"github.com/google/cel-go/cel"
	"github.com/pkg/errors"
	exprv1 "google.golang.org/genproto/googleapis/api/expr/v1alpha1"
)

// MemoFilterCELAttributes are the CEL attributes for memo.
var MemoFilterCELAttributes = []cel.EnvOption{
	cel.Variable("content", cel.StringType),
	cel.Variable("tag", cel.StringType),
}

// Parse parses the filter string and returns the parsed expression.
// The filter string should be a CEL expression.
func Parse(filter string, opts ...cel.EnvOption) (expr *exprv1.ParsedExpr, err error) {
	e, err := cel.NewEnv(opts...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create CEL environment")
	}
	ast, issues := e.Compile(filter)
	if issues != nil {
		return nil, errors.Errorf("failed to compile filter: %v", issues)
	}
	return cel.AstToParsedExpr(ast)
}

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
