package d1

import (
	"errors"
	"strings"
)

// guardTable backs conditional writes inside atomic batches. Inserting the
// value 0 violates its CHECK constraint, which aborts and rolls back the
// batch; the table never holds rows. Driver methods use it to re-verify a
// precondition read before the batch so a concurrent change cannot slip a
// partial write through.
const guardTable = "d1_guard"

// guardConstraint names the CHECK so a guard failure is recognizable in the
// error message returned by D1.
const guardConstraint = "d1_guard_ok"

// guardStatement builds the assertion statement for condition. The insert
// selects a violating row only when the condition is false.
func guardStatement(condition string, args ...any) statement {
	return statement{
		SQL:  "INSERT INTO " + guardTable + " (ok) SELECT 0 WHERE NOT (" + condition + ")",
		Args: args,
	}
}

// isGuardFailure reports whether err is a batch aborted by a guard statement.
func isGuardFailure(err error) bool {
	var d1Err *Error
	if !errors.As(err, &d1Err) {
		return false
	}
	return strings.Contains(d1Err.Message, guardConstraint)
}

// guardError maps a batch error to conflict when the batch was aborted by a
// guard and returns the original error otherwise.
func guardError(err error, conflict error) error {
	if isGuardFailure(err) {
		return conflict
	}
	return err
}
