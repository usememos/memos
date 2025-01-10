package store

type LogicOperator string

const (
	AND LogicOperator = "AND"
	OR  LogicOperator = "OR"
)

type QueryExpression struct {
	Operator LogicOperator
	Children []*QueryExpression
}
