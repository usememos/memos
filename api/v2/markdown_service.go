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
		node.Node = &apiv2pb.Node_OrderedListNode{OrderedListNode: &apiv2pb.OrderedListNode{Number: n.Number, Children: children}}
	case *ast.UnorderedList:
		children := convertFromASTNodes(n.Children)
		node.Node = &apiv2pb.Node_UnorderedListNode{UnorderedListNode: &apiv2pb.UnorderedListNode{Symbol: n.Symbol, Children: children}}
	case *ast.TaskList:
		children := convertFromASTNodes(n.Children)
		node.Node = &apiv2pb.Node_TaskListNode{TaskListNode: &apiv2pb.TaskListNode{Symbol: n.Symbol, Complete: n.Complete, Children: children}}
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
		node.Node = &apiv2pb.Node_AutoLinkNode{AutoLinkNode: &apiv2pb.AutoLinkNode{Url: n.URL}}
	case *ast.Tag:
		node.Node = &apiv2pb.Node_TagNode{TagNode: &apiv2pb.TagNode{Content: n.Content}}
	case *ast.Strikethrough:
		node.Node = &apiv2pb.Node_StrikethroughNode{StrikethroughNode: &apiv2pb.StrikethroughNode{Content: n.Content}}
	case *ast.EscapingCharacter:
		node.Node = &apiv2pb.Node_EscapingCharacterNode{EscapingCharacterNode: &apiv2pb.EscapingCharacterNode{Symbol: n.Symbol}}
	default:
		node.Node = &apiv2pb.Node_TextNode{TextNode: &apiv2pb.TextNode{}}
	}

	return node
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
