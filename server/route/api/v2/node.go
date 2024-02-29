package v2

import (
	apiv2pb "github.com/usememos/memos/proto/gen/api/v2"
	"github.com/yourselfhosted/gomark/ast"
)

func convertFromASTNode(rawNode ast.Node) *apiv2pb.Node {
	node := &apiv2pb.Node{
		Type: apiv2pb.NodeType(apiv2pb.NodeType_value[string(rawNode.Type())]),
	}

	switch n := rawNode.(type) {
	case *ast.LineBreak:
		node.Node = &apiv2pb.Node_LineBreakNode{}
	case *ast.Paragraph:
		children := convertFromASTNodes(n.Children)
		node.Node = &apiv2pb.Node_ParagraphNode{ParagraphNode: &apiv2pb.ParagraphNode{Children: children}}
	case *ast.CodeBlock:
		node.Node = &apiv2pb.Node_CodeBlockNode{CodeBlockNode: &apiv2pb.CodeBlockNode{Language: n.Language, Content: n.Content}}
	case *ast.Heading:
		children := convertFromASTNodes(n.Children)
		node.Node = &apiv2pb.Node_HeadingNode{HeadingNode: &apiv2pb.HeadingNode{Level: int32(n.Level), Children: children}}
	case *ast.HorizontalRule:
		node.Node = &apiv2pb.Node_HorizontalRuleNode{HorizontalRuleNode: &apiv2pb.HorizontalRuleNode{Symbol: n.Symbol}}
	case *ast.Blockquote:
		children := convertFromASTNodes(n.Children)
		node.Node = &apiv2pb.Node_BlockquoteNode{BlockquoteNode: &apiv2pb.BlockquoteNode{Children: children}}
	case *ast.OrderedList:
		children := convertFromASTNodes(n.Children)
		node.Node = &apiv2pb.Node_OrderedListNode{OrderedListNode: &apiv2pb.OrderedListNode{Number: n.Number, Indent: int32(n.Indent), Children: children}}
	case *ast.UnorderedList:
		children := convertFromASTNodes(n.Children)
		node.Node = &apiv2pb.Node_UnorderedListNode{UnorderedListNode: &apiv2pb.UnorderedListNode{Symbol: n.Symbol, Indent: int32(n.Indent), Children: children}}
	case *ast.TaskList:
		children := convertFromASTNodes(n.Children)
		node.Node = &apiv2pb.Node_TaskListNode{TaskListNode: &apiv2pb.TaskListNode{Symbol: n.Symbol, Indent: int32(n.Indent), Complete: n.Complete, Children: children}}
	case *ast.MathBlock:
		node.Node = &apiv2pb.Node_MathBlockNode{MathBlockNode: &apiv2pb.MathBlockNode{Content: n.Content}}
	case *ast.Table:
		node.Node = &apiv2pb.Node_TableNode{TableNode: convertTableFromASTNode(n)}
	case *ast.EmbeddedContent:
		node.Node = &apiv2pb.Node_EmbeddedContentNode{EmbeddedContentNode: &apiv2pb.EmbeddedContentNode{ResourceName: n.ResourceName, Params: n.Params}}
	case *ast.Text:
		node.Node = &apiv2pb.Node_TextNode{TextNode: &apiv2pb.TextNode{Content: n.Content}}
	case *ast.Bold:
		children := convertFromASTNodes(n.Children)
		node.Node = &apiv2pb.Node_BoldNode{BoldNode: &apiv2pb.BoldNode{Symbol: n.Symbol, Children: children}}
	case *ast.Italic:
		node.Node = &apiv2pb.Node_ItalicNode{ItalicNode: &apiv2pb.ItalicNode{Symbol: n.Symbol, Content: n.Content}}
	case *ast.BoldItalic:
		node.Node = &apiv2pb.Node_BoldItalicNode{BoldItalicNode: &apiv2pb.BoldItalicNode{Symbol: n.Symbol, Content: n.Content}}
	case *ast.Code:
		node.Node = &apiv2pb.Node_CodeNode{CodeNode: &apiv2pb.CodeNode{Content: n.Content}}
	case *ast.Image:
		node.Node = &apiv2pb.Node_ImageNode{ImageNode: &apiv2pb.ImageNode{AltText: n.AltText, Url: n.URL}}
	case *ast.Link:
		node.Node = &apiv2pb.Node_LinkNode{LinkNode: &apiv2pb.LinkNode{Text: n.Text, Url: n.URL}}
	case *ast.AutoLink:
		node.Node = &apiv2pb.Node_AutoLinkNode{AutoLinkNode: &apiv2pb.AutoLinkNode{Url: n.URL, IsRawText: n.IsRawText}}
	case *ast.Tag:
		node.Node = &apiv2pb.Node_TagNode{TagNode: &apiv2pb.TagNode{Content: n.Content}}
	case *ast.Strikethrough:
		node.Node = &apiv2pb.Node_StrikethroughNode{StrikethroughNode: &apiv2pb.StrikethroughNode{Content: n.Content}}
	case *ast.EscapingCharacter:
		node.Node = &apiv2pb.Node_EscapingCharacterNode{EscapingCharacterNode: &apiv2pb.EscapingCharacterNode{Symbol: n.Symbol}}
	case *ast.Math:
		node.Node = &apiv2pb.Node_MathNode{MathNode: &apiv2pb.MathNode{Content: n.Content}}
	case *ast.Highlight:
		node.Node = &apiv2pb.Node_HighlightNode{HighlightNode: &apiv2pb.HighlightNode{Content: n.Content}}
	case *ast.Subscript:
		node.Node = &apiv2pb.Node_SubscriptNode{SubscriptNode: &apiv2pb.SubscriptNode{Content: n.Content}}
	case *ast.Superscript:
		node.Node = &apiv2pb.Node_SuperscriptNode{SuperscriptNode: &apiv2pb.SuperscriptNode{Content: n.Content}}
	case *ast.ReferencedContent:
		node.Node = &apiv2pb.Node_ReferencedContentNode{ReferencedContentNode: &apiv2pb.ReferencedContentNode{ResourceName: n.ResourceName, Params: n.Params}}
	case *ast.Spoiler:
		node.Node = &apiv2pb.Node_SpoilerNode{SpoilerNode: &apiv2pb.SpoilerNode{Content: n.Content}}
	default:
		node.Node = &apiv2pb.Node_TextNode{TextNode: &apiv2pb.TextNode{}}
	}
	return node
}

func convertFromASTNodes(rawNodes []ast.Node) []*apiv2pb.Node {
	nodes := []*apiv2pb.Node{}
	for _, rawNode := range rawNodes {
		node := convertFromASTNode(rawNode)
		nodes = append(nodes, node)
	}
	return nodes
}

func convertTableFromASTNode(node *ast.Table) *apiv2pb.TableNode {
	table := &apiv2pb.TableNode{
		Header:    node.Header,
		Delimiter: node.Delimiter,
	}
	for _, row := range node.Rows {
		table.Rows = append(table.Rows, &apiv2pb.TableNode_Row{Cells: row})
	}
	return table
}
