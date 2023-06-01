// Copyright 2019 The CC Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Parts of the documentation are modified versions originating in the Go
// project, particularly the reflect package, license of which is reproduced
// below.
// ----------------------------------------------------------------------------
// Copyright 2009 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the GO-LICENSE file.

package cc // import "modernc.org/cc/v3"

import (
	"bytes"
	"fmt"
	"math"
	"sort"
	"strings"
	"sync"
)

var (
	_ Field = (*field)(nil)

	_ Type = (*aliasType)(nil)
	_ Type = (*arrayType)(nil)
	_ Type = (*attributedType)(nil)
	_ Type = (*bitFieldType)(nil)
	_ Type = (*functionType)(nil)
	_ Type = (*pointerType)(nil)
	_ Type = (*structType)(nil)
	_ Type = (*taggedType)(nil)
	_ Type = (*typeBase)(nil)
	_ Type = (*vectorType)(nil)
	_ Type = noType

	bytesBufferPool = sync.Pool{New: func() interface{} { return &bytes.Buffer{} }}

	idBool        = dict.sid("_Bool")
	idImag        = dict.sid("imag")
	idReal        = dict.sid("real")
	idVectorSize  = dict.sid("vector_size")
	idVectorSize2 = dict.sid("__vector_size__")

	noType = &typeBase{}

	_ typeDescriptor = (*DeclarationSpecifiers)(nil)
	_ typeDescriptor = (*SpecifierQualifierList)(nil)
	_ typeDescriptor = (*TypeQualifiers)(nil)
	_ typeDescriptor = noTypeDescriptor

	noTypeDescriptor = &DeclarationSpecifiers{}

	// [0]6.3.1.1-1
	//
	// Every integer type has an integer conversion rank defined as
	// follows:
	intConvRank = [maxKind]int{ // Keep Bool first and sorted by rank.
		Bool:      1,
		Char:      2,
		SChar:     2,
		UChar:     2,
		Short:     3,
		UShort:    3,
		Int:       4,
		UInt:      4,
		Long:      5,
		ULong:     5,
		LongLong:  6,
		ULongLong: 6,
		Int128:    7,
		UInt128:   7,
	}

	complexIntegerTypes = [maxKind]bool{
		ComplexChar:      true,
		ComplexInt:       true,
		ComplexLong:      true,
		ComplexLongLong:  true,
		ComplexShort:     true,
		ComplexUInt:      true,
		ComplexULong:     true,
		ComplexULongLong: true,
		ComplexUShort:    true,
	}

	complexTypes = [maxKind]bool{
		ComplexChar:       true,
		ComplexDouble:     true,
		ComplexFloat:      true,
		ComplexInt:        true,
		ComplexLong:       true,
		ComplexLongDouble: true,
		ComplexLongLong:   true,
		ComplexShort:      true,
		ComplexUInt:       true,
		ComplexULong:      true,
		ComplexULongLong:  true,
		ComplexUShort:     true,
	}

	integerTypes = [maxKind]bool{
		Bool:      true,
		Char:      true,
		Enum:      true,
		Int:       true,
		Long:      true,
		LongLong:  true,
		SChar:     true,
		Short:     true,
		UChar:     true,
		UInt:      true,
		ULong:     true,
		ULongLong: true,
		UShort:    true,
		Int8:      true,
		Int16:     true,
		Int32:     true,
		Int64:     true,
		Int128:    true,
		UInt8:     true,
		UInt16:    true,
		UInt32:    true,
		UInt64:    true,
		UInt128:   true,
	}

	arithmeticTypes = [maxKind]bool{
		Bool:              true,
		Char:              true,
		ComplexChar:       true,
		ComplexDouble:     true,
		ComplexFloat:      true,
		ComplexInt:        true,
		ComplexLong:       true,
		ComplexLongDouble: true,
		ComplexLongLong:   true,
		ComplexShort:      true,
		ComplexUInt:       true,
		ComplexUShort:     true,
		Double:            true,
		Enum:              true,
		Float:             true,
		Int:               true,
		Long:              true,
		LongDouble:        true,
		LongLong:          true,
		SChar:             true,
		Short:             true,
		UChar:             true,
		UInt:              true,
		ULong:             true,
		ULongLong:         true,
		UShort:            true,
		Int8:              true,
		Int16:             true,
		Int32:             true,
		Int64:             true,
		Int128:            true,
		UInt8:             true,
		UInt16:            true,
		UInt32:            true,
		UInt64:            true,
		UInt128:           true,
	}

	realTypes = [maxKind]bool{
		Bool:       true,
		Char:       true,
		Double:     true,
		Enum:       true,
		Float:      true,
		Int128:     true,
		Int:        true,
		Long:       true,
		LongDouble: true,
		LongLong:   true,
		SChar:      true,
		Short:      true,
		UChar:      true,
		UInt:       true,
		ULong:      true,
		ULongLong:  true,
		UShort:     true,
		UInt128:    true,
	}
)

type noStorageClass struct{}

func (noStorageClass) auto() bool        { return false }
func (noStorageClass) extern() bool      { return false }
func (noStorageClass) register() bool    { return false }
func (noStorageClass) static() bool      { return false }
func (noStorageClass) threadLocal() bool { return false }
func (noStorageClass) typedef() bool     { return false }

// InvalidType creates a new invalid type.
func InvalidType() Type {
	return noType
}

// Type is the representation of a C type.
//
// Not all methods apply to all kinds of types. Restrictions, if any, are noted
// in the documentation for each method. Use the Kind method to find out the
// kind of type before calling kind-specific methods. Calling a method
// inappropriate to the kind of type causes a run-time panic.
//
// Calling a method on a type of kind Invalid yields an undefined result, but
// does not panic.
type Type interface {
	//TODO bits()

	// Alias returns the type this type aliases. Non typedef types return
	// themselves.
	Alias() Type

	// Align returns the alignment in bytes of a value of this type when
	// allocated in memory.
	Align() int

	// Attributes returns type's attributes, if any.
	Attributes() []*AttributeSpecifier

	// UnionCommon reports the kind that unifies all union members, if any,
	// or Invalid. For example
	//
	//	union { int i; double d; }
	//
	// Has no unifying kind and will report kind Invalid, but
	//
	//	union { int *p; double *p; }
	//
	// will report kind Ptr.
	//
	// UnionCommon panics if the type's Kind is valid but not Enum.
	UnionCommon() Kind

	// Decay returns itself for non array types and the pointer to array
	// element otherwise.
	Decay() Type

	// Elem returns a type's element type. It panics if the type's Kind is
	// valid but not Array or Ptr.
	Elem() Type

	// EnumType returns the undelying integer type of an enumerated type.  It
	// panics if the type's Kind is valid but not Enum.
	EnumType() Type

	// BitField returns the associated Field of a type. It panics if the
	// type IsBitFieldType returns false.
	BitField() Field

	// FieldAlign returns the alignment in bytes of a value of this type
	// when used as a field in a struct.
	FieldAlign() int

	// FieldByIndex returns the nested field corresponding to the index
	// sequence. It is equivalent to calling Field successively for each
	// index i.  It panics if the type's Kind is valid but not Struct or
	// any complex kind.
	FieldByIndex(index []int) Field

	// FieldByName returns the struct field with the given name and a
	// boolean indicating if the field was found.
	FieldByName(name StringID) (Field, bool)

	// FieldByName2 is like FieldByName but additionally returns the
	// indices that form the path to the field.
	FieldByName2(name StringID) (Field, []int, bool)

	// IsAggregate reports whether type is an aggregate type, [0]6.2.5.
	//
	// 21) Array and structure types are collectively called aggregate types.
	//
	// 37) Note that aggregate type does not include union type because an object
	// with union type can only contain one member at a time.
	IsAggregate() bool

	// IsPacked reports whether type is packed. It panics if the type's
	// Kind is valid but not Struct or Union.
	IsPacked() bool

	// IsIncomplete reports whether type is incomplete.
	IsIncomplete() bool

	// IsComplexIntegerType report whether a type is an integer complex
	// type.
	IsComplexIntegerType() bool

	// IsComplexType report whether a type is a complex type.
	IsComplexType() bool

	// IsArithmeticType report whether a type is an arithmetic type.
	IsArithmeticType() bool

	// IsBitFieldType report whether a type is for a bit field.
	IsBitFieldType() bool

	// IsIntegerType report whether a type is an integer type.
	IsIntegerType() bool

	// IsRealType report whether a type is a real type.
	IsRealType() bool

	// IsScalarType report whether a type is a scalar type.
	IsScalarType() bool

	// HasFlexibleMember reports whether a struct has a flexible array
	// member. It panics if the type's Kind is valid but not Struct or
	// Union.
	//
	// https://en.wikipedia.org/wiki/Flexible_array_member
	HasFlexibleMember() bool

	// IsAliasType returns whether a type is an alias name of another type
	// For eample
	//
	//	typedef int foo;
	//	foo x;	// The type of x reports true from IsAliasType().
	IsAliasType() bool

	// IsAssingmentCompatible reports whether a type can be assigned from rhs. [0], 6.5.16.1.
	IsAssingmentCompatible(rhs Type) bool

	// isAssingmentCompatibleOperand reports whether a type can be assigned from rhs. [0], 6.5.16.1.
	isAssingmentCompatibleOperand(rhs Operand) bool

	// IsCompatible reports whether the two types are compatible. [0], 6.2.7.
	IsCompatible(Type) bool

	isCompatibleIgnoreQualifiers(Type) bool

	// IsCompatibleLayout reports whether the two types have identical layouts.
	IsCompatibleLayout(Type) bool

	// AliasDeclarator returns the typedef declarator of the alias type. It panics
	// if the type is not an alias type.
	AliasDeclarator() *Declarator

	// IsTaggedType returns whether a type is a tagged reference of a enum,
	// struct or union type. For example
	//
	//	struct s { int x; } y;	//  The type of y reports false from IsTaggedType.
	//	struct s z;		//  The type of z reports true from IsTaggedType.
	IsTaggedType() bool

	// IsVariadic reports whether a function type is variadic. It panics if
	// the type's Kind is valid but not Function.
	IsVariadic() bool

	// IsVLA reports whether array is a variable length array. It panics if
	// the type's Kind is valid but not Array.
	IsVLA() bool

	// Kind returns the specific kind of this type.
	Kind() Kind

	// Len returns an array type's length for array types and vector size
	// for vector types.  It panics if the type's Kind is valid but not
	// Array or Vector.
	Len() uintptr

	// LenExpr returns an array type's length expression.  It panics if the
	// type's Kind is valid but not Array or the array is not a VLA.
	LenExpr() *AssignmentExpression

	// NumField returns a struct type's field count.  It panics if the
	// type's Kind is valid but not Struct or any complex kind.
	NumField() int

	// Parameters returns the parameters of a function type. It panics if
	// the type's Kind is valid but not Function.
	Parameters() []*Parameter

	// Real returns the real field of a type. It panics if the type's Kind
	// is valid but not a complex kind.
	Real() Field

	// Imag returns the imaginary field of a type. It panics if the type's
	// Kind is valid but not a complex kind.
	Imag() Field

	// Result returns the result type of a function type. It panics if the
	// type's Kind is valid but not Function.
	Result() Type

	// Size returns the number of bytes needed to store a value of the
	// given type. It panics if type is valid but incomplete.
	Size() uintptr

	// String implements fmt.Stringer.
	String() string

	// Tag returns the tag, of a tagged type or of a struct or union type.
	// Tag panics if the type is not tagged type or a struct or union type.
	Tag() StringID

	// Name returns type name, if any.
	Name() StringID

	// IsAtomic reports whether type has type qualifier "_Atomic".
	IsAtomic() bool

	// hasConst reports whether type has type qualifier "const".
	hasConst() bool

	// Inline reports whether type has function specifier "inline".
	Inline() bool

	IsSignedType() bool

	// noReturn reports whether type has function specifier "_NoReturn".
	noReturn() bool

	// restrict reports whether type has type qualifier "restrict".
	restrict() bool

	setLen(uintptr)
	setFnSpecs(inline, noret bool)
	setKind(Kind)

	string(*bytes.Buffer)

	base() typeBase
	baseP() *typeBase

	underlyingType() Type

	// IsVolatile reports whether type has type qualifier "volatile".
	IsVolatile() bool

	isVectorType() bool
}

// A Field describes a single field in a struct/union.
type Field interface {
	BitFieldBlockFirst() Field
	BitFieldBlockWidth() int
	BitFieldOffset() int
	BitFieldWidth() int
	Declarator() *StructDeclarator
	InUnion() bool // Directly or indirectly
	Index() int
	IsBitField() bool
	IsFlexible() bool // https://en.wikipedia.org/wiki/Flexible_array_member
	Mask() uint64
	Name() StringID  // Can be zero.
	Offset() uintptr // In bytes from the beginning of the struct/union.
	Padding() int    // In bytes after the field. N/A for bit fields, fields preceding bit fields or union fields.
	Parent() Type    // The struct/union type that contains the field.
	Promote() Type
	Type() Type // Field type.
}

// A Kind represents the specific kind of type that a Type represents. The zero Kind is not a valid kind.
type Kind uint

const (
	maxTypeSpecifiers = 4 // eg. long long unsigned int
)

var (
	validTypeSpecifiers = map[[maxTypeSpecifiers]TypeSpecifierCase]byte{

		// [2], 6.7.2 Type specifiers, 2.

		//TODO atomic-type-specifier
		{TypeSpecifierBool}:                         byte(Bool),
		{TypeSpecifierChar, TypeSpecifierSigned}:    byte(SChar),
		{TypeSpecifierChar, TypeSpecifierUnsigned}:  byte(UChar),
		{TypeSpecifierChar}:                         byte(Char),
		{TypeSpecifierDouble, TypeSpecifierComplex}: byte(ComplexDouble),
		{TypeSpecifierDouble}:                       byte(Double),
		{TypeSpecifierEnum}:                         byte(Enum),
		{TypeSpecifierFloat, TypeSpecifierComplex}:  byte(ComplexFloat),
		{TypeSpecifierFloat}:                        byte(Float),
		{TypeSpecifierInt, TypeSpecifierLong, TypeSpecifierLong, TypeSpecifierSigned}:   byte(LongLong),
		{TypeSpecifierInt, TypeSpecifierLong, TypeSpecifierLong, TypeSpecifierUnsigned}: byte(ULongLong),
		{TypeSpecifierInt, TypeSpecifierLong, TypeSpecifierLong}:                        byte(LongLong),
		{TypeSpecifierInt, TypeSpecifierLong, TypeSpecifierSigned}:                      byte(Long),
		{TypeSpecifierInt, TypeSpecifierLong, TypeSpecifierUnsigned}:                    byte(ULong),
		{TypeSpecifierInt, TypeSpecifierLong}:                                           byte(Long),
		{TypeSpecifierInt, TypeSpecifierSigned}:                                         byte(Int),
		{TypeSpecifierInt, TypeSpecifierUnsigned}:                                       byte(UInt),
		{TypeSpecifierInt}: byte(Int),
		{TypeSpecifierLong, TypeSpecifierDouble, TypeSpecifierComplex}: byte(ComplexLongDouble),
		{TypeSpecifierLong, TypeSpecifierDouble}:                       byte(LongDouble),
		{TypeSpecifierLong, TypeSpecifierLong, TypeSpecifierSigned}:    byte(LongLong),
		{TypeSpecifierLong, TypeSpecifierLong, TypeSpecifierUnsigned}:  byte(ULongLong),
		{TypeSpecifierLong, TypeSpecifierLong}:                         byte(LongLong),
		{TypeSpecifierLong, TypeSpecifierSigned}:                       byte(Long),
		{TypeSpecifierLong, TypeSpecifierUnsigned}:                     byte(ULong),
		{TypeSpecifierLong}: byte(Long),
		{TypeSpecifierShort, TypeSpecifierInt, TypeSpecifierSigned}:   byte(Short),
		{TypeSpecifierShort, TypeSpecifierInt, TypeSpecifierUnsigned}: byte(UShort),
		{TypeSpecifierShort, TypeSpecifierInt}:                        byte(Short),
		{TypeSpecifierShort, TypeSpecifierSigned}:                     byte(Short),
		{TypeSpecifierShort, TypeSpecifierUnsigned}:                   byte(UShort),
		{TypeSpecifierShort}:                                          byte(Short),
		{TypeSpecifierSigned}:                                         byte(Int),
		{TypeSpecifierStructOrUnion}:                                  byte(Struct),
		{TypeSpecifierTypedefName}:                                    byte(TypedefName), //TODO
		{TypeSpecifierUnsigned}:                                       byte(UInt),
		{TypeSpecifierVoid}:                                           byte(Void),

		// GCC Extensions.

		{TypeSpecifierChar, TypeSpecifierComplex}:                         byte(ComplexChar),
		{TypeSpecifierComplex}:                                            byte(ComplexDouble),
		{TypeSpecifierDecimal128}:                                         byte(Decimal128),
		{TypeSpecifierDecimal32}:                                          byte(Decimal32),
		{TypeSpecifierDecimal64}:                                          byte(Decimal64),
		{TypeSpecifierFloat128}:                                           byte(Float128),
		{TypeSpecifierFloat32x}:                                           byte(Float32x),
		{TypeSpecifierFloat32}:                                            byte(Float32),
		{TypeSpecifierFloat64x}:                                           byte(Float64x),
		{TypeSpecifierFloat64}:                                            byte(Float64),
		{TypeSpecifierInt, TypeSpecifierComplex}:                          byte(ComplexInt),
		{TypeSpecifierInt, TypeSpecifierLong, TypeSpecifierComplex}:       byte(ComplexLong),
		{TypeSpecifierInt8, TypeSpecifierSigned}:                          byte(Int8),
		{TypeSpecifierInt16, TypeSpecifierSigned}:                         byte(Int16),
		{TypeSpecifierInt32, TypeSpecifierSigned}:                         byte(Int32),
		{TypeSpecifierInt64, TypeSpecifierSigned}:                         byte(Int64),
		{TypeSpecifierInt128, TypeSpecifierSigned}:                        byte(Int128),
		{TypeSpecifierInt8, TypeSpecifierUnsigned}:                        byte(UInt8),
		{TypeSpecifierInt16, TypeSpecifierUnsigned}:                       byte(UInt16),
		{TypeSpecifierInt32, TypeSpecifierUnsigned}:                       byte(UInt32),
		{TypeSpecifierInt64, TypeSpecifierUnsigned}:                       byte(UInt64),
		{TypeSpecifierInt128, TypeSpecifierUnsigned}:                      byte(UInt128),
		{TypeSpecifierInt8}:                                               byte(Int8),
		{TypeSpecifierInt16}:                                              byte(Int16),
		{TypeSpecifierInt32}:                                              byte(Int32),
		{TypeSpecifierInt64}:                                              byte(Int64),
		{TypeSpecifierInt128}:                                             byte(Int128),
		{TypeSpecifierLong, TypeSpecifierComplex}:                         byte(ComplexLong),
		{TypeSpecifierLong, TypeSpecifierDouble, TypeSpecifierFloat64x}:   byte(LongDouble),
		{TypeSpecifierLong, TypeSpecifierLong, TypeSpecifierComplex}:      byte(ComplexLongLong),
		{TypeSpecifierShort, TypeSpecifierComplex}:                        byte(ComplexUShort),
		{TypeSpecifierShort, TypeSpecifierUnsigned, TypeSpecifierComplex}: byte(ComplexShort),
		{TypeSpecifierTypeofExpr}:                                         byte(typeofExpr), //TODO
		{TypeSpecifierTypeofType}:                                         byte(typeofType), //TODO
		{TypeSpecifierUnsigned, TypeSpecifierComplex}:                     byte(ComplexUInt),
	}
)

type typeDescriptor interface {
	Node
	auto() bool
	extern() bool
	register() bool
	static() bool
	threadLocal() bool
	typedef() bool
}

type storageClass byte

const (
	fAuto storageClass = 1 << iota
	fExtern
	fRegister
	fStatic
	fThreadLocal
	fTypedef
)

type flag uint16

const (
	// function specifier
	fInline flag = 1 << iota //TODO should go elsewhere
	fNoReturn

	// type qualifier
	fAtomic
	fConst
	fRestrict
	fVolatile

	// other
	fIncomplete
	fSigned // Valid only for integer types.
	fPacked
	fAligned // __attribute__((aligned(n))) applied.
)

type typeBase struct {
	size uintptr

	flags flag

	align      byte
	fieldAlign byte
	kind       byte
}

func (t *typeBase) check(ctx *context, td typeDescriptor, defaultInt bool) (r Type) {
	k0 := t.kind
	var alignmentSpecifiers []*AlignmentSpecifier
	var attributeSpecifiers []*AttributeSpecifier
	var typeSpecifiers []*TypeSpecifier
	switch n := td.(type) {
	case *DeclarationSpecifiers:
		for ; n != nil; n = n.DeclarationSpecifiers {
			switch n.Case {
			case DeclarationSpecifiersStorage: // StorageClassSpecifier DeclarationSpecifiers
				// nop
			case DeclarationSpecifiersTypeSpec: // TypeSpecifier DeclarationSpecifiers
				typeSpecifiers = append(typeSpecifiers, n.TypeSpecifier.list()...)
			case DeclarationSpecifiersTypeQual: // TypeQualifier DeclarationSpecifiers
				// nop
			case DeclarationSpecifiersFunc: // FunctionSpecifier DeclarationSpecifiers
				// nop
			case DeclarationSpecifiersAlignSpec: // AlignmentSpecifier DeclarationSpecifiers
				alignmentSpecifiers = append(alignmentSpecifiers, n.AlignmentSpecifier)
			case DeclarationSpecifiersAttribute: // AttributeSpecifier DeclarationSpecifiers
				attributeSpecifiers = append(attributeSpecifiers, n.AttributeSpecifier)
			default:
				panic(internalError())
			}
		}
	case *SpecifierQualifierList:
		for ; n != nil; n = n.SpecifierQualifierList {
			switch n.Case {
			case SpecifierQualifierListTypeSpec: // TypeSpecifier SpecifierQualifierList
				typeSpecifiers = append(typeSpecifiers, n.TypeSpecifier.list()...)
			case SpecifierQualifierListTypeQual: // TypeQualifier SpecifierQualifierList
				// nop
			case SpecifierQualifierListAlignSpec: // AlignmentSpecifier SpecifierQualifierList
				alignmentSpecifiers = append(alignmentSpecifiers, n.AlignmentSpecifier)
			case SpecifierQualifierListAttribute: // AttributeSpecifier SpecifierQualifierList
				attributeSpecifiers = append(attributeSpecifiers, n.AttributeSpecifier)
			default:
				panic(internalError())
			}
		}
	case *TypeQualifiers:
		for ; n != nil; n = n.TypeQualifiers {
			if n.Case == TypeQualifiersAttribute {
				attributeSpecifiers = append(attributeSpecifiers, n.AttributeSpecifier)
			}
		}
	default:
		panic(internalError())
	}

	if len(typeSpecifiers) > maxTypeSpecifiers {
		ctx.err(typeSpecifiers[maxTypeSpecifiers].Position(), "too many type specifiers")
		typeSpecifiers = typeSpecifiers[:maxTypeSpecifiers]
	}

	sort.Slice(typeSpecifiers, func(i, j int) bool {
		return typeSpecifiers[i].Case < typeSpecifiers[j].Case
	})
	var k [maxTypeSpecifiers]TypeSpecifierCase
	for i, v := range typeSpecifiers {
		k[i] = v.Case
	}
	switch {
	case len(typeSpecifiers) == 0:
		if !defaultInt {
			break
		}

		k[0] = TypeSpecifierInt
		fallthrough
	default:
		var ok bool
		if t.kind, ok = validTypeSpecifiers[k]; !ok {
			s := k[:]
			for len(s) > 1 && s[len(s)-1] == TypeSpecifierVoid {
				s = s[:len(s)-1]
			}
			ctx.err(td.Position(), "invalid type specifiers combination: %v", s)
			return t
		}

		if t.kind == byte(LongDouble) && ctx.cfg.LongDoubleIsDouble {
			t.kind = byte(Double)
		}
	}
	switch len(alignmentSpecifiers) {
	case 0:
		//TODO set alignment from model
	case 1:
		align := alignmentSpecifiers[0].align()
		if align > math.MaxUint8 {
			panic(internalError())
		}
		t.align = byte(align)
		t.fieldAlign = t.align
	default:
		ctx.err(alignmentSpecifiers[1].Position(), "multiple alignment specifiers")
	}

	abi := ctx.cfg.ABI
	switch k := t.Kind(); k {
	case typeofExpr, typeofType, Struct, Union, Enum:
		// nop
	default:
		if integerTypes[k] && abi.isSignedInteger(k) {
			t.flags |= fSigned
		}
		if v, ok := abi.Types[k]; ok {
			t.size = uintptr(abi.size(k))
			if t.align != 0 {
				break
			}

			t.align = byte(v.Align)
			t.fieldAlign = byte(v.FieldAlign)
			break
		}

		//TODO ctx.err(td.Position(), "missing model item for %s", t.Kind())
	}

	typ := Type(t)
	switch k := t.Kind(); k {
	case TypedefName:
		ts := typeSpecifiers[0]
		tok := ts.Token
		nm := tok.Value
		d := ts.resolvedIn.typedef(nm, tok)
		typ = &aliasType{typeBase: t, nm: nm, d: d}
	case Enum:
		typ = typeSpecifiers[0].EnumSpecifier.typ
	case Struct, Union:
		t.kind = k0
		typ = typeSpecifiers[0].StructOrUnionSpecifier.typ
	case typeofExpr, typeofType:
		typ = typeSpecifiers[0].typ
	default:
		if complexTypes[k] {
			typ = ctx.cfg.ABI.Type(k)
		}
	}
	return typ
}

func (t *typeBase) setAligned(n int) {
	t.flags |= fAligned
	t.align = byte(n)
}

// IsAssingmentCompatible implements Type.
func (t *typeBase) IsAssingmentCompatible(rhs Type) (r bool) {
	// defer func() {
	// 	rhs0 := rhs
	// 	if !r {
	// 		trc("TRACE %v <- %v\n%s", t, rhs0, debug.Stack()) //TODO-
	// 	}
	// }()
	if t == nil || rhs == nil {
		return false
	}

	if t == rhs {
		return true
	}
	// [0], 6.5.16.1 Simple assignment
	//
	// 1 One of the following shall hold:
	//
	// — the left operand has qualified or unqualified arithmetic type and the
	// right has arithmetic type;
	//
	// — the left operand has a qualified or unqualified version of a structure or
	// union type compatible with the type of the right;
	//
	// — both operands are pointers to qualified or unqualified versions of
	// compatible types, and the type pointed to by the left has all the qualifiers
	// of the type pointed to by the right;
	//
	// — one operand is a pointer to an object or incomplete type and the other is
	// a pointer to a qualified or unqualified version of void, and the type
	// pointed to by the left has all the qualifiers of the type pointed to by the
	// right;
	//
	// — the left operand is a pointer and the right is a null pointer constant; or
	//
	// — the left operand has type _Bool and the right is a pointer.
	if t.IsArithmeticType() && rhs.IsArithmeticType() {
		return true
	}

	if x, ok := rhs.(*aliasType); ok {
		if x.nm == idBool && rhs.Kind() == Ptr {
			return true
		}
	}

	if t.IsIntegerType() && rhs.Kind() == Ptr {
		// 6.3.2.3 Pointers
		//
		// 6 Any pointer type may be converted to an integer type. Except as previously specified, the
		// result is implementation-defined. If the result cannot be represented in the integer type,
		// the behavior is undefined. The result need not be in the range of values of any integer
		// type.
		return true
	}

	return false
}

// isAssingmentCompatibleOperand implements Type.
func (t *typeBase) isAssingmentCompatibleOperand(rhs Operand) (r bool) {
	// defer func() {
	// 	rhs0 := rhs
	// 	if !r {
	// 		trc("TRACE %v <- %v %v\n%s", t, rhs0.Value(), rhs0.Type(), debug.Stack()) //TODO-
	// 	}
	// }()
	if t == nil || rhs == nil {
		return false
	}

	rhsType := rhs.Type().Decay()
	if t == rhsType {
		return true
	}

	return t.IsAssingmentCompatible(rhsType)
}

// IsCompatible implements Type.
func (t *typeBase) IsCompatible(u Type) (r bool) {
	// defer func() {
	// 	u0 := u
	// 	if !r {
	// 		trc("TRACE %v <- %v\n%s", t, u0, debug.Stack()) //TODO-
	// 	}
	// }()
	if t == nil || u == nil {
		return false
	}

	if t == u {
		return true
	}

	if !t.IsScalarType() && t.Kind() != Void {
		panic(internalErrorf("IsCompatible of invalid type: %v", t.Kind()))
	}

	v := u.base()
	// [0], 6.7.3
	//
	// 9 For two qualified types to be compatible, both shall have the identically
	// qualified version of a compatible type; the order of type qualifiers within
	// a list of specifiers or qualifiers does not affect the specified type.
	if t.flags&(fAtomic|fConst|fRestrict|fVolatile|fSigned) != v.flags&(fAtomic|fConst|fRestrict|fVolatile|fSigned) {
		return false
	}

	if t.Kind() == u.Kind() {
		return true
	}

	if t.Kind() == Enum && u.IsIntegerType() && t.Size() == u.Size() {
		return true
	}

	return t.IsIntegerType() && u.Kind() == Enum && t.Size() == u.Size()
}

// isCompatibleIgnoreQualifiers implements Type.
func (t *typeBase) isCompatibleIgnoreQualifiers(u Type) (r bool) {
	// defer func() {
	// 	u0 := u
	// 	if !r {
	// 		trc("TRACE %v <- %v\n%s", t, u0, debug.Stack()) //TODO-
	// 	}
	// }()
	if t == nil || u == nil {
		return false
	}

	if t == u {
		return true
	}

	if !t.IsScalarType() && t.Kind() != Void {
		panic(internalErrorf("isCompatibleIgnoreQualifiers of invalid type: %v", t.Kind()))
	}

	if t.Kind() == u.Kind() {
		return true
	}

	if t.Kind() == Enum && u.IsIntegerType() && t.Size() == u.Size() {
		return true
	}

	return t.IsIntegerType() && u.Kind() == Enum && t.Size() == u.Size()
}

// IsCompatibleLayout implements Type.
func (t *typeBase) IsCompatibleLayout(u Type) bool {
	if t == u {
		return true
	}

	if !t.IsScalarType() {
		panic(internalErrorf("%s: IsCompatibleLayout of invalid type", t.Kind()))
	}

	if t.Kind() == u.Kind() {
		return true
	}

	if t.Kind() == Enum && u.IsIntegerType() && t.Size() == u.Size() {
		return true
	}

	return t.IsIntegerType() && u.Kind() == Enum && t.Size() == u.Size()
}

// IsPacked implements Type.
func (t *typeBase) IsPacked() bool {
	return t.flags&fPacked != 0
}

// UnionCommon implements Type.
func (t *typeBase) UnionCommon() Kind {
	panic(internalErrorf("%s: UnionCommon of invalid type", t.Kind()))
}

// IsAtomic implements Type.
func (t *typeBase) IsAtomic() bool { return t.flags&fAtomic != 0 }

// Attributes implements Type.
func (t *typeBase) Attributes() (a []*AttributeSpecifier) { return nil }

// Alias implements Type.
func (t *typeBase) Alias() Type { return t }

// IsAliasType implements Type.
func (t *typeBase) IsAliasType() bool { return false }

func (t *typeBase) AliasDeclarator() *Declarator {
	panic(internalErrorf("%s: AliasDeclarator of invalid type", t.Kind()))
}

// IsTaggedType implements Type.
func (t *typeBase) IsTaggedType() bool { return false }

// Align implements Type.
func (t *typeBase) Align() int { return int(t.align) }

// BitField implements Type.
func (t *typeBase) BitField() Field {
	if t.Kind() == Invalid {
		return nil
	}

	panic(internalErrorf("%s: BitField of invalid type", t.Kind()))
}

// base implements Type.
func (t *typeBase) base() typeBase { return *t }

// baseP implements Type.
func (t *typeBase) baseP() *typeBase { return t }

// isVectorType implements Type.
func (t *typeBase) isVectorType() bool {
	return false
}

// Decay implements Type.
func (t *typeBase) Decay() Type {
	if t.Kind() != Array {
		return t
	}

	panic(internalErrorf("%s: Decay of invalid type", t.Kind()))
}

// Elem implements Type.
func (t *typeBase) Elem() Type {
	if t.Kind() == Invalid {
		return t
	}

	panic(internalErrorf("%s: Elem of invalid type", t.Kind()))
}

// EnumType implements Type.
func (t *typeBase) EnumType() Type {
	if t.Kind() == Invalid {
		return t
	}

	panic(internalErrorf("%s: EnumType of invalid type", t.Kind()))
}

// hasConst implements Type.
func (t *typeBase) hasConst() bool { return t.flags&fConst != 0 }

// FieldAlign implements Type.
func (t *typeBase) FieldAlign() int { return int(t.fieldAlign) }

// FieldByIndex implements Type.
func (t *typeBase) FieldByIndex([]int) Field {
	if t.Kind() == Invalid {
		return nil
	}

	panic(internalErrorf("%s: FieldByIndex of invalid type", t.Kind()))
}

// NumField implements Type.
func (t *typeBase) NumField() int {
	if t.Kind() == Invalid {
		return 0
	}

	panic(internalErrorf("%s: NumField of invalid type", t.Kind()))
}

// FieldByName implements Type.
func (t *typeBase) FieldByName(StringID) (Field, bool) {
	if t.Kind() == Invalid {
		return nil, false
	}

	panic(internalErrorf("%s: FieldByName of invalid type", t.Kind()))
}

// FieldByName2 implements Type.
func (t *typeBase) FieldByName2(StringID) (Field, []int, bool) {
	if t.Kind() == Invalid {
		return nil, nil, false
	}

	panic(internalErrorf("%s: FieldByName2 of invalid type", t.Kind()))
}

// IsIncomplete implements Type.
func (t *typeBase) IsIncomplete() bool { return t.flags&fIncomplete != 0 }

// IsAggregate implements Type.
func (t *typeBase) IsAggregate() bool { return t.Kind() == Array || t.Kind() == Struct }

// Inline implements Type.
func (t *typeBase) Inline() bool { return t.flags&fInline != 0 }

// IsIntegerType implements Type.
func (t *typeBase) IsIntegerType() bool { return integerTypes[t.kind] }

// IsArithmeticType implements Type.
func (t *typeBase) IsArithmeticType() bool { return arithmeticTypes[t.Kind()] }

// IsComplexType implements Type.
func (t *typeBase) IsComplexType() bool { return complexTypes[t.Kind()] }

// IsComplexIntegerType implements Type.
func (t *typeBase) IsComplexIntegerType() bool { return complexIntegerTypes[t.Kind()] }

// IsBitFieldType implements Type.
func (t *typeBase) IsBitFieldType() bool { return false }

// IsRealType implements Type.
func (t *typeBase) IsRealType() bool { return realTypes[t.Kind()] }

// IsScalarType implements Type.
func (t *typeBase) IsScalarType() bool {
	return (t.IsArithmeticType() || t.Kind() == Ptr) && !t.isVectorType()
}

// HasFlexibleMember implements Type.
func (t *typeBase) HasFlexibleMember() bool {
	if t.Kind() == Invalid {
		return false
	}

	panic(internalErrorf("%s: HasFlexibleMember of invalid type", t.Kind()))
}

// IsSignedType implements Type.
func (t *typeBase) IsSignedType() bool {
	if !integerTypes[t.kind] {
		panic(internalErrorf("%s: IsSignedType of non-integer type", t.Kind()))
	}

	return t.flags&fSigned != 0
}

// IsVariadic implements Type.
func (t *typeBase) IsVariadic() bool {
	if t.Kind() == Invalid {
		return false
	}

	panic(internalErrorf("%s: IsVariadic of invalid type", t.Kind()))
}

// IsVLA implements Type.
func (t *typeBase) IsVLA() bool {
	if t.Kind() == Invalid {
		return false
	}

	panic(internalErrorf("%s: IsVLA of invalid type", t.Kind()))
}

// Kind implements Type.
func (t *typeBase) Kind() Kind { return Kind(t.kind) }

// Len implements Type.
func (t *typeBase) Len() uintptr { panic(internalErrorf("%s: Len of non-array type", t.Kind())) }

// LenExpr implements Type.
func (t *typeBase) LenExpr() *AssignmentExpression {
	panic(internalErrorf("%s: LenExpr of non-array type", t.Kind()))
}

// noReturn implements Type.
func (t *typeBase) noReturn() bool { return t.flags&fNoReturn != 0 }

// restrict implements Type.
func (t *typeBase) restrict() bool { return t.flags&fRestrict != 0 }

// Parameters implements Type.
func (t *typeBase) Parameters() []*Parameter {
	if t.Kind() == Invalid {
		return nil
	}

	panic(internalErrorf("%s: Parameters of invalid type", t.Kind()))
}

// Result implements Type.
func (t *typeBase) Result() Type {
	if t.Kind() == Invalid {
		return noType
	}

	panic(internalErrorf("%s: Result of invalid type", t.Kind()))
}

// Real implements Type
func (t *typeBase) Real() Field {
	if t.Kind() == Invalid {
		return nil
	}

	panic(internalErrorf("%s: Real of invalid type", t.Kind()))
}

// Imag implements Type
func (t *typeBase) Imag() Field {
	if t.Kind() == Invalid {
		return nil
	}

	panic(internalErrorf("%s: Imag of invalid type", t.Kind()))
}

// Size implements Type.
func (t *typeBase) Size() uintptr {
	if t.IsIncomplete() {
		panic(internalError())
	}

	return t.size
}

// setLen implements Type.
func (t *typeBase) setLen(uintptr) {
	if t.Kind() == Invalid {
		return
	}

	panic(internalErrorf("%s: setLen of non-array type", t.Kind()))
}

// setFnSpecs implements Type.
func (t *typeBase) setFnSpecs(inline, noret bool) {
	t.flags &^= fInline | fNoReturn
	if inline {
		t.flags |= fInline
	}
	if noret {
		t.flags |= fNoReturn
	}
}

// setKind implements Type.
func (t *typeBase) setKind(k Kind) { t.kind = byte(k) }

// underlyingType implements Type.
func (t *typeBase) underlyingType() Type { return t }

// IsVolatile implements Type.
func (t *typeBase) IsVolatile() bool { return t.flags&fVolatile != 0 }

// String implements Type.
func (t *typeBase) String() string {
	b := bytesBufferPool.Get().(*bytes.Buffer)
	defer func() { b.Reset(); bytesBufferPool.Put(b) }()
	t.string(b)
	return strings.TrimSpace(b.String())
}

// Name implements Type.
func (t *typeBase) Name() StringID { return 0 }

// Tag implements Type.
func (t *typeBase) Tag() StringID {
	panic(internalErrorf("%s: Tag of invalid type", t.Kind()))
}

// string implements Type.
func (t *typeBase) string(b *bytes.Buffer) {
	spc := ""
	if t.IsAtomic() {
		b.WriteString("atomic")
		spc = " "
	}
	if t.hasConst() {
		b.WriteString(spc)
		b.WriteString("const")
		spc = " "
	}
	if t.Inline() {
		b.WriteString(spc)
		b.WriteString("inline")
		spc = " "
	}
	if t.noReturn() {
		b.WriteString(spc)
		b.WriteString("_NoReturn")
		spc = " "
	}
	if t.restrict() {
		b.WriteString(spc)
		b.WriteString("restrict")
		spc = " "
	}
	if t.IsVolatile() {
		b.WriteString(spc)
		b.WriteString("volatile")
		spc = " "
	}
	b.WriteString(spc)
	switch k := t.Kind(); k {
	case Enum:
		b.WriteString("enum")
	case Invalid:
		// nop
	case Struct:
		b.WriteString("struct")
	case Union:
		b.WriteString("union")
	case Ptr:
		b.WriteString("pointer")
	case typeofExpr, typeofType:
		panic(internalError())
	default:
		b.WriteString(k.String())
	}
}

type attributedType struct {
	Type
	attr []*AttributeSpecifier
}

// Alias implements Type.
func (t *attributedType) Alias() Type { return t }

// String implements Type.
func (t *attributedType) String() string {
	b := bytesBufferPool.Get().(*bytes.Buffer)
	defer func() { b.Reset(); bytesBufferPool.Put(b) }()
	t.string(b)
	return strings.TrimSpace(b.String())
}

// string implements Type.
func (t *attributedType) string(b *bytes.Buffer) {
	t.Type.string(b)
	for _, v := range t.attr {
		b.WriteString(nodeSource(v))
	}
}

// Attributes implements Type.
func (t *attributedType) Attributes() []*AttributeSpecifier { return t.attr }

type pointerType struct {
	typeBase

	elem           Type
	typeQualifiers Type
}

// IsAssingmentCompatible implements Type.
func (t *pointerType) IsAssingmentCompatible(rhs Type) (r bool) {
	// defer func() {
	// 	rhs0 := rhs
	// 	if !r {
	// 		trc("TRACE %v <- %v\n%s", t, rhs0, debug.Stack()) //TODO-
	// 	}
	// }()
	if t == nil || rhs == nil {
		return false
	}

	if rhs = rhs.Alias().Decay(); t == rhs {
		return true
	}

	// [0], 6.5.16.1 Simple assignment
	//
	// 1 One of the following shall hold:
	//
	// — the left operand has qualified or unqualified arithmetic type and the
	// right has arithmetic type;
	//
	// — the left operand has a qualified or unqualified version of a structure or
	// union type compatible with the type of the right;
	//
	// — both operands are pointers to qualified or unqualified versions of
	// compatible types, and the type pointed to by the left has all the qualifiers
	// of the type pointed to by the right;
	//
	// — one operand is a pointer to an object or incomplete type and the other is
	// a pointer to a qualified or unqualified version of void, and the type
	// pointed to by the left has all the qualifiers of the type pointed to by the
	// right;
	//
	// — the left operand is a pointer and the right is a null pointer constant; or
	//
	// — the left operand has type _Bool and the right is a pointer.

	if rhs.Kind() == Ptr {
		v := rhs.(*pointerType)
		a := t.Elem().Alias().Decay()
		b := v.Elem().Alias().Decay()
		// — one operand is a pointer to an object or incomplete type and the other is
		// a pointer to a qualified or unqualified version of void, and the type
		// pointed to by the left has all the qualifiers of the type pointed to by the
		// right;
		if a.Kind() == Void || b.Kind() == Void {
			return true
		}

		x := a.base().flags & (fAtomic | fConst | fRestrict | fVolatile)
		y := b.base().flags & (fAtomic | fConst | fRestrict | fVolatile)
		if x&y == y {
			// — both operands are pointers to qualified or unqualified versions of
			// compatible types, and the type pointed to by the left has all the qualifiers
			// of the type pointed to by the right;
			if a.underlyingType() != nil && b.underlyingType() != nil && a.isCompatibleIgnoreQualifiers(b) {
				return true
			}

			if a.IsIncomplete() || b.IsIncomplete() && a.Kind() == b.Kind() {
				return true
			}

			if a.IsIntegerType() && b.IsIntegerType() {
				return true
			}
		}
		// trc("a %T %[1]v, x %#x, b %T %[3]v, y %#x, x&y %#x", a, x, b, y, x&y)
		// trc("a %+v, b%+v", a.base(), b.base())
		return false
	}
	return rhs.Kind() == Function && t.Elem().IsAssingmentCompatible(rhs)
}

// isAssingmentCompatibleOperand implements Type.
func (t *pointerType) isAssingmentCompatibleOperand(rhs Operand) (r bool) {
	// defer func() {
	// 	rhs0 := rhs
	// 	if !r {
	// 		trc("TRACE %v <- %v %v\n%s", t, rhs0.Value(), rhs0.Type(), debug.Stack()) //TODO-
	// 	}
	// }()
	if t == nil || rhs == nil {
		return false
	}

	rhsType := rhs.Type()
	if rhsType.Kind() == Function {
		if t.Elem().Kind() == Void {
			return true
		}

		return t.Elem().IsCompatible(rhsType)
	}

	// — the left operand is a pointer and the right is a null pointer constant; or
	return rhs.IsZero() || t.IsAssingmentCompatible(rhsType)
}

// IsCompatible implements Type.
func (t *pointerType) IsCompatible(u Type) (r bool) {
	// defer func() {
	// 	u0 := u
	// 	if !r {
	// 		trc("TRACE %v <- %v\n%s", t, u0, debug.Stack()) //TODO-
	// 	}
	// }()
	if t == nil || u == nil {
		return false
	}

	if t == u {
		return true
	}

	if u = u.Alias().Decay(); t == u {
		return true
	}

	if u.Kind() != Ptr {
		return false
	}

	v := u.(*pointerType)
	// [0], 6.7.5.1
	//
	// 2 For two pointer types to be compatible, both shall be identically
	// qualified and both shall be pointers to compatible types.;
	if t.typeBase.flags&(fAtomic|fConst|fRestrict|fVolatile|fSigned) != v.typeBase.flags&(fAtomic|fConst|fRestrict|fVolatile|fSigned) {
		return false
	}

	return t.Elem().IsCompatible(v.Elem())
}

// isCompatibleIgnoreQualifiers implements Type.
func (t *pointerType) isCompatibleIgnoreQualifiers(u Type) (r bool) {
	// defer func() {
	// 	u0 := u
	// 	if !r {
	// 		trc("TRACE %v <- %v\n%s", t, u0, debug.Stack()) //TODO-
	// 	}
	// }()
	if t == nil || u == nil {
		return false
	}

	if t == u {
		return true
	}

	if u = u.Alias().Decay(); t == u {
		return true
	}

	if u.Kind() != Ptr {
		return false
	}

	v := u.(*pointerType)
	if t.Elem().Kind() == Void || v.Elem().Kind() == Void {
		return true
	}

	return t.Elem().isCompatibleIgnoreQualifiers(v.Elem())
}

// Alias implements Type.
func (t *pointerType) Alias() Type { return t }

// Attributes implements Type.
func (t *pointerType) Attributes() (a []*AttributeSpecifier) { return t.elem.Attributes() }

// Decay implements Type.
func (t *pointerType) Decay() Type { return t }

// Elem implements Type.
func (t *pointerType) Elem() Type { return t.elem }

// underlyingType implements Type.
func (t *pointerType) underlyingType() Type { return t }

// String implements Type.
func (t *pointerType) String() string {
	b := bytesBufferPool.Get().(*bytes.Buffer)
	defer func() { b.Reset(); bytesBufferPool.Put(b) }()
	t.string(b)
	return strings.TrimSpace(b.String())
}

// string implements Type.
func (t *pointerType) string(b *bytes.Buffer) {
	if t := t.typeQualifiers; t != nil {
		t.string(b)
	}
	b.WriteString("pointer to ")
	t.Elem().string(b)
}

type arrayType struct {
	typeBase

	expr   *AssignmentExpression
	decay  Type
	elem   Type
	length uintptr

	vla bool
}

// IsAssingmentCompatible implements Type.
func (t *arrayType) IsAssingmentCompatible(rhs Type) (r bool) {
	// defer func() {
	// 	rhs0 := rhs
	// 	if !r {
	// 		trc("TRACE %v <- %v\n%s", t, rhs0, debug.Stack()) //TODO-
	// 	}
	// }()
	if t == nil || rhs == nil {
		return false
	}

	if rhs = rhs.Alias().Decay(); t == rhs {
		return true
	}

	// [0], 6.5.16.1 Simple assignment
	//
	// 1 One of the following shall hold:
	//
	// — the left operand has qualified or unqualified arithmetic type and the
	// right has arithmetic type;
	//
	// — the left operand has a qualified or unqualified version of a structure or
	// union type compatible with the type of the right;
	//
	// — both operands are pointers to qualified or unqualified versions of
	// compatible types, and the type pointed to by the left has all the qualifiers
	// of the type pointed to by the right;
	//
	// — one operand is a pointer to an object or incomplete type and the other is
	// a pointer to a qualified or unqualified version of void, and the type
	// pointed to by the left has all the qualifiers of the type pointed to by the
	// right;
	//
	// — the left operand is a pointer and the right is a null pointer constant; or
	//
	// — the left operand has type _Bool and the right is a pointer.
	if rhs.Kind() == Array {
		rhs = rhs.Decay()
	}

	return t.Decay().IsAssingmentCompatible(t)
}

// isAssingmentCompatibleOperand implements Type.
func (t *arrayType) isAssingmentCompatibleOperand(rhs Operand) (r bool) {
	// defer func() {
	// 	rhs0 := rhs
	// 	if !r {
	// 		trc("TRACE %v <- %v %v\n%s", t, rhs0.Value(), rhs0.Type(), debug.Stack()) //TODO-
	// 	}
	// }()
	if t == nil || rhs == nil {
		return false
	}

	return t.IsAssingmentCompatible(rhs.Type())
}

// IsCompatible implements Type.
func (t *arrayType) IsCompatible(u Type) (r bool) {
	// defer func() {
	// 	u0 := u
	// 	if !r {
	// 		trc("TRACE %v <- %v\n%s", t, u0, debug.Stack()) //TODO-
	// 	}
	// }()
	if t == nil || u == nil {
		return false
	}

	if u = u.Alias().Decay(); t == u {
		return true
	}

	if t.vla || u.Kind() != Array {
		return false
	}

	v := u.(*arrayType)
	// [0], 6.7.5.2
	//
	// 6 For two array types to be compatible, both shall have compatible element
	// types, and if both size specifiers are present, and are integer constant
	// expressions, then both size specifiers shall have the same constant value.
	// If the two array types are used in a context which requires them to be
	// compatible, it is undefined behavior if the two size specifiers evaluate to
	// unequal values.
	return !t.vla && !v.vla && t.length == v.length && t.elem.IsCompatible(v.elem)
}

// isCompatibleIgnoreQualifiers implements Type.
func (t *arrayType) isCompatibleIgnoreQualifiers(u Type) (r bool) {
	return t.IsCompatible(u)
}

// IsCompatibleLayout implements Type.
func (t *arrayType) IsCompatibleLayout(u Type) bool {
	if u = u.Alias().Decay(); t == u {
		return true
	}

	if t.vla || u.Kind() != Array {
		return false
	}

	v := u.(*arrayType)
	return !t.vla && !v.vla && t.length == v.length && t.elem.IsCompatibleLayout(v.elem)
}

// Alias implements Type.
func (t *arrayType) Alias() Type { return t }

// IsVLA implements Type.
func (t *arrayType) IsVLA() bool { return t.vla || t.elem.Kind() == Array && t.Elem().IsVLA() }

// String implements Type.
func (t *arrayType) String() string {
	b := bytesBufferPool.Get().(*bytes.Buffer)
	defer func() { b.Reset(); bytesBufferPool.Put(b) }()
	t.string(b)
	return strings.TrimSpace(b.String())
}

// string implements Type.
func (t *arrayType) string(b *bytes.Buffer) {
	b.WriteString("array of ")
	if t.Len() != 0 {
		fmt.Fprintf(b, "%d ", t.Len())
	}
	t.Elem().string(b)
}

// Attributes implements Type.
func (t *arrayType) Attributes() (a []*AttributeSpecifier) { return t.elem.Attributes() }

// Decay implements Type.
func (t *arrayType) Decay() Type { return t.decay }

// Elem implements Type.
func (t *arrayType) Elem() Type { return t.elem }

// Len implements Type.
func (t *arrayType) Len() uintptr { return t.length }

// LenExpr implements Type.
func (t *arrayType) LenExpr() *AssignmentExpression {
	if !t.vla {
		panic(internalErrorf("%s: LenExpr of non variable length array", t.Kind()))
	}

	return t.expr
}

// setLen implements Type.
func (t *arrayType) setLen(n uintptr) {
	t.typeBase.flags &^= fIncomplete
	t.length = n
	if t.Elem() != nil {
		t.size = t.length * t.Elem().Size()
	}
}

// underlyingType implements Type.
func (t *arrayType) underlyingType() Type { return t }

type aliasType struct {
	*typeBase
	nm StringID
	d  *Declarator
}

// HasFlexibleMember implements Type.
func (t *aliasType) HasFlexibleMember() bool {
	return t.d.Type().HasFlexibleMember()
}

// IsAssingmentCompatible implements Type.
func (t *aliasType) IsAssingmentCompatible(rhs Type) (r bool) {
	// defer func() {
	// 	rhs0 := rhs
	// 	if !r {
	// 		trc("TRACE %v <- %v\n%s", t, rhs0, debug.Stack()) //TODO-
	// 	}
	// }()
	if t == nil || rhs == nil {
		return false
	}

	if t == rhs {
		return true
	}

	if x, ok := rhs.(*aliasType); ok && t.nm == x.nm {
		return true
	}

	if rhs = rhs.Alias().Decay(); t == rhs {
		return true
	}

	// [0], 6.5.16.1 Simple assignment
	//
	// 1 One of the following shall hold:
	//
	// — the left operand has qualified or unqualified arithmetic type and the
	// right has arithmetic type;
	//
	// — the left operand has a qualified or unqualified version of a structure or
	// union type compatible with the type of the right;
	//
	// — both operands are pointers to qualified or unqualified versions of
	// compatible types, and the type pointed to by the left has all the qualifiers
	// of the type pointed to by the right;
	//
	// — one operand is a pointer to an object or incomplete type and the other is
	// a pointer to a qualified or unqualified version of void, and the type
	// pointed to by the left has all the qualifiers of the type pointed to by the
	// right;
	//
	// — the left operand is a pointer and the right is a null pointer constant; or
	//
	// — the left operand has type _Bool and the right is a pointer.
	return t.d.Type().IsAssingmentCompatible(rhs)
}

// isAssingmentCompatibleOperand implements Type.
func (t *aliasType) isAssingmentCompatibleOperand(rhs Operand) (r bool) {
	// defer func() {
	// 	rhs0 := rhs
	// 	if !r {
	// 		trc("TRACE %v <- %v %v\n%s", t, rhs0.Value(), rhs0.Type(), debug.Stack()) //TODO-
	// 	}
	// }()
	if t == nil || rhs == nil {
		return false
	}

	if x, ok := rhs.Type().(*aliasType); ok && t.nm == x.nm {
		return true
	}

	rhsType := rhs.Type().Decay()
	if t == rhsType {
		return true
	}

	return t.d.Type().isAssingmentCompatibleOperand(rhs)
}

// IsCompatible implements Type.
func (t *aliasType) IsCompatible(u Type) (r bool) {
	// defer func() {
	// 	u0 := u
	// 	if !r {
	// 		trc("TRACE %v <- %v\n%s", t, u0, debug.Stack()) //TODO-
	// 	}
	// }()
	if t == nil || u == nil {
		return false
	}

	if x, ok := u.(*aliasType); ok && t.nm == x.nm {
		return true
	}

	if u = u.Alias().Decay(); t == u {
		return true
	}

	return t.d.Type().IsCompatible(u)
}

// isCompatibleIgnoreQualifiers implements Type.
func (t *aliasType) isCompatibleIgnoreQualifiers(u Type) (r bool) {
	// defer func() {
	// 	u0 := u
	// 	if !r {
	// 		trc("TRACE %v <- %v\n%s", t, u0, debug.Stack()) //TODO-
	// 	}
	// }()
	if t == nil || u == nil {
		return false
	}

	if x, ok := u.(*aliasType); ok && t.nm == x.nm {
		return true
	}

	if u = u.Alias().Decay(); t == u {
		return true
	}

	return t.d.Type().isCompatibleIgnoreQualifiers(u)
}

// IsCompatibleLayout implements Type.
func (t *aliasType) IsCompatibleLayout(u Type) bool {
	if t == nil || u == nil {
		return false
	}

	if x, ok := u.(*aliasType); ok && t.nm == x.nm {
		return true
	}

	if u = u.Alias().Decay(); t == u {
		return true
	}

	return t.d.Type().IsCompatibleLayout(u)
}

// IsPacked implements Type.
func (t *aliasType) IsPacked() bool {
	if t == nil {
		return false
	}

	return t.d.Type().IsPacked()
}

// UnionCommon implements Type.
func (t *aliasType) UnionCommon() Kind { return t.d.Type().UnionCommon() }

// IsAliasType implements Type.
func (t *aliasType) IsAliasType() bool { return true }

// IsAggregate implements Type.
func (t *aliasType) IsAggregate() bool { return t.d.Type().IsAggregate() }

func (t *aliasType) AliasDeclarator() *Declarator { return t.d }

// IsTaggedType implements Type.
func (t *aliasType) IsTaggedType() bool { return false }

// Alias implements Type.
func (t *aliasType) Alias() Type { return t.d.Type() }

// Align implements Type.
func (t *aliasType) Align() int { return t.d.Type().Align() }

// Attributes implements Type.
func (t *aliasType) Attributes() (a []*AttributeSpecifier) { return t.d.Type().Attributes() }

// BitField implements Type.
func (t *aliasType) BitField() Field { return t.d.Type().BitField() }

// EnumType implements Type.
func (t *aliasType) EnumType() Type { return t.d.Type().EnumType() }

// Decay implements Type.
func (t *aliasType) Decay() Type { return t.d.Type().Decay() }

// Elem implements Type.
func (t *aliasType) Elem() Type { return t.d.Type().Elem() }

// FieldAlign implements Type.
func (t *aliasType) FieldAlign() int { return t.d.Type().FieldAlign() }

// NumField implements Type.
func (t *aliasType) NumField() int { return t.d.Type().NumField() }

// FieldByIndex implements Type.
func (t *aliasType) FieldByIndex(i []int) Field { return t.d.Type().FieldByIndex(i) }

// FieldByName implements Type.
func (t *aliasType) FieldByName(s StringID) (Field, bool) { return t.d.Type().FieldByName(s) }

// FieldByName2 implements Type.
func (t *aliasType) FieldByName2(s StringID) (Field, []int, bool) { return t.d.Type().FieldByName2(s) }

// IsIncomplete implements Type.
func (t *aliasType) IsIncomplete() bool { return t.d.Type().IsIncomplete() }

// IsArithmeticType implements Type.
func (t *aliasType) IsArithmeticType() bool { return t.d.Type().IsArithmeticType() }

// IsComplexType implements Type.
func (t *aliasType) IsComplexType() bool { return t.d.Type().IsComplexType() }

// IsComplexIntegerType implements Type.
func (t *aliasType) IsComplexIntegerType() bool { return t.d.Type().IsComplexIntegerType() }

// IsBitFieldType implements Type.
func (t *aliasType) IsBitFieldType() bool { return t.d.Type().IsBitFieldType() }

// IsIntegerType implements Type.
func (t *aliasType) IsIntegerType() bool { return t.d.Type().IsIntegerType() }

// IsRealType implements Type.
func (t *aliasType) IsRealType() bool { return t.d.Type().IsRealType() }

// IsScalarType implements Type.
func (t *aliasType) IsScalarType() bool { return t.d.Type().IsScalarType() }

// IsVLA implements Type.
func (t *aliasType) IsVLA() bool { return t.d.Type().IsVLA() }

// IsVariadic implements Type.
func (t *aliasType) IsVariadic() bool { return t.d.Type().IsVariadic() }

// Kind implements Type.
func (t *aliasType) Kind() Kind { return t.d.Type().Kind() }

// Len implements Type.
func (t *aliasType) Len() uintptr { return t.d.Type().Len() }

// LenExpr implements Type.
func (t *aliasType) LenExpr() *AssignmentExpression { return t.d.Type().LenExpr() }

// Parameters implements Type.
func (t *aliasType) Parameters() []*Parameter { return t.d.Type().Parameters() }

// Result implements Type.
func (t *aliasType) Result() Type { return t.d.Type().Result() }

// Real implements Type
func (t *aliasType) Real() Field { return t.d.Type().Real() }

// Imag implements Type
func (t *aliasType) Imag() Field { return t.d.Type().Imag() }

// Size implements Type.
func (t *aliasType) Size() uintptr { return t.d.Type().Size() }

// String implements Type.
func (t *aliasType) String() string {
	var a []string
	if t.typeBase.IsAtomic() {
		a = append(a, "atomic")
	}
	if t.typeBase.hasConst() {
		a = append(a, "const")
	}
	if t.typeBase.Inline() {
		a = append(a, "inline")
	}
	if t.typeBase.noReturn() {
		a = append(a, "_NoReturn")
	}
	if t.typeBase.restrict() {
		a = append(a, "restrict")
	}
	if t.typeBase.IsVolatile() {
		a = append(a, "volatile")
	}
	a = append(a, t.nm.String())
	return strings.Join(a, " ")
}

// Tag implements Type.
func (t *aliasType) Tag() StringID { return t.d.Type().Tag() }

// Name implements Type.
func (t *aliasType) Name() StringID { return t.nm }

// IsAtomic implements Type.
func (t *aliasType) IsAtomic() bool { return t.d.Type().IsAtomic() }

// Inline implements Type.
func (t *aliasType) Inline() bool { return t.d.Type().Inline() }

// IsSignedType implements Type.
func (t *aliasType) IsSignedType() bool { return t.d.Type().IsSignedType() }

// noReturn implements Type.
func (t *aliasType) noReturn() bool { return t.d.Type().noReturn() }

// restrict implements Type.
func (t *aliasType) restrict() bool { return t.d.Type().restrict() }

// setLen implements Type.
func (t *aliasType) setLen(n uintptr) { t.d.Type().setLen(n) }

// setKind implements Type.
func (t *aliasType) setKind(k Kind) { t.d.Type().setKind(k) }

// string implements Type.
func (t *aliasType) string(b *bytes.Buffer) { b.WriteString(t.String()) }

func (t *aliasType) underlyingType() Type { return t.d.Type().underlyingType() }

// IsVolatile implements Type.
func (t *aliasType) IsVolatile() bool { return t.d.Type().IsVolatile() }

func (t *aliasType) isVectorType() bool { return t.d.Type().isVectorType() }

func (t *aliasType) setFnSpecs(inline, noret bool) { t.d.Type().setFnSpecs(inline, noret) }

type field struct {
	bitFieldMask uint64 // bits: 3, bitOffset: 2 -> 0x1c. Valid only when isBitField is true.
	blockStart   *field // First bit field of the block this bit field belongs to.
	d            *StructDeclarator
	offset       uintptr // In bytes from start of the struct.
	parent       Type
	promote      Type
	typ          Type

	name StringID // Can be zero.
	x    int
	xs   []int

	isBitField bool
	isFlexible bool // https://en.wikipedia.org/wiki/Flexible_array_member
	inUnion    bool // directly or indirectly

	bitFieldOffset byte // In bits from bit 0 within the field. Valid only when isBitField is true.
	bitFieldWidth  byte // Width of the bit field in bits. Valid only when isBitField is true.
	blockWidth     byte // Total width of the bit field block this bit field belongs to.
	pad            byte
}

func (f *field) BitFieldBlockFirst() Field     { return f.blockStart }
func (f *field) BitFieldBlockWidth() int       { return int(f.blockWidth) }
func (f *field) BitFieldOffset() int           { return int(f.bitFieldOffset) }
func (f *field) BitFieldWidth() int            { return int(f.bitFieldWidth) }
func (f *field) Declarator() *StructDeclarator { return f.d }
func (f *field) InUnion() bool                 { return f.inUnion }
func (f *field) Index() int                    { return f.x }
func (f *field) IsBitField() bool              { return f.isBitField }
func (f *field) IsFlexible() bool              { return f.isFlexible }
func (f *field) Mask() uint64                  { return f.bitFieldMask }
func (f *field) Name() StringID                { return f.name }
func (f *field) Offset() uintptr               { return f.offset }
func (f *field) Padding() int                  { return int(f.pad) } // N/A for bitfields
func (f *field) Parent() Type                  { return f.parent }
func (f *field) Promote() Type                 { return f.promote }
func (f *field) Type() Type                    { return f.typ }
func (f *field) at(offDelta uintptr) *field    { r := *f; r.offset += offDelta; return &r }

func (f *field) string(b *bytes.Buffer) {
	b.WriteString(f.name.String())
	if f.isBitField {
		fmt.Fprintf(b, ":%d", f.bitFieldWidth)
	}
	b.WriteByte(' ')
	f.typ.string(b)
}

type fieldPath struct {
	fld  *field
	path []int

	ambiguous bool
}

func (f *fieldPath) String() string {
	return fmt.Sprintf("%q %v %v", f.fld.name, f.path, f.ambiguous)
}

type structType struct {
	*typeBase

	attr   []*AttributeSpecifier
	common Kind
	fields []*field
	m      map[StringID]*field
	paths  map[StringID]*fieldPath

	tag StringID

	hasFlexibleMember bool
}

// HasFlexibleMember implements Type.
func (t *structType) HasFlexibleMember() bool { return t.hasFlexibleMember }

// IsAssingmentCompatible implements Type.
func (t *structType) IsAssingmentCompatible(rhs Type) (r bool) {
	// defer func() {
	// 	rhs0 := rhs
	// 	if !r {
	// 		trc("TRACE %v <- %v\n%s", t, rhs0, debug.Stack()) //TODO-
	// 	}
	// }()
	if t == nil || rhs == nil {
		return false
	}

	if rhs = rhs.Alias().Decay(); t == rhs {
		return true
	}

	// [0], 6.5.16.1 Simple assignment
	//
	// 1 One of the following shall hold:
	//
	// — the left operand has qualified or unqualified arithmetic type and the
	// right has arithmetic type;
	//
	// — the left operand has a qualified or unqualified version of a structure or
	// union type compatible with the type of the right;
	//
	// — both operands are pointers to qualified or unqualified versions of
	// compatible types, and the type pointed to by the left has all the qualifiers
	// of the type pointed to by the right;
	//
	// — one operand is a pointer to an object or incomplete type and the other is
	// a pointer to a qualified or unqualified version of void, and the type
	// pointed to by the left has all the qualifiers of the type pointed to by the
	// right;
	//
	// — the left operand is a pointer and the right is a null pointer constant; or
	//
	// — the left operand has type _Bool and the right is a pointer.
	return t.IsCompatible(rhs)
}

// isAssingmentCompatibleOperand implements Type.
func (t *structType) isAssingmentCompatibleOperand(rhs Operand) (r bool) {
	// defer func() {
	// 	rhs0 := rhs
	// 	if !r {
	// 		trc("TRACE %v <- %v %v\n%s", t, rhs0.Value(), rhs0.Type(), debug.Stack()) //TODO-
	// 	}
	// }()
	if t == nil || rhs == nil {
		return false
	}

	rhsType := rhs.Type().Decay()
	if t == rhsType {
		return true
	}

	return t.IsAssingmentCompatible(rhsType)
}

func (t *structType) firstUnionField() Field {
	for _, f := range t.fields {
		if f.Name() != 0 || !f.Type().IsBitFieldType() {
			return f
		}
	}
	panic(todo(""))
}

// IsCompatible implements Type.
func (t *structType) IsCompatible(u Type) (r bool) {
	// defer func() {
	// 	u0 := u
	// 	if !r {
	// 		trc("TRACE %v <- %v\n%s", t, u0, debug.Stack()) //TODO-
	// 	}
	// }()
	if t == nil || u == nil {
		return false
	}

	if t.Kind() == Union {
		return t.firstUnionField().Type().IsCompatible(u)
	}

	if t.IsComplexType() && u.IsArithmeticType() {
		return true
	}

	if u = u.Alias().Decay(); t == u {
		return true
	}

	v, ok := u.(*structType)
	if !ok || t.Kind() != v.Kind() {
		return false
	}

	if t.tag != 0 && t.tag == v.tag {
		return true
	}

	if t.tag != v.tag || len(t.fields) != len(v.fields) {
		return false
	}

	if (t.IsIncomplete() || v.IsIncomplete()) && t.tag == v.tag {
		return true
	}

	for i, f1 := range t.fields {
		f2 := v.fields[i]
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

		if !ft1.IsCompatible(ft2) {
			return false
		}
	}
	return true
}

// isCompatibleIgnoreQualifiers implements Type.
func (t *structType) isCompatibleIgnoreQualifiers(u Type) (r bool) {
	return t.IsCompatible(u)
}

// IsCompatibleLayout implements Type.
func (t *structType) IsCompatibleLayout(u Type) bool {
	if u = u.Alias().Decay(); t == u {
		return true
	}

	v, ok := u.(*structType)
	if !ok || t.Kind() != v.Kind() {
		return false
	}

	if t.tag != v.tag || len(t.fields) != len(v.fields) {
		return false
	}

	for i, f1 := range t.fields {
		f2 := v.fields[i]
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

		if ft1.IsCompatible(ft2) {
			return false
		}
	}
	return true
}

// UnionCommon implements Type.
func (t *structType) UnionCommon() Kind {
	if t.Kind() != Union {
		panic(internalErrorf("%s: UnionCommon of invalid type", t.Kind()))
	}

	return t.common
}

// Alias implements Type.
func (t *structType) Alias() Type { return t }

// Tag implements Type.
func (t *structType) Tag() StringID { return t.tag }

func (t *structType) check(ctx *context, n Node) *structType {
	if t == nil {
		return nil
	}

	// Reject ambiguous names.
	for _, f := range t.fields {
		f.parent = t
		if f.Name() != 0 {
			continue
		}

		switch x := f.Type().(type) {
		case *structType:
			for _, f2 := range x.fields {
				nm := f2.Name()
				if nm == 0 {
					continue
				}

				if _, ok := t.m[nm]; ok {
					ctx.errNode(n, "ambiguous field name %q", nm)
				}
			}
		default:
			//TODO report err
		}
	}

	return ctx.cfg.ABI.layout(ctx, n, t)
}

// Real implements Type
func (t *structType) Real() Field {
	if !complexTypes[t.Kind()] {
		panic(internalErrorf("%s: Real of invalid type", t.Kind()))
	}

	f, ok := t.FieldByName(idReal)
	if !ok {
		panic(internalError())
	}

	return f
}

// Imag implements Type
func (t *structType) Imag() Field {
	if !complexTypes[t.Kind()] {
		panic(internalErrorf("%s: Real of invalid type", t.Kind()))
	}

	f, ok := t.FieldByName(idImag)
	if !ok {
		panic(internalError())
	}

	return f
}

// Decay implements Type.
func (t *structType) Decay() Type { return t }

func (t *structType) underlyingType() Type { return t }

// String implements Type.
func (t *structType) String() string {
	b := bytesBufferPool.Get().(*bytes.Buffer)
	defer func() { b.Reset(); bytesBufferPool.Put(b) }()
	t.string(b)
	return strings.TrimSpace(b.String())
}

// Name implements Type.
func (t *structType) Name() StringID { return t.tag }

// string implements Type.
func (t *structType) string(b *bytes.Buffer) {
	switch {
	case complexTypes[t.Kind()]:
		b.WriteString(t.Kind().String())
		return
	default:
		b.WriteString(t.Kind().String())
	}
	b.WriteByte(' ')
	if t.tag != 0 {
		b.WriteString(t.tag.String())
		b.WriteByte(' ')
	}
	b.WriteByte('{')
	for _, v := range t.fields {
		v.string(b)
		b.WriteString("; ")
	}
	b.WriteByte('}')
}

// FieldByIndex implements Type.
func (t *structType) FieldByIndex(i []int) Field {
	if len(i) > 1 {
		panic("TODO")
	}

	return t.fields[i[0]]
}

// FieldByName implements Type.
func (t *structType) FieldByName(name StringID) (Field, bool) {
	if f := t.m[name]; f != nil {
		return f, true
	}

	if t.paths == nil {
		t.paths = map[StringID]*fieldPath{}
		t.computePaths(0, t.paths, nil)
	}
	nfo := t.paths[name]
	if nfo == nil || nfo.ambiguous {
		return nil, false
	}

	return nfo.fld, true
}

// FieldByName2 implements Type.
func (t *structType) FieldByName2(name StringID) (Field, []int, bool) {
	if f := t.m[name]; f != nil {
		return f, f.xs, true
	}

	if t.paths == nil {
		t.paths = map[StringID]*fieldPath{}
		t.computePaths(0, t.paths, nil)
	}
	nfo := t.paths[name]
	if nfo == nil || nfo.ambiguous {
		return nil, nil, false
	}

	return nfo.fld, nfo.path, true
}

func (t *structType) computePaths(off uintptr, paths map[StringID]*fieldPath, path []int) {
	path = append(path, 0)
	for i, f := range t.fields {
		nm := f.Name()
		path[len(path)-1] = i
		if nm != 0 {
			switch ex := paths[nm]; {
			case ex != nil:
				switch {
				case len(path) < len(ex.path):
					ex.fld = f.at(off)
					ex.path = append([]int(nil), path...)
					ex.ambiguous = false
				case len(path) == len(ex.path) && (off+f.Offset() != ex.fld.Offset() || f.Type().Size() != ex.fld.Type().Size()):
					ex.ambiguous = true
				}
			default:
				paths[nm] = &fieldPath{fld: f.at(off), path: append([]int(nil), path...)}
			}
		}
		if x, ok := f.Type().underlyingType().(*structType); ok {
			x.computePaths(off+f.Offset(), paths, path)
		}
	}
}

// NumField implements Type.
func (t *structType) NumField() int { return len(t.fields) }

type taggedType struct {
	*typeBase
	resolutionScope Scope
	typ             Type

	tag StringID
}

// IsPacked implements Type.
func (t *taggedType) IsPacked() bool {
	if t == nil {
		return false
	}

	return t.underlyingType().IsPacked()
}

// HasFlexibleMember implements Type.
func (t *taggedType) HasFlexibleMember() bool {
	return t.typ.HasFlexibleMember()
}

// IsAssingmentCompatible implements Type.
func (t *taggedType) IsAssingmentCompatible(rhs Type) (r bool) {
	// defer func() {
	// 	rhs0 := rhs
	// 	if !r {
	// 		trc("TRACE %v <- %v\n%s", t, rhs0, debug.Stack()) //TODO-
	// 	}
	// }()
	if t == nil || rhs == nil {
		return false
	}

	if t == rhs {
		return true
	}

	if t.Kind() == rhs.Kind() && t.tag != 0 && t.tag == rhs.Tag() {
		return true
	}

	if rhs = rhs.Alias().Decay(); t == rhs {
		return true
	}

	// [0], 6.5.16.1 Simple assignment
	//
	// 1 One of the following shall hold:
	//
	// — the left operand has qualified or unqualified arithmetic type and the
	// right has arithmetic type;
	//
	// — the left operand has a qualified or unqualified version of a structure or
	// union type compatible with the type of the right;
	//
	// — both operands are pointers to qualified or unqualified versions of
	// compatible types, and the type pointed to by the left has all the qualifiers
	// of the type pointed to by the right;
	//
	// — one operand is a pointer to an object or incomplete type and the other is
	// a pointer to a qualified or unqualified version of void, and the type
	// pointed to by the left has all the qualifiers of the type pointed to by the
	// right;
	//
	// — the left operand is a pointer and the right is a null pointer constant; or
	//
	// — the left operand has type _Bool and the right is a pointer.
	return t.typ.IsAssingmentCompatible(rhs)
}

// isAssingmentCompatibleOperand implements Type.
func (t *taggedType) isAssingmentCompatibleOperand(rhs Operand) (r bool) {
	// defer func() {
	// 	rhs0 := rhs
	// 	if !r {
	// 		trc("TRACE %v <- %v %v\n%s", t, rhs0.Value(), rhs0.Type(), debug.Stack()) //TODO-
	// 	}
	// }()
	if t == nil || rhs == nil {
		return false
	}

	rhsType := rhs.Type().Decay()
	if t == rhsType {
		return true
	}

	if t.Kind() == rhsType.Kind() && t.tag != 0 && t.tag == rhsType.Tag() {
		return true
	}

	return t.IsAssingmentCompatible(rhsType)
}

// IsCompatible implements Type.
func (t *taggedType) IsCompatible(u Type) (r bool) {
	defer func() {
		// if !r {
		// 	trc("TRACE %v <- %v: %v (%s)", t, u0, r, origin(2)) //TODO-
		// }
	}()
	if t == nil || u == nil {
		return false
	}

	if t == u {
		return true
	}

	if u = u.Alias().Decay(); t == u {
		return true
	}

	if t.Kind() == u.Kind() && t.tag != 0 && t.tag == u.Tag() {
		return true
	}

	return t.typ.IsCompatible(u)
}

// isCompatibleIgnoreQualifiers implements Type.
func (t *taggedType) isCompatibleIgnoreQualifiers(u Type) (r bool) {
	// defer func() {
	// 	u0 := u
	// 	if !r {
	// 		trc("TRACE %v <- %v\n%s", t, u0, debug.Stack()) //TODO-
	// 	}
	// }()
	if t == nil || u == nil {
		return false
	}

	if t == u {
		return true
	}

	if u = u.Alias().Decay(); t == u {
		return true
	}

	if t.Kind() == u.Kind() && t.tag != 0 && t.tag == u.Tag() {
		return true
	}

	return t.typ.isCompatibleIgnoreQualifiers(u)
}

// IsCompatibleLayout implements Type.
func (t *taggedType) IsCompatibleLayout(u Type) bool {
	if u = u.Alias().Decay(); t == u {
		return true
	}

	if t == nil || u == nil {
		return false
	}

	if t == u {
		return true
	}

	if u = u.Alias().Decay(); t == u {
		return true
	}

	if t.Kind() == u.Kind() && t.tag != 0 && t.tag == u.Tag() {
		return true
	}

	return t.typ.IsCompatibleLayout(u)
}

// UnionCommon implements Type.
func (t *taggedType) UnionCommon() Kind { return t.typ.UnionCommon() }

// IsTaggedType implements Type.
func (t *taggedType) IsTaggedType() bool { return true }

// Tag implements Type.
func (t *taggedType) Tag() StringID { return t.tag }

// Alias implements Type.
func (t *taggedType) Alias() Type { return t.underlyingType() }

// Decay implements Type.
func (t *taggedType) Decay() Type { return t }

// IsIncomplete implements Type.
func (t *taggedType) IsIncomplete() bool {
	u := t.underlyingType()
	return u == noType || u.IsIncomplete()
}

// String implements Type.
func (t *taggedType) String() string {
	b := bytesBufferPool.Get().(*bytes.Buffer)
	defer func() { b.Reset(); bytesBufferPool.Put(b) }()
	t.string(b)
	return strings.TrimSpace(b.String())
}

// Name implements Type.
func (t *taggedType) Name() StringID { return t.tag }

// NumField implements Type.
func (t *taggedType) NumField() int { return t.underlyingType().NumField() }

// FieldByIndex implements Type.
func (t *taggedType) FieldByIndex(i []int) Field { return t.underlyingType().FieldByIndex(i) }

// FieldByName implements Type.
func (t *taggedType) FieldByName(s StringID) (Field, bool) { return t.underlyingType().FieldByName(s) }

// FieldByName2 implements Type.
func (t *taggedType) FieldByName2(s StringID) (Field, []int, bool) {
	return t.underlyingType().FieldByName2(s)
}

// IsSignedType implements Type.
func (t *taggedType) IsSignedType() bool { return t.underlyingType().IsSignedType() }

// EnumType implements Type.
func (t *taggedType) EnumType() Type { return t.underlyingType() }

// string implements Type.
func (t *taggedType) string(b *bytes.Buffer) {
	t.typeBase.string(b)
	b.WriteByte(' ')
	b.WriteString(t.tag.String())
}

func (t *taggedType) underlyingType() Type {
	if t.typ != nil {
		return t.typ
	}

	k := t.Kind()
	for s := t.resolutionScope; s != nil; s = s.Parent() {
		for _, v := range s[t.tag] {
			switch x := v.(type) {
			case *Declarator, *StructDeclarator, *LabeledStatement:
				// nop
			case *EnumSpecifier:
				if k == Enum && x.Case == EnumSpecifierDef {
					t.typ = x.Type()
					return t.typ.underlyingType()
				}
			case *StructOrUnionSpecifier:
				if x.typ == nil {
					break
				}

				switch k {
				case Struct:
					if typ := x.Type(); typ.Kind() == Struct {
						t.typ = typ
						return typ.underlyingType()
					}
				case Union:
					if typ := x.Type(); typ.Kind() == Union {
						t.typ = typ
						return typ.underlyingType()
					}
				}
			default:
				panic(todo("internal error: %T", x))
			}
		}
	}
	t.typ = noType
	return noType
}

// Size implements Type.
func (t *taggedType) Size() (r uintptr) {
	return t.underlyingType().Size()
}

// Align implements Type.
func (t *taggedType) Align() int { return t.underlyingType().Align() }

// FieldAlign implements Type.
func (t *taggedType) FieldAlign() int { return t.underlyingType().FieldAlign() }

type functionType struct {
	typeBase
	params    []*Parameter
	paramList []StringID

	result Type

	variadic bool
}

// IsAssingmentCompatible implements Type.
func (t *functionType) IsAssingmentCompatible(rhs Type) (r bool) {
	// defer func() {
	// 	rhs0 := rhs
	// 	if !r {
	// 		trc("TRACE %v <- %v\n%s", t, rhs0, debug.Stack()) //TODO-
	// 	}
	// }()
	if t == nil || rhs == nil {
		return false
	}

	if rhs = rhs.Alias().Decay(); t == rhs {
		return true
	}

	// [0], 6.5.16.1 Simple assignment
	//
	// 1 One of the following shall hold:
	//
	// — the left operand has qualified or unqualified arithmetic type and the
	// right has arithmetic type;
	//
	// — the left operand has a qualified or unqualified version of a structure or
	// union type compatible with the type of the right;
	//
	// — both operands are pointers to qualified or unqualified versions of
	// compatible types, and the type pointed to by the left has all the qualifiers
	// of the type pointed to by the right;
	//
	// — one operand is a pointer to an object or incomplete type and the other is
	// a pointer to a qualified or unqualified version of void, and the type
	// pointed to by the left has all the qualifiers of the type pointed to by the
	// right;
	//
	// — the left operand is a pointer and the right is a null pointer constant; or
	//
	// — the left operand has type _Bool and the right is a pointer.
	if rhs.Kind() != Function {
		return false
	}

	v := rhs.(*functionType)
	if t.params != nil && v.params != nil || t.variadic != v.variadic {
		if len(t.params) != len(v.params) {
			return false
		}

		for i, x := range t.params {
			if !x.Type().IsAssingmentCompatible(v.params[i].Type()) {
				return false
			}
		}
	}
	return t.result.IsAssingmentCompatible(v.result)
}

// isAssingmentCompatibleOperand implements Type.
func (t *functionType) isAssingmentCompatibleOperand(rhs Operand) (r bool) {
	// defer func() {
	// 	rhs0 := rhs
	// 	if !r {
	// 		trc("TRACE %v <- %v %v\n%s", t, rhs0.Value(), rhs0.Type(), debug.Stack()) //TODO-
	// 	}
	// }()
	if t == nil || rhs == nil {
		return false
	}

	rhsType := rhs.Type().Decay()
	if t == rhsType {
		return true
	}

	return t.IsAssingmentCompatible(rhsType)
}

// IsCompatible implements Type.
func (t *functionType) IsCompatible(u Type) (r bool) {
	// defer func() {
	// 	u0 := u
	// 	if !r {
	// 		trc("TRACE %v <- %v\n%s", t, u0, debug.Stack()) //TODO-
	// 	}
	// }()
	if t == nil || u == nil {
		return false
	}

	if u = u.Alias().Decay(); t == u {
		return true
	}

	if u.Kind() != Function {
		return false
	}

	v := u.(*functionType)
	// [0], 6.7.5.3
	//
	// 15 For two function types to be compatible, both shall specify compatible
	// return types.
	//
	// Moreover, the parameter type lists, if both are present, shall agree in the
	// number of parameters and in use of the ellipsis terminator; corresponding
	// parameters shall have compatible types. If one type has a parameter type
	// list and the other type is specified by a function declarator that is not
	// part of a function definition and that contains an empty identifier list,
	// the parameter list shall not have an ellipsis terminator and the type of
	// each parameter shall be compatible with the type that results from the
	// application of the default argument promotions. If one type has a parameter
	// type list and the other type is specified by a function definition that
	// contains a (possibly empty) identifier list, both shall agree in the number
	// of parameters, and the type of each prototype parameter shall be compatible
	// with the type that results from the application of the default argument
	// promotions to the type of the corresponding identifier. (In the
	// determination of type compatibility and of a composite type, each parameter
	// declared with function or array type is taken as having the adjusted type
	// and each parameter declared with qualified type is taken as having the
	// unqualified version of its declared type.)
	if t.params != nil && v.params != nil || t.variadic != v.variadic {
		if len(t.params) != len(v.params) {
			return false
		}

		for i, x := range t.params {
			if !x.Type().IsCompatible(v.params[i].Type()) {
				return false
			}
		}
	}
	return t.result.IsCompatible(v.result)
}

// isCompatibleIgnoreQualifiers implements Type.
func (t *functionType) isCompatibleIgnoreQualifiers(u Type) (r bool) {
	return t.IsCompatible(u)
}

// Alias implements Type.
func (t *functionType) Alias() Type { return t }

// Decay implements Type.
func (t *functionType) Decay() Type { return t }

// String implements Type.
func (t *functionType) String() string {
	b := bytesBufferPool.Get().(*bytes.Buffer)
	defer func() { b.Reset(); bytesBufferPool.Put(b) }()
	t.string(b)
	return strings.TrimSpace(b.String())
}

// string implements Type.
func (t *functionType) string(b *bytes.Buffer) {
	b.WriteString("function(")
	for i, v := range t.params {
		v.Type().string(b)
		if i < len(t.params)-1 {
			b.WriteString(", ")
		}
	}
	if t.variadic {
		b.WriteString(", ...")
	}
	b.WriteString(")")
	if t.result != nil && t.result.Kind() != Void {
		b.WriteString(" returning ")
		t.result.string(b)
	}
}

// Parameters implements Type.
func (t *functionType) Parameters() []*Parameter { return t.params }

// Result implements Type.
func (t *functionType) Result() Type { return t.result }

// IsVariadic implements Type.
func (t *functionType) IsVariadic() bool { return t.variadic }

type bitFieldType struct {
	Type
	field *field
}

// Alias implements Type.
func (t *bitFieldType) Alias() Type { return t }

// IsBitFieldType implements Type.
func (t *bitFieldType) IsBitFieldType() bool { return true }

// BitField implements Type.
func (t *bitFieldType) BitField() Field { return t.field }

type vectorType struct {
	typeBase

	elem   Type
	length uintptr
}

// IsAssingmentCompatible implements Type.
func (t *vectorType) IsAssingmentCompatible(rhs Type) (r bool) {
	// defer func() {
	// 	rhs0 := rhs
	// 	if !r {
	// 		trc("TRACE %v <- %v\n%s", t, rhs0, debug.Stack()) //TODO-
	// 	}
	// }()
	if t == nil || rhs == nil {
		return false
	}

	if t == rhs {
		return true
	}

	// [0], 6.5.16.1 Simple assignment
	//
	// 1 One of the following shall hold:
	//
	// — the left operand has qualified or unqualified arithmetic type and the
	// right has arithmetic type;
	//
	// — the left operand has a qualified or unqualified version of a structure or
	// union type compatible with the type of the right;
	//
	// — both operands are pointers to qualified or unqualified versions of
	// compatible types, and the type pointed to by the left has all the qualifiers
	// of the type pointed to by the right;
	//
	// — one operand is a pointer to an object or incomplete type and the other is
	// a pointer to a qualified or unqualified version of void, and the type
	// pointed to by the left has all the qualifiers of the type pointed to by the
	// right;
	//
	// — the left operand is a pointer and the right is a null pointer constant; or
	//
	// — the left operand has type _Bool and the right is a pointer.
	return t.IsCompatible(rhs)
}

// isAssingmentCompatibleOperand implements Type.
func (t *vectorType) isAssingmentCompatibleOperand(rhs Operand) (r bool) {
	// defer func() {
	// 	rhs0 := rhs
	// 	if !r {
	// 		trc("TRACE %v <- %v %v\n%s", t, rhs0.Value(), rhs0.Type(), debug.Stack()) //TODO-
	// 	}
	// }()
	if t == nil || rhs == nil {
		return false
	}

	rhsType := rhs.Type()
	if t == rhsType {
		return true
	}

	return t.IsAssingmentCompatible(rhsType)
}

// IsCompatible implements Type.
func (t *vectorType) IsCompatible(u Type) (r bool) {
	// defer func() {
	// 	u0 := u
	// 	if !r {
	// 		trc("TRACE %v <- %v\n%s", t, u0, debug.Stack()) //TODO-
	// 	}
	// }()
	if t == nil || u == nil {
		return false
	}

	if t == u {
		return true
	}

	if t == u {
		return true
	}

	if u.Kind() != Vector {
		return false
	}

	v := u.(*vectorType)
	return t.length == v.length && t.elem.IsCompatible(v.elem)
}

// isCompatibleIgnoreQualifiers implements Type.
func (t *vectorType) isCompatibleIgnoreQualifiers(u Type) (r bool) {
	return t.IsCompatible(u)
}

// IsCompatibleLayout implements Type.
func (t *vectorType) IsCompatibleLayout(u Type) bool {
	if u = u.Alias().Decay(); t == u {
		return true
	}

	if u.Kind() != Vector {
		return false
	}

	v := u.(*vectorType)
	return t.length == v.length && t.elem.IsCompatibleLayout(v.elem)
}

// Alias implements Type.
func (t *vectorType) Alias() Type { return t }

// IsVLA implements Type.
func (t *vectorType) IsVLA() bool { return false }

// String implements Type.
func (t *vectorType) String() string {
	b := bytesBufferPool.Get().(*bytes.Buffer)
	defer func() { b.Reset(); bytesBufferPool.Put(b) }()
	t.string(b)
	return strings.TrimSpace(b.String())
}

// string implements Type.
func (t *vectorType) string(b *bytes.Buffer) {
	fmt.Fprintf(b, "vector of %d ", t.Len())
	t.Elem().string(b)
}

// Attributes implements Type.
func (t *vectorType) Attributes() (a []*AttributeSpecifier) { return t.elem.Attributes() }

// Elem implements Type.
func (t *vectorType) Elem() Type { return t.elem }

// Len implements Type.
func (t *vectorType) Len() uintptr { return t.length }

// LenExpr implements Type.
func (t *vectorType) LenExpr() *AssignmentExpression {
	panic(internalErrorf("%s: LenExpr of non variable length array", t.Kind()))
}

// setLen implements Type.
func (t *vectorType) setLen(n uintptr) {
	panic("internal error")
}

// underlyingType implements Type.
func (t *vectorType) underlyingType() Type { return t }

func isCharType(t Type) bool {
	switch t.Kind() {
	case Char, SChar, UChar, Int8, UInt8:
		return true
	}

	return false
}

func isWCharType(t Type) bool {
	switch {
	case t.IsAliasType():
		id := t.AliasDeclarator().Name()
		return id == idWcharT || id == idWinWchar
	default:
		return false
	}
}

// Struct layout describes storage details of a struct/union type.
type StructLayout struct {
	Offsets        []uintptr // In field order.
	OffsetToFields map[uintptr][]Field
	PaddingsBefore map[Field]int
	PaddingAfter   int
	t              Type

	NeedExplicitAlign bool
}

// NewStructLayout returns a newly created StructLayout for t, or nil if t is
// not a struct/union type.
func NewStructLayout(t Type) *StructLayout {
	switch t.Kind() {
	case Struct, Union:
		// ok
	default:
		return nil
	}

	nf := t.NumField()
	flds := map[uintptr][]Field{}
	var maxAlign int
	for idx := []int{0}; idx[0] < nf; idx[0]++ {
		f := t.FieldByIndex(idx)
		if f.IsBitField() && f.BitFieldWidth() == 0 {
			continue
		}

		if a := f.Type().Align(); !f.IsBitField() && a > maxAlign {
			maxAlign = a
		}
		off := f.Offset()
		flds[off] = append(flds[off], f)
	}
	var offs []uintptr
	for k := range flds {
		offs = append(offs, k)
	}
	sort.Slice(offs, func(i, j int) bool { return offs[i] < offs[j] })
	var pads map[Field]int
	var pos uintptr
	var forceAlign bool
	for _, off := range offs {
		f := flds[off][0]
		ft := f.Type()
		//trc("%q off %d pos %d %v %v %v", f.Name(), off, pos, ft, ft.Kind(), ft.IsIncomplete())
		switch {
		case ft.IsBitFieldType():
			if p := int(off - pos); p != 0 {
				if pads == nil {
					pads = map[Field]int{}
				}
				pads[f] = p
				pos = off
			}
			pos += uintptr(f.BitFieldBlockWidth()) >> 3
		default:
			var sz uintptr
			switch {
			case ft.Kind() != Array || ft.Len() != 0:
				sz = ft.Size()
			default:
				forceAlign = true
			}
			if p := int(off - pos); p != 0 {
				if pads == nil {
					pads = map[Field]int{}
				}
				pads[f] = p
				pos = off
			}
			pos += sz
		}
	}
	return &StructLayout{
		NeedExplicitAlign: forceAlign || maxAlign < t.Align(),
		OffsetToFields:    flds,
		Offsets:           offs,
		PaddingAfter:      int(t.Size() - pos),
		PaddingsBefore:    pads,
		t:                 t,
	}
}

func (x *StructLayout) String() string {
	t := x.t
	nf := t.NumField()
	var a []string
	w := 0
	for i := 0; i < nf; i++ {
		if n := len(t.FieldByIndex([]int{i}).Name().String()); n > w {
			w = n
		}
	}
	for i := 0; i < nf; i++ {
		f := t.FieldByIndex([]int{i})
		var bf StringID
		if f.IsBitField() {
			if bfbf := f.(*field).blockStart; bfbf != nil {
				bf = bfbf.Name()
			}
		}
		a = append(a, fmt.Sprintf("%3d: %*q: BitFieldOffset %3v, BitFieldWidth %3v, IsBitField %5v, Mask: %#016x, off: %3v, pad %2v, BitFieldBlockWidth: %2d, BitFieldBlockFirst: %s, %v",
			i, w+2, f.Name(), f.BitFieldOffset(), f.BitFieldWidth(),
			f.IsBitField(), f.Mask(), f.Offset(), f.Padding(),
			f.BitFieldBlockWidth(), bf, f.Type(),
		))
	}
	var b strings.Builder
	fmt.Fprintf(&b, "%v\n%s\n----\n", t, strings.Join(a, "\n"))
	fmt.Fprintf(&b, "size: %v\n", t.Size())
	fmt.Fprintf(&b, "offs: %v\n", x.Offsets)
	a = a[:0]
	for k, v := range x.OffsetToFields {
		var b []string
		for _, w := range v {
			b = append(b, fmt.Sprintf("%q padBefore: %d ", w.Name(), x.PaddingsBefore[w]))
		}
		a = append(a, fmt.Sprintf("%4d %s", k, b))
	}
	sort.Strings(a)
	for _, v := range a {
		fmt.Fprintf(&b, "%s\n", v)
	}
	fmt.Fprintf(&b, "padAfter: %v\n", x.PaddingAfter)
	for i := 0; i < nf; i++ {
		f := t.FieldByIndex([]int{i})
		if x, ok := f.Type().(*structType); ok {
			s := dumpLayout(x)
			a := strings.Split(s, "\n")
			fmt.Fprintf(&b, "====\n")
			for _, v := range a {
				fmt.Fprintf(&b, "%s\n", v)
			}
		}
	}
	return b.String()
}

func dumpLayout(t Type) string {
	switch t.Kind() {
	case Struct, Union:
		// ok
	default:
		return t.String()
	}

	return NewStructLayout(t).String()
}
