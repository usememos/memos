package v1

import (
	"strings"

	"github.com/google/cel-go/cel"
	"github.com/google/cel-go/common/ast"
	"github.com/pkg/errors"
)

func extractWebhookIDFromName(name string) string {
	parts := strings.Split(name, "/")
	if len(parts) >= 4 && parts[0] == "users" && parts[2] == "webhooks" {
		return parts[3]
	}
	return ""
}

// extractUsernameFromFilter extracts username from the filter string using CEL.
// Supported filter format: "username == 'steven'"
// Returns the username value and an error if the filter format is invalid.
func extractUsernameFromFilter(filterStr string) (string, error) {
	filterStr = strings.TrimSpace(filterStr)
	if filterStr == "" {
		return "", nil
	}

	// Create CEL environment with username variable
	env, err := cel.NewEnv(
		cel.Variable("username", cel.StringType),
	)
	if err != nil {
		return "", errors.Wrap(err, "failed to create CEL environment")
	}

	// Parse and check the filter expression
	celAST, issues := env.Compile(filterStr)
	if issues != nil && issues.Err() != nil {
		return "", errors.Wrapf(issues.Err(), "invalid filter expression: %s", filterStr)
	}

	// Extract username from the AST
	username, err := extractUsernameFromAST(celAST.NativeRep().Expr())
	if err != nil {
		return "", err
	}

	return username, nil
}

// extractUsernameFromAST extracts the username value from a CEL AST expression.
func extractUsernameFromAST(expr ast.Expr) (string, error) {
	if expr == nil {
		return "", errors.New("empty expression")
	}

	// Check if this is a call expression (for ==, !=, etc.)
	if expr.Kind() != ast.CallKind {
		return "", errors.New("filter must be a comparison expression (e.g., username == 'value')")
	}

	call := expr.AsCall()

	// We only support == operator
	if call.FunctionName() != "_==_" {
		return "", errors.Errorf("unsupported operator: %s (only '==' is supported)", call.FunctionName())
	}

	// The call should have exactly 2 arguments
	args := call.Args()
	if len(args) != 2 {
		return "", errors.New("invalid comparison expression")
	}

	// Try to extract username from either left or right side
	if username, ok := extractUsernameFromComparison(args[0], args[1]); ok {
		return username, nil
	}
	if username, ok := extractUsernameFromComparison(args[1], args[0]); ok {
		return username, nil
	}

	return "", errors.New("filter must compare 'username' field with a string constant")
}

// extractUsernameFromComparison tries to extract username value if left is 'username' ident and right is a string constant.
func extractUsernameFromComparison(left, right ast.Expr) (string, bool) {
	// Check if left side is 'username' identifier
	if left.Kind() != ast.IdentKind {
		return "", false
	}
	ident := left.AsIdent()
	if ident != "username" {
		return "", false
	}

	// Right side should be a constant string
	if right.Kind() != ast.LiteralKind {
		return "", false
	}
	literal := right.AsLiteral()

	// literal is a ref.Val, we need to get the Go value
	str, ok := literal.Value().(string)
	if !ok || str == "" {
		return "", false
	}

	return str, true
}

// ListUserNotifications lists all notifications for a user.
// Notifications are backed by the inbox storage layer and represent activities
// that require user attention (e.g., memo comments).
