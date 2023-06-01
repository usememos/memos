// Copyright 2019 The CC Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package cc // import "modernc.org/cc/v3"

import (
	"fmt"
	"go/token"
	"math"
	"math/big"
	"math/bits"
	"path/filepath"
	"strconv"
	"strings"

	"modernc.org/mathutil"
	"modernc.org/strutil"
)

const longDoublePrec = 256

type mode = int

var (
	idBuiltinConstantPImpl = dict.sid("__builtin_constant_p_impl")
	idClosure              = dict.sid("0closure") // Must be invalid indentifier.
	idWcharT               = dict.sid("wchar_t")
	idWinWchar             = dict.sid("WCHAR")

	_ fmt.State
)

const (
	// [2], 6.6 Constant expressions, 6
	//
	// An integer constant expression shall have integer type and shall
	// only have operands that are integer constants, enumeration
	// constants, character constants, sizeof expressions whose results are
	// integer constants, _Alignof expressions, and floating constants that
	// are the immediate operands of casts. Cast operators in an integer
	// constant expression shall only convert arithmetic types to integer
	// types, except as part of an operand to the sizeof or _Alignof
	// operator.
	mIntConstExpr = 1 << iota

	mIntConstExprFloat   // As mIntConstExpr plus accept floating point constants.
	mIntConstExprAnyCast // As mIntConstExpr plus accept any cast.
)

// Parameter represents a function parameter.
type Parameter struct {
	d   *Declarator
	typ Type
}

// NewParameter returns a newly created parameter
func NewParameter(d *Declarator, t Type) *Parameter {
	return &Parameter{d, t}
}

func (p *Parameter) Declarator() *Declarator { return p.d }
func (p *Parameter) Name() StringID          { return p.d.Name() }
func (p *Parameter) Type() Type              { return p.typ }

func (n *TranslationUnit) check(ctx *context) {
	for n := n; n != nil; n = n.TranslationUnit {
		n.ExternalDeclaration.check(ctx)
	}
	for ; n != nil; n = n.TranslationUnit {
		n.ExternalDeclaration.checkFnBodies(ctx)
	}
}

func (n *ExternalDeclaration) checkFnBodies(ctx *context) {
	if n == nil {
		return
	}

	switch n.Case {
	case ExternalDeclarationFuncDef: // FunctionDefinition
		n.FunctionDefinition.checkBody(ctx)
	}
}

// https://gcc.gnu.org/onlinedocs/gcc/Inline.html
//
// If you specify both inline and extern in the function definition, then the
// definition is used only for inlining. In no case is the function compiled on
// its own, not even if you refer to its address explicitly. Such an address
// becomes an external reference, as if you had only declared the function, and
// had not defined it.
//
// This combination of inline and extern has almost the effect of a macro. The
// way to use it is to put a function definition in a header file with these
// keywords, and put another copy of the definition (lacking inline and extern)
// in a library file. The definition in the header file causes most calls to
// the function to be inlined. If any uses of the function remain, they refer
// to the single copy in the library.
func (n *Declarator) isExternInline() bool {
	return n.IsExtern() && n.Type() != nil && n.Type().Inline()
}

// DeclarationSpecifiers Declarator DeclarationList CompoundStatement
func (n *FunctionDefinition) checkBody(ctx *context) {
	if n == nil {
		return
	}

	if n.checked {
		return
	}

	n.checked = true
	if n.Declarator.isExternInline() && !ctx.cfg.CheckExternInlineFnBodies {
		return
	}

	ctx.checkFn = n
	rd := ctx.readDelta
	ctx.readDelta = 1
	n.CompoundStatement.check(ctx)
	ctx.checkFn = nil
	for k, v := range n.ComputedGotos {
		if _, ok := n.Labels[k]; !ok {
			ctx.errNode(v, "label %s undefined", k)
		}
	}
	for k, v := range n.Gotos {
		if _, ok := n.Labels[k]; !ok {
			ctx.errNode(v, "label %s undefined", k)
		}
	}
	for _, n := range n.InitDeclarators {
		d := n.Declarator
		if d.Type().IsIncomplete() && d.Linkage != External {
			ctx.errNode(d, "declarator has incomplete type")
		}
		if ctx.cfg.RejectUninitializedDeclarators && d.Linkage == None && d.Write == 0 && !d.AddressTaken && d.Read != 0 {
			switch d.Type().Kind() {
			case Array, Struct, Union, Invalid:
				// nop
			default:
				ctx.errNode(d, "%s may be used uninitialized in this function", d.Name())
			}
		}
	}
	for _, n := range n.CompositeLiterals {
		switch t := n.Operand.Type(); t.Kind() {
		case Invalid:
			ctx.errNode(n, "composite literal has invalid type")
		default:
			if t.IsIncomplete() {
				ctx.errNode(n, "composite literal has incomplete type")
			}
		}
	}
	ctx.readDelta = rd
}

func (n *ExternalDeclaration) check(ctx *context) {
	if n == nil {
		return
	}

	switch n.Case {
	case ExternalDeclarationFuncDef: // FunctionDefinition
		n.FunctionDefinition.checkDeclarator(ctx)
	case ExternalDeclarationDecl: // Declaration
		n.Declaration.check(ctx, true)
	case ExternalDeclarationAsm: // AsmFunctionDefinition
		n.AsmFunctionDefinition.check(ctx)
	case ExternalDeclarationAsmStmt: // AsmStatement
		n.AsmStatement.check(ctx)
	case ExternalDeclarationEmpty: // ';'
		// nop
	case ExternalDeclarationPragma: // PragmaSTDC
		n.PragmaSTDC.check(ctx)
	default:
		panic(todo(""))
	}
}

func (n *PragmaSTDC) check(ctx *context) {
	// nop
}

func (n *AsmFunctionDefinition) check(ctx *context) {
	if n == nil {
		return
	}

	typ, inline, noret := n.DeclarationSpecifiers.check(ctx, false)
	typ.setFnSpecs(inline, noret)
	n.Declarator.check(ctx, n.DeclarationSpecifiers, typ, true)
	n.AsmStatement.check(ctx)
}

func (n *AsmStatement) check(ctx *context) {
	if n == nil {
		return
	}

	n.Asm.check(ctx)
	n.AttributeSpecifierList.check(ctx, nil)
}

func (n *Declaration) check(ctx *context, tld bool) {
	if n == nil {
		return
	}

	typ, _, _ := n.DeclarationSpecifiers.check(ctx, false)
	n.InitDeclaratorList.check(ctx, n.DeclarationSpecifiers, typ, tld)
}

func (n *InitDeclaratorList) check(ctx *context, td typeDescriptor, typ Type, tld bool) {
	for ; n != nil; n = n.InitDeclaratorList {
		n.AttributeSpecifierList.check(ctx, typ.baseP())
		n.InitDeclarator.check(ctx, td, typ, tld)
	}
}

func (n *InitDeclarator) check(ctx *context, td typeDescriptor, typ Type, tld bool) {
	if n == nil {
		return
	}

	if f := ctx.checkFn; f != nil {
		f.InitDeclarators = append(f.InitDeclarators, n)
	}
	if attr := n.AttributeSpecifierList.check(ctx, typ.baseP()); len(attr) != 0 {
		typ = &attributedType{typ, attr}
	}
	switch n.Case {
	case InitDeclaratorDecl: // Declarator AttributeSpecifierList
		n.Declarator.check(ctx, td, typ, tld)
	case InitDeclaratorInit: // Declarator AttributeSpecifierList '=' Initializer
		typ := n.Declarator.check(ctx, td, typ, tld)
		n.Declarator.hasInitializer = true
		n.Declarator.Write++
		n.Initializer.check(ctx, &n.Initializer.list, typ, n.Declarator.StorageClass, nil, 0, nil, nil, false)
		n.Initializer.setConstZero()
		n.initializer = &InitializerValue{typ: typ, initializer: n.Initializer}
		if ctx.cfg.TrackAssignments {
			setLHS(map[*Declarator]struct{}{n.Declarator: {}}, n.Initializer)
		}
	default:
		panic(todo(""))
	}
}

func (n *Initializer) setConstZero() {
	switch n.Case {
	case InitializerExpr: // AssignmentExpression
		if op := n.AssignmentExpression.Operand; op != nil {
			n.isConst = op.IsConst()
			n.isZero = op.IsZero()
		}
	case InitializerInitList: // '{' InitializerList ',' '}'
		li := n.InitializerList
		li.setConstZero()
		n.isConst = li.IsConst()
		n.isZero = li.IsZero()
	default:
		panic(todo("%v:", n.Position()))
	}
}

func (n *InitializerList) setConstZero() {
	if n == nil {
		return
	}

	n0 := n
	n0.isConst = true
	n0.isZero = true
	for ; n != nil; n = n.InitializerList {
		in := n.Initializer
		in.setConstZero()
		n0.isConst = n0.isConst && in.isConst
		n0.isZero = n0.isZero && in.isZero
	}
}

// [0], 6.7.8 Initialization
func (n *Initializer) check(ctx *context, list *[]*Initializer, t Type, sc StorageClass, fld Field, off uintptr, il *InitializerList, designatorList *DesignatorList, inList bool) *InitializerList {
	// trc("==== %v: case %v, t %v, off %v, designatorList != nil %v, inList %v", n.Position(), n.Case, t.Alias(), off, designatorList != nil, inList)
	// if fld != nil {
	// 	trc("\tfld %q", fld.Name())
	// }

	// 3 - The type of the entity to be initialized shall be an array of
	// unknown size or an object type that is not a variable length array
	// type.
	if t.Kind() == Array && t.IsVLA() {
		ctx.errNode(n, "cannot initialize a variable length array: %v", t)
		if il != nil {
			return il.InitializerList
		}

		return nil
	}

	defer func(d int) { ctx.readDelta = d }(ctx.readDelta)

	ctx.readDelta = 1
	n.typ = t
	single := n.single()
	var op Operand
	if single != nil {
		op = single.AssignmentExpression.check(ctx, false)
		single.typ = t
		single.Field = fld
		single.Offset = off
	}

	// 11: The initializer for a scalar shall be a single expression, optionally
	// enclosed in braces. The initial value of the object is that of the
	// expression (after conversion); the same type constraints and conversions as
	// for simple assignment apply, taking the type of the scalar to be the
	// unqualified version of its declared type.
	if t.IsScalarType() && single != nil {
		if designatorList != nil {
			panic(todo("", n.Position()))
		}

		//TODO check compatible
		*list = append(*list, single)
		switch {
		case t.Kind() == op.Type().Kind():
			single.AssignmentExpression.InitializerOperand = op
		default:
			single.AssignmentExpression.InitializerOperand = op.convertTo(ctx, n, t)
		}
		if il != nil {
			return il.InitializerList
		}

		return nil
	}

	// 12: The rest of this subclause deals with initializers for objects that have
	// aggregate or union type.

	k := t.Kind()

	// 13: The initializer for a structure or union object that has automatic
	// storage duration shall be either an initializer list as described below, or
	// a single expression that has compatible structure or union type. In the
	// latter case, the initial value of the object, including unnamed members, is
	// that of the expression.
	if n.Case == InitializerExpr && sc == Automatic && (k == Struct || k == Union || k == Vector) && t.IsCompatible(op.Type()) {
		if designatorList != nil {
			panic(todo("", n.Position()))
		}

		*list = append(*list, single)
		if il != nil {
			return il.InitializerList
		}

		return nil
	}

	if k == Array && single != nil {
		et := t.Elem()
		switch {
		case isCharType(et):
			// 14: An array of character type may be initialized by a character string
			// literal, optionally enclosed in braces. Successive characters of the
			// character string literal (including the terminating null character if there
			// is room or if the array is of unknown size) initialize the elements of the
			// array.
			if x, ok := op.Value().(StringValue); ok {
				if designatorList != nil {
					panic(todo("", n.Position()))
				}

				*list = append(*list, single)
				str := StringID(x).String()
				if t.IsIncomplete() {
					t.setLen(uintptr(len(str)) + 1)
				}
				if il != nil {
					return il.InitializerList
				}

				return nil
			}
		case isWCharType(et):
			// 15: An array with element type compatible with wchar_t may be initialized by
			// a wide string literal, optionally enclosed in braces. Successive wide
			// characters of the wide string literal (including the terminating null wide
			// character if there is room or if the array is of unknown size) initialize
			// the elements of the array.
			if x, ok := op.Value().(WideStringValue); ok {
				if designatorList != nil {
					panic(todo("", n.Position()))
				}

				*list = append(*list, single)
				str := []rune(StringID(x).String())
				if t.IsIncomplete() {
					t.setLen(uintptr(len(str)) + 1)
				}
				if il != nil {
					panic(todo(""))
				}

				return nil
			}
		}
	}

	// 16: Otherwise, the initializer for an object that has aggregate or union
	// type shall be a brace-enclosed list of initializers for the elements or
	// named members.
	if n.Case == InitializerExpr {
		if il != nil {
			switch t.Kind() {
			case Array:
				return il.checkArray(ctx, list, t, sc, off, designatorList, inList)
			case Struct:
				return il.checkStruct(ctx, list, t, sc, off, designatorList, inList)
			case Union:
				return il.checkUnion(ctx, list, t, sc, off, designatorList, inList)
			case Vector:
				return il.InitializerList //TODO
			default:
				panic(todo("", n.Position(), t, t.Kind()))
			}
		}

		var l *InitializerList
		Inspect(n.AssignmentExpression, func(m Node, b bool) bool {
			if x, ok := m.(*PostfixExpression); ok && x.Case == PostfixExpressionComplit {
				if !b {
					return true
				}

				if l == nil {
					l = x.InitializerList
					return true
				}

				l = nil
				return false
			}
			return true
		})
		if l != nil {
			l.check(ctx, list, t, sc, off, designatorList, inList)
			return nil
		}

		ctx.errNode(n, "initializer for an object that has aggregate or union type shall be a brace-enclosed list of initializers for the elements or named members: %v", t)
		return nil
	}

	n.InitializerList.check(ctx, list, t, sc, off, designatorList, inList)
	if il != nil {
		return il.InitializerList
	}

	return nil
}

func (n *InitializerList) checkArray(ctx *context, list *[]*Initializer, t Type, sc StorageClass, off uintptr, designatorList *DesignatorList, inList bool) *InitializerList {
	elem := t.Elem()
	esz := elem.Size()
	length := t.Len()
	var i, maxI uintptr
	nestedDesignator := designatorList != nil
	retOnDesignator := false
loop:
	for n != nil {
		switch {
		case retOnDesignator && n.Designation != nil:
			return n
		case designatorList == nil && !inList && n.Designation != nil:
			designatorList = n.Designation.DesignatorList
			fallthrough
		case designatorList != nil:
			d := designatorList.Designator
			designatorList = designatorList.DesignatorList
			switch d.Case {
			case DesignatorIndex: // '[' ConstantExpression ']'
				switch x := d.ConstantExpression.check(ctx, ctx.mode|mIntConstExpr, false).Value().(type) {
				case Int64Value:
					i = uintptr(x)
				case Uint64Value:
					i = uintptr(x)
				default:
					panic(todo("%v: %T", n.Position(), x))
				}
				if !inList && i > maxI {
					maxI = i
				}
			case DesignatorField: // '.' IDENTIFIER
				panic(todo("", n.Position(), d.Position()))
			case DesignatorField2: // IDENTIFIER ':'
				panic(todo("", n.Position(), d.Position()))
			default:
				panic(todo(""))
			}

			n = n.Initializer.check(ctx, list, elem, sc, nil, off+i*esz, n, designatorList, designatorList != nil)
			designatorList = nil
			if nestedDesignator {
				retOnDesignator = true
			}
			i++
		default:
			if !t.IsIncomplete() && i >= length {
				break loop
			}

			if i > maxI {
				maxI = i
			}
			n = n.Initializer.check(ctx, list, elem, sc, nil, off+i*esz, n, nil, inList)
			i++
		}
	}
	if t.IsIncomplete() {
		t.setLen(maxI + 1)
	}
	return n
}

func (n *InitializerList) checkStruct(ctx *context, list *[]*Initializer, t Type, sc StorageClass, off uintptr, designatorList *DesignatorList, inList bool) *InitializerList {
	// trc("==== (A) %v: t %v, off %v, dl %v, inList %v", n.Position(), t, off, designatorList != nil, inList)
	// defer trc("==== (Z) %v: t %v, off %v, dl %v, inList %v", n.Position(), t, off, designatorList != nil, inList)
	t = t.underlyingType()
	// trc("%v: %v, off %v", n.Position(), t, off) //TODO-
	nf := t.NumField()
	i := []int{0}
	var f Field
	nestedDesignator := designatorList != nil
	retOnDesignator := false
	for n != nil {
		switch {
		case retOnDesignator && n.Designation != nil:
			return n
		case designatorList == nil && !inList && n.Designation != nil:
			designatorList = n.Designation.DesignatorList
			fallthrough
		case designatorList != nil:
			d := designatorList.Designator
			designatorList = designatorList.DesignatorList
			var nm StringID
			switch d.Case {
			case DesignatorIndex: // '[' ConstantExpression ']'
				panic(todo("", n.Position(), d.Position()))
			case DesignatorField: // '.' IDENTIFIER
				nm = d.Token2.Value
			case DesignatorField2: // IDENTIFIER ':'
				nm = d.Token.Value
			default:
				panic(todo(""))
			}

			f, xa, ok := t.FieldByName2(nm)
			if !ok {
				panic(todo("%v: t %v %q", d.Position(), t, nm))
			}

			t0 := t
			switch {
			case len(xa) != 1:
				var f2 Field
				var off2 uintptr
				for len(xa) != 1 {
					f2 = t.FieldByIndex(xa[:1])
					off2 += f2.Offset()
					t = f2.Type()
					xa = xa[1:]
				}
				n = n.Initializer.check(ctx, list, t, sc, f, off+off2, n, designatorList, designatorList != nil)
				if t.Kind() == Union {
					t = t0
				}
			default:
				n = n.Initializer.check(ctx, list, f.Type(), sc, f, off+f.Offset(), n, designatorList, designatorList != nil)
			}
			designatorList = nil
			if nestedDesignator {
				retOnDesignator = true
			}
			i[0] = xa[0] + 1
		default:
			// [0], 6.7.8 Initialization
			//
			// 9 - Except where explicitly stated otherwise, for the
			// purposes of this subclause unnamed members of objects of
			// structure and union type do not participate in
			// initialization.  Unnamed members of structure objects have
			// indeterminate value even after initialization.
			for ; ; i[0]++ {
				if i[0] >= nf {
					return n
				}

				f = t.FieldByIndex(i)
				if f.Name() != 0 || !f.Type().IsBitFieldType() {
					n = n.Initializer.check(ctx, list, f.Type(), sc, f, off+f.Offset(), n, nil, inList)
					i[0]++
					break
				}
			}
		}
	}
	return n
}

func spos(n Node) string {
	p := n.Position()
	p.Filename = filepath.Base(p.Filename)
	return p.String()
}

func (n *InitializerList) checkUnion(ctx *context, list *[]*Initializer, t Type, sc StorageClass, off uintptr, designatorList *DesignatorList, inList bool) *InitializerList {
	// trc("==== %v: t %v, off %v, dl %v, inList %v", n.Position(), t, off, designatorList != nil, inList)
	t = t.underlyingType()
	// trc("%v: %v, off %v", n.Position(), t, off) //TODO-
	nf := t.NumField()
	i := []int{0}
	for pass := 0; n != nil; pass++ {
		switch {
		case designatorList == nil && !inList && n.Designation != nil:
			designatorList = n.Designation.DesignatorList
			fallthrough
		case designatorList != nil:
			d := designatorList.Designator
			designatorList = designatorList.DesignatorList
			var nm StringID
			switch d.Case {
			case DesignatorIndex: // '[' ConstantExpression ']'
				panic(todo("", n.Position(), d.Position()))
			case DesignatorField: // '.' IDENTIFIER
				nm = d.Token2.Value
			case DesignatorField2: // IDENTIFIER ':'
				nm = d.Token.Value
			default:
				panic(todo(""))
			}

			f, xa, ok := t.FieldByName2(nm)
			if !ok {
				panic(todo("", d.Position()))
			}

			if !inList && pass == 0 {
				n.Initializer.field0 = f
			}
			switch {
			case len(xa) != 1:
				var f2 Field
				var off2 uintptr
				for len(xa) != 1 {
					f2 = t.FieldByIndex(xa[:1])
					off2 += f2.Offset()
					t = f2.Type()
					xa = xa[1:]
				}
				next := n.Initializer.check(ctx, list, t, sc, f, off+off2+f.Offset(), n, designatorList, designatorList != nil)
				if designatorList != nil && designatorList.DesignatorList != nil {
					panic(todo("", n.Position(), d.Position()))
				}

				return next
			default:
				next := n.Initializer.check(ctx, list, f.Type(), sc, f, off+f.Offset(), n, designatorList, designatorList != nil)
				if designatorList != nil && designatorList.DesignatorList != nil {
					panic(todo("", n.Position(), d.Position()))
				}

				return next
			}
		default:
			// [0], 6.7.8 Initialization
			//
			// 9 - Except where explicitly stated otherwise, for the
			// purposes of this subclause unnamed members of objects of
			// structure and union type do not participate in
			// initialization.  Unnamed members of structure objects have
			// indeterminate value even after initialization.
			for ; ; i[0]++ {
				if i[0] >= nf {
					panic(todo(""))
				}

				f := t.FieldByIndex(i)
				if f.Name() != 0 || !f.Type().IsBitFieldType() {
					next := n.Initializer.check(ctx, list, f.Type(), sc, f, off+f.Offset(), n, nil, inList)
					return next
				}
			}
			panic(todo("", n.Position()))
		}
	}
	return nil
}

// Accept a single initializer, optionally enclosed in braces, but nested
// braces. Implements eg. [0]6.7.8.11.
//
//	42	// ok
//	{42}	// ok
//	{{42}}	// not ok
func (n *Initializer) single() *Initializer {
	switch n.Case {
	case InitializerExpr: // AssignmentExpression
		return n
	case InitializerInitList: // '{' InitializerList ',' '}'
		if n.InitializerList == nil { //
			return nil
		}

		if n.InitializerList.InitializerList == nil {
			if in := n.InitializerList.Initializer; in.Case == InitializerExpr {
				return in
			}
		}
	}
	return nil
}

// [0], 6.7.8 Initialization
func (n *InitializerList) check(ctx *context, list *[]*Initializer, t Type, sc StorageClass, off uintptr, designatorList *DesignatorList, inList bool) {
	switch t.Kind() {
	case Array, Vector:
		if n == nil { // {}
			if t.IsIncomplete() {
				t.setLen(0)
			}
			return
		}

		n.checkArray(ctx, list, t, sc, off, designatorList, inList)
	case Struct:
		if n == nil { // {}
			return
		}

		n.checkStruct(ctx, list, t, sc, off, designatorList, inList)
	case Union:
		if n == nil { // {}
			return
		}

		n.checkUnion(ctx, list, t, sc, off, designatorList, inList)
	default:
		if n == nil || t == nil || t.Kind() == Invalid {
			return
		}

		n.Initializer.check(ctx, list, t, sc, nil, off, nil, designatorList, inList)
	}
}

func setLHS(lhs map[*Declarator]struct{}, rhs Node) {
	inCall := 0
	Inspect(rhs, func(n Node, enter bool) bool {
		switch x := n.(type) {
		case *PostfixExpression:
			switch x.Case {
			case PostfixExpressionCall: // PostfixExpression '(' ArgumentExpressionList ')'
				switch {
				case enter:
					inCall++
					if d := x.Declarator(); d != nil {
						for v := range lhs {
							d.setLHS(v)
						}
					}
				default:
					inCall--
				}
			}
		case *PrimaryExpression:
			if inCall != 0 || !enter {
				break
			}

			if d := x.Declarator(); d != nil {
				for v := range lhs {
					d.setLHS(v)
				}
			}
		}
		return true
	})
}

func (n *AssignmentExpression) check(ctx *context, isAsmArg bool) Operand {
	if n == nil {
		return noOperand
	}

	if n.Operand != nil {
		return n.Operand
	}

	if ctx.cfg.TrackAssignments && n.AssignmentExpression != nil {
		defer func() {
			lhs := map[*Declarator]struct{}{}
			Inspect(n.UnaryExpression, func(n Node, enter bool) bool {
				if !enter {
					return true
				}

				if x, ok := n.(*PrimaryExpression); ok {
					lhs[x.Declarator()] = struct{}{}
				}
				return true
			})
			setLHS(lhs, n.AssignmentExpression)
		}()
	}

	//TODO check for "modifiable lvalue" in left operand
	n.Operand = noOperand
	switch n.Case {
	case AssignmentExpressionCond: // ConditionalExpression
		n.Operand = n.ConditionalExpression.check(ctx, isAsmArg)
		n.IsSideEffectsFree = n.ConditionalExpression.IsSideEffectsFree
	case AssignmentExpressionAssign: // UnaryExpression '=' AssignmentExpression
		l := n.UnaryExpression.check(ctx, isAsmArg)
		if d := n.UnaryExpression.Declarator(); d != nil {
			d.Read -= ctx.readDelta
		}
		if d := n.UnaryExpression.Operand.Declarator(); d != nil {
			d.Write++
			if l.Type().Kind() == Array && !d.IsParameter && l.Type().String() != "va_list" {
				ctx.errNode(n.UnaryExpression, "assignment to expression with array type")
				break
			}
		}

		if !l.IsLValue() {
			//TODO ctx.errNode(n.UnaryExpression, "expected lvalue")
			break
		}

		r := n.AssignmentExpression.check(ctx, isAsmArg)
		_ = r //TODO check assignability
		n.Operand = l.(*lvalue).Operand
	case AssignmentExpressionMul: // UnaryExpression "*=" AssignmentExpression
		l := n.UnaryExpression.check(ctx, isAsmArg)
		if d := n.UnaryExpression.Operand.Declarator(); d != nil {
			d.SubjectOfAsgnOp = true
			d.Read += ctx.readDelta
			d.Write++
		}
		if !l.IsLValue() {
			//TODO panic(n.Position().String()) // report error
			break
		}

		r := n.AssignmentExpression.check(ctx, isAsmArg)
		//TODO check assignability
		if l.Type().IsArithmeticType() {
			op, _ := usualArithmeticConversions(ctx, n, l, r, true)
			n.promote = op.Type()
		}
		n.Operand = &operand{abi: &ctx.cfg.ABI, typ: l.Type()}
	case AssignmentExpressionDiv: // UnaryExpression "/=" AssignmentExpression
		l := n.UnaryExpression.check(ctx, isAsmArg)
		if d := n.UnaryExpression.Operand.Declarator(); d != nil {
			d.SubjectOfAsgnOp = true
			d.Read += ctx.readDelta
			d.Write++
		}
		if !l.IsLValue() {
			//TODO panic(n.Position().String()) // report error
			break
		}

		r := n.AssignmentExpression.check(ctx, isAsmArg)
		//TODO check assignability
		if l.Type().IsArithmeticType() {
			op, _ := usualArithmeticConversions(ctx, n, l, r, true)
			n.promote = op.Type()
		}
		n.Operand = &operand{abi: &ctx.cfg.ABI, typ: l.Type()}
	case AssignmentExpressionMod: // UnaryExpression "%=" AssignmentExpression
		l := n.UnaryExpression.check(ctx, isAsmArg)
		if d := n.UnaryExpression.Operand.Declarator(); d != nil {
			d.SubjectOfAsgnOp = true
			d.Read += ctx.readDelta
			d.Write++
		}
		if !l.IsLValue() {
			//TODO panic(n.Position().String()) // report error
			break
		}

		r := n.AssignmentExpression.check(ctx, isAsmArg)
		//TODO check assignability
		if l.Type().IsArithmeticType() {
			op, _ := usualArithmeticConversions(ctx, n, l, r, true)
			n.promote = op.Type()
		}
		n.Operand = &operand{abi: &ctx.cfg.ABI, typ: l.Type()}
	case AssignmentExpressionAdd: // UnaryExpression "+=" AssignmentExpression
		l := n.UnaryExpression.check(ctx, isAsmArg)
		if d := n.UnaryExpression.Operand.Declarator(); d != nil {
			d.SubjectOfAsgnOp = true
			d.Read += ctx.readDelta
			d.Write++
		}
		if !l.IsLValue() {
			//TODO panic(n.Position().String()) // report error
			break
		}

		r := n.AssignmentExpression.check(ctx, isAsmArg)
		//TODO check assignability
		n.promote = n.UnaryExpression.Operand.Type()
		if l.Type().IsArithmeticType() {
			op, _ := usualArithmeticConversions(ctx, n, l, r, true)
			n.promote = op.Type()
		}
		n.Operand = &operand{abi: &ctx.cfg.ABI, typ: l.Type()}
	case AssignmentExpressionSub: // UnaryExpression "-=" AssignmentExpression
		l := n.UnaryExpression.check(ctx, isAsmArg)
		if d := n.UnaryExpression.Operand.Declarator(); d != nil {
			d.SubjectOfAsgnOp = true
			d.Read += ctx.readDelta
			d.Write++
		}
		if !l.IsLValue() {
			//TODO panic(n.Position().String()) // report error
			break
		}

		r := n.AssignmentExpression.check(ctx, isAsmArg)
		//TODO check assignability
		n.promote = n.UnaryExpression.Operand.Type()
		if l.Type().IsArithmeticType() {
			op, _ := usualArithmeticConversions(ctx, n, l, r, true)
			n.promote = op.Type()
		}
		n.Operand = &operand{abi: &ctx.cfg.ABI, typ: l.Type()}
	case AssignmentExpressionLsh: // UnaryExpression "<<=" AssignmentExpression
		l := n.UnaryExpression.check(ctx, isAsmArg)
		if d := n.UnaryExpression.Operand.Declarator(); d != nil {
			d.SubjectOfAsgnOp = true
			d.Read += ctx.readDelta
			d.Write++
		}
		if !l.IsLValue() {
			//TODO panic(n.Position().String()) // report error
			break
		}

		r := n.AssignmentExpression.check(ctx, isAsmArg)
		//TODO check assignability
		if !l.Type().IsIntegerType() || !r.Type().IsIntegerType() {
			//TODO report error
			break
		}

		n.promote = r.integerPromotion(ctx, n).Type()
		n.Operand = (&operand{abi: &ctx.cfg.ABI, typ: l.Type()}).integerPromotion(ctx, n)
	case AssignmentExpressionRsh: // UnaryExpression ">>=" AssignmentExpression
		l := n.UnaryExpression.check(ctx, isAsmArg)
		if d := n.UnaryExpression.Operand.Declarator(); d != nil {
			d.SubjectOfAsgnOp = true
			d.Read += ctx.readDelta
			d.Write++
		}
		if !l.IsLValue() {
			//TODO panic(n.Position().String()) // report error
			break
		}

		r := n.AssignmentExpression.check(ctx, isAsmArg)
		//TODO check assignability
		if !l.Type().IsIntegerType() || !r.Type().IsIntegerType() {
			//TODO report error
			break
		}

		n.promote = r.integerPromotion(ctx, n).Type()
		n.Operand = (&operand{abi: &ctx.cfg.ABI, typ: l.Type()}).integerPromotion(ctx, n)
	case AssignmentExpressionAnd: // UnaryExpression "&=" AssignmentExpression
		l := n.UnaryExpression.check(ctx, isAsmArg)
		if d := n.UnaryExpression.Operand.Declarator(); d != nil {
			d.SubjectOfAsgnOp = true
			d.Read += ctx.readDelta
			d.Write++
		}
		if !l.IsLValue() {
			//TODO panic(n.Position().String()) // report error
			break
		}

		r := n.AssignmentExpression.check(ctx, isAsmArg)
		//TODO check assignability
		if !l.Type().IsIntegerType() || !r.Type().IsIntegerType() {
			//TODO report error
			break
		}

		op, _ := usualArithmeticConversions(ctx, n, l, r, true)
		n.promote = op.Type()
		n.Operand = &operand{abi: &ctx.cfg.ABI, typ: l.Type()}
	case AssignmentExpressionXor: // UnaryExpression "^=" AssignmentExpression
		l := n.UnaryExpression.check(ctx, isAsmArg)
		if d := n.UnaryExpression.Operand.Declarator(); d != nil {
			d.SubjectOfAsgnOp = true
			d.Read += ctx.readDelta
			d.Write++
		}
		if !l.IsLValue() {
			//TODO panic(n.Position().String()) // report error
			break
		}

		r := n.AssignmentExpression.check(ctx, isAsmArg)
		//TODO check assignability
		if !l.Type().IsIntegerType() || !r.Type().IsIntegerType() {
			//TODO report error
			break
		}

		op, _ := usualArithmeticConversions(ctx, n, l, r, true)
		n.promote = op.Type()
		n.Operand = &operand{abi: &ctx.cfg.ABI, typ: l.Type()}
	case AssignmentExpressionOr: // UnaryExpression "|=" AssignmentExpression
		l := n.UnaryExpression.check(ctx, isAsmArg)
		if d := n.UnaryExpression.Operand.Declarator(); d != nil {
			d.SubjectOfAsgnOp = true
			d.Read += ctx.readDelta
			d.Write++
		}
		if !l.IsLValue() {
			//TODO panic(n.Position().String()) // report error
			break
		}

		r := n.AssignmentExpression.check(ctx, isAsmArg)
		//TODO check assignability
		if !l.Type().IsIntegerType() || !r.Type().IsIntegerType() {
			//TODO report error
			break
		}

		op, _ := usualArithmeticConversions(ctx, n, l, r, true)
		n.promote = op.Type()
		n.Operand = &operand{abi: &ctx.cfg.ABI, typ: l.Type()}
	default:
		panic(todo(""))
	}
	return n.Operand
}

func (n *UnaryExpression) check(ctx *context, isAsmArg bool) Operand {
	if n == nil {
		return noOperand
	}

	n.Operand = noOperand //TODO-
	switch n.Case {
	case UnaryExpressionPostfix: // PostfixExpression
		n.Operand = n.PostfixExpression.check(ctx, false, isAsmArg)
		n.IsSideEffectsFree = n.PostfixExpression.IsSideEffectsFree
	case UnaryExpressionInc: // "++" UnaryExpression
		op := n.UnaryExpression.check(ctx, isAsmArg)
		if d := op.Declarator(); d != nil {
			d.SubjectOfIncDec = true
			d.Read += ctx.readDelta
			d.Write++
		}
		n.Operand = &operand{abi: &ctx.cfg.ABI, typ: op.Type()}
	case UnaryExpressionDec: // "--" UnaryExpression
		op := n.UnaryExpression.check(ctx, isAsmArg)
		if d := op.Declarator(); d != nil {
			d.SubjectOfIncDec = true
			d.Read += ctx.readDelta
			d.Write++
		}
		n.Operand = &operand{abi: &ctx.cfg.ABI, typ: op.Type()}
	case UnaryExpressionAddrof: // '&' CastExpression
		ctx.not(n, mIntConstExpr)
		op := n.CastExpression.addrOf(ctx)
		n.IsSideEffectsFree = n.CastExpression.IsSideEffectsFree
		if op.Type().IsBitFieldType() {
			//TODO report error
			break
		}

		d := n.CastExpression.Declarator()
		if d != nil {
			setAddressTaken(n, d, "'&' CastExpression")
			if d.td.register() {
				//TODO report error
			}
		}

		// [0], 6.5.3.2
		//
		// The operand of the unary & operator shall be either a
		// function designator, the result of a [] or unary * operator,
		// or an lvalue that designates an object that is not a
		// bit-field and is not declared with the register
		// storage-class specifier.
		//TODO
		if x, ok := op.(*funcDesignator); ok {
			n.Operand = x
			break
		}

		n.Operand = op
	case UnaryExpressionDeref: // '*' CastExpression
		ctx.not(n, mIntConstExpr)
		op := n.CastExpression.check(ctx, isAsmArg)
		n.IsSideEffectsFree = n.CastExpression.IsSideEffectsFree
		if x, ok := op.(*funcDesignator); ok {
			n.Operand = x
			break
		}

		if op.Type().Kind() == Function {
			n.Operand = op
			break
		}

		if op.Type().Decay().Kind() != Ptr {
			//TODO report error
			break
		}

		n.Operand = &lvalue{Operand: &operand{abi: &ctx.cfg.ABI, typ: op.Type().Elem()}}
	case UnaryExpressionPlus: // '+' CastExpression
		op := n.CastExpression.check(ctx, isAsmArg)
		n.IsSideEffectsFree = n.CastExpression.IsSideEffectsFree
		if op == nil {
			//TODO report error
			break
		}
		if !op.Type().IsArithmeticType() {
			//TODO report error
			break
		}

		if op.Type().IsIntegerType() {
			op = op.integerPromotion(ctx, n)
		}
		n.Operand = op
	case UnaryExpressionMinus: // '-' CastExpression
		op := n.CastExpression.check(ctx, isAsmArg)
		n.IsSideEffectsFree = n.CastExpression.IsSideEffectsFree
		if op == nil {
			//TODO report error
			break
		}
		if op.Type().Kind() == Vector {
			n.Operand = &operand{abi: &ctx.cfg.ABI, typ: op.Type()}
			break
		}

		if !op.Type().IsArithmeticType() {
			//TODO report error
			break
		}

		if op.Type().IsIntegerType() {
			op = op.integerPromotion(ctx, n)
		}
		if v := op.Value(); v != nil {
			op = (&operand{abi: &ctx.cfg.ABI, typ: op.Type(), value: v.neg()}).normalize(ctx, n)
		}
		n.Operand = op
	case UnaryExpressionCpl: // '~' CastExpression
		op := n.CastExpression.check(ctx, isAsmArg)
		n.IsSideEffectsFree = n.CastExpression.IsSideEffectsFree
		if op.Type().Kind() == Vector {
			if !op.Type().Elem().IsIntegerType() {
				ctx.errNode(n, "operand must be integer")
			}
			n.Operand = &operand{abi: &ctx.cfg.ABI, typ: op.Type()}
			break
		}

		if op.Type().IsComplexType() {
			n.Operand = op
			break
		}

		if !op.Type().IsIntegerType() {
			ctx.errNode(n, "operand must be integer")
			break
		}

		op = op.integerPromotion(ctx, n)
		if v := op.Value(); v != nil {
			op = (&operand{abi: &ctx.cfg.ABI, typ: op.Type(), value: v.cpl()}).normalize(ctx, n)
		}
		n.Operand = op
	case UnaryExpressionNot: // '!' CastExpression
		op := n.CastExpression.check(ctx, isAsmArg)
		n.IsSideEffectsFree = n.CastExpression.IsSideEffectsFree
		op2 := &operand{abi: &ctx.cfg.ABI, typ: ctx.cfg.ABI.Type(Int)}
		switch {
		case op.IsZero():
			op2.value = Int64Value(1)
		case op.IsNonZero():
			op2.value = Int64Value(0)
		}
		n.Operand = op2
	case UnaryExpressionSizeofExpr: // "sizeof" UnaryExpression
		n.IsSideEffectsFree = true
		rd := ctx.readDelta
		// [0]6.5.3.4, 2: If the type of the operand is a variable length array type,
		// the operand is evaluated; otherwise, the operand is not evaluated and the
		// result is an integer constant.
		switch op := n.UnaryExpression.Operand; {
		case op != nil && op.Type() != nil && op.Type().IsVLA():
			ctx.readDelta = 1
		default:
			ctx.readDelta = 0
		}
		ctx.push(ctx.mode &^ mIntConstExpr)
		op := n.UnaryExpression.check(ctx, isAsmArg)
		ctx.pop()
		ctx.readDelta = rd
		if op.Type().IsIncomplete() {
			break
		}

		sz := op.Type().Size()
		if d := n.UnaryExpression.Declarator(); d != nil && d.IsParameter {
			sz = op.Type().Decay().Size()
		}
		n.Operand = (&operand{abi: &ctx.cfg.ABI, typ: ctx.cfg.ABI.Type(ULongLong), value: Uint64Value(sz)}).convertTo(ctx, n, sizeT(ctx, n.lexicalScope, n.Token))
	case UnaryExpressionSizeofType: // "sizeof" '(' TypeName ')'
		n.IsSideEffectsFree = true
		rd := ctx.readDelta
		ctx.readDelta = 0
		ctx.push(ctx.mode)
		if ctx.mode&mIntConstExpr != 0 {
			ctx.mode |= mIntConstExprAnyCast
		}
		t := n.TypeName.check(ctx, false, false, nil)
		ctx.pop()
		ctx.readDelta = rd
		if t.IsIncomplete() {
			break
		}

		n.Operand = (&operand{abi: &ctx.cfg.ABI, typ: ctx.cfg.ABI.Type(ULongLong), value: Uint64Value(t.Size())}).convertTo(ctx, n, sizeT(ctx, n.lexicalScope, n.Token))
	case UnaryExpressionLabelAddr: // "&&" IDENTIFIER
		abi := &ctx.cfg.ABI
		n.Operand = &operand{abi: abi, typ: abi.Ptr(n, abi.Type(Void))}
		n.IsSideEffectsFree = true
		ctx.not(n, mIntConstExpr)
		f := ctx.checkFn
		if f == nil {
			//TODO report error
			break
		}

		if f.ComputedGotos == nil {
			f.ComputedGotos = map[StringID]*UnaryExpression{}
		}
		f.ComputedGotos[n.Token2.Value] = n
	case UnaryExpressionAlignofExpr: // "_Alignof" UnaryExpression
		n.IsSideEffectsFree = true
		ctx.push(ctx.mode &^ mIntConstExpr)
		op := n.UnaryExpression.check(ctx, isAsmArg)
		n.Operand = (&operand{abi: &ctx.cfg.ABI, typ: ctx.cfg.ABI.Type(ULongLong), value: Uint64Value(op.Type().Align())}).convertTo(ctx, n, sizeT(ctx, n.lexicalScope, n.Token))
		ctx.pop()
	case UnaryExpressionAlignofType: // "_Alignof" '(' TypeName ')'
		n.IsSideEffectsFree = true
		ctx.push(ctx.mode)
		if ctx.mode&mIntConstExpr != 0 {
			ctx.mode |= mIntConstExprAnyCast
		}
		t := n.TypeName.check(ctx, false, false, nil)
		n.Operand = (&operand{abi: &ctx.cfg.ABI, typ: ctx.cfg.ABI.Type(ULongLong), value: Uint64Value(t.Align())}).convertTo(ctx, n, sizeT(ctx, n.lexicalScope, n.Token))
		ctx.pop()
	case UnaryExpressionImag: // "__imag__" UnaryExpression
		ctx.not(n, mIntConstExpr)
		n.UnaryExpression.check(ctx, isAsmArg)
		n.IsSideEffectsFree = n.UnaryExpression.IsSideEffectsFree
		n.Operand = complexPart(ctx, n.UnaryExpression.Operand)
	case UnaryExpressionReal: // "__real__" UnaryExpression
		ctx.not(n, mIntConstExpr)
		n.UnaryExpression.check(ctx, isAsmArg)
		n.IsSideEffectsFree = n.UnaryExpression.IsSideEffectsFree
		n.Operand = complexPart(ctx, n.UnaryExpression.Operand)
	default:
		panic(todo(""))
	}
	return n.Operand
}

func complexPart(ctx *context, op Operand) Operand {
	var k Kind
	switch op.Type().Kind() {
	case ComplexChar:
		k = Char
	case ComplexDouble:
		k = Double
	case ComplexFloat:
		k = Float
	case ComplexInt:
		k = Int
	case ComplexLong:
		k = Long
	case ComplexLongDouble:
		k = LongDouble
	case ComplexLongLong:
		k = LongLong
	case ComplexShort:
		k = Short
	case ComplexUInt:
		k = UInt
	case ComplexULong:
		k = ULong
	case ComplexULongLong:
		k = ULongLong
	case ComplexUShort:
		k = UShort
	default:
		//TODO report err
		return noOperand
	}

	abi := &ctx.cfg.ABI
	typ := abi.Type(k)
	return &operand{abi: abi, typ: typ}
}

func sizeT(ctx *context, s Scope, tok Token) Type {
	if t := ctx.sizeT; t != nil {
		return t
	}

	t := ctx.stddef(idSizeT, s, tok)
	if t.Kind() != Invalid {
		ctx.sizeT = t
	}
	return t
}

func (n *CastExpression) addrOf(ctx *context) Operand {
	if n == nil {
		return noOperand
	}

	n.Operand = noOperand //TODO-
	switch n.Case {
	case CastExpressionUnary: // UnaryExpression
		n.Operand = n.UnaryExpression.addrOf(ctx)
		n.IsSideEffectsFree = n.UnaryExpression.IsSideEffectsFree
	case CastExpressionCast: // '(' TypeName ')' CastExpression
		panic(n.Position().String())
	default:
		panic(todo(""))
	}
	return n.Operand
}

func (n *UnaryExpression) addrOf(ctx *context) Operand {
	if n == nil {
		return noOperand
	}

	n.Operand = noOperand //TODO-
	switch n.Case {
	case UnaryExpressionPostfix: // PostfixExpression
		n.Operand = n.PostfixExpression.addrOf(ctx)
		n.IsSideEffectsFree = n.PostfixExpression.IsSideEffectsFree
	case UnaryExpressionInc: // "++" UnaryExpression
		panic(n.Position().String())
	case UnaryExpressionDec: // "--" UnaryExpression
		panic(n.Position().String())
	case UnaryExpressionAddrof: // '&' CastExpression
		panic(n.Position().String())
	case UnaryExpressionDeref: // '*' CastExpression
		n.Operand = n.CastExpression.check(ctx, false)
		n.IsSideEffectsFree = n.CastExpression.IsSideEffectsFree
	case UnaryExpressionPlus: // '+' CastExpression
		panic(n.Position().String())
	case UnaryExpressionMinus: // '-' CastExpression
		panic(n.Position().String())
	case UnaryExpressionCpl: // '~' CastExpression
		panic(n.Position().String())
	case UnaryExpressionNot: // '!' CastExpression
		panic(n.Position().String())
	case UnaryExpressionSizeofExpr: // "sizeof" UnaryExpression
		panic(n.Position().String())
	case UnaryExpressionSizeofType: // "sizeof" '(' TypeName ')'
		panic(n.Position().String())
	case UnaryExpressionLabelAddr: // "&&" IDENTIFIER
		panic(n.Position().String())
	case UnaryExpressionAlignofExpr: // "_Alignof" UnaryExpression
		panic(n.Position().String())
	case UnaryExpressionAlignofType: // "_Alignof" '(' TypeName ')'
		panic(n.Position().String())
	case UnaryExpressionImag: // "__imag__" UnaryExpression
		n.Operand = n.UnaryExpression.addrOf(ctx)
		n.IsSideEffectsFree = n.UnaryExpression.IsSideEffectsFree
	case UnaryExpressionReal: // "__real__" UnaryExpression
		n.Operand = n.UnaryExpression.addrOf(ctx)
		n.IsSideEffectsFree = n.UnaryExpression.IsSideEffectsFree
	default:
		panic(todo(""))
	}
	return n.Operand
}

func (n *PostfixExpression) addrOf(ctx *context) Operand {
	if n == nil {
		return noOperand
	}

	n.Operand = noOperand //TODO-
	switch n.Case {
	case PostfixExpressionPrimary: // PrimaryExpression
		n.Operand = n.PrimaryExpression.addrOf(ctx)
		n.IsSideEffectsFree = n.PrimaryExpression.IsSideEffectsFree
	case PostfixExpressionIndex: // PostfixExpression '[' Expression ']'
		pe := n.PostfixExpression.check(ctx, false, false)
		if d := n.PostfixExpression.Declarator(); d != nil && d.Type().Kind() != Ptr {
			setAddressTaken(n, d, "PostfixExpression '[' Expression ']'")
			d.Read += ctx.readDelta
		}
		e := n.Expression.check(ctx, false)
		n.IsSideEffectsFree = n.PostfixExpression.IsSideEffectsFree && n.Expression.IsSideEffectsFree
		t := pe.Type().Decay()
		if t.Kind() == Invalid {
			break
		}

		if t.Kind() == Ptr {
			if t := e.Type(); t.Kind() != Invalid && !t.IsIntegerType() {
				ctx.errNode(n.Expression, "index must be integer type, have %v", e.Type())
				break
			}

			n.Operand = n.indexAddr(ctx, &n.Token, pe, e)
			break
		}

		if pe.Type().Kind() == Vector {
			if t := e.Type(); t.Kind() != Invalid && !t.IsIntegerType() {
				ctx.errNode(n.Expression, "index must be integer type, have %v", e.Type())
				break
			}

			n.Operand = n.index(ctx, pe, e)
			break
		}

		t = e.Type().Decay()
		if t.Kind() == Invalid {
			break
		}

		if t.Kind() == Ptr {
			if t := pe.Type(); t.Kind() != Invalid && !t.IsIntegerType() {
				ctx.errNode(n.Expression, "index must be integer type, have %v", pe.Type())
				break
			}

			n.Operand = n.indexAddr(ctx, &n.Token, e, pe)
			break
		}

		ctx.errNode(n, "invalid index expression %v[%v]", pe.Type(), e.Type())
	case PostfixExpressionCall: // PostfixExpression '(' ArgumentExpressionList ')'
		panic(n.Position().String())
	case PostfixExpressionSelect: // PostfixExpression '.' IDENTIFIER
		op := n.PostfixExpression.addrOf(ctx)
		n.IsSideEffectsFree = n.PostfixExpression.IsSideEffectsFree
		if d := n.PostfixExpression.Declarator(); d != nil {
			setAddressTaken(n, d, "PostfixExpression '.' IDENTIFIER")
			d.Read += ctx.readDelta
		}
		st := op.Type().Elem()
		if k := st.Kind(); k == Invalid || k != Struct && k != Union {
			//TODO report error
			break
		}

		f, ok := st.FieldByName(n.Token2.Value)
		if !ok {
			ctx.errNode(&n.Token2, "unknown or ambiguous field: %s", n.Token2.Value)
			break
		}

		n.Field = f
		ft := f.Type()
		if f.IsBitField() {
			//TODO report error
			break
		}

		ot := ctx.cfg.ABI.Ptr(n, ft)
		switch {
		case op.IsConst():
			switch x := op.Value().(type) {
			case Uint64Value:
				n.Operand = &operand{abi: &ctx.cfg.ABI, typ: ot, value: x + Uint64Value(f.Offset())}
				return n.Operand
			case nil:
				// nop
			default:
				//TODO panic(todo(" %v: %T", n.Position(), x))
			}

			fallthrough
		default:
			n.Operand = &lvalue{Operand: &operand{abi: &ctx.cfg.ABI, typ: ot, offset: op.Offset() + f.Offset()}, declarator: op.Declarator()}
		}
	case PostfixExpressionPSelect: // PostfixExpression "->" IDENTIFIER
		op := n.PostfixExpression.check(ctx, false, false)
		n.IsSideEffectsFree = n.PostfixExpression.IsSideEffectsFree
		if d := n.PostfixExpression.Declarator(); d != nil {
			d.Read += ctx.readDelta
		}
		t := op.Type()
		if k := t.Decay().Kind(); k == Invalid || k != Ptr {
			//TODO report error
			break
		}

		st := t.Elem()
		if k := st.Kind(); k == Invalid || k != Struct && k != Union {
			//TODO report error
			break
		}

		f, ok := st.FieldByName(n.Token2.Value)
		if !ok {
			//TODO report error
			break
		}

		n.Field = f
		ft := f.Type()
		if f.IsBitField() {
			//TODO report error
			break
		}

		ot := ctx.cfg.ABI.Ptr(n, ft)
		switch {
		case op.IsConst():
			switch x := op.Value().(type) {
			case Uint64Value:
				n.Operand = &operand{abi: &ctx.cfg.ABI, typ: ot, value: x + Uint64Value(f.Offset())}
				return n.Operand
			case nil:
				// nop
			default:
				panic(todo(" %T", x))
			}

			fallthrough
		default:
			n.Operand = &lvalue{Operand: &operand{abi: &ctx.cfg.ABI, typ: ot, offset: op.Offset() + f.Offset()}, declarator: op.Declarator()}
		}
	case PostfixExpressionInc: // PostfixExpression "++"
		panic(n.Position().String())
	case PostfixExpressionDec: // PostfixExpression "--"
		panic(n.Position().String())
	case PostfixExpressionComplit: // '(' TypeName ')' '{' InitializerList ',' '}'
		//TODO IsSideEffectsFree
		if f := ctx.checkFn; f != nil {
			f.CompositeLiterals = append(f.CompositeLiterals, n)
		}
		t := n.TypeName.check(ctx, false, false, nil)
		var v *InitializerValue
		if n.InitializerList != nil {
			n.InitializerList.isConst = true
			n.InitializerList.check(ctx, &n.InitializerList.list, t, Automatic, 0, nil, false)
			n.InitializerList.setConstZero()
			v = &InitializerValue{typ: ctx.cfg.ABI.Ptr(n, t), initializer: n.InitializerList}
		}
		n.Operand = &lvalue{Operand: (&operand{abi: &ctx.cfg.ABI, typ: ctx.cfg.ABI.Ptr(n, t), value: v}).normalize(ctx, n)}
	case PostfixExpressionTypeCmp: // "__builtin_types_compatible_p" '(' TypeName ',' TypeName ')'
		panic(n.Position().String())
	default:
		panic(todo(""))
	}
	return n.Operand
}

func (n *PostfixExpression) indexAddr(ctx *context, nd Node, pe, e Operand) Operand {
	var x uintptr
	hasx := false
	switch v := e.Value().(type) {
	case Int64Value:
		x = uintptr(v)
		hasx = true
	case Uint64Value:
		x = uintptr(v)
		hasx = true
	}
	off := x * pe.Type().Elem().Size()
	switch y := pe.Value().(type) {
	case StringValue, WideStringValue:
		if hasx {
			return &lvalue{Operand: &operand{abi: &ctx.cfg.ABI, typ: ctx.cfg.ABI.Ptr(n, pe.Type().Elem()), value: pe.Value(), offset: off}}
		}
	case Uint64Value:
		if hasx {
			return &lvalue{Operand: &operand{abi: &ctx.cfg.ABI, typ: ctx.cfg.ABI.Ptr(n, pe.Type().Elem()), value: y + Uint64Value(off)}}
		}
	}

	if d := pe.Declarator(); d != nil && hasx {
		r := &lvalue{Operand: &operand{abi: &ctx.cfg.ABI, typ: ctx.cfg.ABI.Ptr(n, pe.Type().Elem()), offset: pe.Offset() + off}, declarator: d}
		return r
	}

	return &lvalue{Operand: &operand{abi: &ctx.cfg.ABI, typ: ctx.cfg.ABI.Ptr(n, pe.Type().Elem())}}
}

func (n *PrimaryExpression) addrOf(ctx *context) Operand {
	if n == nil {
		return noOperand
	}

	n.Operand = noOperand //TODO-
	switch n.Case {
	case PrimaryExpressionIdent: // IDENTIFIER
		n.IsSideEffectsFree = true
		n.check(ctx, false, false)
		if d := n.Operand.Declarator(); d != nil {
			switch d.Type().Kind() {
			case Function:
				// nop //TODO ?
			default:
				setAddressTaken(n, d, "&IDENTIFIER")
				n.Operand = &lvalue{Operand: &operand{abi: &ctx.cfg.ABI, typ: ctx.cfg.ABI.Ptr(n, d.Type())}, declarator: d}
			}
			return n.Operand
		}
		if ctx.cfg.RejectLateBinding && !ctx.cfg.ignoreUndefinedIdentifiers {
			ctx.errNode(n, "front-end: undefined: %s", n.Token.Value)
			return noOperand
		}

		//TODO
	case PrimaryExpressionInt: // INTCONST
		panic(n.Position().String())
	case PrimaryExpressionFloat: // FLOATCONST
		panic(n.Position().String())
	case PrimaryExpressionEnum: // ENUMCONST
		panic(n.Position().String())
	case PrimaryExpressionChar: // CHARCONST
		panic(n.Position().String())
	case PrimaryExpressionLChar: // LONGCHARCONST
		panic(n.Position().String())
	case PrimaryExpressionString: // STRINGLITERAL
		panic(n.Position().String())
	case PrimaryExpressionLString: // LONGSTRINGLITERAL
		panic(n.Position().String())
	case PrimaryExpressionExpr: // '(' Expression ')'
		n.Operand = n.Expression.addrOf(ctx)
		n.IsSideEffectsFree = n.Expression.IsSideEffectsFree
	case PrimaryExpressionStmt: // '(' CompoundStatement ')'
		panic(n.Position().String())
	default:
		panic(todo(""))
	}
	return n.Operand
}

func (n *Expression) addrOf(ctx *context) Operand {
	if n == nil {
		return noOperand
	}
	n.Operand = noOperand //TODO-
	switch n.Case {
	case ExpressionAssign: // AssignmentExpression
		n.Operand = n.AssignmentExpression.addrOf(ctx)
		n.IsSideEffectsFree = n.AssignmentExpression.IsSideEffectsFree
	case ExpressionComma: // Expression ',' AssignmentExpression
		panic(n.Position().String())
	default:
		panic(todo(""))
	}
	return n.Operand
}

func (n *AssignmentExpression) addrOf(ctx *context) Operand {
	if n == nil {
		return noOperand
	}
	n.Operand = noOperand //TODO-
	switch n.Case {
	case AssignmentExpressionCond: // ConditionalExpression
		n.Operand = n.ConditionalExpression.addrOf(ctx)
		n.IsSideEffectsFree = n.ConditionalExpression.IsSideEffectsFree
	case AssignmentExpressionAssign: // UnaryExpression '=' AssignmentExpression
		panic(n.Position().String())
	case AssignmentExpressionMul: // UnaryExpression "*=" AssignmentExpression
		panic(n.Position().String())
	case AssignmentExpressionDiv: // UnaryExpression "/=" AssignmentExpression
		panic(n.Position().String())
	case AssignmentExpressionMod: // UnaryExpression "%=" AssignmentExpression
		panic(n.Position().String())
	case AssignmentExpressionAdd: // UnaryExpression "+=" AssignmentExpression
		panic(n.Position().String())
	case AssignmentExpressionSub: // UnaryExpression "-=" AssignmentExpression
		panic(n.Position().String())
	case AssignmentExpressionLsh: // UnaryExpression "<<=" AssignmentExpression
		panic(n.Position().String())
	case AssignmentExpressionRsh: // UnaryExpression ">>=" AssignmentExpression
		panic(n.Position().String())
	case AssignmentExpressionAnd: // UnaryExpression "&=" AssignmentExpression
		panic(n.Position().String())
	case AssignmentExpressionXor: // UnaryExpression "^=" AssignmentExpression
		panic(n.Position().String())
	case AssignmentExpressionOr: // UnaryExpression "|=" AssignmentExpression
		panic(n.Position().String())
	default:
		panic(todo(""))
	}
	return n.Operand
}

func (n *ConditionalExpression) addrOf(ctx *context) Operand {
	if n == nil {
		return noOperand
	}
	n.Operand = noOperand //TODO-
	switch n.Case {
	case ConditionalExpressionLOr: // LogicalOrExpression
		n.Operand = n.LogicalOrExpression.addrOf(ctx)
		n.IsSideEffectsFree = n.LogicalOrExpression.IsSideEffectsFree
	case ConditionalExpressionCond: // LogicalOrExpression '?' Expression ':' ConditionalExpression
		panic(n.Position().String())
	default:
		panic(todo(""))
	}
	return n.Operand
}

func (n *LogicalOrExpression) addrOf(ctx *context) Operand {
	if n == nil {
		return noOperand
	}

	n.Operand = noOperand //TODO-
	switch n.Case {
	case LogicalOrExpressionLAnd: // LogicalAndExpression
		n.Operand = n.LogicalAndExpression.addrOf(ctx)
		n.IsSideEffectsFree = n.LogicalAndExpression.IsSideEffectsFree
	case LogicalOrExpressionLOr: // LogicalOrExpression "||" LogicalAndExpression
		panic(n.Position().String())
	default:
		panic(todo(""))
	}
	return n.Operand
}

func (n *LogicalAndExpression) addrOf(ctx *context) Operand {
	if n == nil {
		return noOperand
	}

	n.Operand = noOperand //TODO-
	switch n.Case {
	case LogicalAndExpressionOr: // InclusiveOrExpression
		n.Operand = n.InclusiveOrExpression.addrOf(ctx)
		n.IsSideEffectsFree = n.InclusiveOrExpression.IsSideEffectsFree
	case LogicalAndExpressionLAnd: // LogicalAndExpression "&&" InclusiveOrExpression
		panic(n.Position().String())
	default:
		panic(todo(""))
	}
	return n.Operand
}

func (n *InclusiveOrExpression) addrOf(ctx *context) Operand {
	if n == nil {
		return noOperand
	}

	n.Operand = noOperand //TODO-
	switch n.Case {
	case InclusiveOrExpressionXor: // ExclusiveOrExpression
		n.Operand = n.ExclusiveOrExpression.addrOf(ctx)
		n.IsSideEffectsFree = n.ExclusiveOrExpression.IsSideEffectsFree
	case InclusiveOrExpressionOr: // InclusiveOrExpression '|' ExclusiveOrExpression
		panic(n.Position().String())
	default:
		panic(todo(""))
	}
	return n.Operand
}

func (n *ExclusiveOrExpression) addrOf(ctx *context) Operand {
	if n == nil {
		return noOperand
	}

	n.Operand = noOperand //TODO-
	switch n.Case {
	case ExclusiveOrExpressionAnd: // AndExpression
		n.Operand = n.AndExpression.addrOf(ctx)
		n.IsSideEffectsFree = n.AndExpression.IsSideEffectsFree
	case ExclusiveOrExpressionXor: // ExclusiveOrExpression '^' AndExpression
		panic(n.Position().String())
	default:
		panic(todo(""))
	}
	return n.Operand
}

func (n *AndExpression) addrOf(ctx *context) Operand {
	if n == nil {
		return noOperand
	}

	n.Operand = noOperand //TODO-
	switch n.Case {
	case AndExpressionEq: // EqualityExpression
		n.Operand = n.EqualityExpression.addrOf(ctx)
		n.IsSideEffectsFree = n.EqualityExpression.IsSideEffectsFree
	case AndExpressionAnd: // AndExpression '&' EqualityExpression
		panic(n.Position().String())
	default:
		panic(todo(""))
	}
	return n.Operand
}

func (n *EqualityExpression) addrOf(ctx *context) Operand {
	if n == nil {
		return noOperand
	}

	n.Operand = noOperand //TODO-
	switch n.Case {
	case EqualityExpressionRel: // RelationalExpression
		n.Operand = n.RelationalExpression.addrOf(ctx)
		n.IsSideEffectsFree = n.RelationalExpression.IsSideEffectsFree
	case EqualityExpressionEq: // EqualityExpression "==" RelationalExpression
		panic(n.Position().String())
	case EqualityExpressionNeq: // EqualityExpression "!=" RelationalExpression
		panic(n.Position().String())
	default:
		panic(todo(""))
	}
	return n.Operand
}

func (n *RelationalExpression) addrOf(ctx *context) Operand {
	if n == nil {
		return noOperand
	}

	n.Operand = noOperand //TODO-
	switch n.Case {
	case RelationalExpressionShift: // ShiftExpression
		n.Operand = n.ShiftExpression.addrOf(ctx)
		n.IsSideEffectsFree = n.ShiftExpression.IsSideEffectsFree
	case RelationalExpressionLt: // RelationalExpression '<' ShiftExpression
		panic(n.Position().String())
	case RelationalExpressionGt: // RelationalExpression '>' ShiftExpression
		panic(n.Position().String())
	case RelationalExpressionLeq: // RelationalExpression "<=" ShiftExpression
		panic(n.Position().String())
	case RelationalExpressionGeq: // RelationalExpression ">=" ShiftExpression
		panic(n.Position().String())
	default:
		panic(todo(""))
	}
	return n.Operand
}

func (n *ShiftExpression) addrOf(ctx *context) Operand {
	if n == nil {
		return noOperand
	}

	n.Operand = noOperand //TODO-
	switch n.Case {
	case ShiftExpressionAdd: // AdditiveExpression
		n.Operand = n.AdditiveExpression.addrOf(ctx)
		n.IsSideEffectsFree = n.AdditiveExpression.IsSideEffectsFree
	case ShiftExpressionLsh: // ShiftExpression "<<" AdditiveExpression
		panic(n.Position().String())
	case ShiftExpressionRsh: // ShiftExpression ">>" AdditiveExpression
		panic(n.Position().String())
	default:
		panic(todo(""))
	}
	return n.Operand
}

func (n *AdditiveExpression) addrOf(ctx *context) Operand {
	if n == nil {
		return noOperand
	}

	n.Operand = noOperand //TODO-
	switch n.Case {
	case AdditiveExpressionMul: // MultiplicativeExpression
		n.Operand = n.MultiplicativeExpression.addrOf(ctx)
		n.IsSideEffectsFree = n.MultiplicativeExpression.IsSideEffectsFree
	case AdditiveExpressionAdd: // AdditiveExpression '+' MultiplicativeExpression
		panic(n.Position().String())
	case AdditiveExpressionSub: // AdditiveExpression '-' MultiplicativeExpression
		panic(n.Position().String())
	default:
		panic(todo(""))
	}
	return n.Operand
}

func (n *MultiplicativeExpression) addrOf(ctx *context) Operand {
	if n == nil {
		return noOperand
	}

	n.Operand = noOperand //TODO-
	switch n.Case {
	case MultiplicativeExpressionCast: // CastExpression
		n.Operand = n.CastExpression.addrOf(ctx)
		n.IsSideEffectsFree = n.CastExpression.IsSideEffectsFree
	case MultiplicativeExpressionMul: // MultiplicativeExpression '*' CastExpression
		panic(n.Position().String())
	case MultiplicativeExpressionDiv: // MultiplicativeExpression '/' CastExpression
		panic(n.Position().String())
	case MultiplicativeExpressionMod: // MultiplicativeExpression '%' CastExpression
		panic(n.Position().String())
	default:
		panic(todo(""))
	}
	return n.Operand
}

func (n *TypeName) check(ctx *context, inUnion, isPacked bool, list *[]*TypeSpecifier) Type {
	if n == nil {
		return noType
	}

	n.typ = n.SpecifierQualifierList.check(ctx, inUnion, isPacked, list)
	if n.AbstractDeclarator != nil {
		n.typ = n.AbstractDeclarator.check(ctx, n.typ)
	}
	for list := n.SpecifierQualifierList; list != nil; list = list.SpecifierQualifierList {
		if expr, ok := list.AttributeSpecifier.Has(idVectorSize, idVectorSize2); ok {
			n.vectorize(ctx, expr)
			break
		}
	}
	return n.typ
}

func (n *TypeName) vectorize(ctx *context, expr *ExpressionList) {
	dst := &n.typ
	elem := n.typ
	switch n.typ.Kind() {
	case Function:
		dst = &n.typ.(*functionType).result
		elem = n.typ.Result()
	}

	sz := expr.vectorSize(ctx)
	if sz == 0 {
		sz = elem.Size()
	}
	if sz%elem.Size() != 0 {
		ctx.errNode(expr, "vector size must be a multiple of the base size")
	}
	b := n.typ.base()
	b.size = sz
	b.kind = byte(Vector)
	*dst = &vectorType{
		typeBase: b,
		elem:     elem,
		length:   sz / elem.Size(),
	}
}

func (n *AbstractDeclarator) check(ctx *context, typ Type) Type {
	if n == nil {
		return typ
	}

	n.typ = noType //TODO-
	switch n.Case {
	case AbstractDeclaratorPtr: // Pointer
		n.typ = n.Pointer.check(ctx, typ)
	case AbstractDeclaratorDecl: // Pointer DirectAbstractDeclarator
		typ = n.Pointer.check(ctx, typ)
		n.typ = n.DirectAbstractDeclarator.check(ctx, typ)
	default:
		panic(todo(""))
	}
	return n.typ
}

func (n *DirectAbstractDeclarator) check(ctx *context, typ Type) Type {
	if n == nil {
		return typ
	}

	switch n.Case {
	case DirectAbstractDeclaratorDecl: // '(' AbstractDeclarator ')'
		if n.AbstractDeclarator == nil {
			// [0], 6.7.6, 128)
			//
			// As indicated by the syntax, empty parentheses in a
			// type name are interpreted as ‘‘function with no
			// parameter specification’’, rather than redundant
			// parentheses around the omitted identifier.
			panic(todo("")) //TODO
		}

		return n.AbstractDeclarator.check(ctx, typ)
	case DirectAbstractDeclaratorArr: // DirectAbstractDeclarator '[' TypeQualifiers AssignmentExpression ']'
		return n.DirectAbstractDeclarator.check(ctx, checkArray(ctx, &n.Token, typ, n.AssignmentExpression, true, false))
	case DirectAbstractDeclaratorStaticArr: // DirectAbstractDeclarator '[' "static" TypeQualifiers AssignmentExpression ']'
		return n.DirectAbstractDeclarator.check(ctx, checkArray(ctx, &n.Token, typ, n.AssignmentExpression, false, false))
	case DirectAbstractDeclaratorArrStatic: // DirectAbstractDeclarator '[' TypeQualifiers "static" AssignmentExpression ']'
		return n.DirectAbstractDeclarator.check(ctx, checkArray(ctx, &n.Token, typ, n.AssignmentExpression, false, false))
	case DirectAbstractDeclaratorArrStar: // DirectAbstractDeclarator '[' '*' ']'
		return n.DirectAbstractDeclarator.check(ctx, checkArray(ctx, &n.Token, typ, nil, true, true))
	case DirectAbstractDeclaratorFunc: // DirectAbstractDeclarator '(' ParameterTypeList ')'
		ft := &functionType{typeBase: typeBase{kind: byte(Function)}, result: typ}
		n.ParameterTypeList.check(ctx, ft)
		return n.DirectAbstractDeclarator.check(ctx, ft)
	}

	panic(internalErrorf("%v: %v", n.Position(), n.Case))
}

func (n *ParameterTypeList) check(ctx *context, ft *functionType) {
	if n == nil {
		return
	}

	switch n.Case {
	case ParameterTypeListList: // ParameterList
		n.ParameterList.check(ctx, ft)
	case ParameterTypeListVar: // ParameterList ',' "..."
		ft.variadic = true
		n.ParameterList.check(ctx, ft)
	default:
		panic(todo(""))
	}
}

func (n *ParameterList) check(ctx *context, ft *functionType) {
	for ; n != nil; n = n.ParameterList {
		p := n.ParameterDeclaration.check(ctx, ft)
		ft.params = append(ft.params, p)
	}
}

func (n *ParameterDeclaration) check(ctx *context, ft *functionType) *Parameter {
	if n == nil {
		return nil
	}

	switch n.Case {
	case ParameterDeclarationDecl: // DeclarationSpecifiers Declarator AttributeSpecifierList
		typ, _, _ := n.DeclarationSpecifiers.check(ctx, false)
		n.Declarator.IsParameter = true
		if n.typ = n.Declarator.check(ctx, n.DeclarationSpecifiers, typ, false); n.typ.Kind() == Void {
			panic(n.Position().String())
		}
		if n.AttributeSpecifierList != nil {
			//TODO panic(n.Position().String())
		}
		n.AttributeSpecifierList.check(ctx, n.typ.baseP())
		return &Parameter{d: n.Declarator, typ: n.typ}
	case ParameterDeclarationAbstract: // DeclarationSpecifiers AbstractDeclarator
		n.typ, _, _ = n.DeclarationSpecifiers.check(ctx, false)
		if n.AbstractDeclarator != nil {
			n.typ = n.AbstractDeclarator.check(ctx, n.typ)
		}
		return &Parameter{typ: n.typ}
	default:
		panic(todo(""))
	}
}

func (n *Pointer) check(ctx *context, typ Type) (t Type) {
	if n == nil || typ == nil {
		return typ
	}

	switch n.Case {
	case PointerTypeQual: // '*' TypeQualifiers
		n.TypeQualifiers.check(ctx, &n.typeQualifiers)
	case PointerPtr: // '*' TypeQualifiers Pointer
		n.TypeQualifiers.check(ctx, &n.typeQualifiers)
		typ = n.Pointer.check(ctx, typ)
	case PointerBlock: // '^' TypeQualifiers
		n.TypeQualifiers.check(ctx, &n.typeQualifiers)
	default:
		panic(todo(""))
	}
	r := ctx.cfg.ABI.Ptr(n, typ).(*pointerType)
	if n.typeQualifiers != nil {
		r.typeQualifiers = n.typeQualifiers.check(ctx, (*DeclarationSpecifiers)(nil), false)
	}
	return r
}

func (n *TypeQualifiers) check(ctx *context, typ **typeBase) {
	for ; n != nil; n = n.TypeQualifiers {
		switch n.Case {
		case TypeQualifiersTypeQual: // TypeQualifier
			if *typ == nil {
				*typ = &typeBase{}
			}
			n.TypeQualifier.check(ctx, *typ)
		case TypeQualifiersAttribute: // AttributeSpecifier
			if *typ == nil {
				*typ = &typeBase{}
			}
			n.AttributeSpecifier.check(ctx, *typ)
		default:
			panic(todo(""))
		}
	}
}

func (n *TypeQualifier) check(ctx *context, typ *typeBase) {
	if n == nil {
		return
	}

	switch n.Case {
	case TypeQualifierConst: // "const"
		typ.flags |= fConst
	case TypeQualifierRestrict: // "restrict"
		typ.flags |= fRestrict
	case TypeQualifierVolatile: // "volatile"
		typ.flags |= fVolatile
	case TypeQualifierAtomic: // "_Atomic"
		typ.flags |= fAtomic
	default:
		panic(todo(""))
	}
}

func (n *SpecifierQualifierList) check(ctx *context, inUnion, isPacked bool, list *[]*TypeSpecifier) Type {
	n0 := n
	typ := &typeBase{}
	for ; n != nil; n = n.SpecifierQualifierList {
		switch n.Case {
		case SpecifierQualifierListTypeSpec: // TypeSpecifier SpecifierQualifierList
			n.TypeSpecifier.check(ctx, typ, inUnion)
			if list != nil && n.TypeSpecifier.Case != TypeSpecifierAtomic {
				*list = append(*list, n.TypeSpecifier)
			}
		case SpecifierQualifierListTypeQual: // TypeQualifier SpecifierQualifierList
			n.TypeQualifier.check(ctx, typ)
		case SpecifierQualifierListAlignSpec: // AlignmentSpecifier SpecifierQualifierList
			n.AlignmentSpecifier.check(ctx)
		case SpecifierQualifierListAttribute: // AttributeSpecifier SpecifierQualifierList
			n.AttributeSpecifier.check(ctx, typ)
		default:
			panic(todo(""))
		}
	}
	return typ.check(ctx, n0, true)
}

func (n *TypeSpecifier) check(ctx *context, typ *typeBase, inUnion bool) {
	if n == nil {
		return
	}

	switch n.Case {
	case
		TypeSpecifierVoid,       // "void"
		TypeSpecifierChar,       // "char"
		TypeSpecifierShort,      // "short"
		TypeSpecifierInt,        // "int"
		TypeSpecifierInt8,       // "__int8"
		TypeSpecifierInt16,      // "__int16"
		TypeSpecifierInt32,      // "__int32"
		TypeSpecifierInt64,      // "__int64"
		TypeSpecifierInt128,     // "__int128"
		TypeSpecifierLong,       // "long"
		TypeSpecifierFloat,      // "float"
		TypeSpecifierFloat16,    // "__fp16"
		TypeSpecifierDecimal32,  // "_Decimal32"
		TypeSpecifierDecimal64,  // "_Decimal64"
		TypeSpecifierDecimal128, // "_Decimal128"
		TypeSpecifierFloat32,    // "_Float32"
		TypeSpecifierFloat32x,   // "_Float32x"
		TypeSpecifierFloat64,    // "_Float64"
		TypeSpecifierFloat64x,   // "_Float64x"
		TypeSpecifierFloat128,   // "_Float128"
		TypeSpecifierFloat80,    // "__float80"
		TypeSpecifierDouble,     // "double"
		TypeSpecifierSigned,     // "signed"
		TypeSpecifierUnsigned,   // "unsigned"
		TypeSpecifierBool,       // "_Bool"
		TypeSpecifierComplex:    // "_Complex"
		// nop
	case TypeSpecifierStructOrUnion: // StructOrUnionSpecifier
		n.StructOrUnionSpecifier.check(ctx, typ, inUnion)
	case TypeSpecifierEnum: // EnumSpecifier
		n.EnumSpecifier.check(ctx)
	case TypeSpecifierTypedefName: // TYPEDEFNAME
		// nop
	case TypeSpecifierTypeofExpr: // "typeof" '(' Expression ')'
		op := n.Expression.check(ctx, false)
		n.typ = op.Type()
	case TypeSpecifierTypeofType: // "typeof" '(' TypeName ')'
		n.typ = n.TypeName.check(ctx, false, false, nil)
	case TypeSpecifierAtomic: // AtomicTypeSpecifier
		t := n.AtomicTypeSpecifier.check(ctx)
		typ.kind = t.base().kind
		typ.flags |= fAtomic
		n.typ = typ
	case
		TypeSpecifierFract, // "_Fract"
		TypeSpecifierSat,   // "_Sat"
		TypeSpecifierAccum: // "_Accum"
		// nop
	default:
		panic(todo(""))
	}
}

func (n *AtomicTypeSpecifier) check(ctx *context) Type {
	if n == nil {
		return nil
	}

	return n.TypeName.check(ctx, false, false, &n.list)
}

func (n *EnumSpecifier) check(ctx *context) {
	if n == nil {
		return
	}

	switch n.Case {
	case EnumSpecifierDef: // "enum" AttributeSpecifierList IDENTIFIER '{' EnumeratorList ',' '}'
		n.AttributeSpecifierList.check(ctx, nil)
		min, max := n.EnumeratorList.check(ctx)
		var tmin, tmax Type
		switch min := min.(type) {
		case Int64Value:
			switch {
			case min >= 0 && ctx.cfg.UnsignedEnums:
				tmin = n.requireUint(ctx, uint64(min))
				switch max := max.(type) {
				case Int64Value:
					tmax = n.requireUint(ctx, uint64(max))
				case Uint64Value:
					tmax = n.requireUint(ctx, uint64(max))
				case nil:
					panic(todo("%v:", n.Position()))
				}
			default:
				tmin = n.requireInt(ctx, int64(min))
				switch max := max.(type) {
				case Int64Value:
					tmax = n.requireInt(ctx, int64(max))
				case Uint64Value:
					tmax = n.requireInt(ctx, int64(max))
				case nil:
					panic(todo("%v:", n.Position()))
				}
			}
		case Uint64Value:
			tmin = n.requireUint(ctx, uint64(min))
			switch max := max.(type) {
			case Int64Value:
				if max < 0 {
					panic(todo("%v: min %v max %v", n.Position(), min, max))
				}

				tmax = n.requireUint(ctx, uint64(max))
			case Uint64Value:
				tmax = n.requireUint(ctx, uint64(max))
			case nil:
				_ = max
				panic(todo("%v:", n.Position()))
			}
		case nil:
			panic(todo("%v: %v %T", n.Position(), n.Case, min))
		}
		switch {
		case tmin.Size() > tmax.Size():
			n.typ = tmin
		default:
			n.typ = tmax
		}
		if !n.typ.IsIntegerType() || n.typ.Size() == 0 { //TODO-
			panic(todo(""))
		}

		reg := n.lexicalScope.Parent() == nil
		for list := n.EnumeratorList; list != nil; list = list.EnumeratorList {
			en := list.Enumerator
			en.Operand = en.Operand.convertTo(ctx, en, n.typ)
			if reg {
				ctx.enums[en.Token.Value] = en.Operand
			}
		}
	case EnumSpecifierTag: // "enum" AttributeSpecifierList IDENTIFIER
		n.typ = &taggedType{
			resolutionScope: n.lexicalScope,
			tag:             n.Token2.Value,
			typeBase:        &typeBase{kind: byte(Enum)},
		}
	default:
		panic(todo(""))
	}
}

func (n *EnumSpecifier) requireInt(ctx *context, m int64) (r Type) {
	var w int
	switch {
	case m < 0:
		w = mathutil.BitLenUint64(uint64(-m))
	default:
		w = mathutil.BitLenUint64(uint64(m)) + 1
	}
	w = mathutil.Max(w, 32)
	abi := ctx.cfg.ABI
	for k0, v := range intConvRank {
		k := Kind(k0)
		if k == Bool || k == Enum || v == 0 || !abi.isSignedInteger(k) {
			continue
		}

		t := abi.Types[k]
		if int(t.Size)*8 < w {
			continue
		}

		if r == nil || t.Size < r.Size() {
			r = abi.Type(k)
		}
	}
	if r == nil || r.Size() == 0 { //TODO-
		panic(todo(""))
	}
	return r
}

func (n *EnumSpecifier) requireUint(ctx *context, m uint64) (r Type) {
	w := mathutil.BitLenUint64(m)
	w = mathutil.Max(w, 32)
	abi := ctx.cfg.ABI
	for k0, v := range intConvRank {
		k := Kind(k0)
		if k == Bool || k == Enum || v == 0 || abi.isSignedInteger(k) {
			continue
		}

		t := abi.Types[k]
		if int(t.Size)*8 < w {
			continue
		}

		if r == nil || t.Size < r.Size() {
			r = abi.Type(k)
		}
	}
	if r == nil || r.Size() == 0 { //TODO-
		panic(todo(""))
	}
	return r
}

func (n *EnumeratorList) check(ctx *context) (min, max Value) {
	var iota Value
	for ; n != nil; n = n.EnumeratorList {
		iota, min, max = n.Enumerator.check(ctx, iota, min, max)
	}
	return min, max
}

func (n *Enumerator) check(ctx *context, iota, min, max Value) (Value, Value, Value) {
	if n == nil {
		return nil, nil, nil
	}

	if iota == nil {
		iota = Int64Value(0)
	}
	switch n.Case {
	case EnumeratorIdent: // IDENTIFIER AttributeSpecifierList
		n.AttributeSpecifierList.check(ctx, nil)
		n.Operand = (&operand{abi: &ctx.cfg.ABI, typ: ctx.cfg.ABI.Type(Int), value: iota}).normalize(ctx, n)
	case EnumeratorExpr: // IDENTIFIER AttributeSpecifierList '=' ConstantExpression
		n.AttributeSpecifierList.check(ctx, nil)
		n.Operand = n.ConstantExpression.check(ctx, ctx.mode|mIntConstExpr, false)
		iota = n.Operand.Value()
	default:
		panic(todo(""))
	}
	switch x := iota.(type) {
	case Int64Value:
		switch m := min.(type) {
		case Int64Value:
			if x < m {
				min = x
			}
		case Uint64Value:
			if x < 0 || Uint64Value(x) < m {
				min = x
			}
		case nil:
			min = x
		}
		switch m := max.(type) {
		case Int64Value:
			if x > m {
				max = x
			}
		case Uint64Value:
			if x >= 0 && Uint64Value(x) > m {
				max = x
			}
		case nil:
			max = x
		}
		x++
		iota = x
	case Uint64Value:
		switch m := min.(type) {
		case Int64Value:
			if m < 0 {
				break
			}

			if x < Uint64Value(m) {
				min = x
			}
		case Uint64Value:
			if x < m {
				min = x
			}
		case nil:
			min = x
		}
		switch m := max.(type) {
		case Int64Value:
			if m < 0 {
				max = x
				break
			}

			if x > Uint64Value(m) {
				max = x
			}

		case Uint64Value:
			if x > m {
				max = x
			}
		case nil:
			max = x
		}
		x++
		iota = x
	case nil:
		//TODO report type
	}

	return iota, min, max
}

func (n *ConstantExpression) check(ctx *context, mode mode, isAsmArg bool) Operand {
	if n == nil {
		return noOperand
	}

	ctx.push(mode)
	n.Operand = n.ConditionalExpression.check(ctx, isAsmArg)
	ctx.pop()
	return n.Operand
}

func (n *StructOrUnionSpecifier) check(ctx *context, typ *typeBase, inUnion bool) Type {
	if n == nil {
		return noType
	}

	switch n.Case {
	case StructOrUnionSpecifierDef: // StructOrUnion AttributeSpecifierList IDENTIFIER '{' StructDeclarationList '}'
		typ.kind = byte(n.StructOrUnion.check(ctx))
		attr := n.AttributeSpecifierList.check(ctx, typ)
		fields := n.StructDeclarationList.check(ctx, inUnion || typ.Kind() == Union, typ.IsPacked())
		m := make(map[StringID]*field, len(fields))
		x := 0
		for _, v := range fields {
			if v.name != 0 {
				v.x = x
				v.xs = []int{x}
				x++
				m[v.name] = v
			}
		}
		t := (&structType{
			attr:     attr,
			fields:   fields,
			m:        m,
			tag:      n.Token.Value,
			typeBase: typ,
		}).check(ctx, n)
		if typ.Kind() == Union {
			var k Kind
			for _, v := range fields {
				if k == Invalid {
					k = v.typ.Kind()
					continue
				}

				if v.typ.Kind() != k {
					k = Invalid
					break
				}
			}
			t.common = k
		}
		n.typ = t
		if nm := n.Token.Value; nm != 0 && n.lexicalScope.Parent() == nil {
			ctx.structTypes[nm] = t
		}
	case StructOrUnionSpecifierTag: // StructOrUnion AttributeSpecifierList IDENTIFIER
		typ.kind = byte(n.StructOrUnion.check(ctx))
		attr := n.AttributeSpecifierList.check(ctx, typ.baseP())
		n.typ = &taggedType{
			resolutionScope: n.lexicalScope,
			tag:             n.Token.Value,
			typeBase:        typ,
		}
		if attr != nil {
			n.typ = &attributedType{n.typ, attr}
		}
	default:
		panic(todo(""))
	}
	return n.typ
}

func (n *StructDeclarationList) check(ctx *context, inUnion, isPacked bool) (s []*field) {
	for ; n != nil; n = n.StructDeclarationList {
		s = append(s, n.StructDeclaration.check(ctx, inUnion, isPacked)...)
	}
	return s
}

func (n *StructDeclaration) check(ctx *context, inUnion, isPacked bool) (s []*field) {
	if n == nil || n.Empty {
		return nil
	}

	typ := n.SpecifierQualifierList.check(ctx, inUnion, isPacked, nil)
	if n.StructDeclaratorList != nil {
		return n.StructDeclaratorList.check(ctx, n.SpecifierQualifierList, typ, inUnion, isPacked)
	}

	return []*field{{typ: typ, inUnion: inUnion}}
}

func (n *StructDeclaratorList) check(ctx *context, td typeDescriptor, typ Type, inUnion, isPacked bool) (s []*field) {
	for ; n != nil; n = n.StructDeclaratorList {
		s = append(s, n.StructDeclarator.check(ctx, td, typ, inUnion, isPacked))
	}
	return s
}

func (n *StructDeclarator) check(ctx *context, td typeDescriptor, typ Type, inUnion, isPacked bool) *field {
	if n == nil {
		return nil
	}

	if isPacked {
		typ.baseP().flags |= fPacked
	}
	if n.Declarator != nil {
		typ = n.Declarator.check(ctx, td, typ, false)
	}
	if attr := n.AttributeSpecifierList.check(ctx, typ.baseP()); len(attr) != 0 {
		typ = &attributedType{typ, attr}
	}
	sf := &field{
		typ:     typ,
		d:       n,
		inUnion: inUnion,
	}
	switch n.Case {
	case StructDeclaratorDecl: // Declarator
		sf.name = n.Declarator.Name()
	case StructDeclaratorBitField: // Declarator ':' ConstantExpression AttributeSpecifierList
		sf.isBitField = true
		sf.typ = &bitFieldType{Type: typ, field: sf}
		sf.name = n.Declarator.Name()
		if op := n.ConstantExpression.check(ctx, ctx.mode|mIntConstExpr, false); op.Type().IsIntegerType() {
			switch x := op.Value().(type) {
			case Int64Value:
				if x < 0 || x > 64 {
					panic("TODO")
				}
				sf.bitFieldWidth = byte(x)
			case Uint64Value:
				if x > 64 {
					panic("TODO")
				}
				sf.bitFieldWidth = byte(x)
			default:
				//dbg("%T", x)
				panic(PrettyString(op))
			}
		} else {
			//dbg("", n.ConstantExpression)
			panic(n.Declarator.Position())
		}
		n.AttributeSpecifierList.check(ctx, sf.typ.baseP())
	default:
		panic(todo(""))
	}
	return sf
}

func (n *StructOrUnion) check(ctx *context) Kind {
	if n == nil {
		return Invalid
	}

	switch n.Case {
	case StructOrUnionStruct: // "struct"
		return Struct
	case StructOrUnionUnion: // "union"
		return Union
	default:
		panic(todo(""))
	}
}

func (n *CastExpression) check(ctx *context, isAsmArg bool) Operand {
	if n == nil {
		return noOperand
	}

	n.Operand = noOperand //TODO-
	switch n.Case {
	case CastExpressionUnary: // UnaryExpression
		n.Operand = n.UnaryExpression.check(ctx, isAsmArg)
		n.IsSideEffectsFree = n.UnaryExpression.IsSideEffectsFree
	case CastExpressionCast: // '(' TypeName ')' CastExpression
		t := n.TypeName.check(ctx, false, false, nil)
		ctx.push(ctx.mode)
		if m := ctx.mode; m&mIntConstExpr != 0 && m&mIntConstExprAnyCast == 0 {
			if t := n.TypeName.Type(); t != nil && t.Kind() != Int {
				ctx.mode &^= mIntConstExpr
			}
			ctx.mode |= mIntConstExprFloat
		}
		op := n.CastExpression.check(ctx, isAsmArg)
		n.IsSideEffectsFree = n.CastExpression.IsSideEffectsFree
		ctx.pop()
		n.Operand = op.convertTo(ctx, n, t)
	default:
		panic(todo(""))
	}
	return n.Operand
}

func (n *PostfixExpression) check(ctx *context, implicitFunc, isAsmArg bool) Operand {
	if n == nil {
		return noOperand
	}

	n.Operand = noOperand //TODO-
out:
	switch n.Case {
	case PostfixExpressionPrimary: // PrimaryExpression
		n.Operand = n.PrimaryExpression.check(ctx, implicitFunc, isAsmArg)
		n.IsSideEffectsFree = n.PrimaryExpression.IsSideEffectsFree
	case PostfixExpressionIndex: // PostfixExpression '[' Expression ']'
		pe := n.PostfixExpression.check(ctx, false, isAsmArg)
		if d := pe.Declarator(); d != nil {
			d.Read += ctx.readDelta
		}
		e := n.Expression.check(ctx, isAsmArg)
		n.IsSideEffectsFree = n.PostfixExpression.IsSideEffectsFree && n.Expression.IsSideEffectsFree
		t := pe.Type().Decay()
		if t.Kind() == Invalid {
			break
		}

		if t.Kind() == Ptr {
			if t := e.Type(); t.Kind() != Invalid && !t.IsIntegerType() {
				ctx.errNode(n.Expression, "index must be integer type, have %v", e.Type())
				break
			}

			n.Operand = n.index(ctx, pe, e)
			break
		}

		if pe.Type().Kind() == Vector {
			if t := e.Type(); t.Kind() != Invalid && !t.IsIntegerType() {
				ctx.errNode(n.Expression, "index must be integer type, have %v", e.Type())
				break
			}

			n.Operand = n.index(ctx, pe, e)
			break
		}

		t = e.Type().Decay()
		if t.Kind() == Invalid {
			break
		}

		if t.Kind() == Ptr {
			if t := pe.Type(); t.Kind() != Invalid && !t.IsIntegerType() {
				ctx.errNode(n.Expression, "index must be integer type, have %v", pe.Type())
				break
			}

			n.Operand = n.index(ctx, e, pe)
			break
		}

		ctx.errNode(n, "invalid index expression %v[%v]", pe.Type(), e.Type())
	case PostfixExpressionCall: // PostfixExpression '(' ArgumentExpressionList ')'
		op := n.PostfixExpression.check(ctx, true, isAsmArg)
		Inspect(n.PostfixExpression, func(n Node, enter bool) bool {
			if !enter {
				return true
			}

			if x, ok := n.(*PrimaryExpression); ok {
				if d := x.Declarator(); d != nil {
					d.called = true
				}
			}
			return true
		})
		args := n.ArgumentExpressionList.check(ctx, n.PostfixExpression.Declarator(), isAsmArg)
		switch op.Declarator().Name() {
		case idBuiltinConstantPImpl:
			if len(args) < 2 {
				panic(todo(""))
			}

			var v Int64Value
			if args[1].Value() != nil {
				v = 1
			}
			n.Operand = &operand{abi: &ctx.cfg.ABI, typ: ctx.cfg.ABI.Type(Int), value: v}
		default:
			switch n.PostfixExpression.Operand.Value().(type) {
			case StringValue, WideStringValue:
				if isAsmArg {
					// asm("foo": "bar" (a))
					//            ^
					break out
				}
			}

			n.Operand = n.checkCall(ctx, n, op.Type(), args, n.ArgumentExpressionList)
		}
	case PostfixExpressionSelect: // PostfixExpression '.' IDENTIFIER
		op := n.PostfixExpression.check(ctx, false, isAsmArg)
		n.IsSideEffectsFree = n.PostfixExpression.IsSideEffectsFree
		if d := op.Declarator(); d != nil {
			d.Read += ctx.readDelta
		}
		st := op.Type()
		st0 := st.underlyingType()
		if k := st.Kind(); k == Invalid || k != Struct && k != Union {
			ctx.errNode(n.PostfixExpression, "select expression of wrong type: %s (%s)", st, st0)
			break
		}

		f, ok := st.FieldByName(n.Token2.Value)
		if !ok {
			ctx.errNode(n.PostfixExpression, "unknown or ambiguous field %q of type %s (%s)", n.Token2.Value, st, st0)
			break
		}

		n.Field = f
		ft := f.Type()
		if f.IsBitField() {
			ft = &bitFieldType{Type: ft, field: f.(*field)}
			n.Operand = &lvalue{Operand: &operand{abi: &ctx.cfg.ABI, typ: ft}}
			break
		}

		n.Operand = &lvalue{Operand: &operand{abi: &ctx.cfg.ABI, typ: ft, offset: op.Offset() + f.Offset()}}
	case PostfixExpressionPSelect: // PostfixExpression "->" IDENTIFIER
		op := n.PostfixExpression.check(ctx, false, isAsmArg)
		n.IsSideEffectsFree = n.PostfixExpression.IsSideEffectsFree
		if d := op.Declarator(); d != nil {
			d.Read += ctx.readDelta
		}
		t := op.Type()
		if k := t.Decay().Kind(); k == Invalid || k != Ptr {
			//TODO report error
			break
		}

		st := t.Elem()
		if k := st.Kind(); k == Invalid || k != Struct && k != Union {
			//TODO report error
			break
		}

		f, ok := st.FieldByName(n.Token2.Value)
		if !ok {
			//TODO report error
			break
		}

		n.Field = f
		ft := f.Type()
		if f.IsBitField() {
			ft = &bitFieldType{Type: ft, field: f.(*field)}
		}
		n.Operand = &lvalue{Operand: &operand{abi: &ctx.cfg.ABI, typ: ft}}
	case PostfixExpressionInc: // PostfixExpression "++"
		op := n.PostfixExpression.check(ctx, false, isAsmArg)
		if d := op.Declarator(); d != nil {
			d.SubjectOfIncDec = true
			d.Read += ctx.readDelta
			d.Write++
		}
		n.Operand = &operand{abi: &ctx.cfg.ABI, typ: op.Type()}
	case PostfixExpressionDec: // PostfixExpression "--"
		op := n.PostfixExpression.check(ctx, false, isAsmArg)
		if d := op.Declarator(); d != nil {
			d.SubjectOfIncDec = true
			d.Read += ctx.readDelta
			d.Write++
		}
		n.Operand = &operand{abi: &ctx.cfg.ABI, typ: op.Type()}
	case PostfixExpressionComplit: // '(' TypeName ')' '{' InitializerList ',' '}'
		//TODO IsSideEffectsFree
		if f := ctx.checkFn; f != nil {
			f.CompositeLiterals = append(f.CompositeLiterals, n)
		}
		t := n.TypeName.check(ctx, false, false, nil)
		var v *InitializerValue
		if n.InitializerList != nil {
			n.InitializerList.check(ctx, &n.InitializerList.list, t, Automatic, 0, nil, false)
			n.InitializerList.setConstZero()
			v = &InitializerValue{typ: t, initializer: n.InitializerList}
		}
		n.Operand = &lvalue{Operand: (&operand{abi: &ctx.cfg.ABI, typ: t, value: v}).normalize(ctx, n)}
	case PostfixExpressionTypeCmp: // "__builtin_types_compatible_p" '(' TypeName ',' TypeName ')'
		n.IsSideEffectsFree = true
		t1 := n.TypeName.check(ctx, false, false, nil)
		t2 := n.TypeName2.check(ctx, false, false, nil)
		v := 0
		switch {
		case t1.IsArithmeticType() && t2.IsArithmeticType():
			if t1.Kind() == t2.Kind() {
				v = 1
			}
		default:
			ctx.errNode(n, "ICE: __builtin_types_compatible_p(%v, %v)", t1, t2)
		}
		n.Operand = &operand{abi: &ctx.cfg.ABI, typ: ctx.cfg.ABI.Type(Int), value: Int64Value(v)}
	case PostfixExpressionChooseExpr: // "__builtin_choose_expr" '(' ConstantExpression ',' AssignmentExpression ',' AssignmentExpression ')'
		n.Operand = noOperand
		expr1 := n.AssignmentExpression.check(ctx, isAsmArg)
		if expr1 == nil {
			ctx.errNode(n, "first argument of __builtin_choose_expr must be a constant expression")
			break
		}

		if !expr1.IsConst() {
			ctx.errNode(n, "first argument of __builtin_choose_expr must be a constant expression: %v %v", expr1.Value(), expr1.Type())
			break
		}

		switch {
		case expr1.IsNonZero():
			n.Operand = n.AssignmentExpression2.check(ctx, isAsmArg)
			n.IsSideEffectsFree = n.AssignmentExpression2.IsSideEffectsFree
		default:
			n.Operand = n.AssignmentExpression3.check(ctx, isAsmArg)
			n.IsSideEffectsFree = n.AssignmentExpression3.IsSideEffectsFree
		}
	default:
		panic(todo(""))
	}
	return n.Operand
}

func (n *PostfixExpression) index(ctx *context, pe, e Operand) Operand {
	var x uintptr
	hasx := false
	switch v := e.Value().(type) {
	case Int64Value:
		x = uintptr(v)
		hasx = true
	case Uint64Value:
		x = uintptr(v)
		hasx = true
	}
	off := x * pe.Type().Elem().Size()
	switch v := pe.Value().(type) {
	case StringValue:
		if hasx {
			s := StringID(v).String()
			var v byte
			switch {
			case x > uintptr(len(s)):
				//TODO report err
				return noOperand
			case x < uintptr(len(s)):
				v = s[x]
			}

			return (&operand{abi: &ctx.cfg.ABI, typ: pe.Type().Elem(), value: Int64Value(v)}).normalize(ctx, n)
		}
	case WideStringValue:
		if hasx {
			s := []rune(StringID(v).String())
			var v rune
			switch {
			case x > uintptr(len(s)):
				//TODO report err
				return noOperand
			case x < uintptr(len(s)):
				v = s[x]
			}

			return (&operand{abi: &ctx.cfg.ABI, typ: pe.Type().Elem(), value: Int64Value(v)}).normalize(ctx, n)
		}
	}

	if d := pe.Declarator(); d != nil && hasx {
		return &lvalue{Operand: &operand{abi: &ctx.cfg.ABI, typ: pe.Type().Elem(), offset: pe.Offset() + off}, declarator: d}
	}

	return &lvalue{Operand: &operand{abi: &ctx.cfg.ABI, typ: pe.Type().Elem()}}
}

func (n *PostfixExpression) checkCall(ctx *context, nd Node, f Type, args []Operand, argList *ArgumentExpressionList) (r Operand) {
	r = noOperand
	switch f.Kind() {
	case Invalid:
		return noOperand
	case Function:
		// ok
	case Ptr:
		if e := f.Elem(); e.Kind() == Function {
			f = e
			break
		}

		ctx.errNode(nd, "expected function pointer type: %v, %v", f, f.Kind())
		return r
	default:
		ctx.errNode(nd, "expected function type: %v, %v", f, f.Kind())
		return r
	}

	r = &operand{abi: &ctx.cfg.ABI, typ: f.Result()}
	params := f.Parameters()
	if len(params) == 1 && params[0].Type().Kind() == Void {
		params = nil
		if len(args) != 0 {
			//TODO report error
			return r
		}
	}

	for i, arg := range args {
		var t Type
		switch {
		case i < len(params):
			//TODO check assignability
			t = params[i].Type().Decay()
		default:
			t = defaultArgumentPromotion(ctx, nd, arg).Type()
		}
		argList.AssignmentExpression.promote = t
		argList = argList.ArgumentExpressionList
	}
	return r
}

func defaultArgumentPromotion(ctx *context, n Node, op Operand) Operand {
	t := op.Type().Decay()
	if arithmeticTypes[t.Kind()] {
		if t.IsIntegerType() {
			return op.integerPromotion(ctx, n)
		}

		switch t.Kind() {
		case Float:
			return op.convertTo(ctx, n, ctx.cfg.ABI.Type(Double))
		}
	}
	return op
}

func (n *ArgumentExpressionList) check(ctx *context, f *Declarator, isAsmArg bool) (r []Operand) {
	for ; n != nil; n = n.ArgumentExpressionList {
		op := n.AssignmentExpression.check(ctx, isAsmArg)
		if op.Type() == nil {
			ctx.errNode(n, "operand has usupported, invalid or incomplete type")
			op = noOperand
		} else if op.Type().IsComplexType() {
			ctx.checkFn.CallSiteComplexExpr = append(ctx.checkFn.CallSiteComplexExpr, n.AssignmentExpression)
		}
		r = append(r, op)
		if !ctx.cfg.TrackAssignments {
			continue
		}

		Inspect(n.AssignmentExpression, func(n Node, enter bool) bool {
			if !enter {
				return true
			}

			if x, ok := n.(*PrimaryExpression); ok {
				x.Declarator().setLHS(f)
			}
			return true
		})
	}
	return r
}

func (n *Expression) check(ctx *context, isAsmArg bool) Operand {
	if n == nil {
		return noOperand
	}

	n.Operand = noOperand //TODO-
	switch n.Case {
	case ExpressionAssign: // AssignmentExpression
		n.Operand = n.AssignmentExpression.check(ctx, isAsmArg)
		n.IsSideEffectsFree = n.AssignmentExpression.IsSideEffectsFree
	case ExpressionComma: // Expression ',' AssignmentExpression
		op := n.Expression.check(ctx, isAsmArg)
		n.Operand = n.AssignmentExpression.check(ctx, isAsmArg)
		if !op.IsConst() && n.Operand.IsConst() {
			n.Operand = &operand{abi: &ctx.cfg.ABI, typ: n.Operand.Type()}
		}
		n.IsSideEffectsFree = n.Expression.IsSideEffectsFree && n.AssignmentExpression.IsSideEffectsFree
	default:
		panic(todo(""))
	}
	return n.Operand
}

func (n *PrimaryExpression) check(ctx *context, implicitFunc, isAsmArg bool) Operand {
	if n == nil {
		return noOperand
	}

	n.Operand = noOperand //TODO-
	switch n.Case {
	case PrimaryExpressionIdent: // IDENTIFIER
		n.IsSideEffectsFree = true
		return n.checkIdentifier(ctx, implicitFunc)
	case PrimaryExpressionInt: // INTCONST
		n.IsSideEffectsFree = true
		n.Operand = n.intConst(ctx)
	case PrimaryExpressionFloat: // FLOATCONST
		n.IsSideEffectsFree = true
		if ctx.mode&mIntConstExpr != 0 && ctx.mode&mIntConstExprFloat == 0 {
			ctx.errNode(n, "invalid integer constant expression")
			break
		}

		n.Operand = n.floatConst(ctx)
	case PrimaryExpressionEnum: // ENUMCONST
		n.IsSideEffectsFree = true
		if e := n.resolvedIn.enumerator(n.Token.Value, n.Token); e != nil {
			op := e.Operand.(*operand)
			op.typ = ctx.cfg.ABI.Type(Int) //  [0] 6.4.4.3/2
			n.Operand = op
			break
		}

		//TODO report err
	case PrimaryExpressionChar: // CHARCONST
		n.IsSideEffectsFree = true
		s := []rune(n.Token.Value.String())
		var v Value
		switch {
		case s[0] <= 255:
			// If an integer character constant contains a single character or escape
			// sequence, its value is the one that results when an object with type char
			// whose value is that of the single character or escape sequence is converted
			// to type int.
			switch {
			case ctx.cfg.ABI.SignedChar:
				v = Int64Value(int8(s[0]))
			default:
				v = Int64Value(s[0])
			}
		default:
			v = Int64Value(s[0])
		}
		n.Operand = (&operand{abi: &ctx.cfg.ABI, typ: ctx.cfg.ABI.Type(Int), value: v}).normalize(ctx, n)
	case PrimaryExpressionLChar: // LONGCHARCONST
		n.IsSideEffectsFree = true
		s := []rune(n.Token.Value.String())
		n.Operand = (&operand{abi: &ctx.cfg.ABI, typ: wcharT(ctx, n.lexicalScope, n.Token), value: Int64Value(s[0])}).normalize(ctx, n)
	case PrimaryExpressionString: // STRINGLITERAL
		n.IsSideEffectsFree = true
		ctx.not(n, mIntConstExpr)
		typ := ctx.cfg.ABI.Type(Char)
		b := typ.base()
		b.align = byte(typ.Align())
		b.fieldAlign = byte(typ.FieldAlign())
		b.kind = byte(Array)
		sz := uintptr(len(n.Token.Value.String())) + 1 //TODO set sz in cpp
		arr := &arrayType{typeBase: b, decay: ctx.cfg.ABI.Ptr(n, typ), elem: typ, length: sz}
		arr.setLen(sz)
		n.Operand = (&operand{abi: &ctx.cfg.ABI, typ: arr, value: StringValue(n.Token.Value)}).normalize(ctx, n)
	case PrimaryExpressionLString: // LONGSTRINGLITERAL
		n.IsSideEffectsFree = true
		ctx.not(n, mIntConstExpr)
		typ := wcharT(ctx, n.lexicalScope, n.Token)
		b := typ.base()
		b.align = byte(typ.Align())
		b.fieldAlign = byte(typ.FieldAlign())
		b.kind = byte(Array)
		sz := uintptr(len([]rune(n.Token.Value.String()))) + 1 //TODO set sz in cpp
		arr := &arrayType{typeBase: b, decay: ctx.cfg.ABI.Ptr(n, typ), elem: typ, length: sz}
		arr.setLen(sz)
		n.Operand = (&operand{abi: &ctx.cfg.ABI, typ: arr, value: WideStringValue(n.Token.Value)}).normalize(ctx, n)
	case PrimaryExpressionExpr: // '(' Expression ')'
		n.Operand = n.Expression.check(ctx, isAsmArg)
		n.IsSideEffectsFree = n.Expression.IsSideEffectsFree
	case PrimaryExpressionStmt: // '(' CompoundStatement ')'
		//TODO IsSideEffectsFree
		ctx.not(n, mIntConstExpr)
		n.Operand = n.CompoundStatement.check(ctx)
		if n.Operand == noOperand {
			n.Operand = &operand{abi: &ctx.cfg.ABI, typ: ctx.cfg.ABI.Type(Void)}
		}
	default:
		panic(todo(""))
	}
	return n.Operand
}

func wcharT(ctx *context, s Scope, tok Token) Type {
	if t := ctx.wcharT; t != nil {
		return t
	}

	t := ctx.stddef(idWCharT, s, tok)
	if t.Kind() != Invalid {
		ctx.wcharT = t
	}
	return t
}

func (n *PrimaryExpression) checkIdentifier(ctx *context, implicitFunc bool) Operand {
	ctx.not(n, mIntConstExpr)
	var d *Declarator
	nm := n.Token.Value
	if n.resolvedIn == nil {
		if ctx.cfg.RejectLateBinding && !ctx.cfg.ignoreUndefinedIdentifiers {
			ctx.errNode(n, "front-end: undefined: %s", n.Token.Value)
			return noOperand
		}

	out:
		for s := n.lexicalScope; s != nil; s = s.Parent() {
			for _, v := range s[nm] {
				switch x := v.(type) {
				case *Enumerator:
					break out
				case *Declarator:
					if x.IsTypedefName {
						d = nil
						break out
					}

					n.resolvedIn = s
					n.resolvedTo = x
					d = x
					t := d.Type()
					if t != nil && t.Kind() == Function {
						if d.fnDef {
							break out
						}

						continue
					}

					if t != nil && !t.IsIncomplete() {
						break out
					}
				case *EnumSpecifier, *StructOrUnionSpecifier, *StructDeclarator, *LabeledStatement:
					// nop
				default:
					panic(todo(""))
				}
			}
		}
	}
	if d == nil && n.resolvedIn != nil {
		d = n.resolvedIn.declarator(n.Token.Value, n.Token)
	}
	if d == nil && !ctx.cfg.DisableBuiltinResolution {
		d = builtin(ctx, nm)
	}
	if d == nil {
		_, ok := gccKeywords[nm]
		if !ok && implicitFunc {
			d := &Declarator{
				DirectDeclarator: &DirectDeclarator{
					lexicalScope: ctx.ast.Scope,
					Case:         DirectDeclaratorFuncIdent,
					DirectDeclarator: &DirectDeclarator{
						lexicalScope: ctx.ast.Scope,
						Case:         DirectDeclaratorIdent,
						Token:        Token{Value: nm},
					},
				},
				implicit: true,
			}
			ed := &ExternalDeclaration{
				Case: ExternalDeclarationDecl,
				Declaration: &Declaration{
					DeclarationSpecifiers: &DeclarationSpecifiers{
						Case: DeclarationSpecifiersTypeSpec,
						TypeSpecifier: &TypeSpecifier{
							Case: TypeSpecifierInt,
						},
					},
					InitDeclaratorList: &InitDeclaratorList{
						InitDeclarator: &InitDeclarator{
							Case:       InitDeclaratorDecl,
							Declarator: d,
						},
					},
				},
			}
			ed.check(ctx)
			n.Operand = &funcDesignator{Operand: &operand{abi: &ctx.cfg.ABI, typ: d.Type()}, declarator: d}
			return n.Operand
		}

		if !ctx.cfg.ignoreUndefinedIdentifiers {
			ctx.errNode(n, "front-end: undefined: %s", n.Token.Value)
		}
		return noOperand
	}
	if d == nil {
		if !ctx.cfg.ignoreUndefinedIdentifiers {
			ctx.errNode(n, "front-end: undefined: %s", n.Token.Value)
		}
		return noOperand
	}

	switch d.Linkage {
	case Internal:
		if d.IsStatic() {
			break
		}

		fallthrough
	case External:
		s := n.resolvedIn
		if s.Parent() == nil {
			break
		}

		for s.Parent() != nil {
			s = s.Parent()
		}

		if d2 := s.declarator(n.Token.Value, Token{}); d2 != nil {
			d = d2
		}
	}

	if d.Type() == nil {
		ctx.errNode(d, "unresolved type of: %s", n.Token.Value)
		return noOperand
	}

	d.Read += ctx.readDelta
	switch t := d.Type(); t.Kind() {
	case Function:
		n.Operand = &funcDesignator{Operand: &operand{abi: &ctx.cfg.ABI, typ: t}, declarator: d}
	default:
		n.Operand = &lvalue{Operand: &operand{abi: &ctx.cfg.ABI, typ: t}, declarator: d}
	}
	if !ctx.capture {
		return n.Operand
	}

	for s := n.lexicalScope; s != nil; s = s.Parent() {
		if _, ok := s[nm]; ok {
			return n.Operand // d in fn scope
		}

		if _, ok := s[idClosure]; ok { // d in outer scope
			if ctx.closure == nil {
				ctx.closure = map[StringID]struct{}{} //TODO capture the PrimaryExpression, not the declarator name
			}
			ctx.closure[nm] = struct{}{}
			return n.Operand
		}
	}
	panic(todo(""))
}

func builtin(ctx *context, nm StringID) *Declarator {
	id := dict.sid("__builtin_" + nm.String())
	a := ctx.ast.Scope[id]
	if len(a) == 0 {
		return nil
	}

	switch x := a[0].(type) {
	case *Declarator:
		if x.fnDef || x.IsFunctionPrototype() {
			return x
		}
	}
	return nil
}

func (n *PrimaryExpression) floatConst(ctx *context) Operand {
	s0 := n.Token.String()
	s := s0
	var cplx, suff string
loop2:
	for i := len(s) - 1; i > 0; i-- {
		switch s0[i] {
		case 'l', 'L':
			s = s[:i]
			if ctx.cfg.LongDoubleIsDouble {
				break
			}

			suff += "l"
		case 'f', 'F':
			s = s[:i]
			suff += "f"
		case 'i', 'I', 'j', 'J':
			s = s[:i]
			cplx += "i"
		default:
			break loop2
		}
	}

	if len(suff) > 1 || len(cplx) > 1 {
		ctx.errNode(n, "invalid number format")
		return noOperand
	}

	var v float64
	var err error
	prec := uint(64)
	if suff == "l" {
		prec = longDoublePrec
	}
	var bf *big.Float
	switch {
	case suff == "l" || strings.Contains(s, "p") || strings.Contains(s, "P"):
		bf, _, err = big.ParseFloat(strings.ToLower(s), 0, prec, big.ToNearestEven)
		if err == nil {
			v, _ = bf.Float64()
		}
	default:
		v, err = strconv.ParseFloat(s, 64)
	}
	if err != nil {
		switch {
		case !strings.HasPrefix(s, "-") && strings.Contains(err.Error(), "value out of range"):
			// linux_386/usr/include/math.h
			//
			// 	/* Value returned on overflow.  With IEEE 754 floating point, this is
			// 	   +Infinity, otherwise the largest representable positive value.  */
			// 	#if __GNUC_PREREQ (3, 3)
			// 	# define HUGE_VAL (__builtin_huge_val ())
			// 	#else
			// 	/* This may provoke compiler warnings, and may not be rounded to
			// 	   +Infinity in all IEEE 754 rounding modes, but is the best that can
			// 	   be done in ISO C while remaining a constant expression.  10,000 is
			// 	   greater than the maximum (decimal) exponent for all supported
			// 	   floating-point formats and widths.  */
			// 	# define HUGE_VAL 1e10000
			// 	#endif
			v = math.Inf(1)
		default:
			ctx.errNode(n, "%v", err)
			return noOperand
		}
	}

	// [0]6.4.4.2
	switch suff {
	case "":
		switch {
		case cplx != "":
			return (&operand{abi: &ctx.cfg.ABI, typ: ctx.cfg.ABI.Type(ComplexDouble), value: Complex128Value(complex(0, v))}).normalize(ctx, n)
		default:
			return (&operand{abi: &ctx.cfg.ABI, typ: ctx.cfg.ABI.Type(Double), value: Float64Value(v)}).normalize(ctx, n)
		}
	case "f":
		switch {
		case cplx != "":
			return (&operand{abi: &ctx.cfg.ABI, typ: ctx.cfg.ABI.Type(ComplexFloat), value: Complex64Value(complex(0, float32(v)))}).normalize(ctx, n)
		default:
			return (&operand{abi: &ctx.cfg.ABI, typ: ctx.cfg.ABI.Type(Float), value: Float32Value(float32(v))}).normalize(ctx, n)
		}
	case "l":
		switch {
		case cplx != "":
			return (&operand{abi: &ctx.cfg.ABI, typ: ctx.cfg.ABI.Type(ComplexLongDouble), value: Complex256Value{&Float128Value{N: big.NewFloat(0)}, &Float128Value{N: bf}}}).normalize(ctx, n)
		default:
			return (&operand{abi: &ctx.cfg.ABI, typ: ctx.cfg.ABI.Type(LongDouble), value: &Float128Value{N: bf}}).normalize(ctx, n)
		}
	default:
		//dbg("%q %q %q %q %v", s0, s, suff, cplx, err)
		panic("TODO")
	}
}

func (n *PrimaryExpression) intConst(ctx *context) Operand {
	var val uint64
	s0 := n.Token.String()
	s := strings.TrimRight(s0, "uUlL")
	var decadic bool
	switch {
	case strings.HasPrefix(s, "0x") || strings.HasPrefix(s, "0X"):
		var err error
		if val, err = strconv.ParseUint(s[2:], 16, 64); err != nil {
			ctx.errNode(n, "%v", err)
			return nil
		}
	case strings.HasPrefix(s, "0b") || strings.HasPrefix(s, "0B"):
		var err error
		if val, err = strconv.ParseUint(s[2:], 2, 64); err != nil {
			ctx.errNode(n, "%v", err)
			return nil
		}
	case strings.HasPrefix(s, "0"):
		var err error
		if val, err = strconv.ParseUint(s, 8, 64); err != nil {
			ctx.errNode(n, "%v", err)
			return nil
		}
	default:
		decadic = true
		var err error
		if val, err = strconv.ParseUint(s, 10, 64); err != nil {
			ctx.errNode(n, "%v", err)
			return nil
		}
	}

	suffix := s0[len(s):]
	switch suffix = strings.ToLower(suffix); suffix {
	case "":
		if decadic {
			return intConst(ctx, n, s0, val, Int, Long, LongLong)
		}

		return intConst(ctx, n, s0, val, Int, UInt, Long, ULong, LongLong, ULongLong)
	case "u":
		return intConst(ctx, n, s0, val, UInt, ULong, ULongLong)
	case "l":
		if decadic {
			return intConst(ctx, n, s0, val, Long, LongLong)
		}

		return intConst(ctx, n, s0, val, Long, ULong, LongLong, ULongLong)
	case "lu", "ul":
		return intConst(ctx, n, s0, val, ULong, ULongLong)
	case "ll":
		if decadic {
			return intConst(ctx, n, s0, val, LongLong)
		}

		return intConst(ctx, n, s0, val, LongLong, ULongLong)
	case "llu", "ull":
		return intConst(ctx, n, s0, val, ULongLong)
	default:
		ctx.errNode(n, "invalid suffix: %v", s0)
		return nil
	}
}

func intConst(ctx *context, n Node, s string, val uint64, list ...Kind) Operand {
	abi := ctx.cfg.ABI
	b := bits.Len64(val)
	for _, k := range list {
		sign := 0
		if abi.isSignedInteger(k) {
			sign = 1
		}
		if abi.size(k)*8 >= b+sign {
			switch {
			case sign == 0:
				return (&operand{abi: &ctx.cfg.ABI, typ: abi.Type(k), value: Uint64Value(val)}).normalize(ctx, n)
			default:
				return (&operand{abi: &ctx.cfg.ABI, typ: abi.Type(k), value: Int64Value(val)}).normalize(ctx, n)
			}
		}
	}

	ctx.errNode(n, "invalid integer constant %v", s)
	return nil
}

func (n *ConditionalExpression) check(ctx *context, isAsmArg bool) Operand {
	if n == nil {
		return noOperand
	}

	n.Operand = noOperand //TODO-
	switch n.Case {
	case ConditionalExpressionLOr: // LogicalOrExpression
		n.Operand = n.LogicalOrExpression.check(ctx, isAsmArg)
		n.IsSideEffectsFree = n.LogicalOrExpression.IsSideEffectsFree
	case ConditionalExpressionCond: // LogicalOrExpression '?' Expression ':' ConditionalExpression
		op := n.LogicalOrExpression.check(ctx, isAsmArg)
		// The first operand shall have scalar type.
		if !op.Type().Decay().IsScalarType() {
			//TODO report error
			break
		}

		a := n.Expression.check(ctx, isAsmArg)
		b := n.ConditionalExpression.check(ctx, isAsmArg)
		at := a.Type().Decay()
		bt := b.Type().Decay()

		n.IsSideEffectsFree = n.LogicalOrExpression.IsSideEffectsFree && (n.Expression == nil || n.Expression.IsSideEffectsFree) && n.ConditionalExpression.IsSideEffectsFree
		var val Value
		if op.Value() != nil {
			switch {
			case op.IsZero():
				n.IsSideEffectsFree = n.LogicalOrExpression.IsSideEffectsFree && n.ConditionalExpression.IsSideEffectsFree
			default:
				n.IsSideEffectsFree = n.LogicalOrExpression.IsSideEffectsFree && n.Expression.IsSideEffectsFree
			}
			if a.Value() != nil && b.Value() != nil { //TODO not needed both non nil
				switch {
				case op.IsZero():
					val = b.Value()
				default:
					val = a.Value()
				}
			}
		}

		if a.Type().Kind() == Invalid && b.Type().Kind() == Invalid {
			return noOperand
		}

		// One of the following shall hold for the second and third
		// operands:
		//TODO — both operands have the same structure or union type;
		//TODO — one operand is a pointer to an object or incomplete type and the other is a pointer to a
		//TODO qualified or unqualified version of void.
		switch {
		// — both operands have arithmetic type;
		case a.Type().IsArithmeticType() && b.Type().IsArithmeticType():
			// If both the second and third operands have
			// arithmetic type, the result type that would be
			// determined by the usual arithmetic conversions, were
			// they applied to those two operands,
			// is the type of the result.
			op, _ := usualArithmeticConversions(ctx, n, a, b, true)
			n.Operand = (&operand{abi: &ctx.cfg.ABI, typ: op.Type(), value: val}).normalize(ctx, n)
		// — both operands have void type;
		case a.Type().Kind() == Void && b.Type().Kind() == Void:
			n.Operand = (&operand{abi: &ctx.cfg.ABI, typ: a.Type(), value: val}).normalize(ctx, n)
		// — one operand is a pointer and the other is a null pointer constant;
		case (a.Type().Kind() == Ptr || a.Type().Kind() == Function) && b.IsZero():
			n.Operand = (&operand{abi: &ctx.cfg.ABI, typ: a.Type(), value: val}).normalize(ctx, n)
		case (b.Type().Kind() == Ptr || b.Type().Kind() == Function) && a.IsZero():
			n.Operand = (&operand{abi: &ctx.cfg.ABI, typ: b.Type(), value: val}).normalize(ctx, n)
		// — both operands are pointers to qualified or unqualified versions of compatible types;
		case at.Kind() == Ptr && bt.Kind() == Ptr:
			//TODO check compatible
			//TODO if !at.isCompatibleIgnoreQualifiers(bt) {
			//TODO 	trc("%v: XXXX %v ? %v", n.Token2.Position(), at, bt)
			//TODO 	ctx.assignmentCompatibilityErrorCond(&n.Token2, at, bt)
			//TODO }
			n.Operand = (&operand{abi: &ctx.cfg.ABI, typ: n.Expression.Operand.Type(), value: val}).normalize(ctx, n)
		case a.Type().Kind() == Ptr && a.Type().Elem().Kind() == Function && b.Type().Kind() == Function:
			//TODO check compatible
			n.Operand = (&operand{abi: &ctx.cfg.ABI, typ: a.Type(), value: val}).normalize(ctx, n)
		case b.Type().Kind() == Ptr && b.Type().Elem().Kind() == Function && a.Type().Kind() == Function:
			//TODO check compatible
			n.Operand = (&operand{abi: &ctx.cfg.ABI, typ: b.Type(), value: val}).normalize(ctx, n)
		case a.Type().Kind() != Invalid:
			n.Operand = (&operand{abi: &ctx.cfg.ABI, typ: a.Type(), value: val}).normalize(ctx, n)
		case b.Type().Kind() != Invalid:
			n.Operand = (&operand{abi: &ctx.cfg.ABI, typ: b.Type(), value: val}).normalize(ctx, n)
		default:
			panic(todo(""))
		}
	default:
		panic(todo(""))
	}
	return n.Operand
}

func (n *LogicalOrExpression) check(ctx *context, isAsmArg bool) Operand {
	if n == nil {
		return noOperand
	}

	n.Operand = noOperand //TODO-
	switch n.Case {
	case LogicalOrExpressionLAnd: // LogicalAndExpression
		n.Operand = n.LogicalAndExpression.check(ctx, isAsmArg)
		n.IsSideEffectsFree = n.LogicalAndExpression.IsSideEffectsFree
	case LogicalOrExpressionLOr: // LogicalOrExpression "||" LogicalAndExpression
		lop := n.LogicalOrExpression.check(ctx, isAsmArg)
		rop := n.LogicalAndExpression.check(ctx, isAsmArg)
		n.IsSideEffectsFree = n.LogicalOrExpression.IsSideEffectsFree && n.LogicalAndExpression.IsSideEffectsFree ||
			lop.Value() != nil && lop.IsNonZero() && n.LogicalOrExpression.IsSideEffectsFree
		var v Value
		if lop.Value() != nil && rop.Value() != nil { //TODO lop.IsNonZero shortcut
			switch {
			case n.LogicalOrExpression.Operand.IsNonZero() || n.LogicalAndExpression.Operand.IsNonZero():
				v = Int64Value(1)
			default:
				v = Int64Value(0)
			}
		}
		n.Operand = (&operand{abi: &ctx.cfg.ABI, typ: ctx.cfg.ABI.Type(Int), value: v}).normalize(ctx, n)
	default:
		panic(todo(""))
	}
	return n.Operand
}

func (n *LogicalAndExpression) check(ctx *context, isAsmArg bool) Operand {
	if n == nil {
		return noOperand
	}

	n.Operand = noOperand //TODO-
	switch n.Case {
	case LogicalAndExpressionOr: // InclusiveOrExpression
		n.Operand = n.InclusiveOrExpression.check(ctx, isAsmArg)
		n.IsSideEffectsFree = n.InclusiveOrExpression.IsSideEffectsFree
	case LogicalAndExpressionLAnd: // LogicalAndExpression "&&" InclusiveOrExpression
		lop := n.LogicalAndExpression.check(ctx, isAsmArg)
		rop := n.InclusiveOrExpression.check(ctx, isAsmArg)
		n.IsSideEffectsFree = n.LogicalAndExpression.IsSideEffectsFree && n.InclusiveOrExpression.IsSideEffectsFree ||
			lop.Value() != nil && lop.IsZero() && n.LogicalAndExpression.IsSideEffectsFree
		var v Value
		if lop.Value() != nil && rop.Value() != nil { //TODO lop.IsZero shortcut
			switch {
			case n.LogicalAndExpression.Operand.IsNonZero() && n.InclusiveOrExpression.Operand.IsNonZero():
				v = Int64Value(1)
			default:
				v = Int64Value(0)
			}
		}
		n.Operand = (&operand{abi: &ctx.cfg.ABI, typ: ctx.cfg.ABI.Type(Int), value: v}).normalize(ctx, n)
	default:
		panic(todo(""))
	}
	return n.Operand
}

func (n *InclusiveOrExpression) check(ctx *context, isAsmArg bool) Operand {
	if n == nil {
		return noOperand
	}

	n.Operand = noOperand //TODO-
	switch n.Case {
	case InclusiveOrExpressionXor: // ExclusiveOrExpression
		n.Operand = n.ExclusiveOrExpression.check(ctx, isAsmArg)
		n.IsSideEffectsFree = n.ExclusiveOrExpression.IsSideEffectsFree
	case InclusiveOrExpressionOr: // InclusiveOrExpression '|' ExclusiveOrExpression
		a := n.InclusiveOrExpression.check(ctx, isAsmArg)
		b := n.ExclusiveOrExpression.check(ctx, isAsmArg)
		n.IsSideEffectsFree = n.InclusiveOrExpression.IsSideEffectsFree && n.ExclusiveOrExpression.IsSideEffectsFree
		n.promote = noType
		if a.Type().Kind() == Vector || b.Type().Kind() == Vector {
			n.Operand = checkBinaryVectorIntegerArtithmetic(ctx, n, a, b)
			break
		}

		if !a.Type().IsIntegerType() || !b.Type().IsIntegerType() {
			ctx.errNode(n, "operands must be integers")
			break
		}

		a, b = usualArithmeticConversions(ctx, &n.Token, a, b, true)
		n.promote = a.Type()
		if a.Value() == nil || b.Value() == nil {
			n.Operand = &operand{abi: &ctx.cfg.ABI, typ: a.Type()}
			break
		}

		n.Operand = (&operand{abi: &ctx.cfg.ABI, typ: a.Type(), value: a.Value().or(b.Value())}).normalize(ctx, n)
	default:
		panic(todo(""))
	}
	return n.Operand
}

func checkBinaryVectorIntegerArtithmetic(ctx *context, n Node, a, b Operand) Operand {
	var rt Type
	if a.Type().Kind() == Vector {
		rt = a.Type()
		a = &operand{abi: &ctx.cfg.ABI, typ: a.Type().Elem()}
	}
	if b.Type().Kind() == Vector {
		if rt == nil {
			rt = b.Type()
		}
		b = &operand{abi: &ctx.cfg.ABI, typ: b.Type().Elem()}
	}
	a, b = usualArithmeticConversions(ctx, n, a, b, true)
	if !a.Type().IsIntegerType() || !b.Type().IsIntegerType() {
		ctx.errNode(n, "operands must be integers")
	}
	return &operand{abi: &ctx.cfg.ABI, typ: rt}
}

func (n *ExclusiveOrExpression) check(ctx *context, isAsmArg bool) Operand {
	if n == nil {
		return noOperand
	}

	n.Operand = noOperand //TODO-
	switch n.Case {
	case ExclusiveOrExpressionAnd: // AndExpression
		n.Operand = n.AndExpression.check(ctx, isAsmArg)
		n.IsSideEffectsFree = n.AndExpression.IsSideEffectsFree
	case ExclusiveOrExpressionXor: // ExclusiveOrExpression '^' AndExpression
		a := n.ExclusiveOrExpression.check(ctx, isAsmArg)
		b := n.AndExpression.check(ctx, isAsmArg)
		n.IsSideEffectsFree = n.ExclusiveOrExpression.IsSideEffectsFree && n.AndExpression.IsSideEffectsFree
		if a.Type().Kind() == Vector || b.Type().Kind() == Vector {
			n.Operand = checkBinaryVectorIntegerArtithmetic(ctx, n, a, b)
			break
		}

		if !a.Type().IsIntegerType() || !b.Type().IsIntegerType() {
			ctx.errNode(n, "operands must be integers")
			break
		}

		a, b = usualArithmeticConversions(ctx, &n.Token, a, b, true)
		n.promote = a.Type()
		if a.Value() == nil || b.Value() == nil {
			n.Operand = &operand{abi: &ctx.cfg.ABI, typ: a.Type()}
			break
		}

		n.Operand = (&operand{abi: &ctx.cfg.ABI, typ: a.Type(), value: a.Value().xor(b.Value())}).normalize(ctx, n)
	default:
		panic(todo(""))
	}
	return n.Operand
}

func (n *AndExpression) check(ctx *context, isAsmArg bool) Operand {
	if n == nil {
		return noOperand
	}

	n.Operand = noOperand //TODO-
	switch n.Case {
	case AndExpressionEq: // EqualityExpression
		n.Operand = n.EqualityExpression.check(ctx, isAsmArg)
		n.IsSideEffectsFree = n.EqualityExpression.IsSideEffectsFree
	case AndExpressionAnd: // AndExpression '&' EqualityExpression
		a := n.AndExpression.check(ctx, isAsmArg)
		b := n.EqualityExpression.check(ctx, isAsmArg)
		n.IsSideEffectsFree = n.AndExpression.IsSideEffectsFree && n.EqualityExpression.IsSideEffectsFree
		if a.Type().Kind() == Vector || b.Type().Kind() == Vector {
			n.Operand = checkBinaryVectorIntegerArtithmetic(ctx, n, a, b)
			break
		}

		if !a.Type().IsIntegerType() || !b.Type().IsIntegerType() {
			ctx.errNode(n, "operands must be integers")
			break
		}

		a, b = usualArithmeticConversions(ctx, &n.Token, a, b, true)
		n.promote = a.Type()
		if a.Value() == nil || b.Value() == nil {
			n.Operand = &operand{abi: &ctx.cfg.ABI, typ: a.Type()}
			break
		}

		n.Operand = (&operand{abi: &ctx.cfg.ABI, typ: a.Type(), value: a.Value().and(b.Value())}).normalize(ctx, n)
	default:
		panic(todo(""))
	}
	return n.Operand
}

func (n *EqualityExpression) check(ctx *context, isAsmArg bool) Operand {
	if n == nil {
		return noOperand
	}

	switch n.Case {
	case EqualityExpressionRel: // RelationalExpression
		n.Operand = n.RelationalExpression.check(ctx, isAsmArg)
		n.IsSideEffectsFree = n.RelationalExpression.IsSideEffectsFree
	case
		EqualityExpressionEq,  // EqualityExpression "==" RelationalExpression
		EqualityExpressionNeq: // EqualityExpression "!=" RelationalExpression

		op := &operand{abi: &ctx.cfg.ABI, typ: ctx.cfg.ABI.Type(Int)}
		n.Operand = op
		lo := n.EqualityExpression.check(ctx, isAsmArg)
		ro := n.RelationalExpression.check(ctx, isAsmArg)
		n.IsSideEffectsFree = n.EqualityExpression.IsSideEffectsFree && n.RelationalExpression.IsSideEffectsFree
		lt := lo.Type().Decay()
		rt := ro.Type().Decay()
		n.promote = noType
		ok := false
		switch {
		case lo.Type().Kind() == Vector && ro.Type().Kind() == Vector:
			n.Operand = checkVectorComparison(ctx, n, lo.Type(), ro.Type())
			return n.Operand
		case lt.IsArithmeticType() && rt.IsArithmeticType():
			op, _ := usualArithmeticConversions(ctx, n, lo, ro, true)
			n.promote = op.Type()
			ok = true
		case lt.Kind() == Ptr && (rt.Kind() == Ptr || rt.IsIntegerType()):
			n.promote = lt
			//TODO
		case (lt.Kind() == Ptr || lt.IsIntegerType()) && rt.Kind() == Ptr:
			n.promote = rt
			//TODO
		case lt.Kind() == Function:
			n.promote = ctx.cfg.ABI.Ptr(n, lt)
		case rt.Kind() == Function:
			n.promote = ctx.cfg.ABI.Ptr(n, rt)
		default:
			//TODO report error
		}
		if n.promote.Kind() == Invalid || !ok {
			break
		}

		lo = lo.convertTo(ctx, n, n.promote)
		ro = ro.convertTo(ctx, n, n.promote)
		if a, b := lo.Value(), ro.Value(); a != nil && b != nil {
			switch n.Case {
			case EqualityExpressionEq: // EqualityExpression "==" RelationalExpression
				op.value = a.eq(b)
			case EqualityExpressionNeq: // EqualityExpression "!=" RelationalExpression
				op.value = a.neq(b)
			}
		}
	default:
		panic(todo(""))
	}
	return n.Operand
}

func checkVectorComparison(ctx *context, n Node, a, b Type) (r Operand) {
	a = a.underlyingType()
	b = b.underlyingType()
	rt := *a.(*vectorType)
	rt.elem = ctx.cfg.ABI.Type(Int)
	r = &operand{abi: &ctx.cfg.ABI, typ: &rt}
	x := a.Elem()
	y := b.Elem()
	if x.Kind() != y.Kind() {
		ctx.errNode(n, "cannot compare vectors of different element types: %s and %s", x, y)
	}
	return r
}

func (n *RelationalExpression) check(ctx *context, isAsmArg bool) Operand {
	if n == nil {
		return noOperand
	}

	n.Operand = noOperand //TODO-
	switch n.Case {
	case RelationalExpressionShift: // ShiftExpression
		n.Operand = n.ShiftExpression.check(ctx, isAsmArg)
		n.IsSideEffectsFree = n.ShiftExpression.IsSideEffectsFree
	case
		RelationalExpressionLt,  // RelationalExpression '<' ShiftExpression
		RelationalExpressionGt,  // RelationalExpression '>' ShiftExpression
		RelationalExpressionLeq, // RelationalExpression "<=" ShiftExpression
		RelationalExpressionGeq: // RelationalExpression ">=" ShiftExpression

		n.promote = noType
		op := &operand{abi: &ctx.cfg.ABI, typ: ctx.cfg.ABI.Type(Int)}
		n.Operand = op
		lo := n.RelationalExpression.check(ctx, isAsmArg)
		ro := n.ShiftExpression.check(ctx, isAsmArg)
		n.IsSideEffectsFree = n.RelationalExpression.IsSideEffectsFree && n.ShiftExpression.IsSideEffectsFree
		if lo.Type().Kind() == Vector && ro.Type().Kind() == Vector {
			n.Operand = checkVectorComparison(ctx, n, lo.Type(), ro.Type())
			break
		}

		if lo.Type().IsComplexType() || ro.Type().IsComplexType() {
			ctx.errNode(&n.Token, "complex numbers are not ordered")
			break
		}

		lt := lo.Type().Decay()
		rt := ro.Type().Decay()
		n.promote = noType
		ok := true
		switch {
		case lt.IsRealType() && rt.IsRealType():
			op, _ := usualArithmeticConversions(ctx, n, lo, ro, true)
			n.promote = op.Type()
		case lt.Kind() == Ptr && (rt.Kind() == Ptr || rt.IsIntegerType()):
			n.promote = lt
			//TODO
		case (lt.Kind() == Ptr || lt.IsIntegerType()) && rt.Kind() == Ptr:
			n.promote = rt
			//TODO
		default:
			//TODO report error
			ok = false
		}
		if n.promote.Kind() == Invalid || !ok {
			break
		}

		lo = lo.convertTo(ctx, n, n.promote)
		ro = ro.convertTo(ctx, n, n.promote)
		if a, b := lo.Value(), ro.Value(); a != nil && b != nil {
			switch n.Case {
			case RelationalExpressionLt: // RelationalExpression '<' ShiftExpression
				op.value = a.lt(b)
			case RelationalExpressionGt: // RelationalExpression '>' ShiftExpression
				op.value = a.gt(b)
			case RelationalExpressionLeq: // RelationalExpression "<=" ShiftExpression
				op.value = a.le(b)
			case RelationalExpressionGeq: // RelationalExpression ">=" ShiftExpression
				op.value = a.ge(b)
			}
		}
	default:
		panic(todo(""))
	}
	return n.Operand
}

func (n *ShiftExpression) check(ctx *context, isAsmArg bool) Operand {
	if n == nil {
		return noOperand
	}

	n.Operand = noOperand //TODO-
	switch n.Case {
	case ShiftExpressionAdd: // AdditiveExpression
		n.Operand = n.AdditiveExpression.check(ctx, isAsmArg)
		n.IsSideEffectsFree = n.AdditiveExpression.IsSideEffectsFree
	case ShiftExpressionLsh: // ShiftExpression "<<" AdditiveExpression
		a := n.ShiftExpression.check(ctx, isAsmArg)
		b := n.AdditiveExpression.check(ctx, isAsmArg)
		n.IsSideEffectsFree = n.ShiftExpression.IsSideEffectsFree && n.AdditiveExpression.IsSideEffectsFree
		if a.Type().Kind() == Vector || b.Type().Kind() == Vector {
			n.Operand = checkBinaryVectorIntegerArtithmetic(ctx, n, a, b)
			break
		}

		if !a.Type().IsIntegerType() || !b.Type().IsIntegerType() {
			//TODO report err
			break
		}

		a = a.integerPromotion(ctx, n)
		b = b.integerPromotion(ctx, n)
		n.promote = b.Type()
		if a.Value() == nil || b.Value() == nil {
			n.Operand = &operand{abi: &ctx.cfg.ABI, typ: a.Type()}
			break
		}

		n.Operand = (&operand{abi: &ctx.cfg.ABI, typ: a.Type(), value: a.Value().lsh(b.Value())}).normalize(ctx, n)
	case ShiftExpressionRsh: // ShiftExpression ">>" AdditiveExpression
		a := n.ShiftExpression.check(ctx, isAsmArg)
		b := n.AdditiveExpression.check(ctx, isAsmArg)
		n.IsSideEffectsFree = n.ShiftExpression.IsSideEffectsFree && n.AdditiveExpression.IsSideEffectsFree
		if a.Type().Kind() == Vector || b.Type().Kind() == Vector {
			n.Operand = checkBinaryVectorIntegerArtithmetic(ctx, n, a, b)
			break
		}

		if !a.Type().IsIntegerType() || !b.Type().IsIntegerType() {
			//TODO report err
			break
		}

		a = a.integerPromotion(ctx, n)
		b = b.integerPromotion(ctx, n)
		n.promote = b.Type()
		if a.Value() == nil || b.Value() == nil {
			n.Operand = &operand{abi: &ctx.cfg.ABI, typ: a.Type()}
			break
		}

		n.Operand = (&operand{abi: &ctx.cfg.ABI, typ: a.Type(), value: a.Value().rsh(b.Value())}).normalize(ctx, n)
	default:
		panic(todo(""))
	}
	return n.Operand
}

func (n *AdditiveExpression) check(ctx *context, isAsmArg bool) Operand {
	if n == nil {
		return noOperand
	}

	n.Operand = noOperand //TODO-
	switch n.Case {
	case AdditiveExpressionMul: // MultiplicativeExpression
		n.Operand = n.MultiplicativeExpression.check(ctx, isAsmArg)
		n.IsSideEffectsFree = n.MultiplicativeExpression.IsSideEffectsFree
	case AdditiveExpressionAdd: // AdditiveExpression '+' MultiplicativeExpression
		n.promote = noType
		a := n.AdditiveExpression.check(ctx, isAsmArg)
		b := n.MultiplicativeExpression.check(ctx, isAsmArg)
		n.IsSideEffectsFree = n.AdditiveExpression.IsSideEffectsFree && n.MultiplicativeExpression.IsSideEffectsFree
		if a.Type().Kind() == Vector || b.Type().Kind() == Vector {
			n.Operand = checkBinaryVectorArtithmetic(ctx, n, a, b)
			break
		}

		if t := a.Type().Decay(); t.Kind() == Ptr && b.Type().IsScalarType() {
			var x uintptr
			hasx := false
			switch v := b.Value().(type) {
			case Int64Value:
				x = uintptr(v)
				hasx = true
			case Uint64Value:
				x = uintptr(v)
				hasx = true
			}
			off := x * a.Type().Elem().Size()
			switch y := a.Value().(type) {
			case StringValue:
				n.Operand = &operand{abi: &ctx.cfg.ABI, typ: ctx.cfg.ABI.Ptr(n, a.Type().Elem()), value: y, offset: a.Offset() + off}
			default:
				switch {
				case a.Value() == nil && a.Declarator() != nil && hasx:
					n.Operand = &lvalue{Operand: &operand{abi: &ctx.cfg.ABI, typ: ctx.cfg.ABI.Ptr(n, a.Type().Elem()), offset: a.Offset() + off}, declarator: a.Declarator()}
				default:
					n.Operand = &operand{abi: &ctx.cfg.ABI, typ: t}
				}
			}
			break
		}

		if t := b.Type().Decay(); t.Kind() == Ptr && a.Type().IsScalarType() {
			n.Operand = &operand{abi: &ctx.cfg.ABI, typ: t}
			break
		}

		if !a.Type().IsArithmeticType() || !b.Type().IsArithmeticType() {
			//TODO report error
			break
		}

		a, b = usualArithmeticConversions(ctx, &n.Token, a, b, true)
		n.promote = a.Type()
		if a.Value() == nil || b.Value() == nil {
			n.Operand = &operand{abi: &ctx.cfg.ABI, typ: a.Type()}
			break
		}

		n.Operand = (&operand{abi: &ctx.cfg.ABI, typ: a.Type(), value: a.Value().add(b.Value())}).normalize(ctx, n)
	case AdditiveExpressionSub: // AdditiveExpression '-' MultiplicativeExpression
		n.promote = noType
		a := n.AdditiveExpression.check(ctx, isAsmArg)
		b := n.MultiplicativeExpression.check(ctx, isAsmArg)
		n.IsSideEffectsFree = n.AdditiveExpression.IsSideEffectsFree && n.MultiplicativeExpression.IsSideEffectsFree
		if a.Type().Kind() == Vector || b.Type().Kind() == Vector {
			n.Operand = checkBinaryVectorArtithmetic(ctx, n, a, b)
			break
		}

		if a.Type().Decay().Kind() == Ptr && b.Type().Decay().Kind() == Ptr {
			var val Value
			if a.Value() != nil && b.Value() != nil {
				ae := a.Type().Decay().Elem()
				be := b.Type().Decay().Elem()
				switch {
				case ae.Size() == be.Size():
					var d int64
					switch x := a.Value().(type) {
					case Int64Value:
						d = int64(x)
					case Uint64Value:
						d = int64(x)
					}
					switch x := b.Value().(type) {
					case Int64Value:
						val = Int64Value(d - int64(x))
					case Uint64Value:
						val = Int64Value(d - int64(x))
					}
				default:
					ctx.errNode(n, "difference of pointers of differently sized elements")
				}
			}
			pt := ptrdiffT(ctx, n.lexicalScope, n.Token)
			n.promote = pt
			n.Operand = &operand{abi: &ctx.cfg.ABI, typ: pt, value: val}
			if val != nil {
				n.Operand = n.Operand.convertTo(ctx, n, a.Type())
			}
			break
		}

		if t := a.Type().Decay(); t.Kind() == Ptr && b.Type().IsScalarType() {
			n.Operand = &operand{abi: &ctx.cfg.ABI, typ: t}
			break
		}

		if !a.Type().IsArithmeticType() || !b.Type().IsArithmeticType() {
			//TODO report error
			break
		}

		a, b = usualArithmeticConversions(ctx, &n.Token, a, b, true)
		n.promote = a.Type()
		if a.Value() == nil || b.Value() == nil {
			n.Operand = &operand{abi: &ctx.cfg.ABI, typ: a.Type()}
			break
		}

		n.Operand = (&operand{abi: &ctx.cfg.ABI, typ: a.Type(), value: a.Value().sub(b.Value())}).normalize(ctx, n)
	default:
		panic(todo(""))
	}
	return n.Operand
}

func checkBinaryVectorArtithmetic(ctx *context, n Node, a, b Operand) Operand {
	var rt Type
	if a.Type().Kind() == Vector {
		rt = a.Type()
		a = &operand{abi: &ctx.cfg.ABI, typ: a.Type().Elem()}
	}
	if b.Type().Kind() == Vector {
		if rt == nil {
			rt = b.Type()
		}
		b = &operand{abi: &ctx.cfg.ABI, typ: b.Type().Elem()}
	}
	usualArithmeticConversions(ctx, n, a, b, true)
	return &operand{abi: &ctx.cfg.ABI, typ: rt}
}

func ptrdiffT(ctx *context, s Scope, tok Token) Type {
	if t := ctx.ptrdiffT; t != nil {
		return t
	}

	t := ctx.stddef(idPtrdiffT, s, tok)
	if t.Kind() != Invalid {
		ctx.ptrdiffT = t
	}
	return t
}

func (n *MultiplicativeExpression) check(ctx *context, isAsmArg bool) Operand {
	if n == nil {
		return noOperand
	}

	n.Operand = noOperand //TODO-
	switch n.Case {
	case MultiplicativeExpressionCast: // CastExpression
		n.Operand = n.CastExpression.check(ctx, isAsmArg)
		n.IsSideEffectsFree = n.CastExpression.IsSideEffectsFree
	case MultiplicativeExpressionMul: // MultiplicativeExpression '*' CastExpression
		a := n.MultiplicativeExpression.check(ctx, isAsmArg)
		b := n.CastExpression.check(ctx, isAsmArg)
		n.IsSideEffectsFree = n.MultiplicativeExpression.IsSideEffectsFree && n.CastExpression.IsSideEffectsFree
		if a.Type().Kind() == Vector || b.Type().Kind() == Vector {
			n.Operand = checkBinaryVectorArtithmetic(ctx, n, a, b)
			break
		}

		if !a.Type().IsArithmeticType() || !b.Type().IsArithmeticType() {
			break
		}

		a, b = usualArithmeticConversions(ctx, &n.Token, a, b, true)
		n.promote = a.Type()
		if a.Value() == nil || b.Value() == nil {
			n.Operand = &operand{abi: &ctx.cfg.ABI, typ: a.Type()}
			break
		}

		n.Operand = (&operand{abi: &ctx.cfg.ABI, typ: a.Type(), value: a.Value().mul(b.Value())}).normalize(ctx, n)
	case MultiplicativeExpressionDiv: // MultiplicativeExpression '/' CastExpression
		a := n.MultiplicativeExpression.check(ctx, isAsmArg)
		b := n.CastExpression.check(ctx, isAsmArg)
		n.IsSideEffectsFree = n.MultiplicativeExpression.IsSideEffectsFree && n.CastExpression.IsSideEffectsFree
		if a.Type().Kind() == Vector || b.Type().Kind() == Vector {
			n.Operand = checkBinaryVectorArtithmetic(ctx, n, a, b)
			break
		}

		if !a.Type().IsArithmeticType() || !b.Type().IsArithmeticType() {
			break
		}

		a, b = usualArithmeticConversions(ctx, &n.Token, a, b, true)
		n.promote = a.Type()
		if a.Value() == nil || b.Value() == nil {
			n.Operand = &operand{abi: &ctx.cfg.ABI, typ: a.Type()}
			break
		}

		n.Operand = (&operand{abi: &ctx.cfg.ABI, typ: a.Type(), value: a.Value().div(b.Value())}).normalize(ctx, n)
	case MultiplicativeExpressionMod: // MultiplicativeExpression '%' CastExpression
		a := n.MultiplicativeExpression.check(ctx, isAsmArg)
		b := n.CastExpression.check(ctx, isAsmArg)
		n.IsSideEffectsFree = n.MultiplicativeExpression.IsSideEffectsFree && n.CastExpression.IsSideEffectsFree
		if a.Type().Kind() == Vector || b.Type().Kind() == Vector {
			n.Operand = checkBinaryVectorArtithmetic(ctx, n, a, b)
			break
		}

		if !a.Type().IsArithmeticType() || !b.Type().IsArithmeticType() {
			break
		}

		if !a.Type().IsIntegerType() || !b.Type().IsIntegerType() {
			ctx.errNode(&n.Token, "the operands of the %% operator shall have integer type.") // [0] 6.5.5, 2
			break
		}

		a, b = usualArithmeticConversions(ctx, &n.Token, a, b, true)
		n.promote = a.Type()
		if a.Value() == nil || b.Value() == nil {
			n.Operand = &operand{abi: &ctx.cfg.ABI, typ: a.Type()}
			break
		}

		n.Operand = (&operand{abi: &ctx.cfg.ABI, typ: a.Type(), value: a.Value().mod(b.Value())}).normalize(ctx, n)
	default:
		panic(todo(""))
	}
	return n.Operand
}

func (n *Declarator) check(ctx *context, td typeDescriptor, typ Type, tld bool) Type {
	if n == nil {
		n.typ = ctx.cfg.ABI.Type(Int)
		return noType
	}

	typ = n.Pointer.check(ctx, typ)
	n.td = td
	if attr := n.AttributeSpecifierList.check(ctx, typ.baseP()); len(attr) != 0 {
		typ = &attributedType{typ, attr}
	}
	n.typ = n.DirectDeclarator.check(ctx, typ)

	hasStorageSpecifiers := td.typedef() || td.extern() || td.static() ||
		td.auto() || td.register() || td.threadLocal()

	typ = n.typ
	if typ == nil {
		n.typ = ctx.cfg.ABI.Type(Int)
		ctx.errNode(n, "declarator has unsupported, invalid or incomplete type")
		return noType
	}

	if typ.Kind() == Array && typ.IsVLA() {
		if f := ctx.checkFn; f != nil {
			f.VLAs = append(f.VLAs, n)
		}
	}

	// 6.2.2 Linkages of identifiers
	n.Linkage = None
	switch {
	case tld && td.static():
		// 3: If the declaration of a file scope identifier for an object or a function
		// contains the storage-class specifier static, the identifier has internal
		// linkage.
		n.Linkage = Internal
	case td.extern():
		//TODO
		//
		// 4: For an identifier declared with the storage-class specifier extern in a
		// scope in which a prior declaration of that identifier is visible, 23) if the
		// prior declaration specifies internal or external linkage, the linkage of the
		// identifier at the later declaration is the same as the linkage specified at
		// the prior declaration. If no prior declaration is visible, or if the prior
		// declaration specifies no linkage, then the identifier has external linkage.
		n.Linkage = External
	case
		!n.IsParameter && typ.Kind() == Function && !hasStorageSpecifiers,
		tld && !hasStorageSpecifiers:

		// 5: If the declaration of an identifier for a function has no storage-class
		// specifier, its linkage is determined exactly as if it were declared with the
		// storage-class specifier extern.
		n.Linkage = External
	}

	// 6.2.4 Storage durations of objects
	switch {
	case n.Linkage == External, n.Linkage == Internal, td.static():
		// 2: An object whose identifier is declared with external or internal linkage,
		// or with the storage-class specifier static has static storage duration. Its
		// lifetime is the entire execution of the program and its stored value is
		// initialized only once, prior to
		// program startup.
		n.StorageClass = Static
	case n.Linkage == None && !td.static():
		// 4: An object whose identifier is declared with no linkage and without the
		// storage-class specifier static has automatic storage duration.
		n.StorageClass = Automatic
	}
	switch {
	case n.typ.Kind() == Invalid:
		ctx.errNode(n, "declarator has incomplete type")
	}
	if n.IsTypedefName {
		if k, ok := complexTypedefs[n.Name()]; ok {
			abi := ctx.cfg.ABI
			t := n.typ.Alias()
			t.setKind(k)
			abi.types[k] = t
			abi.Types[k] = ABIType{Size: t.Size(), Align: t.Align(), FieldAlign: t.FieldAlign()}
		}
	}
	switch expr, ok := n.AttributeSpecifierList.Has(idVectorSize, idVectorSize2); {
	case ok:
		n.vectorize(ctx, expr)
	default:
		switch x := td.(type) {
		case *DeclarationSpecifiers:
			for ; x != nil; x = x.DeclarationSpecifiers {
				if expr, ok := x.AttributeSpecifier.Has(idVectorSize, idVectorSize2); ok {
					n.vectorize(ctx, expr)
					break
				}
			}
		}
	}
	return n.typ
}

func (n *Declarator) vectorize(ctx *context, expr *ExpressionList) {
	dst := &n.typ
	elem := n.typ
	switch n.typ.Kind() {
	case Function:
		dst = &n.typ.(*functionType).result
		elem = n.typ.Result()
	}

	sz := expr.vectorSize(ctx)
	if sz == 0 {
		sz = elem.Size()
	}
	if elem.Size() == 0 {
		ctx.errNode(expr, "vector element has zero size")
		return
	}

	if sz%elem.Size() != 0 {
		ctx.errNode(expr, "vector size must be a multiple of the base size")
	}
	b := n.typ.base()
	b.size = sz
	b.kind = byte(Vector)
	*dst = &vectorType{
		typeBase: b,
		elem:     elem,
		length:   sz / elem.Size(),
	}
}

func (n *ExpressionList) vectorSize(ctx *context) (r uintptr) {
	if n.ExpressionList != nil {
		ctx.errNode(n, "expected single expression")
		return 0
	}

	switch x := n.AssignmentExpression.Operand.Value().(type) {
	case Int64Value:
		if x <= 0 {
			ctx.errNode(n, "expected integer greater than zero")
			return 0
		}

		r = uintptr(x)
	case Uint64Value:
		r = uintptr(x)
	case nil:
		ctx.errNode(n, "expected constant expression")
		r = 0
	default:
		panic(todo("%T", x))
	}
	if bits.OnesCount64(uint64(r)) != 1 {
		ctx.errNode(n, "expected a power of two")
		r = 0
	}
	return r
}

func (n *DirectDeclarator) check(ctx *context, typ Type) Type {
	if n == nil {
		return noType
	}

	switch n.Case {
	case DirectDeclaratorIdent: // IDENTIFIER Asm
		n.Asm.check(ctx)
		return typ
	case DirectDeclaratorDecl: // '(' AttributeSpecifierList Declarator ')'
		n.AttributeSpecifierList.check(ctx, typ.baseP())
		return n.Declarator.check(ctx, noTypeDescriptor, typ, false)
	case DirectDeclaratorArr: // DirectDeclarator '[' TypeQualifiers AssignmentExpression ']'
		return n.DirectDeclarator.check(ctx, checkArray(ctx, &n.Token, typ, n.AssignmentExpression, true, false))
	case DirectDeclaratorStaticArr: // DirectDeclarator '[' "static" TypeQualifiers AssignmentExpression ']'
		return n.DirectDeclarator.check(ctx, checkArray(ctx, &n.Token, typ, n.AssignmentExpression, false, false))
	case DirectDeclaratorArrStatic: // DirectDeclarator '[' TypeQualifiers "static" AssignmentExpression ']'
		return n.DirectDeclarator.check(ctx, checkArray(ctx, &n.Token, typ, n.AssignmentExpression, false, false))
	case DirectDeclaratorStar: // DirectDeclarator '[' TypeQualifiers '*' ']'
		return n.DirectDeclarator.check(ctx, checkArray(ctx, &n.Token, typ, nil, true, true))
	case DirectDeclaratorFuncParam: // DirectDeclarator '(' ParameterTypeList ')'
		ft := &functionType{typeBase: typeBase{kind: byte(Function)}, result: typ}
		if typ != nil && typ.Inline() {
			ft.typeBase.flags = fInline
		}
		n.ParameterTypeList.check(ctx, ft)
		return n.DirectDeclarator.check(ctx, ft)
	case DirectDeclaratorFuncIdent: // DirectDeclarator '(' IdentifierList ')'
		ft := &functionType{typeBase: typeBase{kind: byte(Function)}, result: typ, paramList: n.IdentifierList.check(ctx)}
		if typ != nil && typ.Inline() {
			ft.typeBase.flags = fInline
		}
		if n.idListNoDeclList {
			n.checkIdentList(ctx, ft)
		}
		return n.DirectDeclarator.check(ctx, ft)
	}

	panic(internalErrorf("%v: %v", n.Position(), n.Case))
}

func (n *DirectDeclarator) checkIdentList(ctx *context, ft *functionType) {
	s := n.paramScope
	for _, nm := range ft.paramList {
		d := s[nm][0].(*Declarator)
		d.check(ctx, noTypeDescriptor, ctx.cfg.ABI.Type(Int), false)
		ft.params = append(ft.params, &Parameter{d, d.Type()})
	}
}

func checkArray(ctx *context, n Node, typ Type, expr *AssignmentExpression, exprIsOptional, noExpr bool) Type { //TODO pass and use typeQualifiers
	if typ == nil {
		ctx.errNode(n, "array of invalid or incomplete type")
		return noType
	}

	b := typ.base()
	b.align = byte(typ.Align())
	b.fieldAlign = byte(typ.FieldAlign())
	b.kind = byte(Array)
	switch {
	case expr != nil && noExpr:
		panic(todo(""))
	case expr != nil:
		op := expr.check(ctx, false)
		if op.Type().Kind() == Invalid {
			return noType
		}

		if !op.Type().IsIntegerType() {
			//TODO report err
			return noType
		}

		var length uintptr
		var vla bool
		var vlaExpr *AssignmentExpression
		switch x := op.Value().(type) {
		case nil:
			vla = true
			vlaExpr = expr
		case Int64Value:
			length = uintptr(x)
		case Uint64Value:
			length = uintptr(x)
		}
		switch {
		case vla:
			b.size = ctx.cfg.ABI.Types[Ptr].Size
		default:
			if typ.IsIncomplete() {
				//TODO report error
				return noType
			}

			b.size = length * typ.Size()
		}
		return &arrayType{typeBase: b, decay: ctx.cfg.ABI.Ptr(n, typ), elem: typ, length: length, vla: vla, expr: vlaExpr}
	case noExpr:
		// nop
	case !exprIsOptional:
		panic(todo(""))
	}
	b.flags |= fIncomplete
	return &arrayType{typeBase: b, decay: ctx.cfg.ABI.Ptr(n, typ), elem: typ}
}

func (n *IdentifierList) check(ctx *context) (r []StringID) {
	for ; n != nil; n = n.IdentifierList {
		tok := n.Token2.Value
		if tok == 0 {
			tok = n.Token.Value
		}
		r = append(r, tok)
	}
	return r
}

func (n *Asm) check(ctx *context) {
	if n == nil {
		return
	}

	n.AsmQualifierList.check(ctx)
	n.AsmArgList.check(ctx)
}

func (n *AsmArgList) check(ctx *context) {
	for ; n != nil; n = n.AsmArgList {
		n.AsmExpressionList.check(ctx)
	}
}

func (n *AsmExpressionList) check(ctx *context) {
	if ctx.cfg.DoNotTypecheckAsm {
		return
	}

	for ; n != nil; n = n.AsmExpressionList {
		n.AsmIndex.check(ctx)
		n.AssignmentExpression.check(ctx, true)
	}
}

func (n *AsmIndex) check(ctx *context) {
	if n == nil {
		return
	}

	n.Expression.check(ctx, true)
}

func (n *AsmQualifierList) check(ctx *context) {
	for ; n != nil; n = n.AsmQualifierList {
		n.AsmQualifier.check(ctx)
	}
}

func (n *AsmQualifier) check(ctx *context) {
	if n == nil {
		return
	}

	switch n.Case {
	case AsmQualifierVolatile: // "volatile"
		//TODO
	case AsmQualifierInline: // "inline"
		//TODO
	case AsmQualifierGoto: // "goto"
		//TODO
	default:
		panic(todo(""))
	}
}

func (n *AttributeSpecifierList) check(ctx *context, t *typeBase) (a []*AttributeSpecifier) {
	for ; n != nil; n = n.AttributeSpecifierList {
		a = append(a, n.AttributeSpecifier.check(ctx, t))
	}
	return a
}

func (n *AttributeSpecifier) check(ctx *context, t *typeBase) *AttributeSpecifier {
	if n == nil {
		return nil
	}

	n.AttributeValueList.check(ctx, t)
	return n
}

func (n *AttributeValueList) check(ctx *context, t *typeBase) {
	for ; n != nil; n = n.AttributeValueList {
		n.AttributeValue.check(ctx, t)
	}
}

func (n *AttributeValue) check(ctx *context, t *typeBase) {
	if n == nil {
		return
	}

	switch n.Case {
	case AttributeValueIdent: // IDENTIFIER
		if n.Token.Value == idPacked && t != nil {
			t.flags |= fPacked
		}
	case AttributeValueExpr: // IDENTIFIER '(' ExpressionList ')'
		v := ctx.cfg.ignoreErrors
		ctx.cfg.ignoreErrors = true
		defer func() { ctx.cfg.ignoreErrors = v }()
		n.ExpressionList.check(ctx, false)
		if n.Token.Value == idAligned && n.ExpressionList != nil && t != nil {
			switch x := n.ExpressionList.AssignmentExpression.Operand.Value().(type) {
			case Int64Value:
				t.setAligned(int(x))
				switch t.Kind() {
				case Struct, Union:
					ctx.structs[StructInfo{Size: t.Size(), Align: t.Align()}] = struct{}{}
				}
			}
		}
	default:
		panic(todo(""))
	}
}

func (n *ExpressionList) check(ctx *context, isAsmArg bool) {
	for ; n != nil; n = n.ExpressionList {
		n.AssignmentExpression.check(ctx, isAsmArg)
	}
}

func (n *DeclarationSpecifiers) check(ctx *context, inUnion bool) (r Type, inline, noret bool) {
	n0 := n
	typ := &typeBase{}
	for ; n != nil; n = n.DeclarationSpecifiers {
		switch n.Case {
		case DeclarationSpecifiersStorage: // StorageClassSpecifier DeclarationSpecifiers
			n.StorageClassSpecifier.check(ctx, n)
		case DeclarationSpecifiersTypeSpec: // TypeSpecifier DeclarationSpecifiers
			n.TypeSpecifier.check(ctx, typ, inUnion)
		case DeclarationSpecifiersTypeQual: // TypeQualifier DeclarationSpecifiers
			n.TypeQualifier.check(ctx, typ)
		case DeclarationSpecifiersFunc: // FunctionSpecifier DeclarationSpecifiers
			if n.FunctionSpecifier == nil {
				break
			}

			switch n.FunctionSpecifier.Case {
			case FunctionSpecifierInline: // "inline"
				inline = true
			case FunctionSpecifierNoreturn: // "_Noreturn"
				noret = true
			default:
				panic(todo(""))
			}
		case DeclarationSpecifiersAlignSpec: // AlignmentSpecifier DeclarationSpecifiers
			n.AlignmentSpecifier.check(ctx)
		case DeclarationSpecifiersAttribute: // AttributeSpecifier DeclarationSpecifiers
			n.AttributeSpecifier.check(ctx, typ)
		default:
			panic(todo(""))
		}
	}
	r = typ.check(ctx, n0, true)
	return r, inline, noret
}

func (n *AlignmentSpecifier) check(ctx *context) {
	if n == nil {
		return
	}

	switch n.Case {
	case AlignmentSpecifierAlignasType: // "_Alignas" '(' TypeName ')'
		n.TypeName.check(ctx, false, false, nil)
		//TODO actually set the alignment
	case AlignmentSpecifierAlignasExpr: // "_Alignas" '(' ConstantExpression ')'
		n.ConstantExpression.check(ctx, ctx.mode|mIntConstExpr, false)
		//TODO actually set the alignment
	default:
		panic(todo(""))
	}
}

func (n *StorageClassSpecifier) check(ctx *context, ds *DeclarationSpecifiers) {
	if n == nil {
		return
	}

	switch n.Case {
	case StorageClassSpecifierTypedef: // "typedef"
		ds.class |= fTypedef
	case StorageClassSpecifierExtern: // "extern"
		ds.class |= fExtern
	case StorageClassSpecifierStatic: // "static"
		ds.class |= fStatic
	case StorageClassSpecifierAuto: // "auto"
		ds.class |= fAuto
	case StorageClassSpecifierRegister: // "register"
		ds.class |= fRegister
	case StorageClassSpecifierThreadLocal: // "_Thread_local"
		ds.class |= fThreadLocal
	default:
		panic(todo(""))
	}
	c := bits.OnesCount(uint(ds.class & (fTypedef | fExtern | fStatic | fAuto | fRegister | fThreadLocal)))
	if c == 1 {
		return
	}

	// [2], 6.7.1, 2
	if c == 2 && ds.class&fThreadLocal != 0 {
		if ds.class&(fStatic|fExtern) != 0 {
			return
		}
	}

	ctx.errNode(n, "at most, one storage-class specifier may be given in the declaration specifiers in a declaration")
}

// DeclarationSpecifiers Declarator DeclarationList CompoundStatement
func (n *FunctionDefinition) checkDeclarator(ctx *context) {
	if n == nil {
		return
	}

	n.Declarator.fnDef = true
	n.Declarator.funcDefinition = n
	ctx.checkFn = n
	typ, inline, noret := n.DeclarationSpecifiers.check(ctx, false)
	typ = n.Declarator.check(ctx, n.DeclarationSpecifiers, typ, true)
	typ.setFnSpecs(inline, noret)
	ctx.checkFn = nil
	n.DeclarationList.checkFn(ctx, typ, n.Declarator.ParamScope())
}

func (n *DeclarationList) checkFn(ctx *context, typ Type, s Scope) {
	if n == nil {
		return
	}

	n.check(ctx)
	ft, ok := typ.(*functionType)
	if !ok {
		return
	}

	if ft.params != nil {
		//TODO report error
		return
	}

	if len(ft.paramList) == 0 {
		//TODO report error
		return
	}

	m := make(map[StringID]int, len(ft.paramList))
	for i, v := range ft.paramList {
		if _, ok := m[v]; ok {
			ctx.errNode(n, "duplicate parameter: %s", v)
			continue
		}

		m[v] = i
	}
	params := make([]*Parameter, len(m))
	i := 0
	for ; n != nil; n = n.DeclarationList {
		for n := n.Declaration.InitDeclaratorList; n != nil; n = n.InitDeclaratorList {
			n := n.InitDeclarator
			switch n.Case {
			case InitDeclaratorDecl: // Declarator AttributeSpecifierList
				nm := n.Declarator.Name()
				n.Declarator.IsParameter = true
				switch x, ok := m[nm]; {
				case ok:
					params[x] = &Parameter{d: n.Declarator, typ: n.Declarator.Type()}
					i++
				default:
					//TODO report error
				}
			case InitDeclaratorInit: // Declarator AttributeSpecifierList '=' Initializer
				//TODO report error
				return
			default:
				panic(todo(""))
			}
		}
	}
	for i, v := range params {
		if v != nil {
			continue
		}

		nm := ft.paramList[i]
		d := &Declarator{
			DirectDeclarator: &DirectDeclarator{
				Case:  DirectDeclaratorIdent,
				Token: Token{Rune: IDENTIFIER, Value: nm},
			},
			IsParameter:  true,
			Linkage:      None,
			StorageClass: Automatic,
			typ:          ctx.cfg.ABI.Type(Int),
		}
		s.declare(nm, d)
		params[i] = &Parameter{d, d.typ}
	}
	ft.params = params
}

func (n *CompoundStatement) check(ctx *context) Operand {
	n.Operand = n.BlockItemList.check(ctx)
	return n.Operand
}

func (n *BlockItemList) check(ctx *context) (r Operand) {
	r = noOperand
	var last *BlockItem
	for ; n != nil; n = n.BlockItemList {
		last = n.BlockItem
		r = n.BlockItem.check(ctx)
	}
	if last != nil {
		last.Last = true
	}
	return r
}

func (n *BlockItem) check(ctx *context) Operand {
	if n == nil {
		return noOperand
	}

	switch n.Case {
	case BlockItemDecl: // Declaration
		n.Declaration.check(ctx, false)
	case BlockItemStmt: // Statement
		return n.Statement.check(ctx)
	case BlockItemLabel: // LabelDeclaration
		n.LabelDeclaration.check(ctx)
	case BlockItemFuncDef: // DeclarationSpecifiers Declarator CompoundStatement
		ctxClosure := ctx.closure
		ctx.closure = nil
		ctxCheckFn := ctx.checkFn
		fn := &FunctionDefinition{
			DeclarationSpecifiers: n.DeclarationSpecifiers,
			Declarator:            n.Declarator,
			CompoundStatement:     n.CompoundStatement,
		}
		n.fn = fn
		ctx.checkFn = fn
		n.CompoundStatement.scope.declare(idClosure, n)
		fn.checkDeclarator(ctx)
		ctxCapture := ctx.capture
		ctx.capture = true
		fn.checkBody(ctx)
		n.closure = ctx.closure
		ctx.capture = ctxCapture
		delete(n.CompoundStatement.scope, idClosure)
		ctx.checkFn = ctxCheckFn
		ctx.closure = ctxClosure
	case BlockItemPragma: // PragmaSTDC
		n.PragmaSTDC.check(ctx)
	default:
		panic(todo(""))
	}
	return noOperand
}

func (n *LabelDeclaration) check(ctx *context) {
	if n == nil {
		return
	}

	n.IdentifierList.check(ctx)
}

func (n *Statement) check(ctx *context) Operand {
	if n == nil {
		return noOperand
	}

	n.Operand = noOperand
	switch n.Case {
	case StatementLabeled: // LabeledStatement
		n.LabeledStatement.check(ctx)
	case StatementCompound: // CompoundStatement
		n.Operand = n.CompoundStatement.check(ctx)
	case StatementExpr: // ExpressionStatement
		n.Operand = n.ExpressionStatement.check(ctx)
	case StatementSelection: // SelectionStatement
		n.SelectionStatement.check(ctx)
	case StatementIteration: // IterationStatement
		n.IterationStatement.check(ctx)
	case StatementJump: // JumpStatement
		n.JumpStatement.check(ctx)
	case StatementAsm: // AsmStatement
		n.AsmStatement.check(ctx)
	default:
		panic(todo(""))
	}
	return n.Operand
}

func (n *JumpStatement) check(ctx *context) {
	if n == nil {
		return
	}

	switch n.Case {
	case JumpStatementGoto: // "goto" IDENTIFIER ';'
		n.context = ctx.breakCtx
		if ctx.checkFn.Gotos == nil {
			ctx.checkFn.Gotos = map[StringID]*JumpStatement{}
		}
		ctx.checkFn.Gotos[n.Token2.Value] = n
	case JumpStatementGotoExpr: // "goto" '*' Expression ';'
		n.Expression.check(ctx, false)
		//TODO
	case JumpStatementContinue: // "continue" ';'
		n.context = ctx.breakCtx
		if ctx.continues <= 0 {
			panic(n.Position().String())
		}
		//TODO
	case JumpStatementBreak: // "break" ';'
		n.context = ctx.breakCtx
		if ctx.breaks <= 0 {
			panic(n.Position().String())
		}
		//TODO
	case JumpStatementReturn: // "return" Expression ';'
		n.context = ctx.breakCtx
		op := n.Expression.check(ctx, false)
		if op.Type().IsComplexType() {
			ctx.checkFn.ReturnComplexExpr = append(ctx.checkFn.ReturnComplexExpr, n.Expression)
		}
	default:
		panic(todo(""))
	}
}

func (n *IterationStatement) check(ctx *context) {
	if n == nil {
		return
	}

	sv := ctx.breakCtx
	ctx.breakCtx = n

	defer func() { ctx.breakCtx = sv }()

	switch n.Case {
	case IterationStatementWhile: // "while" '(' Expression ')' Statement
		n.Expression.check(ctx, false)
		ctx.breaks++
		ctx.continues++
		n.Statement.check(ctx)
		ctx.breaks--
		ctx.continues--
	case IterationStatementDo: // "do" Statement "while" '(' Expression ')' ';'
		ctx.breaks++
		ctx.continues++
		n.Statement.check(ctx)
		ctx.breaks--
		ctx.continues--
		n.Expression.check(ctx, false)
	case IterationStatementFor: // "for" '(' Expression ';' Expression ';' Expression ')' Statement
		n.Expression.check(ctx, false)
		n.Expression2.check(ctx, false)
		n.Expression3.check(ctx, false)
		ctx.breaks++
		ctx.continues++
		n.Statement.check(ctx)
		ctx.breaks--
		ctx.continues--
	case IterationStatementForDecl: // "for" '(' Declaration Expression ';' Expression ')' Statement
		n.Declaration.check(ctx, false)
		n.Expression.check(ctx, false)
		n.Expression2.check(ctx, false)
		ctx.breaks++
		ctx.continues++
		n.Statement.check(ctx)
		ctx.breaks--
		ctx.continues--
	default:
		panic(todo(""))
	}
}

func (n *SelectionStatement) check(ctx *context) {
	if n == nil {
		return
	}

	switch n.Case {
	case SelectionStatementIf: // "if" '(' Expression ')' Statement
		n.Expression.check(ctx, false)
		n.Statement.check(ctx)
	case SelectionStatementIfElse: // "if" '(' Expression ')' Statement "else" Statement
		n.Expression.check(ctx, false)
		n.Statement.check(ctx)
		n.Statement2.check(ctx)
		if !n.Expression.Operand.Type().IsScalarType() {
			//TODO report err
			break
		}
	case SelectionStatementSwitch: // "switch" '(' Expression ')' Statement
		if n == nil {
			return
		}

		sv := ctx.breakCtx
		ctx.breakCtx = n

		defer func() { ctx.breakCtx = sv }()

		op := n.Expression.check(ctx, false)
		n.promote = op.integerPromotion(ctx, n).Type()
		cp := ctx.casePromote
		ctx.casePromote = n.promote
		cs := ctx.cases
		ctx.cases = nil
		ctx.switches++
		ctx.breaks++
		n.Statement.check(ctx)
		ctx.breaks--
		ctx.switches--
		n.cases = ctx.cases
		ctx.cases = cs
		ctx.casePromote = cp
	default:
		panic(todo(""))
	}
}

func (n *ExpressionStatement) check(ctx *context) Operand {
	if n == nil {
		return noOperand
	}

	n.AttributeSpecifierList.check(ctx, nil)
	return n.Expression.check(ctx, false)
}

func (n *LabeledStatement) check(ctx *context) {
	if n == nil {
		return
	}

	switch n.Case {
	case LabeledStatementLabel: // IDENTIFIER ':' AttributeSpecifierList Statement
		if ctx.checkFn.Labels == nil {
			ctx.checkFn.Labels = map[StringID]*LabeledStatement{}
		}
		if _, ok := ctx.checkFn.Labels[n.Token.Value]; ok {
			//TODO report redeclared
		}
		ctx.checkFn.Labels[n.Token.Value] = n
		n.AttributeSpecifierList.check(ctx, nil)
		n.Statement.check(ctx)
	case LabeledStatementCaseLabel: // "case" ConstantExpression ':' Statement
		if ctx.switches <= 0 {
			//TODO report error
			break
		}

		switch op := n.ConstantExpression.check(ctx, ctx.mode|mIntConstExpr, false); op.Value().(type) {
		case Int64Value, Uint64Value:
			if t := ctx.casePromote; t.Kind() != Invalid {
				n.ConstantExpression.Operand = op.convertTo(ctx, n, t)
				break
			}

			//TODO report error
		default:
			//TODO report error
		}
		ctx.cases = append(ctx.cases, n)
		n.Statement.check(ctx)
	case LabeledStatementRange: // "case" ConstantExpression "..." ConstantExpression ':' Statement
		if ctx.switches <= 0 {
			//TODO report error
			break
		}

		switch n.ConstantExpression.check(ctx, ctx.mode|mIntConstExpr, false).Value().(type) {
		case Int64Value, Uint64Value:
			// ok
		default:
			//TODO report error
		}
		switch n.ConstantExpression2.check(ctx, ctx.mode|mIntConstExpr, false).Value().(type) {
		case Int64Value, Uint64Value:
			// ok
		default:
			//TODO report error
		}
		ctx.cases = append(ctx.cases, n)
		n.Statement.check(ctx)
	case LabeledStatementDefault: // "default" ':' Statement
		if ctx.switches <= 0 {
			//TODO report error
			break
		}

		ctx.cases = append(ctx.cases, n)
		n.Statement.check(ctx)
	default:
		panic(todo(""))
	}
}

func (n *DeclarationList) check(ctx *context) {
	for ; n != nil; n = n.DeclarationList {
		n.Declaration.check(ctx, false)
	}
}

func setAddressTaken(n Node, d *Declarator, s string) {
	d.AddressTaken = true
	// fmt.Printf("%v: %s, type %v (%v, %v), declared at %v, AddressTaken = true: %v\n",
	// 	n.Position(), d.Name(), d.Type(), d.Type().Kind(), d.Type().Size(), d.Position(), s,
	// ) //TODO-
}

// Dump returns a debug form of n.
func (n *Initializer) Dump() string {
	var b strings.Builder
	f := strutil.IndentFormatter(&b, "\t")
	n.dump(f)
	return b.String()
}

func pos(n Node) (r token.Position) {
	if n == nil {
		return r
	}

	r = token.Position(n.Position())
	if r.IsValid() {
		r.Filename = filepath.Base(r.Filename)
	}
	return r
}

func (n *Initializer) dump(f strutil.Formatter) {
	list := n.List()
	if len(list) != 0 {
		for i, v := range list {
			f.Format("Initializer.List() #%d/%d: %v: off %v type %v", i, len(list), pos(v), v.Offset, v.Type())
			if fld := v.FirstDesignatorField(); fld != nil {
				f.Format(" [FirstDesignatorField %q]", fld.Name())
			}
			f.Format("\n")
		}
	}
	if f0 := n.FirstDesignatorField(); f0 != nil {
		f.Format("[FirstDesignatorField: %q, index %v, off %v, type %v] ", f0.Name(), f0.Index(), n.Offset, n.Type().Alias())
	}
	switch n.Case {
	case InitializerExpr: // AssignmentExpression
		if op := n.AssignmentExpression.Operand; op != nil {
			n.isConst = op.IsConst()
			n.isZero = op.IsZero()
		}
		var t Type
		if n.AssignmentExpression != nil && n.AssignmentExpression.Operand != nil {
			t = n.AssignmentExpression.Operand.Type()
		}
		f.Format("%v: %T@%[2]p, .Case %v, off %v,  type %v\n", pos(n), n, n.Case, n.Offset, t.Alias())
	case InitializerInitList: // '{' InitializerList ',' '}'
		n.InitializerList.dump(f)
	default:
		panic(todo("%v:", n.Position()))
	}
}

// Dump returns a debug form of n.
func (n *InitializerList) Dump() string {
	var b strings.Builder
	f := strutil.IndentFormatter(&b, "\t")
	n.dump(f)
	return b.String()
}

func (n *InitializerList) dump(f strutil.Formatter) {
	if n == nil {
		f.Format("<nil>")
		return
	}

	f.Format("%v: %T@%[2]p, len(.List()) %v {%i\n", pos(n), n, len(n.List()))
	list := n.List()
	for ; n != nil; n = n.InitializerList {
		n.Designation.dump(f)
		n.Initializer.dump(f)
	}
	for i, v := range list {
		f.Format("InitializerList.List() #%d/%d:", i, len(list))
		v.dump(f)
	}
	f.Format("%u}\n")
}

func (n *Designation) dump(f strutil.Formatter) {
	if n == nil {
		return
	}

	cnt := 0
	designatorField2 := false
	for n := n.DesignatorList; n != nil; n = n.DesignatorList {
		n.Designator.dump(f)
		if n.Designator.Case == DesignatorField2 {
			designatorField2 = true
		}
		cnt++
	}
	if cnt > 1 || !designatorField2 {
		f.Format(" = ")
	}
}

func (n *Designator) dump(f strutil.Formatter) {
	switch n.Case {
	case DesignatorIndex: // '[' ConstantExpression ']'
		f.Format("[%v]", n.ConstantExpression.Operand.Value())
	case DesignatorField: // '.' IDENTIFIER
		f.Format(".%s", n.Token2.Value)
	case DesignatorField2: // IDENTIFIER ':'
		f.Format("%s:", n.Token.Value)
	default:
		panic(todo(""))
	}
}
