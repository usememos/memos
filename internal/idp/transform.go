package idp

import (
	"reflect"

	"github.com/expr-lang/expr"
	"github.com/pkg/errors"
)

// ApplyIdentifierTransform evaluates expression against identifier and returns
// the transformed string. expression must be an expr-lang expression that
// receives the variable `identifier` (string) and returns a non-empty string.
//
// An empty expression is a no-op: the original identifier is returned unchanged.
func ApplyIdentifierTransform(expression, identifier string) (string, error) {
	if expression == "" {
		return identifier, nil
	}

	env := map[string]any{"identifier": identifier}
	program, err := expr.Compile(expression, expr.Env(env), expr.AsKind(reflect.String))
	if err != nil {
		return "", errors.Wrap(err, "invalid identifier transform expression")
	}

	result, err := expr.Run(program, env)
	if err != nil {
		return "", errors.Wrap(err, "failed to run identifier transform expression")
	}

	output, ok := result.(string)
	if !ok || output == "" {
		return "", errors.New("identifier transform expression must return a non-empty string")
	}
	return output, nil
}

// ValidateIdentifierTransform compiles expression to catch syntax and type
// errors at save time without running it. Returns nil for an empty expression.
func ValidateIdentifierTransform(expression string) error {
	if expression == "" {
		return nil
	}
	env := map[string]any{"identifier": ""}
	_, err := expr.Compile(expression, expr.Env(env), expr.AsKind(reflect.String))
	if err != nil {
		return errors.Wrap(err, "invalid identifier transform expression")
	}
	return nil
}
