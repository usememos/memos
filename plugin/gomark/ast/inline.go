package ast

type BaseInline struct{}

type Text struct {
	BaseInline

	Content string
}

var NodeTypeText = NewNodeType("Text")

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

func (*Bold) Type() NodeType {
	return NodeTypeBold
}

type Code struct {
	BaseInline

	Content string
}

var NodeTypeCode = NewNodeType("Code")

func (*Code) Type() NodeType {
	return NodeTypeCode
}

type Image struct {
	BaseInline

	AltText string
	URL     string
}

var NodeTypeImage = NewNodeType("Image")

func (*Image) Type() NodeType {
	return NodeTypeImage
}

type Link struct {
	BaseInline

	Text string
	URL  string
}

var NodeTypeLink = NewNodeType("Link")

func (*Link) Type() NodeType {
	return NodeTypeLink
}

type Italic struct {
	BaseInline

	// Symbol is "*" or "_"
	Symbol  string
	Content string
}

var NodeTypeItalic = NewNodeType("Italic")

func (*Italic) Type() NodeType {
	return NodeTypeItalic
}

type Tag struct {
	BaseInline

	Content string
}

var NodeTypeTag = NewNodeType("Tag")

func (*Tag) Type() NodeType {
	return NodeTypeTag
}
