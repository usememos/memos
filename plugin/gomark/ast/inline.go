package ast

type BaseInline struct{}

type Text struct {
	BaseInline

	Content string
}

var NodeTypeText = NewNodeType("Text")

func NewText(content string) *Text {
	return &Text{
		Content: content,
	}
}

func (*Text) Type() NodeType {
	return NodeTypeText
}

type Bold struct {
	BaseInline

	// Symbol is "*" or "_"
	Symbol  string
	Content string
}

var NodeTypeBold = NewNodeType("Bold")

func NewBold(symbol, content string) *Bold {
	return &Bold{
		Symbol:  symbol,
		Content: content,
	}
}

func (*Bold) Type() NodeType {
	return NodeTypeBold
}
