package filter

import (
	"time"

	"github.com/google/cel-go/cel"
	"github.com/google/cel-go/common/types"
	"github.com/google/cel-go/common/types/ref"
	"github.com/pkg/errors"
	exprv1 "google.golang.org/genproto/googleapis/api/expr/v1alpha1"
)

// MemoFilterCELAttributes are the CEL attributes for memo.
var MemoFilterCELAttributes = []cel.EnvOption{
	cel.Variable("content", cel.StringType),
	cel.Variable("creator_id", cel.IntType),
	cel.Variable("created_ts", cel.IntType),
	cel.Variable("updated_ts", cel.IntType),
	cel.Variable("pinned", cel.BoolType),
	cel.Variable("tag", cel.StringType),
	cel.Variable("tags", cel.ListType(cel.StringType)),
	cel.Variable("visibility", cel.StringType),
	cel.Variable("has_task_list", cel.BoolType),
	cel.Variable("has_link", cel.BoolType),
	cel.Variable("has_code", cel.BoolType),
	cel.Variable("has_incomplete_tasks", cel.BoolType),
	// Current timestamp function.
	cel.Function("now",
		cel.Overload("now",
			[]*cel.Type{},
			cel.IntType,
			cel.FunctionBinding(func(_ ...ref.Val) ref.Val {
				return types.Int(time.Now().Unix())
			}),
		),
	),
}

// ReactionFilterCELAttributes are the CEL attributes for reaction.
var ReactionFilterCELAttributes = []cel.EnvOption{
	cel.Variable("content_id", cel.StringType),
}

// UserFilterCELAttributes are the CEL attributes for user.
var UserFilterCELAttributes = []cel.EnvOption{
	cel.Variable("username", cel.StringType),
}

// AttachmentFilterCELAttributes are the CEL attributes for user.
var AttachmentFilterCELAttributes = []cel.EnvOption{
	cel.Variable("memo_id", cel.StringType),
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
