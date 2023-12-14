package ast

type BaseInline struct {
	BaseNode
}

type Text struct {
	BaseInline

	Content string
}

func (*Text) Type() NodeType {
	return TextNode
}

type Bold struct {
	BaseInline

	// Symbol is "*" or "_".
	Symbol  string
	Content string
}

func (*Bold) Type() NodeType {
	return BoldNode
}

type Italic struct {
	BaseInline

	// Symbol is "*" or "_".
	Symbol  string
	Content string
}

func (*Italic) Type() NodeType {
	return ItalicNode
}

type BoldItalic struct {
	BaseInline

	// Symbol is "*" or "_".
	Symbol  string
	Content string
}

func (*BoldItalic) Type() NodeType {
	return BoldItalicNode
}

type Code struct {
	BaseInline

	Content string
}

func (*Code) Type() NodeType {
	return CodeNode
}

type Image struct {
	BaseInline

	AltText string
	URL     string
}

func (*Image) Type() NodeType {
	return ImageNode
}

type Link struct {
	BaseInline

	Text string
	URL  string
}

func (*Link) Type() NodeType {
	return LinkNode
}

type Tag struct {
	BaseInline

	Content string
}

func (*Tag) Type() NodeType {
	return TagNode
}

type Strikethrough struct {
	BaseInline

	Content string
}

func (*Strikethrough) Type() NodeType {
	return StrikethroughNode
}
