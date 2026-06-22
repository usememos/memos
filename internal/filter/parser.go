package filter

import (
	"time"

	"github.com/pkg/errors"
	exprv1 "google.golang.org/genproto/googleapis/api/expr/v1alpha1"
)

// parseContext carries the schema plus the frozen evaluation time used to fold
// the `now` variable into a constant. Freezing once per compile guarantees a
// single filter observes a single instant.
type parseContext struct {
	schema Schema
	now    time.Time
}

func buildCondition(expr *exprv1.Expr, pc parseContext) (Condition, error) {
	switch v := expr.ExprKind.(type) {
	case *exprv1.Expr_CallExpr:
		return buildCallCondition(v.CallExpr, pc)
	case *exprv1.Expr_ConstExpr:
		val, err := getConstValue(expr)
		if err != nil {
			return nil, err
		}
		if v, ok := val.(bool); ok {
			return &ConstantCondition{Value: v}, nil
		}
		return nil, errors.New("filter must evaluate to a boolean value")
	case *exprv1.Expr_IdentExpr:
		name := v.IdentExpr.GetName()
		field, ok := pc.schema.Field(name)
		if !ok {
			return nil, errors.Errorf("unknown identifier %q", name)
		}
		if field.Type != FieldTypeBool {
			return nil, errors.Errorf("identifier %q is not boolean", name)
		}
		return &FieldPredicateCondition{Field: name}, nil
	case *exprv1.Expr_ComprehensionExpr:
		return buildComprehensionCondition(v.ComprehensionExpr, pc.schema)
	default:
		return nil, errors.New("unsupported top-level expression")
	}
}

func buildCallCondition(call *exprv1.Expr_Call, pc parseContext) (Condition, error) {
	switch call.Function {
	case "_&&_":
		if len(call.Args) != 2 {
			return nil, errors.New("logical AND expects two arguments")
		}
		left, err := buildCondition(call.Args[0], pc)
		if err != nil {
			return nil, err
		}
		right, err := buildCondition(call.Args[1], pc)
		if err != nil {
			return nil, err
		}
		return &LogicalCondition{
			Operator: LogicalAnd,
			Left:     left,
			Right:    right,
		}, nil
	case "_||_":
		if len(call.Args) != 2 {
			return nil, errors.New("logical OR expects two arguments")
		}
		left, err := buildCondition(call.Args[0], pc)
		if err != nil {
			return nil, err
		}
		right, err := buildCondition(call.Args[1], pc)
		if err != nil {
			return nil, err
		}
		return &LogicalCondition{
			Operator: LogicalOr,
			Left:     left,
			Right:    right,
		}, nil
	case "!_":
		if len(call.Args) != 1 {
			return nil, errors.New("logical NOT expects one argument")
		}
		child, err := buildCondition(call.Args[0], pc)
		if err != nil {
			return nil, err
		}
		return &NotCondition{Expr: child}, nil
	case "_==_", "_!=_", "_<_", "_>_", "_<=_", "_>=_":
		return buildComparisonCondition(call, pc)
	case "@in":
		return buildInCondition(call, pc)
	case "contains":
		return buildTextMatchCondition(call, pc.schema, TextMatchContains)
	case "startsWith":
		return buildTextMatchCondition(call, pc.schema, TextMatchPrefix)
	case "endsWith":
		return buildTextMatchCondition(call, pc.schema, TextMatchSuffix)
	case "matches":
		return buildMatchesCondition(call, pc.schema)
	case "sets.contains", "sets.intersects", "sets.equivalent":
		return buildSetCondition(call, pc)
	default:
		val, ok, err := evaluateBool(call)
		if err != nil {
			return nil, err
		}
		if ok {
			return &ConstantCondition{Value: val}, nil
		}
		return nil, errors.Errorf("unsupported call expression %q", call.Function)
	}
}

func buildComparisonCondition(call *exprv1.Expr_Call, pc parseContext) (Condition, error) {
	if len(call.Args) != 2 {
		return nil, errors.New("comparison expects two arguments")
	}
	op, err := toComparisonOperator(call.Function)
	if err != nil {
		return nil, err
	}

	left, err := buildValueExpr(call.Args[0], pc)
	if err != nil {
		return nil, err
	}
	right, err := buildValueExpr(call.Args[1], pc)
	if err != nil {
		return nil, err
	}

	// If the left side is a field, validate allowed operators.
	if field, ok := left.(*FieldRef); ok {
		def, exists := pc.schema.Field(field.Name)
		if !exists {
			return nil, errors.Errorf("unknown identifier %q", field.Name)
		}
		if def.Kind == FieldKindVirtualAlias {
			def, exists = pc.schema.ResolveAlias(field.Name)
			if !exists {
				return nil, errors.Errorf("invalid alias %q", field.Name)
			}
		}
		if def.AllowedComparisonOps != nil {
			if _, allowed := def.AllowedComparisonOps[op]; !allowed {
				return nil, errors.Errorf("operator %s not allowed for field %q", op, field.Name)
			}
		}
	}

	return &ComparisonCondition{
		Left:     left,
		Operator: op,
		Right:    right,
	}, nil
}

func buildInCondition(call *exprv1.Expr_Call, pc parseContext) (Condition, error) {
	if len(call.Args) != 2 {
		return nil, errors.New("in operator expects two arguments")
	}

	// Handle identifier in list syntax.
	if identName, err := getIdentName(call.Args[0]); err == nil {
		if field, ok := pc.schema.Field(identName); ok && field.Kind == FieldKindVirtualAlias {
			if _, aliasOk := pc.schema.ResolveAlias(identName); !aliasOk {
				return nil, errors.Errorf("invalid alias %q", identName)
			}
		} else if !ok {
			return nil, errors.Errorf("unknown identifier %q", identName)
		}

		if listExpr := call.Args[1].GetListExpr(); listExpr != nil {
			values := make([]ValueExpr, 0, len(listExpr.Elements))
			for _, element := range listExpr.Elements {
				value, err := buildValueExpr(element, pc)
				if err != nil {
					return nil, err
				}
				values = append(values, value)
			}
			return &InCondition{
				Left:   &FieldRef{Name: identName},
				Values: values,
			}, nil
		}
	}

	// Handle "value in identifier" syntax.
	if identName, err := getIdentName(call.Args[1]); err == nil {
		if _, ok := pc.schema.Field(identName); !ok {
			return nil, errors.Errorf("unknown identifier %q", identName)
		}
		element, err := buildValueExpr(call.Args[0], pc)
		if err != nil {
			return nil, err
		}
		return &ElementInCondition{
			Element: element,
			Field:   identName,
		}, nil
	}

	return nil, errors.New("invalid use of in operator")
}

func buildTextMatchCondition(call *exprv1.Expr_Call, schema Schema, mode TextMatchMode) (Condition, error) {
	if call.Target == nil {
		return nil, errors.New("text match requires a target")
	}
	targetName, err := getIdentName(call.Target)
	if err != nil {
		return nil, err
	}

	field, ok := schema.Field(targetName)
	if !ok {
		return nil, errors.Errorf("unknown identifier %q", targetName)
	}
	if !field.SupportsContains {
		return nil, errors.Errorf("identifier %q does not support text matching", targetName)
	}
	if len(call.Args) != 1 {
		return nil, errors.New("text match expects exactly one argument")
	}
	value, err := getConstValue(call.Args[0])
	if err != nil {
		return nil, errors.Wrap(err, "text match only supports literal arguments")
	}
	str, ok := value.(string)
	if !ok {
		return nil, errors.New("text match argument must be a string")
	}
	return &TextMatchCondition{
		Field: targetName,
		Mode:  mode,
		Value: str,
	}, nil
}

func buildMatchesCondition(call *exprv1.Expr_Call, schema Schema) (Condition, error) {
	if call.Target == nil {
		return nil, errors.New("matches requires a target")
	}
	targetName, err := getIdentName(call.Target)
	if err != nil {
		return nil, err
	}

	field, ok := schema.Field(targetName)
	if !ok {
		return nil, errors.Errorf("unknown identifier %q", targetName)
	}
	if !field.SupportsContains {
		return nil, errors.Errorf("identifier %q does not support matches()", targetName)
	}
	if len(call.Args) != 1 {
		return nil, errors.New("matches expects exactly one argument")
	}
	value, err := getConstValue(call.Args[0])
	if err != nil {
		return nil, errors.Wrap(err, "matches only supports literal arguments")
	}
	pattern, ok := value.(string)
	if !ok {
		return nil, errors.New("matches argument must be a string")
	}
	return &RegexCondition{
		Field:   targetName,
		Pattern: pattern,
	}, nil
}

func buildValueExpr(expr *exprv1.Expr, pc parseContext) (ValueExpr, error) {
	if identName, err := getIdentName(expr); err == nil {
		// `now` is not a schema field; it folds to the frozen evaluation time.
		if identName == "now" {
			return &LiteralValue{Value: pc.now.Unix()}, nil
		}
		if _, ok := pc.schema.Field(identName); !ok {
			return nil, errors.Errorf("unknown identifier %q", identName)
		}
		return &FieldRef{Name: identName}, nil
	}

	if literal, err := getConstValue(expr); err == nil {
		return &LiteralValue{Value: literal}, nil
	}

	if value, ok, err := evaluateNumeric(expr, pc.now); err != nil {
		return nil, err
	} else if ok {
		return &LiteralValue{Value: value}, nil
	}

	if boolVal, ok, err := evaluateBoolExpr(expr); err != nil {
		return nil, err
	} else if ok {
		return &LiteralValue{Value: boolVal}, nil
	}

	if call := expr.GetCallExpr(); call != nil {
		if call.Target != nil && isTimestampAccessor(call.Function) {
			return buildTimestampAccessor(call, pc.schema)
		}
		switch call.Function {
		case "size":
			if len(call.Args) != 1 {
				return nil, errors.New("size() expects one argument")
			}
			arg, err := buildValueExpr(call.Args[0], pc)
			if err != nil {
				return nil, err
			}
			return &FunctionValue{
				Name: "size",
				Args: []ValueExpr{arg},
			}, nil
		case "_+_", "_-_", "_*_":
			value, ok, err := evaluateNumeric(expr, pc.now)
			if err != nil {
				return nil, err
			}
			if ok {
				return &LiteralValue{Value: value}, nil
			}
		default:
			// Fall through to error return below
		}
	}

	return nil, errors.New("unsupported value expression")
}

func toComparisonOperator(fn string) (ComparisonOperator, error) {
	switch fn {
	case "_==_":
		return CompareEq, nil
	case "_!=_":
		return CompareNeq, nil
	case "_<_":
		return CompareLt, nil
	case "_>_":
		return CompareGt, nil
	case "_<=_":
		return CompareLte, nil
	case "_>=_":
		return CompareGte, nil
	default:
		return "", errors.Errorf("unsupported comparison operator %q", fn)
	}
}

func getIdentName(expr *exprv1.Expr) (string, error) {
	if ident := expr.GetIdentExpr(); ident != nil {
		return ident.GetName(), nil
	}
	return "", errors.New("expression is not an identifier")
}

func getConstValue(expr *exprv1.Expr) (interface{}, error) {
	v, ok := expr.ExprKind.(*exprv1.Expr_ConstExpr)
	if !ok {
		return nil, errors.New("expression is not a literal")
	}
	switch x := v.ConstExpr.ConstantKind.(type) {
	case *exprv1.Constant_StringValue:
		return v.ConstExpr.GetStringValue(), nil
	case *exprv1.Constant_Int64Value:
		return v.ConstExpr.GetInt64Value(), nil
	case *exprv1.Constant_Uint64Value:
		return int64(v.ConstExpr.GetUint64Value()), nil
	case *exprv1.Constant_DoubleValue:
		return v.ConstExpr.GetDoubleValue(), nil
	case *exprv1.Constant_BoolValue:
		return v.ConstExpr.GetBoolValue(), nil
	case *exprv1.Constant_NullValue:
		return nil, nil
	default:
		return nil, errors.Errorf("unsupported constant %T", x)
	}
}

func evaluateBool(call *exprv1.Expr_Call) (bool, bool, error) {
	val, ok, err := evaluateBoolExpr(&exprv1.Expr{ExprKind: &exprv1.Expr_CallExpr{CallExpr: call}})
	return val, ok, err
}

func evaluateBoolExpr(expr *exprv1.Expr) (bool, bool, error) {
	if literal, err := getConstValue(expr); err == nil {
		if b, ok := literal.(bool); ok {
			return b, true, nil
		}
		return false, false, nil
	}
	if call := expr.GetCallExpr(); call != nil && call.Function == "!_" {
		if len(call.Args) != 1 {
			return false, false, errors.New("NOT expects exactly one argument")
		}
		val, ok, err := evaluateBoolExpr(call.Args[0])
		if err != nil || !ok {
			return false, false, err
		}
		return !val, true, nil
	}
	return false, false, nil
}

// evaluateNumeric constant-folds an expression to an int64 measured in seconds:
// timestamps and `now` fold to Unix epoch seconds, durations fold to a number of
// seconds, and the two combine through standard arithmetic. CEL has already
// type-checked the operand combinations, so the folded int math is well-formed.
func evaluateNumeric(expr *exprv1.Expr, now time.Time) (int64, bool, error) {
	if literal, err := getConstValue(expr); err == nil {
		switch v := literal.(type) {
		case int64:
			return v, true, nil
		case float64:
			return int64(v), true, nil
		}
		return 0, false, nil
	}

	// The `now` variable folds to the frozen evaluation time.
	if ident := expr.GetIdentExpr(); ident != nil {
		if ident.GetName() == "now" {
			return now.Unix(), true, nil
		}
		return 0, false, nil
	}

	call := expr.GetCallExpr()
	if call == nil {
		return 0, false, nil
	}

	switch call.Function {
	case "timestamp":
		return evaluateTimestamp(call)
	case "duration":
		return evaluateDuration(call)
	case "_+_", "_-_", "_*_", "_/_", "_%_":
		if len(call.Args) != 2 {
			return 0, false, errors.New("arithmetic requires two arguments")
		}
		left, ok, err := evaluateNumeric(call.Args[0], now)
		if err != nil {
			return 0, false, err
		}
		if !ok {
			return 0, false, nil
		}
		right, ok, err := evaluateNumeric(call.Args[1], now)
		if err != nil {
			return 0, false, err
		}
		if !ok {
			return 0, false, nil
		}
		switch call.Function {
		case "_+_":
			return left + right, true, nil
		case "_-_":
			return left - right, true, nil
		case "_*_":
			return left * right, true, nil
		case "_/_":
			if right == 0 {
				return 0, false, errors.New("division by zero")
			}
			return left / right, true, nil
		case "_%_":
			if right == 0 {
				return 0, false, errors.New("modulo by zero")
			}
			return left % right, true, nil
		default:
			return 0, false, errors.Errorf("unsupported arithmetic operator %q", call.Function)
		}
	default:
		return 0, false, nil
	}
}

// evaluateTimestamp folds timestamp("RFC3339") and timestamp(<epoch int>) into
// Unix epoch seconds.
func evaluateTimestamp(call *exprv1.Expr_Call) (int64, bool, error) {
	if len(call.Args) != 1 {
		return 0, false, errors.New("timestamp() expects one argument")
	}
	value, err := getConstValue(call.Args[0])
	if err != nil {
		return 0, false, errors.Wrap(err, "timestamp() only supports literal arguments")
	}
	switch v := value.(type) {
	case string:
		ts, err := time.Parse(time.RFC3339, v)
		if err != nil {
			return 0, false, errors.Wrap(err, "invalid timestamp literal")
		}
		return ts.Unix(), true, nil
	case int64:
		return v, true, nil
	default:
		return 0, false, errors.New("timestamp() argument must be an RFC3339 string or epoch int")
	}
}

// evaluateDuration folds duration("<go-duration>") into a number of seconds.
func evaluateDuration(call *exprv1.Expr_Call) (int64, bool, error) {
	if len(call.Args) != 1 {
		return 0, false, errors.New("duration() expects one argument")
	}
	value, err := getConstValue(call.Args[0])
	if err != nil {
		return 0, false, errors.Wrap(err, "duration() only supports literal arguments")
	}
	str, ok := value.(string)
	if !ok {
		return 0, false, errors.New("duration() argument must be a string")
	}
	d, err := time.ParseDuration(str)
	if err != nil {
		return 0, false, errors.Wrap(err, "invalid duration literal")
	}
	return int64(d.Seconds()), true, nil
}

// timestampAccessors is the set of supported CEL timestamp accessor methods.
var timestampAccessors = map[string]bool{
	"getFullYear":   true,
	"getMonth":      true,
	"getDate":       true,
	"getDayOfMonth": true,
	"getDayOfWeek":  true,
	"getDayOfYear":  true,
	"getHours":      true,
	"getMinutes":    true,
	"getSeconds":    true,
}

func isTimestampAccessor(name string) bool {
	return timestampAccessors[name]
}

// buildTimestampAccessor converts created_ts.getMonth() into a FieldAccessorValue.
// Timezone arguments are rejected; extraction is UTC (see renderer).
func buildTimestampAccessor(call *exprv1.Expr_Call, schema Schema) (ValueExpr, error) {
	targetName, err := getIdentName(call.Target)
	if err != nil {
		return nil, errors.Wrap(err, "timestamp accessor requires a field target")
	}
	field, ok := schema.Field(targetName)
	if !ok {
		return nil, errors.Errorf("unknown identifier %q", targetName)
	}
	if field.Type != FieldTypeTimestamp {
		return nil, errors.Errorf("%s() is only valid on timestamp fields, got %q", call.Function, targetName)
	}
	if len(call.Args) != 0 {
		return nil, errors.Errorf("%s() with a timezone argument is not supported", call.Function)
	}
	return &FieldAccessorValue{Field: targetName, Accessor: call.Function}, nil
}

// buildSetCondition desugars ext.Sets() operations over a JSON list field into
// existing IR: membership reduces to ElementInCondition, and equivalence adds a
// length check. This relies on the list field being a set (no duplicates), which
// holds for memo tags.
func buildSetCondition(call *exprv1.Expr_Call, pc parseContext) (Condition, error) {
	if len(call.Args) != 2 {
		return nil, errors.Errorf("%s expects two arguments", call.Function)
	}

	fieldName, err := getIdentName(call.Args[0])
	if err != nil {
		return nil, errors.Wrap(err, "set operations require a list field as the first argument")
	}
	field, ok := pc.schema.Field(fieldName)
	if !ok {
		return nil, errors.Errorf("unknown identifier %q", fieldName)
	}
	if field.Kind != FieldKindJSONList {
		return nil, errors.Errorf("set operations require a list field, got %q", fieldName)
	}

	listExpr := call.Args[1].GetListExpr()
	if listExpr == nil {
		return nil, errors.New("set operations require a list literal as the second argument")
	}
	values := make([]string, 0, len(listExpr.Elements))
	for _, el := range listExpr.Elements {
		v, err := getConstValue(el)
		if err != nil {
			return nil, errors.Wrap(err, "set operations only support literal string elements")
		}
		s, ok := v.(string)
		if !ok {
			return nil, errors.New("set operations require string elements")
		}
		values = append(values, s)
	}

	membership := func(s string) Condition {
		return &ElementInCondition{Element: &LiteralValue{Value: s}, Field: fieldName}
	}
	sizeEquals := func(n int) Condition {
		return &ComparisonCondition{
			Left:     &FunctionValue{Name: "size", Args: []ValueExpr{&FieldRef{Name: fieldName}}},
			Operator: CompareEq,
			Right:    &LiteralValue{Value: int64(n)},
		}
	}

	switch call.Function {
	case "sets.contains":
		if len(values) == 0 {
			return &ConstantCondition{Value: true}, nil
		}
		return combineConditions(LogicalAnd, mapConditions(values, membership)), nil
	case "sets.intersects":
		if len(values) == 0 {
			return &ConstantCondition{Value: false}, nil
		}
		return combineConditions(LogicalOr, mapConditions(values, membership)), nil
	case "sets.equivalent":
		distinct := distinctStrings(values)
		if len(distinct) == 0 {
			return sizeEquals(0), nil
		}
		contains := combineConditions(LogicalAnd, mapConditions(distinct, membership))
		return &LogicalCondition{Operator: LogicalAnd, Left: contains, Right: sizeEquals(len(distinct))}, nil
	default:
		return nil, errors.Errorf("unsupported set operation %q", call.Function)
	}
}

func mapConditions(values []string, f func(string) Condition) []Condition {
	conds := make([]Condition, 0, len(values))
	for _, v := range values {
		conds = append(conds, f(v))
	}
	return conds
}

func combineConditions(op LogicalOperator, conds []Condition) Condition {
	result := conds[0]
	for _, c := range conds[1:] {
		result = &LogicalCondition{Operator: op, Left: result, Right: c}
	}
	return result
}

func distinctStrings(values []string) []string {
	seen := make(map[string]bool, len(values))
	out := make([]string, 0, len(values))
	for _, v := range values {
		if !seen[v] {
			seen[v] = true
			out = append(out, v)
		}
	}
	return out
}

// buildComprehensionCondition handles CEL comprehension expressions (exists, all, etc.).
func buildComprehensionCondition(comp *exprv1.Expr_Comprehension, schema Schema) (Condition, error) {
	// Determine the comprehension kind by examining the loop initialization and step
	kind, err := detectComprehensionKind(comp)
	if err != nil {
		return nil, err
	}

	// Get the field being iterated over
	iterRangeIdent := comp.IterRange.GetIdentExpr()
	if iterRangeIdent == nil {
		return nil, errors.New("comprehension range must be a field identifier")
	}
	fieldName := iterRangeIdent.GetName()

	// Validate the field
	field, ok := schema.Field(fieldName)
	if !ok {
		return nil, errors.Errorf("unknown field %q in comprehension", fieldName)
	}
	if field.Kind != FieldKindJSONList {
		return nil, errors.Errorf("field %q does not support comprehension (must be a list)", fieldName)
	}

	// Extract the predicate from the loop step
	predicate, err := extractPredicate(comp, schema)
	if err != nil {
		return nil, err
	}

	return &ListComprehensionCondition{
		Kind:      kind,
		Field:     fieldName,
		IterVar:   comp.IterVar,
		Predicate: predicate,
	}, nil
}

// detectComprehensionKind determines if this is an exists() macro.
// Only exists() is currently supported.
func detectComprehensionKind(comp *exprv1.Expr_Comprehension) (ComprehensionKind, error) {
	// Check the accumulator initialization
	accuInit := comp.AccuInit.GetConstExpr()
	if accuInit == nil {
		return "", errors.New("comprehension accumulator must be initialized with a constant")
	}

	// exists() starts with false and uses OR (||) in loop step
	if !accuInit.GetBoolValue() {
		if step := comp.LoopStep.GetCallExpr(); step != nil && step.Function == "_||_" {
			return ComprehensionExists, nil
		}
	}

	// all() starts with true and uses AND (&&) in the loop step.
	if accuInit.GetBoolValue() {
		if step := comp.LoopStep.GetCallExpr(); step != nil && step.Function == "_&&_" {
			return ComprehensionAll, nil
		}
	}

	// exists_one() starts at int(0) and increments via a conditional (predicate ?
	// accu + 1 : accu) in the loop step.
	if _, isInt := accuInit.GetConstantKind().(*exprv1.Constant_Int64Value); isInt {
		if step := comp.LoopStep.GetCallExpr(); step != nil && step.Function == "_?_:_" {
			return ComprehensionExistsOne, nil
		}
	}

	return "", errors.New("unsupported comprehension type (supported: exists, all, exists_one)")
}

// extractPredicate extracts the predicate expression from the comprehension loop step.
func extractPredicate(comp *exprv1.Expr_Comprehension, _ Schema) (PredicateExpr, error) {
	// The loop step is: @result || predicate(t) for exists
	//                or: @result && predicate(t) for all
	step := comp.LoopStep.GetCallExpr()
	if step == nil {
		return nil, errors.New("comprehension loop step must be a call expression")
	}

	// exists/all: accu || predicate  /  accu && predicate  -> predicate is arg[1].
	// exists_one: predicate ? accu + 1 : accu               -> predicate is arg[0].
	var predicateExpr *exprv1.Expr
	if step.Function == "_?_:_" {
		if len(step.Args) != 3 {
			return nil, errors.New("exists_one loop step must have three arguments")
		}
		predicateExpr = step.Args[0]
	} else {
		if len(step.Args) != 2 {
			return nil, errors.New("comprehension loop step must have two arguments")
		}
		predicateExpr = step.Args[1]
	}
	predicateCall := predicateExpr.GetCallExpr()
	if predicateCall == nil {
		return nil, errors.New("comprehension predicate must be a function call")
	}

	// Handle different predicate functions
	switch predicateCall.Function {
	case "_==_":
		return buildEqualsPredicate(predicateCall, comp.IterVar)
	case "startsWith":
		return buildStartsWithPredicate(predicateCall, comp.IterVar)
	case "endsWith":
		return buildEndsWithPredicate(predicateCall, comp.IterVar)
	case "contains":
		return buildContainsPredicate(predicateCall, comp.IterVar)
	default:
		return nil, errors.Errorf(`unsupported predicate function %q in comprehension (supported: ==, startsWith, endsWith, contains)`, predicateCall.Function)
	}
}

// buildEqualsPredicate extracts the value from t == "value".
func buildEqualsPredicate(call *exprv1.Expr_Call, iterVar string) (PredicateExpr, error) {
	if len(call.Args) != 2 {
		return nil, errors.New("equality predicate expects exactly two arguments")
	}

	var constExpr *exprv1.Expr
	switch {
	case isIterVarExpr(call.Args[0], iterVar):
		constExpr = call.Args[1]
	case isIterVarExpr(call.Args[1], iterVar):
		constExpr = call.Args[0]
	default:
		return nil, errors.Errorf("equality predicate must compare against the iteration variable %q", iterVar)
	}

	value, err := getConstValue(constExpr)
	if err != nil {
		return nil, errors.Wrap(err, "equality argument must be a constant string")
	}

	valueStr, ok := value.(string)
	if !ok {
		return nil, errors.New("equality argument must be a string")
	}

	return &EqualsPredicate{Value: valueStr}, nil
}

func isIterVarExpr(expr *exprv1.Expr, iterVar string) bool {
	target := expr.GetIdentExpr()
	return target != nil && target.GetName() == iterVar
}

// buildStartsWithPredicate extracts the pattern from t.startsWith("prefix").
func buildStartsWithPredicate(call *exprv1.Expr_Call, iterVar string) (PredicateExpr, error) {
	// Verify the target is the iteration variable
	if target := call.Target.GetIdentExpr(); target == nil || target.GetName() != iterVar {
		return nil, errors.Errorf("startsWith target must be the iteration variable %q", iterVar)
	}

	if len(call.Args) != 1 {
		return nil, errors.New("startsWith expects exactly one argument")
	}

	prefix, err := getConstValue(call.Args[0])
	if err != nil {
		return nil, errors.Wrap(err, "startsWith argument must be a constant string")
	}

	prefixStr, ok := prefix.(string)
	if !ok {
		return nil, errors.New("startsWith argument must be a string")
	}

	return &StartsWithPredicate{Prefix: prefixStr}, nil
}

// buildEndsWithPredicate extracts the pattern from t.endsWith("suffix").
func buildEndsWithPredicate(call *exprv1.Expr_Call, iterVar string) (PredicateExpr, error) {
	if target := call.Target.GetIdentExpr(); target == nil || target.GetName() != iterVar {
		return nil, errors.Errorf("endsWith target must be the iteration variable %q", iterVar)
	}

	if len(call.Args) != 1 {
		return nil, errors.New("endsWith expects exactly one argument")
	}

	suffix, err := getConstValue(call.Args[0])
	if err != nil {
		return nil, errors.Wrap(err, "endsWith argument must be a constant string")
	}

	suffixStr, ok := suffix.(string)
	if !ok {
		return nil, errors.New("endsWith argument must be a string")
	}

	return &EndsWithPredicate{Suffix: suffixStr}, nil
}

// buildContainsPredicate extracts the pattern from t.contains("substring").
func buildContainsPredicate(call *exprv1.Expr_Call, iterVar string) (PredicateExpr, error) {
	if target := call.Target.GetIdentExpr(); target == nil || target.GetName() != iterVar {
		return nil, errors.Errorf("contains target must be the iteration variable %q", iterVar)
	}

	if len(call.Args) != 1 {
		return nil, errors.New("contains expects exactly one argument")
	}

	substring, err := getConstValue(call.Args[0])
	if err != nil {
		return nil, errors.Wrap(err, "contains argument must be a constant string")
	}

	substringStr, ok := substring.(string)
	if !ok {
		return nil, errors.New("contains argument must be a string")
	}

	return &ContainsPredicate{Substring: substringStr}, nil
}
