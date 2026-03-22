package filter

// Condition represents a boolean expression derived from the CEL filter.
type Condition interface {
	isCondition()
}

// LogicalOperator enumerates the supported logical operators.
type LogicalOperator string

const (
	LogicalAnd LogicalOperator = "AND"
	LogicalOr  LogicalOperator = "OR"
)

// LogicalCondition composes two conditions with a logical operator.
type LogicalCondition struct {
	Operator LogicalOperator
	Left     Condition
	Right    Condition
}

func (*LogicalCondition) isCondition() {}

// NotCondition negates a child condition.
type NotCondition struct {
	Expr Condition
}

func (*NotCondition) isCondition() {}

// FieldPredicateCondition asserts that a field evaluates to true.
type FieldPredicateCondition struct {
	Field string
}

func (*FieldPredicateCondition) isCondition() {}

// ComparisonOperator lists supported comparison operators.
type ComparisonOperator string

const (
	CompareEq  ComparisonOperator = "="
	CompareNeq ComparisonOperator = "!="
	CompareLt  ComparisonOperator = "<"
	CompareLte ComparisonOperator = "<="
	CompareGt  ComparisonOperator = ">"
	CompareGte ComparisonOperator = ">="
)

// ComparisonCondition represents a binary comparison.
type ComparisonCondition struct {
	Left     ValueExpr
	Operator ComparisonOperator
	Right    ValueExpr
}

func (*ComparisonCondition) isCondition() {}

// InCondition represents an IN predicate with literal list values.
type InCondition struct {
	Left   ValueExpr
	Values []ValueExpr
}

func (*InCondition) isCondition() {}

// ElementInCondition represents the CEL syntax `"value" in field`.
type ElementInCondition struct {
	Element ValueExpr
	Field   string
}

func (*ElementInCondition) isCondition() {}

// ContainsCondition models the <field>.contains(<value>) call.
type ContainsCondition struct {
	Field string
	Value string
}

func (*ContainsCondition) isCondition() {}

// ConstantCondition captures a literal boolean outcome.
type ConstantCondition struct {
	Value bool
}

func (*ConstantCondition) isCondition() {}

// ValueExpr models arithmetic or scalar expressions whose result feeds a comparison.
type ValueExpr interface {
	isValueExpr()
}

// FieldRef references a named schema field.
type FieldRef struct {
	Name string
}

func (*FieldRef) isValueExpr() {}

// LiteralValue holds a literal scalar.
type LiteralValue struct {
	Value interface{}
}

func (*LiteralValue) isValueExpr() {}

// FunctionValue captures simple function calls like size(tags).
type FunctionValue struct {
	Name string
	Args []ValueExpr
}

func (*FunctionValue) isValueExpr() {}

// ListComprehensionCondition represents CEL macros like exists(), all(), filter().
type ListComprehensionCondition struct {
	Kind      ComprehensionKind
	Field     string        // The list field to iterate over (e.g., "tags")
	IterVar   string        // The iteration variable name (e.g., "t")
	Predicate PredicateExpr // The predicate to evaluate for each element
}

func (*ListComprehensionCondition) isCondition() {}

// ComprehensionKind enumerates the types of list comprehensions.
type ComprehensionKind string

const (
	ComprehensionExists ComprehensionKind = "exists"
)

// PredicateExpr represents predicates used in comprehensions.
type PredicateExpr interface {
	isPredicateExpr()
}

// StartsWithPredicate represents t.startsWith("prefix").
type StartsWithPredicate struct {
	Prefix string
}

func (*StartsWithPredicate) isPredicateExpr() {}

// EndsWithPredicate represents t.endsWith("suffix").
type EndsWithPredicate struct {
	Suffix string
}

func (*EndsWithPredicate) isPredicateExpr() {}

// ContainsPredicate represents t.contains("substring").
type ContainsPredicate struct {
	Substring string
}

func (*ContainsPredicate) isPredicateExpr() {}
