package v1

import (
	"context"

	"github.com/pkg/errors"
	"github.com/usememos/gomark/ast"
	"github.com/usememos/gomark/parser"
	"github.com/usememos/gomark/parser/tokenizer"
	"github.com/usememos/gomark/renderer"
	"github.com/usememos/gomark/restore"

	"github.com/usememos/memos/plugin/httpgetter"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
)

func (*APIV1Service) ParseMarkdown(_ context.Context, request *v1pb.ParseMarkdownRequest) (*v1pb.ParseMarkdownResponse, error) {
	rawNodes, err := parser.Parse(tokenizer.Tokenize(request.Markdown))
	if err != nil {
		return nil, errors.Wrap(err, "failed to parse memo content")
	}

	nodes := convertFromASTNodes(rawNodes)
	return &v1pb.ParseMarkdownResponse{
		Nodes: nodes,
	}, nil
}

func (*APIV1Service) RestoreMarkdownNodes(_ context.Context, request *v1pb.RestoreMarkdownNodesRequest) (*v1pb.RestoreMarkdownNodesResponse, error) {
	markdown := restore.Restore(convertToASTNodes(request.Nodes))
	return &v1pb.RestoreMarkdownNodesResponse{
		Markdown: markdown,
	}, nil
}

func (*APIV1Service) StringifyMarkdownNodes(_ context.Context, request *v1pb.StringifyMarkdownNodesRequest) (*v1pb.StringifyMarkdownNodesResponse, error) {
	stringRenderer := renderer.NewStringRenderer()
	plainText := stringRenderer.Render(convertToASTNodes(request.Nodes))
	return &v1pb.StringifyMarkdownNodesResponse{
		PlainText: plainText,
	}, nil
}

func (*APIV1Service) GetLinkMetadata(_ context.Context, request *v1pb.GetLinkMetadataRequest) (*v1pb.LinkMetadata, error) {
	htmlMeta, err := httpgetter.GetHTMLMeta(request.Link)
	if err != nil {
		return nil, err
	}

	return &v1pb.LinkMetadata{
		Title:       htmlMeta.Title,
		Description: htmlMeta.Description,
		Image:       htmlMeta.Image,
	}, nil
}

func convertFromASTNode(rawNode ast.Node) *v1pb.Node {
	node := &v1pb.Node{
		Type: v1pb.NodeType(v1pb.NodeType_value[string(rawNode.Type())]),
	}

	switch n := rawNode.(type) {
	case *ast.LineBreak:
		node.Node = &v1pb.Node_LineBreakNode{}
	case *ast.Paragraph:
		children := convertFromASTNodes(n.Children)
		node.Node = &v1pb.Node_ParagraphNode{ParagraphNode: &v1pb.ParagraphNode{Children: children}}
	case *ast.CodeBlock:
		node.Node = &v1pb.Node_CodeBlockNode{CodeBlockNode: &v1pb.CodeBlockNode{Language: n.Language, Content: n.Content}}
	case *ast.Heading:
		children := convertFromASTNodes(n.Children)
		node.Node = &v1pb.Node_HeadingNode{HeadingNode: &v1pb.HeadingNode{Level: int32(n.Level), Children: children}}
	case *ast.HorizontalRule:
		node.Node = &v1pb.Node_HorizontalRuleNode{HorizontalRuleNode: &v1pb.HorizontalRuleNode{Symbol: n.Symbol}}
	case *ast.Blockquote:
		children := convertFromASTNodes(n.Children)
		node.Node = &v1pb.Node_BlockquoteNode{BlockquoteNode: &v1pb.BlockquoteNode{Children: children}}
	case *ast.List:
		children := convertFromASTNodes(n.Children)
		node.Node = &v1pb.Node_ListNode{ListNode: &v1pb.ListNode{Kind: convertListKindFromASTNode(n.Kind), Indent: int32(n.Indent), Children: children}}
	case *ast.OrderedListItem:
		children := convertFromASTNodes(n.Children)
		node.Node = &v1pb.Node_OrderedListItemNode{OrderedListItemNode: &v1pb.OrderedListItemNode{Number: n.Number, Indent: int32(n.Indent), Children: children}}
	case *ast.UnorderedListItem:
		children := convertFromASTNodes(n.Children)
		node.Node = &v1pb.Node_UnorderedListItemNode{UnorderedListItemNode: &v1pb.UnorderedListItemNode{Symbol: n.Symbol, Indent: int32(n.Indent), Children: children}}
	case *ast.TaskListItem:
		children := convertFromASTNodes(n.Children)
		node.Node = &v1pb.Node_TaskListItemNode{TaskListItemNode: &v1pb.TaskListItemNode{Symbol: n.Symbol, Indent: int32(n.Indent), Complete: n.Complete, Children: children}}
	case *ast.MathBlock:
		node.Node = &v1pb.Node_MathBlockNode{MathBlockNode: &v1pb.MathBlockNode{Content: n.Content}}
	case *ast.Table:
		node.Node = &v1pb.Node_TableNode{TableNode: convertTableFromASTNode(n)}
	case *ast.EmbeddedContent:
		node.Node = &v1pb.Node_EmbeddedContentNode{EmbeddedContentNode: &v1pb.EmbeddedContentNode{ResourceName: n.ResourceName, Params: n.Params}}
	case *ast.Text:
		node.Node = &v1pb.Node_TextNode{TextNode: &v1pb.TextNode{Content: n.Content}}
	case *ast.Bold:
		children := convertFromASTNodes(n.Children)
		node.Node = &v1pb.Node_BoldNode{BoldNode: &v1pb.BoldNode{Symbol: n.Symbol, Children: children}}
	case *ast.Italic:
		node.Node = &v1pb.Node_ItalicNode{ItalicNode: &v1pb.ItalicNode{Symbol: n.Symbol, Content: n.Content}}
	case *ast.BoldItalic:
		node.Node = &v1pb.Node_BoldItalicNode{BoldItalicNode: &v1pb.BoldItalicNode{Symbol: n.Symbol, Content: n.Content}}
	case *ast.Code:
		node.Node = &v1pb.Node_CodeNode{CodeNode: &v1pb.CodeNode{Content: n.Content}}
	case *ast.Image:
		node.Node = &v1pb.Node_ImageNode{ImageNode: &v1pb.ImageNode{AltText: n.AltText, Url: n.URL}}
	case *ast.Link:
		node.Node = &v1pb.Node_LinkNode{LinkNode: &v1pb.LinkNode{Text: n.Text, Url: n.URL}}
	case *ast.AutoLink:
		node.Node = &v1pb.Node_AutoLinkNode{AutoLinkNode: &v1pb.AutoLinkNode{Url: n.URL, IsRawText: n.IsRawText}}
	case *ast.Tag:
		node.Node = &v1pb.Node_TagNode{TagNode: &v1pb.TagNode{Content: n.Content}}
	case *ast.Strikethrough:
		node.Node = &v1pb.Node_StrikethroughNode{StrikethroughNode: &v1pb.StrikethroughNode{Content: n.Content}}
	case *ast.EscapingCharacter:
		node.Node = &v1pb.Node_EscapingCharacterNode{EscapingCharacterNode: &v1pb.EscapingCharacterNode{Symbol: n.Symbol}}
	case *ast.Math:
		node.Node = &v1pb.Node_MathNode{MathNode: &v1pb.MathNode{Content: n.Content}}
	case *ast.Highlight:
		node.Node = &v1pb.Node_HighlightNode{HighlightNode: &v1pb.HighlightNode{Content: n.Content}}
	case *ast.Subscript:
		node.Node = &v1pb.Node_SubscriptNode{SubscriptNode: &v1pb.SubscriptNode{Content: n.Content}}
	case *ast.Superscript:
		node.Node = &v1pb.Node_SuperscriptNode{SuperscriptNode: &v1pb.SuperscriptNode{Content: n.Content}}
	case *ast.ReferencedContent:
		node.Node = &v1pb.Node_ReferencedContentNode{ReferencedContentNode: &v1pb.ReferencedContentNode{ResourceName: n.ResourceName, Params: n.Params}}
	case *ast.Spoiler:
		node.Node = &v1pb.Node_SpoilerNode{SpoilerNode: &v1pb.SpoilerNode{Content: n.Content}}
	case *ast.HTMLElement:
		node.Node = &v1pb.Node_HtmlElementNode{HtmlElementNode: &v1pb.HTMLElementNode{TagName: n.TagName, Attributes: n.Attributes}}
	default:
		node.Node = &v1pb.Node_TextNode{TextNode: &v1pb.TextNode{}}
	}
	return node
}

func convertFromASTNodes(rawNodes []ast.Node) []*v1pb.Node {
	nodes := []*v1pb.Node{}
	for _, rawNode := range rawNodes {
		node := convertFromASTNode(rawNode)
		nodes = append(nodes, node)
	}
	return nodes
}

func convertTableFromASTNode(node *ast.Table) *v1pb.TableNode {
	table := &v1pb.TableNode{
		Header:    convertFromASTNodes(node.Header),
		Delimiter: node.Delimiter,
	}
	for _, row := range node.Rows {
		table.Rows = append(table.Rows, &v1pb.TableNode_Row{Cells: convertFromASTNodes(row)})
	}
	return table
}

func convertListKindFromASTNode(node ast.ListKind) v1pb.ListNode_Kind {
	switch node {
	case ast.OrderedList:
		return v1pb.ListNode_ORDERED
	case ast.UnorderedList:
		return v1pb.ListNode_UNORDERED
	case ast.DescrpitionList:
		return v1pb.ListNode_DESCRIPTION
	default:
		return v1pb.ListNode_KIND_UNSPECIFIED
	}
}

func convertToASTNode(node *v1pb.Node) ast.Node {
	switch n := node.Node.(type) {
	case *v1pb.Node_LineBreakNode:
		return &ast.LineBreak{}
	case *v1pb.Node_ParagraphNode:
		children := convertToASTNodes(n.ParagraphNode.Children)
		return &ast.Paragraph{Children: children}
	case *v1pb.Node_CodeBlockNode:
		return &ast.CodeBlock{Language: n.CodeBlockNode.Language, Content: n.CodeBlockNode.Content}
	case *v1pb.Node_HeadingNode:
		children := convertToASTNodes(n.HeadingNode.Children)
		return &ast.Heading{Level: int(n.HeadingNode.Level), Children: children}
	case *v1pb.Node_HorizontalRuleNode:
		return &ast.HorizontalRule{Symbol: n.HorizontalRuleNode.Symbol}
	case *v1pb.Node_BlockquoteNode:
		children := convertToASTNodes(n.BlockquoteNode.Children)
		return &ast.Blockquote{Children: children}
	case *v1pb.Node_ListNode:
		children := convertToASTNodes(n.ListNode.Children)
		return &ast.List{Kind: convertListKindToASTNode(n.ListNode.Kind), Indent: int(n.ListNode.Indent), Children: children}
	case *v1pb.Node_OrderedListItemNode:
		children := convertToASTNodes(n.OrderedListItemNode.Children)
		return &ast.OrderedListItem{Number: n.OrderedListItemNode.Number, Indent: int(n.OrderedListItemNode.Indent), Children: children}
	case *v1pb.Node_UnorderedListItemNode:
		children := convertToASTNodes(n.UnorderedListItemNode.Children)
		return &ast.UnorderedListItem{Symbol: n.UnorderedListItemNode.Symbol, Indent: int(n.UnorderedListItemNode.Indent), Children: children}
	case *v1pb.Node_TaskListItemNode:
		children := convertToASTNodes(n.TaskListItemNode.Children)
		return &ast.TaskListItem{Symbol: n.TaskListItemNode.Symbol, Indent: int(n.TaskListItemNode.Indent), Complete: n.TaskListItemNode.Complete, Children: children}
	case *v1pb.Node_MathBlockNode:
		return &ast.MathBlock{Content: n.MathBlockNode.Content}
	case *v1pb.Node_TableNode:
		return convertTableToASTNode(n.TableNode)
	case *v1pb.Node_EmbeddedContentNode:
		return &ast.EmbeddedContent{ResourceName: n.EmbeddedContentNode.ResourceName, Params: n.EmbeddedContentNode.Params}
	case *v1pb.Node_TextNode:
		return &ast.Text{Content: n.TextNode.Content}
	case *v1pb.Node_BoldNode:
		children := convertToASTNodes(n.BoldNode.Children)
		return &ast.Bold{Symbol: n.BoldNode.Symbol, Children: children}
	case *v1pb.Node_ItalicNode:
		return &ast.Italic{Symbol: n.ItalicNode.Symbol, Content: n.ItalicNode.Content}
	case *v1pb.Node_BoldItalicNode:
		return &ast.BoldItalic{Symbol: n.BoldItalicNode.Symbol, Content: n.BoldItalicNode.Content}
	case *v1pb.Node_CodeNode:
		return &ast.Code{Content: n.CodeNode.Content}
	case *v1pb.Node_ImageNode:
		return &ast.Image{AltText: n.ImageNode.AltText, URL: n.ImageNode.Url}
	case *v1pb.Node_LinkNode:
		return &ast.Link{Text: n.LinkNode.Text, URL: n.LinkNode.Url}
	case *v1pb.Node_AutoLinkNode:
		return &ast.AutoLink{URL: n.AutoLinkNode.Url, IsRawText: n.AutoLinkNode.IsRawText}
	case *v1pb.Node_TagNode:
		return &ast.Tag{Content: n.TagNode.Content}
	case *v1pb.Node_StrikethroughNode:
		return &ast.Strikethrough{Content: n.StrikethroughNode.Content}
	case *v1pb.Node_EscapingCharacterNode:
		return &ast.EscapingCharacter{Symbol: n.EscapingCharacterNode.Symbol}
	case *v1pb.Node_MathNode:
		return &ast.Math{Content: n.MathNode.Content}
	case *v1pb.Node_HighlightNode:
		return &ast.Highlight{Content: n.HighlightNode.Content}
	case *v1pb.Node_SubscriptNode:
		return &ast.Subscript{Content: n.SubscriptNode.Content}
	case *v1pb.Node_SuperscriptNode:
		return &ast.Superscript{Content: n.SuperscriptNode.Content}
	case *v1pb.Node_ReferencedContentNode:
		return &ast.ReferencedContent{ResourceName: n.ReferencedContentNode.ResourceName, Params: n.ReferencedContentNode.Params}
	case *v1pb.Node_SpoilerNode:
		return &ast.Spoiler{Content: n.SpoilerNode.Content}
	case *v1pb.Node_HtmlElementNode:
		return &ast.HTMLElement{TagName: n.HtmlElementNode.TagName, Attributes: n.HtmlElementNode.Attributes}
	default:
		return &ast.Text{}
	}
}

func convertToASTNodes(nodes []*v1pb.Node) []ast.Node {
	rawNodes := []ast.Node{}
	for _, node := range nodes {
		rawNode := convertToASTNode(node)
		rawNodes = append(rawNodes, rawNode)
	}
	return rawNodes
}

func convertTableToASTNode(node *v1pb.TableNode) *ast.Table {
	table := &ast.Table{
		Header:    convertToASTNodes(node.Header),
		Delimiter: node.Delimiter,
	}
	for _, row := range node.Rows {
		table.Rows = append(table.Rows, convertToASTNodes(row.Cells))
	}
	return table
}

func convertListKindToASTNode(kind v1pb.ListNode_Kind) ast.ListKind {
	switch kind {
	case v1pb.ListNode_ORDERED:
		return ast.OrderedList
	case v1pb.ListNode_UNORDERED:
		return ast.UnorderedList
	case v1pb.ListNode_DESCRIPTION:
		return ast.DescrpitionList
	default:
		// Default to description list.
		return ast.DescrpitionList
	}
}
