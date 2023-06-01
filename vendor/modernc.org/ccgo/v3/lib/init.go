// Copyright 2020 The CCGO Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package ccgo // import "modernc.org/ccgo/v3/lib"

import (
	"fmt"
	"sort"
	"strings"

	"modernc.org/cc/v3"
)

func isAggregateTypeOrUnion(t cc.Type) bool {
	switch t.Kind() {
	case cc.Struct, cc.Union, cc.Array:
		return true
	}

	return false
}

// 6.7.8 Initialization
func (p *project) initializer(f *function, n *cc.Initializer, t cc.Type, sc cc.StorageClass, tld *tld) {
	lm := map[*cc.Initializer][]cc.StringID{}
	tm := map[*cc.Initializer][]cc.StringID{}
	s := p.initializerFlatten(n, lm, tm)
	sort.Slice(s, func(i, j int) bool {
		a := s[i]
		b := s[j]
		if a.Offset < b.Offset {
			return true
		}

		if a.Offset > b.Offset {
			return false
		}

		if a.Field == nil || b.Field == nil || !a.Field.IsBitField() || !b.Field.IsBitField() {
			panic(todo("%v: internal error: off %#x, %v: off %#x, t %v", a.Position(), a.Offset, b.Position(), b.Offset, t))
		}

		return a.Field.BitFieldOffset() < b.Field.BitFieldOffset()
	})
	p.initializerInner("", 0, f, s, t, sc, tld, nil, lm, tm)
}

func (p *project) initializerInner(tag string, off uintptr, f *function, s []*cc.Initializer, t cc.Type, sc cc.StorageClass, tld *tld, patchField cc.Field, lm, tm map[*cc.Initializer][]cc.StringID) {
	// 11: The initializer for a scalar shall be a single expression, optionally
	// enclosed in braces. The initial value of the object is that of the
	// expression (after conversion); the same type constraints and conversions as
	// for simple assignment apply, taking the type of the scalar to be the
	// unqualified version of its declared type.
	if t.IsScalarType() && len(s) == 1 {
		p.w("%s%s", tidyComment("", s[0]), tag)
		switch {
		case tld != nil && t.Kind() == cc.Ptr && s[0].AssignmentExpression.Operand.Value() == nil:
			tld.patches = append(tld.patches, initPatch{t, s[0], patchField})
			p.w(" 0 ")
		default:
			p.assignmentExpression(f, s[0].AssignmentExpression, t, exprValue, 0)
		}
		return
	}

	// 12: The rest of this subclause deals with initializers for objects that have
	// aggregate or union type.

	k := t.Kind()

	// 13: The initializer for a structure or union object that has automatic
	// storage duration shall be either an initializer list as described below, or
	// a single expression that has compatible structure or union type. In the
	// latter case, the initial value of the object, including unnamed members, is
	// that of the expression.
	if sc == cc.Automatic && len(s) == 1 {
		switch k {
		case cc.Struct, cc.Union:
			if compatibleStructOrUnion(t, s[0].AssignmentExpression.Operand.Type()) {
				p.w("%s%s", tidyComment("", s[0]), tag)
				p.assignmentExpression(f, s[0].AssignmentExpression, t, exprValue, 0)
				return
			}
		}
	}

	if k == cc.Array && len(s) == 1 {
		et := t.Elem()
		switch {
		case isCharType(et):
			// 14: An array of character type may be initialized by a character string
			// literal, optionally enclosed in braces. Successive characters of the
			// character string literal (including the terminating null character if there
			// is room or if the array is of unknown size) initialize the elements of the
			// array.
			if x, ok := s[0].AssignmentExpression.Operand.Value().(cc.StringValue); ok {
				p.w("%s%s", tidyComment("", s[0]), tag)
				str := cc.StringID(x).String()
				slen := uintptr(len(str)) + 1
				alen := t.Len()
				switch {
				case alen < slen-1:
					p.w("*(*%s)(unsafe.Pointer(%s))", p.typ(s[0], t), p.stringLiteralString(str[:alen]))
				case alen < slen:
					p.w("*(*%s)(unsafe.Pointer(%s))", p.typ(s[0], t), p.stringLiteralString(str))
				default: // alen >= slen
					p.w("*(*%s)(unsafe.Pointer(%s))", p.typ(s[0], t), p.stringLiteralString(str+strings.Repeat("\x00", int(alen-slen))))
				}
				return
			}
		case p.isWCharType(et):
			// 15: An array with element type compatible with wchar_t may be initialized by
			// a wide string literal, optionally enclosed in braces. Successive wide
			// characters of the wide string literal (including the terminating null wide
			// character if there is room or if the array is of unknown size) initialize
			// the elements of the array.
			if x, ok := s[0].AssignmentExpression.Operand.Value().(cc.WideStringValue); ok {
				p.w("%s%s", tidyComment("", s[0]), tag)
				str := []rune(cc.StringID(x).String())
				slen := uintptr(len(str)) + 1
				alen := t.Len()
				switch {
				case alen < slen-1:
					panic(todo("", p.pos(s[0])))
				case alen < slen:
					p.w("*(*%s)(unsafe.Pointer(%s))", p.typ(s[0], t), p.wideStringLiteral(x, 0))
				default: // alen >= slen
					p.w("*(*%s)(unsafe.Pointer(%s))", p.typ(s[0], t), p.wideStringLiteral(x, int(alen-slen)))
				}
				return
			}
		}
	}

	// 16: Otherwise, the initializer for an object that has aggregate or union
	// type shall be a brace-enclosed list of initializers for the elements or
	// named members.
	switch k {
	case cc.Array:
		p.initializerArray(tag, off, f, s, t, sc, tld, lm, tm)
	case cc.Struct:
		p.initializerStruct(tag, off, f, s, t, sc, tld, lm, tm)
	case cc.Union:
		p.initializerUnion(tag, off, f, s, t, sc, tld, lm, tm)
	default:
		panic(todo("%v: internal error: %v alias %v %v", s[0].Position(), t, t.Alias(), len(s)))
	}
}

func (p *project) initializerArray(tag string, off uintptr, f *function, s []*cc.Initializer, t cc.Type, sc cc.StorageClass, tld *tld, lm, tm map[*cc.Initializer][]cc.StringID) {
	if len(s) == 0 {
		p.w("%s%s{}", tag, p.typ(nil, t))
		return
	}

	et := t.Elem()
	esz := et.Size()
	s0 := s[0]
	p.w("%s%s%s{", initComment(s0, lm), tag, p.typ(s0, t))
	var a [][]*cc.Initializer
	for len(s) != 0 {
		s2, parts, _ := p.initializerArrayElement(off, s, esz)
		s = s2
		a = append(a, parts)
	}
	mustIndex := uintptr(len(a)) != t.Len()
	var parts []*cc.Initializer
	for _, parts = range a {
		var comma *cc.Token
		comma = parts[len(parts)-1].TrailingComma()
		elemOff := (parts[0].Offset - off) / esz * esz
		tag = ""
		if mustIndex {
			tag = fmt.Sprintf("%d:", elemOff/esz)
		}
		p.initializerInner(tag, off+elemOff, f, parts, et, sc, tld, nil, lm, tm)
		p.preCommaSep(comma)
		p.w(",")
	}
	p.w("%s}", initComment(parts[len(parts)-1], tm))
}

func initComment(n *cc.Initializer, m map[*cc.Initializer][]cc.StringID) string {
	a := m[n]
	if len(a) == 0 {
		return ""
	}

	m[n] = a[1:]
	return tidyCommentString(a[0].String())
}

func (p *project) initializerArrayElement(off uintptr, s []*cc.Initializer, elemSize uintptr) (r []*cc.Initializer, parts []*cc.Initializer, isZero bool) {
	r = s
	isZero = true
	valueOff := s[0].Offset - off
	elemOff := valueOff - valueOff%elemSize
	nextOff := elemOff + elemSize
	for len(s) != 0 {
		if v := s[0]; v.Offset-off < nextOff {
			s = s[1:]
			parts = append(parts, v)
			if !v.AssignmentExpression.Operand.IsZero() {
				isZero = false
			}
			continue
		}

		break
	}
	return r[len(parts):], parts, isZero
}

func (p *project) initializerStruct(tag string, off uintptr, f *function, s []*cc.Initializer, t cc.Type, sc cc.StorageClass, tld *tld, lm, tm map[*cc.Initializer][]cc.StringID) {
	if len(s) == 0 {
		p.w("%s%s{}", tag, p.typ(nil, t))
		return
	}

	if t.HasFlexibleMember() {
		p.err(s[0], "flexible array members not supported")
		return
	}

	p.w("%s%s%s{", initComment(s[0], lm), tag, p.typ(s[0], t))
	var parts []*cc.Initializer
	var isZero bool
	var fld cc.Field
	for len(s) != 0 {
		var comma *cc.Token
		s, fld, parts, isZero = p.structInitializerParts(off, s, t)
		if isZero {
			continue
		}

		if fld.Type().IsIncomplete() {
			panic(todo(""))
		}

		comma = parts[len(parts)-1].TrailingComma()
		tag = fmt.Sprintf("%s:", p.fieldName2(parts[0], fld))
		ft := fld.Type()
		switch {
		case fld.IsBitField():
			bft := p.bitFileType(parts[0], fld.BitFieldBlockWidth())
			off0 := fld.Offset()
			first := true
			for _, v := range parts {
				if v.AssignmentExpression.Operand.IsZero() {
					continue
				}

				if !first {
					p.w("|")
				}
				first = false
				bitFld := v.Field
				p.w("%s%s", tidyComment("", v.AssignmentExpression), tag)
				tag = ""
				p.assignmentExpression(f, v.AssignmentExpression, bft, exprValue, 0)
				p.w("&%#x", uint64(1)<<uint64(bitFld.BitFieldWidth())-1)
				if o := bitFld.BitFieldOffset() + 8*int((bitFld.Offset()-off0)); o != 0 {
					p.w("<<%d", o)
				}
			}
		default:
			p.initializerInner(tag, off+fld.Offset(), f, parts, ft, sc, tld, fld, lm, tm)
		}
		p.preCommaSep(comma)
		p.w(",")
	}
	p.w("%s}", initComment(parts[len(parts)-1], tm))
}

func (p *project) preCommaSep(comma *cc.Token) {
	if comma == nil {
		return
	}

	p.w("%s", strings.TrimSpace(comma.Sep.String()))
}

func (p *project) structInitializerParts(off uintptr, s []*cc.Initializer, t cc.Type) (r []*cc.Initializer, fld cc.Field, parts []*cc.Initializer, isZero bool) {
	if len(s) == 0 {
		return nil, nil, nil, true
	}

	part := s[0]
	isZero = part.AssignmentExpression.Operand.IsZero()
	parts = append(parts, part)
	s = s[1:]
	fld, _, fNext := p.containingStructField(part, off, t)
	for len(s) != 0 {
		part = s[0]
		vOff := part.Offset
		if vOff >= fNext {
			break
		}

		isZero = isZero && part.AssignmentExpression.Operand.IsZero()
		parts = append(parts, part)
		s = s[1:]
	}
	return s, fld, parts, isZero
}

func (p *project) containingStructField(part *cc.Initializer, off uintptr, t cc.Type) (f cc.Field, fOff, fNext uintptr) {
	nf := t.NumField()
	vOff := part.Offset
	for i := []int{0}; i[0] < nf; i[0]++ {
		f = t.FieldByIndex(i)
		if f.IsBitField() && f.Name() == 0 { // Anonymous bit fields cannot be initialized.
			continue
		}

		fOff = off + f.Offset()
		switch {
		case f.IsBitField():
			fNext = fOff + uintptr(f.BitFieldBlockWidth())>>3
		default:
			fNext = fOff + f.Type().Size()
		}
		if vOff >= fOff && vOff < fNext {
			return f, fOff, fNext
		}
	}

	panic(todo("%v: internal error", p.pos(part)))
}

func (p *project) initializerUnion(tag string, off uintptr, f *function, s []*cc.Initializer, t cc.Type, sc cc.StorageClass, tld *tld, lm, tm map[*cc.Initializer][]cc.StringID) {
	if len(s) == 0 {
		p.w("%s%s{}", tag, p.typ(nil, t))
		return
	}

	if t.HasFlexibleMember() {
		p.err(s[0], "flexible array members not supported")
		return
	}

	parts, isZero := p.initializerUnionField(off, s, t)
	if len(parts) == 0 || isZero {
		p.w("%s%s%s{", initComment(s[0], lm), tag, p.typ(s[0], t))
		p.w("%s}", initComment(parts[len(parts)-1], tm))
		return
	}

	p.w("%sfunc() (r %s) {", tag, p.typ(parts[0], t))
	for _, part := range parts {
		var ft cc.Type
		fld := part.Field
		if fld != nil && fld.IsBitField() {
		}

		if ft == nil {
			ft = part.Type()
		}
		if ft.Kind() == cc.Array {
			et := ft.Elem()
			switch {
			case isCharType(et):
				switch x := part.AssignmentExpression.Operand.Value().(type) {
				case cc.StringValue:
					str := cc.StringID(x).String()
					slen := uintptr(len(str)) + 1
					alen := ft.Len()
					switch {
					case alen < slen-1:
						p.w("copy(((*[%d]byte)(unsafe.Pointer(uintptr(unsafe.Pointer(&r))+%d)))[:], (*[%d]byte)(unsafe.Pointer(%s))[:])\n", alen, part.Offset-off, alen, p.stringLiteralString(str[:alen]))
					case alen < slen:
						p.w("copy(((*[%d]byte)(unsafe.Pointer(uintptr(unsafe.Pointer(&r))+%d)))[:], (*[%d]byte)(unsafe.Pointer(%s))[:])\n", alen, part.Offset-off, alen, p.stringLiteralString(str))
					default: // alen >= slen
						p.w("copy(((*[%d]byte)(unsafe.Pointer(uintptr(unsafe.Pointer(&r))+%d)))[:], (*[%d]byte)(unsafe.Pointer(%s))[:])\n", alen, part.Offset-off, alen, p.stringLiteralString(str+strings.Repeat("\x00", int(alen-slen))))
					}
					continue
				default:
					panic(todo("%v: %v <- %T", p.pos(part), et, x))
				}
			case p.isWCharType(et):
				panic(todo(""))
			}
			ft = et
		}
		switch {
		case fld != nil && fld.IsBitField():
			bft := p.bitFileType(part, fld.BitFieldBlockWidth())
			p.w("*(*%s)(unsafe.Pointer(uintptr(unsafe.Pointer(&r))+%d)) |= ", p.typ(part, bft), part.Offset-off)
			p.assignmentExpression(f, part.AssignmentExpression, bft, exprValue, 0)
			p.w("&%#x", uint64(1)<<uint64(fld.BitFieldWidth())-1)
			if o := fld.BitFieldOffset(); o != 0 {
				p.w("<<%d", o)
			}
		default:
			p.w("*(*%s)(unsafe.Pointer(uintptr(unsafe.Pointer(&r))+%d)) = ", p.typ(part, ft), part.Offset-off)
			p.assignmentExpression(f, part.AssignmentExpression, ft, exprValue, 0)
		}
		p.w("\n")
	}
	p.w("return r\n")
	p.w("}()")
}

func (p *project) initializerUnionField(off uintptr, s []*cc.Initializer, t cc.Type) (parts []*cc.Initializer, isZero bool) {
	isZero = true
	nextOff := off + t.Size()
	for len(s) != 0 {
		if v := s[0]; v.Offset < nextOff {
			s = s[1:]
			parts = append(parts, v)
			isZero = isZero && v.AssignmentExpression.Operand.IsZero()
			continue
		}

		break
	}
	return parts, isZero
}

func compatibleStructOrUnion(t1, t2 cc.Type) bool {
	switch t1.Kind() {
	case cc.Struct:
		if t2.Kind() != cc.Struct {
			return false
		}
	case cc.Union:
		if t2.Kind() != cc.Union {
			return false
		}
	default:
		return false
	}

	if tag := t1.Tag(); tag != 0 && t2.Tag() != tag {
		return false
	}

	nf := t1.NumField()
	if t2.NumField() != nf {
		return false
	}

	for i := []int{0}; i[0] < nf; i[0]++ {
		f1 := t1.FieldByIndex(i)
		f2 := t2.FieldByIndex(i)
		nm := f1.Name()
		if f2.Name() != nm {
			return false
		}

		ft1 := f1.Type()
		ft2 := f2.Type()
		if ft1.Size() != ft2.Size() ||
			f1.IsBitField() != f2.IsBitField() ||
			f1.BitFieldOffset() != f2.BitFieldOffset() ||
			f1.BitFieldWidth() != f2.BitFieldWidth() {
			return false
		}

		if !compatibleType(ft1, ft2) {
			return false
		}
	}
	return true
}

func compatibleType(t1, t2 cc.Type) bool {
	if t1.Kind() != t2.Kind() {
		return false
	}

	switch t1.Kind() {
	case cc.Array:
		if t1.Len() != t2.Len() || !compatibleType(t1.Elem(), t2.Elem()) {
			return false
		}
	case cc.Struct, cc.Union:
		if !compatibleStructOrUnion(t1, t2) {
			return false
		}
	}
	return true
}

func (p *project) bitFileType(n cc.Node, bits int) cc.Type {
	switch bits {
	case 8:
		return p.task.cfg.ABI.Type(cc.UChar)
	case 16:
		return p.task.cfg.ABI.Type(cc.UShort)
	case 32:
		return p.task.cfg.ABI.Type(cc.UInt)
	case 64:
		return p.task.cfg.ABI.Type(cc.ULongLong)
	default:
		panic(todo("%v: internal error: %v", n.Position(), bits))
	}
}

func (p *project) isWCharType(t cc.Type) bool {
	if t.IsAliasType() {
		if id := t.AliasDeclarator().Name(); id == idWcharT ||
			p.task.goos == "windows" && id == idWinWchar {
			return true
		}
	}

	return false
}

func isCharType(t cc.Type) bool {
	switch t.Kind() {
	case cc.Char, cc.SChar, cc.UChar:
		return true
	}

	return false
}

func (p *project) initializerFlatten(n *cc.Initializer, lm, tm map[*cc.Initializer][]cc.StringID) (s []*cc.Initializer) {
	switch n.Case {
	case cc.InitializerExpr: // AssignmentExpression
		return append(s, n)
	case cc.InitializerInitList: // '{' InitializerList ',' '}'
		first := true
		for list := n.InitializerList; list != nil; list = list.InitializerList {
			in := list.Initializer
			k := in
			if in.Case != cc.InitializerExpr {
				k = nil
			}
			if first {
				lm[k] = append(lm[k], append(lm[nil], n.Token.Sep)...)
				if k != nil {
					delete(lm, nil)
				}
				first = false
			}
			if list.InitializerList == nil {
				tm[k] = append([]cc.StringID{n.Token3.Sep}, append(tm[nil], tm[k]...)...)
				tm[k] = append(tm[k], append(tm[nil], n.Token3.Sep)...)
				if k != nil {
					delete(tm, nil)
				}
			}
			s = append(s, p.initializerFlatten(in, lm, tm)...)
		}
		return s
	default:
		panic(todo("%v: internal error: %v", n.Position(), n.Case))
	}
}
