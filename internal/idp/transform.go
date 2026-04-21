package idp

import (
	"reflect"

	"github.com/expr-lang/expr"
	"github.com/pkg/errors"
)

const (
	// maxIdentifierTransformLength caps the expression string stored in the
	// IdP config. Prevents excessive compilation cost from pathologically
	// large expressions at sign-in time.
	maxIdentifierTransformLength = 1024

	// maxTransformOutputLength caps the string returned by the expression
	// before it is passed to validateUsername. validateUsername already
	// enforces UIDMatcher (max 36 chars), so this is a defence-in-depth
	// guard against multi-MB return values.
	maxTransformOutputLength = 255
)

// ApplyIdentifierTransform evaluates expression against identifier and returns
// the transformed string. expression must be an expr-lang expression that
// receives the variable `identifier` (string) and returns a non-empty string.
//
// An empty expression is a no-op: the original identifier is returned unchanged.
//
// expr-lang expressions are pure: the language has no loop constructs, no I/O,
// and no access to Go APIs. expr.Env() puts the compiler in strict mode — only
// the `identifier` variable is accessible. No timeout goroutine is needed
// because unbounded execution is not possible.
func ApplyIdentifierTransform(expression, identifier string) (string, error) {
	if expression == "" {
		return identifier, nil
	}
	if len(expression) > maxIdentifierTransformLength {
		return "", errors.Errorf("identifier transform expression exceeds maximum length of %d", maxIdentifierTransformLength)
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
	if len(output) > maxTransformOutputLength {
		return "", errors.Errorf("identifier transform output exceeds maximum length of %d", maxTransformOutputLength)
	}
	return output, nil
}

// ValidateIdentifierTransform compiles expression to catch syntax and type
// errors at save time without running it. Returns nil for an empty expression.
func ValidateIdentifierTransform(expression string) error {
	if expression == "" {
		return nil
	}
	if len(expression) > maxIdentifierTransformLength {
		return errors.Errorf("identifier transform expression exceeds maximum length of %d", maxIdentifierTransformLength)
	}
	env := map[string]any{"identifier": ""}
	_, err := expr.Compile(expression, expr.Env(env), expr.AsKind(reflect.String))
	if err != nil {
		return errors.Wrap(err, "invalid identifier transform expression")
	}
	return nil
}
