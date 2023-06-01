// Copyright 2020 The CC Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package cc // import "modernc.org/cc/v3"

// Inspect inspects AST node trees.
//
// If n is a non-terminal node, f(n, true) is called first. Next, f is called
// recursively for each of n's non-nil non-terminal children nodes, if any, in
// alphabetical order.  Next, all n's terminal nodes, if any, are visited in
// the numeric order of their suffixes (Token, Token2, Token3, ...). Finally,
// f(n, false) is invoked.
//
// If n a terminal node, of type *Token, f(n, <unspecified boolean value> is
// called once.
//
// Inspect stops when any invocation of f returns false.
func Inspect(n Node, f func(Node, bool) bool) {
	see(n, f)
}

func see(n Node, f func(Node, bool) bool) bool {
	switch x := n.(type) {
	case *AbstractDeclarator:
		return x == nil || f(x, true) &&
			see(x.DirectAbstractDeclarator, f) &&
			see(x.Pointer, f) &&
			f(x, false)
	case *AdditiveExpression:
		return x == nil || f(x, true) &&
			see(x.AdditiveExpression, f) &&
			see(x.MultiplicativeExpression, f) &&
			see(&x.Token, f) &&
			f(x, false)
	case *AlignmentSpecifier:
		return x == nil || f(x, true) &&
			see(x.ConstantExpression, f) &&
			see(x.TypeName, f) &&
			see(&x.Token, f) &&
			see(&x.Token2, f) &&
			see(&x.Token2, f) &&
			see(&x.Token3, f) &&
			f(x, false)
	case *AndExpression:
		return x == nil || f(x, true) &&
			see(x.AndExpression, f) &&
			see(x.EqualityExpression, f) &&
			see(&x.Token, f) &&
			f(x, false)
	case *ArgumentExpressionList:
		return x == nil || f(x, true) &&
			see(x.ArgumentExpressionList, f) &&
			see(x.AssignmentExpression, f) &&
			see(&x.Token, f) &&
			f(x, false)
	case *Asm:
		return x == nil || f(x, true) &&
			see(x.AsmArgList, f) &&
			see(x.AsmQualifierList, f) &&
			see(&x.Token, f) &&
			see(&x.Token2, f) &&
			see(&x.Token2, f) &&
			see(&x.Token3, f) &&
			see(&x.Token4, f) &&
			f(x, false)
	case *AsmArgList:
		return x == nil || f(x, true) &&
			see(x.AsmArgList, f) &&
			see(x.AsmExpressionList, f) &&
			see(&x.Token, f) &&
			f(x, false)
	case *AsmExpressionList:
		return x == nil || f(x, true) &&
			see(x.AsmExpressionList, f) &&
			see(x.AsmIndex, f) &&
			see(x.AssignmentExpression, f) &&
			see(&x.Token, f) &&
			f(x, false)
	case *AsmFunctionDefinition:
		return x == nil || f(x, true) &&
			see(x.AsmStatement, f) &&
			see(x.DeclarationSpecifiers, f) &&
			see(x.Declarator, f) &&
			f(x, false)
	case *AsmIndex:
		return x == nil || f(x, true) &&
			see(x.Expression, f) &&
			see(&x.Token, f) &&
			see(&x.Token2, f) &&
			see(&x.Token2, f) &&
			f(x, false)
	case *AsmQualifier:
		return x == nil || f(x, true) &&
			see(&x.Token, f) &&
			f(x, false)
	case *AsmQualifierList:
		return x == nil || f(x, true) &&
			see(x.AsmQualifier, f) &&
			see(x.AsmQualifierList, f) &&
			f(x, false)
	case *AsmStatement:
		return x == nil || f(x, true) &&
			see(x.Asm, f) &&
			see(x.AttributeSpecifierList, f) &&
			see(&x.Token, f) &&
			f(x, false)
	case *AssignmentExpression:
		return x == nil || f(x, true) &&
			see(x.AssignmentExpression, f) &&
			see(x.ConditionalExpression, f) &&
			see(x.UnaryExpression, f) &&
			see(&x.Token, f) &&
			f(x, false)
	case *AtomicTypeSpecifier:
		return x == nil || f(x, true) &&
			see(x.TypeName, f) &&
			see(&x.Token, f) &&
			see(&x.Token2, f) &&
			see(&x.Token2, f) &&
			see(&x.Token3, f) &&
			f(x, false)
	case *AttributeSpecifier:
		return x == nil || f(x, true) &&
			see(x.AttributeValueList, f) &&
			see(&x.Token, f) &&
			see(&x.Token2, f) &&
			see(&x.Token2, f) &&
			see(&x.Token3, f) &&
			see(&x.Token4, f) &&
			see(&x.Token5, f) &&
			f(x, false)
	case *AttributeSpecifierList:
		return x == nil || f(x, true) &&
			see(x.AttributeSpecifier, f) &&
			see(x.AttributeSpecifierList, f) &&
			f(x, false)
	case *AttributeValue:
		return x == nil || f(x, true) &&
			see(x.ExpressionList, f) &&
			see(&x.Token, f) &&
			see(&x.Token2, f) &&
			see(&x.Token2, f) &&
			see(&x.Token3, f) &&
			f(x, false)
	case *AttributeValueList:
		return x == nil || f(x, true) &&
			see(x.AttributeValue, f) &&
			see(x.AttributeValueList, f) &&
			see(&x.Token, f) &&
			f(x, false)
	case *BlockItem:
		return x == nil || f(x, true) &&
			see(x.CompoundStatement, f) &&
			see(x.Declaration, f) &&
			see(x.DeclarationSpecifiers, f) &&
			see(x.Declarator, f) &&
			see(x.LabelDeclaration, f) &&
			see(x.PragmaSTDC, f) &&
			see(x.Statement, f) &&
			f(x, false)
	case *BlockItemList:
		return x == nil || f(x, true) &&
			see(x.BlockItem, f) &&
			see(x.BlockItemList, f) &&
			f(x, false)
	case *CastExpression:
		return x == nil || f(x, true) &&
			see(x.CastExpression, f) &&
			see(x.TypeName, f) &&
			see(x.UnaryExpression, f) &&
			see(&x.Token, f) &&
			see(&x.Token2, f) &&
			see(&x.Token2, f) &&
			f(x, false)
	case *CompoundStatement:
		return x == nil || f(x, true) &&
			see(x.BlockItemList, f) &&
			see(&x.Token, f) &&
			see(&x.Token2, f) &&
			see(&x.Token2, f) &&
			f(x, false)
	case *ConditionalExpression:
		return x == nil || f(x, true) &&
			see(x.ConditionalExpression, f) &&
			see(x.Expression, f) &&
			see(x.LogicalOrExpression, f) &&
			see(&x.Token, f) &&
			see(&x.Token2, f) &&
			see(&x.Token2, f) &&
			f(x, false)
	case *ConstantExpression:
		return x == nil || f(x, true) &&
			see(x.ConditionalExpression, f) &&
			f(x, false)
	case *Declaration:
		return x == nil || f(x, true) &&
			see(x.DeclarationSpecifiers, f) &&
			see(x.InitDeclaratorList, f) &&
			see(&x.Token, f) &&
			f(x, false)
	case *DeclarationList:
		return x == nil || f(x, true) &&
			see(x.Declaration, f) &&
			see(x.DeclarationList, f) &&
			f(x, false)
	case *DeclarationSpecifiers:
		return x == nil || f(x, true) &&
			see(x.AlignmentSpecifier, f) &&
			see(x.AttributeSpecifier, f) &&
			see(x.DeclarationSpecifiers, f) &&
			see(x.FunctionSpecifier, f) &&
			see(x.StorageClassSpecifier, f) &&
			see(x.TypeQualifier, f) &&
			see(x.TypeSpecifier, f) &&
			f(x, false)
	case *Declarator:
		return x == nil || f(x, true) &&
			see(x.AttributeSpecifierList, f) &&
			see(x.DirectDeclarator, f) &&
			see(x.Pointer, f) &&
			f(x, false)
	case *Designation:
		return x == nil || f(x, true) &&
			see(x.DesignatorList, f) &&
			see(&x.Token, f) &&
			f(x, false)
	case *Designator:
		return x == nil || f(x, true) &&
			see(x.ConstantExpression, f) &&
			see(&x.Token, f) &&
			see(&x.Token2, f) &&
			see(&x.Token2, f) &&
			f(x, false)
	case *DesignatorList:
		return x == nil || f(x, true) &&
			see(x.Designator, f) &&
			see(x.DesignatorList, f) &&
			f(x, false)
	case *DirectAbstractDeclarator:
		return x == nil || f(x, true) &&
			see(x.AbstractDeclarator, f) &&
			see(x.AssignmentExpression, f) &&
			see(x.DirectAbstractDeclarator, f) &&
			see(x.ParameterTypeList, f) &&
			see(x.TypeQualifiers, f) &&
			see(&x.Token, f) &&
			see(&x.Token2, f) &&
			see(&x.Token2, f) &&
			see(&x.Token3, f) &&
			f(x, false)
	case *DirectDeclarator:
		return x == nil || f(x, true) &&
			see(x.Asm, f) &&
			see(x.AssignmentExpression, f) &&
			see(x.AttributeSpecifierList, f) &&
			see(x.Declarator, f) &&
			see(x.DirectDeclarator, f) &&
			see(x.IdentifierList, f) &&
			see(x.ParameterTypeList, f) &&
			see(x.TypeQualifiers, f) &&
			see(&x.Token, f) &&
			see(&x.Token2, f) &&
			see(&x.Token2, f) &&
			see(&x.Token3, f) &&
			f(x, false)
	case *EnumSpecifier:
		return x == nil || f(x, true) &&
			see(x.AttributeSpecifierList, f) &&
			see(x.EnumeratorList, f) &&
			see(&x.Token, f) &&
			see(&x.Token2, f) &&
			see(&x.Token2, f) &&
			see(&x.Token3, f) &&
			see(&x.Token4, f) &&
			see(&x.Token5, f) &&
			f(x, false)
	case *Enumerator:
		return x == nil || f(x, true) &&
			see(x.AttributeSpecifierList, f) &&
			see(x.ConstantExpression, f) &&
			see(&x.Token, f) &&
			see(&x.Token2, f) &&
			see(&x.Token2, f) &&
			f(x, false)
	case *EnumeratorList:
		return x == nil || f(x, true) &&
			see(x.Enumerator, f) &&
			see(x.EnumeratorList, f) &&
			see(&x.Token, f) &&
			f(x, false)
	case *EqualityExpression:
		return x == nil || f(x, true) &&
			see(x.EqualityExpression, f) &&
			see(x.RelationalExpression, f) &&
			see(&x.Token, f) &&
			f(x, false)
	case *ExclusiveOrExpression:
		return x == nil || f(x, true) &&
			see(x.AndExpression, f) &&
			see(x.ExclusiveOrExpression, f) &&
			see(&x.Token, f) &&
			f(x, false)
	case *Expression:
		return x == nil || f(x, true) &&
			see(x.AssignmentExpression, f) &&
			see(x.Expression, f) &&
			see(&x.Token, f) &&
			f(x, false)
	case *ExpressionList:
		return x == nil || f(x, true) &&
			see(x.AssignmentExpression, f) &&
			see(x.ExpressionList, f) &&
			see(&x.Token, f) &&
			f(x, false)
	case *ExpressionStatement:
		return x == nil || f(x, true) &&
			see(x.AttributeSpecifierList, f) &&
			see(x.Expression, f) &&
			see(&x.Token, f) &&
			f(x, false)
	case *ExternalDeclaration:
		return x == nil || f(x, true) &&
			see(x.AsmFunctionDefinition, f) &&
			see(x.AsmStatement, f) &&
			see(x.Declaration, f) &&
			see(x.FunctionDefinition, f) &&
			see(x.PragmaSTDC, f) &&
			see(&x.Token, f) &&
			f(x, false)
	case *FunctionDefinition:
		return x == nil || f(x, true) &&
			see(x.CompoundStatement, f) &&
			see(x.DeclarationList, f) &&
			see(x.DeclarationSpecifiers, f) &&
			see(x.Declarator, f) &&
			f(x, false)
	case *FunctionSpecifier:
		return x == nil || f(x, true) &&
			see(&x.Token, f) &&
			f(x, false)
	case *IdentifierList:
		return x == nil || f(x, true) &&
			see(x.IdentifierList, f) &&
			see(&x.Token, f) &&
			see(&x.Token2, f) &&
			see(&x.Token2, f) &&
			f(x, false)
	case *InclusiveOrExpression:
		return x == nil || f(x, true) &&
			see(x.ExclusiveOrExpression, f) &&
			see(x.InclusiveOrExpression, f) &&
			see(&x.Token, f) &&
			f(x, false)
	case *InitDeclarator:
		return x == nil || f(x, true) &&
			see(x.AttributeSpecifierList, f) &&
			see(x.Declarator, f) &&
			see(x.Initializer, f) &&
			see(&x.Token, f) &&
			f(x, false)
	case *InitDeclaratorList:
		return x == nil || f(x, true) &&
			see(x.AttributeSpecifierList, f) &&
			see(x.InitDeclarator, f) &&
			see(x.InitDeclaratorList, f) &&
			see(&x.Token, f) &&
			f(x, false)
	case *Initializer:
		return x == nil || f(x, true) &&
			see(x.AssignmentExpression, f) &&
			see(x.InitializerList, f) &&
			see(&x.Token, f) &&
			see(&x.Token2, f) &&
			see(&x.Token2, f) &&
			see(&x.Token3, f) &&
			f(x, false)
	case *InitializerList:
		return x == nil || f(x, true) &&
			see(x.Designation, f) &&
			see(x.Initializer, f) &&
			see(x.InitializerList, f) &&
			see(&x.Token, f) &&
			f(x, false)
	case *IterationStatement:
		return x == nil || f(x, true) &&
			see(x.Declaration, f) &&
			see(x.Expression, f) &&
			see(x.Expression2, f) &&
			see(x.Expression3, f) &&
			see(x.Statement, f) &&
			see(&x.Token, f) &&
			see(&x.Token2, f) &&
			see(&x.Token2, f) &&
			see(&x.Token3, f) &&
			see(&x.Token4, f) &&
			see(&x.Token5, f) &&
			f(x, false)
	case *JumpStatement:
		return x == nil || f(x, true) &&
			see(x.Expression, f) &&
			see(&x.Token, f) &&
			see(&x.Token2, f) &&
			see(&x.Token2, f) &&
			see(&x.Token3, f) &&
			f(x, false)
	case *LabelDeclaration:
		return x == nil || f(x, true) &&
			see(x.IdentifierList, f) &&
			see(&x.Token, f) &&
			see(&x.Token2, f) &&
			see(&x.Token2, f) &&
			f(x, false)
	case *LabeledStatement:
		return x == nil || f(x, true) &&
			see(x.AttributeSpecifierList, f) &&
			see(x.ConstantExpression, f) &&
			see(x.ConstantExpression2, f) &&
			see(x.Statement, f) &&
			see(&x.Token, f) &&
			see(&x.Token2, f) &&
			see(&x.Token2, f) &&
			see(&x.Token3, f) &&
			f(x, false)
	case *LogicalAndExpression:
		return x == nil || f(x, true) &&
			see(x.InclusiveOrExpression, f) &&
			see(x.LogicalAndExpression, f) &&
			see(&x.Token, f) &&
			f(x, false)
	case *LogicalOrExpression:
		return x == nil || f(x, true) &&
			see(x.LogicalAndExpression, f) &&
			see(x.LogicalOrExpression, f) &&
			see(&x.Token, f) &&
			f(x, false)
	case *MultiplicativeExpression:
		return x == nil || f(x, true) &&
			see(x.CastExpression, f) &&
			see(x.MultiplicativeExpression, f) &&
			see(&x.Token, f) &&
			f(x, false)
	case *ParameterDeclaration:
		return x == nil || f(x, true) &&
			see(x.AbstractDeclarator, f) &&
			see(x.AttributeSpecifierList, f) &&
			see(x.DeclarationSpecifiers, f) &&
			see(x.Declarator, f) &&
			f(x, false)
	case *ParameterList:
		return x == nil || f(x, true) &&
			see(x.ParameterDeclaration, f) &&
			see(x.ParameterList, f) &&
			see(&x.Token, f) &&
			f(x, false)
	case *ParameterTypeList:
		return x == nil || f(x, true) &&
			see(x.ParameterList, f) &&
			see(&x.Token, f) &&
			see(&x.Token2, f) &&
			see(&x.Token2, f) &&
			f(x, false)
	case *Pointer:
		return x == nil || f(x, true) &&
			see(x.Pointer, f) &&
			see(x.TypeQualifiers, f) &&
			see(&x.Token, f) &&
			f(x, false)
	case *PostfixExpression:
		return x == nil || f(x, true) &&
			see(x.ArgumentExpressionList, f) &&
			see(x.Expression, f) &&
			see(x.InitializerList, f) &&
			see(x.PostfixExpression, f) &&
			see(x.PrimaryExpression, f) &&
			see(x.TypeName, f) &&
			see(x.TypeName2, f) &&
			see(&x.Token, f) &&
			see(&x.Token2, f) &&
			see(&x.Token2, f) &&
			see(&x.Token3, f) &&
			see(&x.Token4, f) &&
			see(&x.Token5, f) &&
			f(x, false)
	case *PragmaSTDC:
		return x == nil || f(x, true) &&
			see(&x.Token, f) &&
			see(&x.Token2, f) &&
			see(&x.Token2, f) &&
			see(&x.Token3, f) &&
			see(&x.Token4, f) &&
			f(x, false)
	case *PrimaryExpression:
		return x == nil || f(x, true) &&
			see(x.CompoundStatement, f) &&
			see(x.Expression, f) &&
			see(&x.Token, f) &&
			see(&x.Token2, f) &&
			see(&x.Token2, f) &&
			f(x, false)
	case *RelationalExpression:
		return x == nil || f(x, true) &&
			see(x.RelationalExpression, f) &&
			see(x.ShiftExpression, f) &&
			see(&x.Token, f) &&
			f(x, false)
	case *SelectionStatement:
		return x == nil || f(x, true) &&
			see(x.Expression, f) &&
			see(x.Statement, f) &&
			see(x.Statement2, f) &&
			see(&x.Token, f) &&
			see(&x.Token2, f) &&
			see(&x.Token2, f) &&
			see(&x.Token3, f) &&
			see(&x.Token4, f) &&
			f(x, false)
	case *ShiftExpression:
		return x == nil || f(x, true) &&
			see(x.AdditiveExpression, f) &&
			see(x.ShiftExpression, f) &&
			see(&x.Token, f) &&
			f(x, false)
	case *SpecifierQualifierList:
		return x == nil || f(x, true) &&
			see(x.AlignmentSpecifier, f) &&
			see(x.AttributeSpecifier, f) &&
			see(x.SpecifierQualifierList, f) &&
			see(x.TypeQualifier, f) &&
			see(x.TypeSpecifier, f) &&
			f(x, false)
	case *Statement:
		return x == nil || f(x, true) &&
			see(x.AsmStatement, f) &&
			see(x.CompoundStatement, f) &&
			see(x.ExpressionStatement, f) &&
			see(x.IterationStatement, f) &&
			see(x.JumpStatement, f) &&
			see(x.LabeledStatement, f) &&
			see(x.SelectionStatement, f) &&
			f(x, false)
	case *StorageClassSpecifier:
		return x == nil || f(x, true) &&
			see(&x.Token, f) &&
			f(x, false)
	case *StructDeclaration:
		return x == nil || f(x, true) &&
			see(x.SpecifierQualifierList, f) &&
			see(x.StructDeclaratorList, f) &&
			see(&x.Token, f) &&
			f(x, false)
	case *StructDeclarationList:
		return x == nil || f(x, true) &&
			see(x.StructDeclaration, f) &&
			see(x.StructDeclarationList, f) &&
			f(x, false)
	case *StructDeclarator:
		return x == nil || f(x, true) &&
			see(x.AttributeSpecifierList, f) &&
			see(x.ConstantExpression, f) &&
			see(x.Declarator, f) &&
			see(&x.Token, f) &&
			f(x, false)
	case *StructDeclaratorList:
		return x == nil || f(x, true) &&
			see(x.StructDeclarator, f) &&
			see(x.StructDeclaratorList, f) &&
			see(&x.Token, f) &&
			f(x, false)
	case *StructOrUnion:
		return x == nil || f(x, true) &&
			see(&x.Token, f) &&
			f(x, false)
	case *StructOrUnionSpecifier:
		return x == nil || f(x, true) &&
			see(x.AttributeSpecifierList, f) &&
			see(x.StructDeclarationList, f) &&
			see(x.StructOrUnion, f) &&
			see(&x.Token, f) &&
			see(&x.Token2, f) &&
			see(&x.Token2, f) &&
			see(&x.Token3, f) &&
			f(x, false)
	case *TranslationUnit:
		return x == nil || f(x, true) &&
			see(x.ExternalDeclaration, f) &&
			see(x.TranslationUnit, f) &&
			f(x, false)
	case *TypeName:
		return x == nil || f(x, true) &&
			see(x.AbstractDeclarator, f) &&
			see(x.SpecifierQualifierList, f) &&
			f(x, false)
	case *TypeQualifier:
		return x == nil || f(x, true) &&
			see(&x.Token, f) &&
			f(x, false)
	case *TypeQualifiers:
		return x == nil || f(x, true) &&
			see(x.AttributeSpecifier, f) &&
			see(x.TypeQualifier, f) &&
			see(x.TypeQualifiers, f) &&
			f(x, false)
	case *TypeSpecifier:
		return x == nil || f(x, true) &&
			see(x.AtomicTypeSpecifier, f) &&
			see(x.EnumSpecifier, f) &&
			see(x.Expression, f) &&
			see(x.StructOrUnionSpecifier, f) &&
			see(x.TypeName, f) &&
			see(&x.Token, f) &&
			see(&x.Token2, f) &&
			see(&x.Token2, f) &&
			see(&x.Token3, f) &&
			f(x, false)
	case *UnaryExpression:
		return x == nil || f(x, true) &&
			see(x.CastExpression, f) &&
			see(x.PostfixExpression, f) &&
			see(x.TypeName, f) &&
			see(x.UnaryExpression, f) &&
			see(&x.Token, f) &&
			see(&x.Token2, f) &&
			see(&x.Token2, f) &&
			see(&x.Token3, f) &&
			f(x, false)
	case *Token:
		return f(x, true)
	default:
		panic(todo("internal error: %T", x))
	}
}
