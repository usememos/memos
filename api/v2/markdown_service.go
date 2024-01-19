package v2

import (
	"context"

	"github.com/pkg/errors"

	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
	apiv2pb "github.com/usememos/memos/proto/gen/api/v2"
)

func (*APIV2Service) ParseMarkdown(_ context.Context, request *apiv2pb.ParseMarkdownRequest) (*apiv2pb.ParseMarkdownResponse, error) {
	rawNodes, err := parser.Parse(tokenizer.Tokenize(request.Markdown))
	if err != nil {
		return nil, errors.Wrap(err, "failed to parse memo content")
	}
	nodes := convertFromASTNodes(rawNodes)
	return &apiv2pb.ParseMarkdownResponse{
		Nodes: nodes,
	}, nil
}

func convertFromASTNodes(rawNodes []ast.Node) []*apiv2pb.Node {
	nodes := []*apiv2pb.Node{}
	for _, rawNode := range rawNodes {
		node := convertFromASTNode(rawNode)
		nodes = append(nodes, node)
	}
	return nodes
}

func convertFromASTNode(rawNode ast.Node) *apiv2pb.Node {
	node := &apiv2pb.Node{
		Type: apiv2pb.NodeType(rawNode.Type()),
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
	default:
		node.Node = &apiv2pb.Node_TextNode{TextNode: &apiv2pb.TextNode{}}
	}

	return node
}

func convertToASTNodes(nodes []*apiv2pb.Node) []ast.Node {
	rawNodes := []ast.Node{}
	for _, node := range nodes {
		rawNode := convertToASTNode(node)
		rawNodes = append(rawNodes, rawNode)
	}
	return rawNodes
}

func convertToASTNode(node *apiv2pb.Node) ast.Node {
	switch n := node.Node.(type) {
	case *apiv2pb.Node_LineBreakNode:
		return &ast.LineBreak{}
	case *apiv2pb.Node_ParagraphNode:
		children := convertToASTNodes(n.ParagraphNode.Children)
		return &ast.Paragraph{Children: children}
	case *apiv2pb.Node_CodeBlockNode:
		return &ast.CodeBlock{Language: n.CodeBlockNode.Language, Content: n.CodeBlockNode.Content}
	case *apiv2pb.Node_HeadingNode:
		children := convertToASTNodes(n.HeadingNode.Children)
		return &ast.Heading{Level: int(n.HeadingNode.Level), Children: children}
	case *apiv2pb.Node_HorizontalRuleNode:
		return &ast.HorizontalRule{Symbol: n.HorizontalRuleNode.Symbol}
	case *apiv2pb.Node_BlockquoteNode:
		children := convertToASTNodes(n.BlockquoteNode.Children)
		return &ast.Blockquote{Children: children}
	case *apiv2pb.Node_OrderedListNode:
		children := convertToASTNodes(n.OrderedListNode.Children)
		return &ast.OrderedList{Number: n.OrderedListNode.Number, Indent: int(n.OrderedListNode.Indent), Children: children}
	case *apiv2pb.Node_UnorderedListNode:
		children := convertToASTNodes(n.UnorderedListNode.Children)
		return &ast.UnorderedList{Symbol: n.UnorderedListNode.Symbol, Indent: int(n.UnorderedListNode.Indent), Children: children}
	case *apiv2pb.Node_TaskListNode:
		children := convertToASTNodes(n.TaskListNode.Children)
		return &ast.TaskList{Symbol: n.TaskListNode.Symbol, Indent: int(n.TaskListNode.Indent), Complete: n.TaskListNode.Complete, Children: children}
	case *apiv2pb.Node_MathBlockNode:
		return &ast.MathBlock{Content: n.MathBlockNode.Content}
	case *apiv2pb.Node_TableNode:
		return convertTableToASTNode(node)
	case *apiv2pb.Node_TextNode:
		return &ast.Text{Content: n.TextNode.Content}
	case *apiv2pb.Node_BoldNode:
		children := convertToASTNodes(n.BoldNode.Children)
		return &ast.Bold{Symbol: n.BoldNode.Symbol, Children: children}
	case *apiv2pb.Node_ItalicNode:
		return &ast.Italic{Symbol: n.ItalicNode.Symbol, Content: n.ItalicNode.Content}
	case *apiv2pb.Node_BoldItalicNode:
		return &ast.BoldItalic{Symbol: n.BoldItalicNode.Symbol, Content: n.BoldItalicNode.Content}
	case *apiv2pb.Node_CodeNode:
		return &ast.Code{Content: n.CodeNode.Content}
	case *apiv2pb.Node_ImageNode:
		return &ast.Image{AltText: n.ImageNode.AltText, URL: n.ImageNode.Url}
	case *apiv2pb.Node_LinkNode:
		return &ast.Link{Text: n.LinkNode.Text, URL: n.LinkNode.Url}
	case *apiv2pb.Node_AutoLinkNode:
		return &ast.AutoLink{URL: n.AutoLinkNode.Url, IsRawText: n.AutoLinkNode.IsRawText}
	case *apiv2pb.Node_TagNode:
		return &ast.Tag{Content: n.TagNode.Content}
	case *apiv2pb.Node_StrikethroughNode:
		return &ast.Strikethrough{Content: n.StrikethroughNode.Content}
	case *apiv2pb.Node_EscapingCharacterNode:
		return &ast.EscapingCharacter{Symbol: n.EscapingCharacterNode.Symbol}
	case *apiv2pb.Node_MathNode:
		return &ast.Math{Content: n.MathNode.Content}
	case *apiv2pb.Node_HighlightNode:
		return &ast.Highlight{Content: n.HighlightNode.Content}
	case *apiv2pb.Node_SubscriptNode:
		return &ast.Subscript{Content: n.SubscriptNode.Content}
	case *apiv2pb.Node_SuperscriptNode:
		return &ast.Superscript{Content: n.SuperscriptNode.Content}
	default:
		return &ast.Text{}
	}
}

func convertTableToASTNode(node *apiv2pb.Node) *ast.Table {
	table := &ast.Table{
		Header:    node.GetTableNode().Header,
		Delimiter: node.GetTableNode().Delimiter,
	}
	for _, row := range node.GetTableNode().Rows {
		table.Rows = append(table.Rows, row.Cells)
	}
	return table
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

func traverseASTNodes(nodes []ast.Node, fn func(ast.Node)) {
	for _, node := range nodes {
		fn(node)
		switch n := node.(type) {
		case *ast.Paragraph:
			traverseASTNodes(n.Children, fn)
		case *ast.Heading:
			traverseASTNodes(n.Children, fn)
		case *ast.Blockquote:
			traverseASTNodes(n.Children, fn)
		case *ast.OrderedList:
			traverseASTNodes(n.Children, fn)
		case *ast.UnorderedList:
			traverseASTNodes(n.Children, fn)
		case *ast.TaskList:
			traverseASTNodes(n.Children, fn)
		case *ast.Bold:
			traverseASTNodes(n.Children, fn)
		}
	}
}
