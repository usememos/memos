package filter

import (
	"github.com/google/cel-go/cel"
	"github.com/pkg/errors"
	exprv1 "google.golang.org/genproto/googleapis/api/expr/v1alpha1"
)

// MemoFilterCELAttributes are the CEL attributes for memo.
var MemoFilterCELAttributes = []cel.EnvOption{
	cel.Variable("content", cel.StringType),
	// As the built-in timestamp type is deprecated, we use string type for now.
	// e.g., "2021-01-01T00:00:00Z"
	cel.Variable("create_time", cel.StringType),
	cel.Variable("tag", cel.StringType),
	cel.Variable("update_time", cel.StringType),
	cel.Variable("visibility", cel.StringType),
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
