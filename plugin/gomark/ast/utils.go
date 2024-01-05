package ast

func FindPrevSiblingExceptLineBreak(node Node) Node {
	if node == nil {
		return nil
	}
	prev := node.PrevSibling()
	if prev != nil && prev.Type() == LineBreakNode && prev.PrevSibling() != nil && prev.PrevSibling().Type() != LineBreakNode {
		return FindPrevSiblingExceptLineBreak(prev)
	}
	return prev
}

func FindNextSiblingExceptLineBreak(node Node) Node {
	if node == nil {
		return nil
	}
	next := node.NextSibling()
	if next != nil && next.Type() == LineBreakNode && next.NextSibling() != nil && next.NextSibling().Type() != LineBreakNode {
		return FindNextSiblingExceptLineBreak(next)
	}
	return next
}
