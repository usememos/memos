package ast

type BaseInline struct {
	BaseNode
}

type Text struct {
	BaseInline

	Content string
}

var NodeTypeText = NewNodeType("Text")

func (*Text) Type() NodeType {
	return NodeTypeText
}

func (n *Text) String() string {
	return n.Type().String() + " " + n.Content
}

type Bold struct {
	BaseInline

	// Symbol is "*" or "_".
	Symbol  string
	Content string
}

var NodeTypeBold = NewNodeType("Bold")

func (*Bold) Type() NodeType {
	return NodeTypeBold
}

func (n *Bold) String() string {
	return n.Type().String() + " " + n.Symbol + " " + n.Content
}

type Italic struct {
	BaseInline

	// Symbol is "*" or "_".
	Symbol  string
	Content string
}

var NodeTypeItalic = NewNodeType("Italic")

func (*Italic) Type() NodeType {
	return NodeTypeItalic
}

func (n *Italic) String() string {
	return n.Type().String() + " " + n.Symbol + " " + n.Content
}

type BoldItalic struct {
	BaseInline

	// Symbol is "*" or "_".
	Symbol  string
	Content string
}

var NodeTypeBoldItalic = NewNodeType("BoldItalic")

func (*BoldItalic) Type() NodeType {
	return NodeTypeBoldItalic
}

func (n *BoldItalic) String() string {
	return n.Type().String() + " " + n.Symbol + " " + n.Content
}

type Code struct {
	BaseInline

	Content string
}

var NodeTypeCode = NewNodeType("Code")

func (*Code) Type() NodeType {
	return NodeTypeCode
}

func (n *Code) String() string {
	return n.Type().String() + " " + n.Content
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

func (n *Image) String() string {
	return n.Type().String() + " " + n.AltText + " " + n.URL
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

func (n *Link) String() string {
	return n.Type().String() + " " + n.Text + " " + n.URL
}

type Tag struct {
	BaseInline

	Content string
}

var NodeTypeTag = NewNodeType("Tag")

func (*Tag) Type() NodeType {
	return NodeTypeTag
}

func (n *Tag) String() string {
	return n.Type().String() + " " + n.Content
}

type Strikethrough struct {
	BaseInline

	Content string
}

var NodeTypeStrikethrough = NewNodeType("Strikethrough")

func (*Strikethrough) Type() NodeType {
	return NodeTypeStrikethrough
}

func (n *Strikethrough) String() string {
	return n.Type().String() + " " + n.Content
}
