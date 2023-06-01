// Copyright 2019 The CC Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package cc // import "modernc.org/cc/v3"

import (
	"encoding/binary"
	"fmt"
	"math"
	"os"
	"runtime"

	"lukechampine.com/uint128"
	"modernc.org/mathutil"
)

var (
	idAligned   = String("aligned")
	idGCCStruct = String("gcc_struct")
	idMSStruct  = String("ms_struct")
	idPacked    = String("packed")

	complexTypedefs = map[StringID]Kind{
		dict.sid("__COMPLEX_CHAR_TYPE__"):               ComplexChar,
		dict.sid("__COMPLEX_DOUBLE_TYPE__"):             ComplexDouble,
		dict.sid("__COMPLEX_FLOAT_TYPE__"):              ComplexFloat,
		dict.sid("__COMPLEX_INT_TYPE__"):                ComplexInt,
		dict.sid("__COMPLEX_LONG_TYPE__"):               ComplexLong,
		dict.sid("__COMPLEX_LONG_DOUBLE_TYPE__"):        ComplexLongDouble,
		dict.sid("__COMPLEX_LONG_LONG_TYPE__"):          ComplexLongLong,
		dict.sid("__COMPLEX_SHORT_TYPE__"):              ComplexShort,
		dict.sid("__COMPLEX_UNSIGNED_TYPE__"):           ComplexUInt,
		dict.sid("__COMPLEX_LONG_UNSIGNED_TYPE__"):      ComplexULong,
		dict.sid("__COMPLEX_LONG_LONG_UNSIGNED_TYPE__"): ComplexULongLong,
		dict.sid("__COMPLEX_SHORT_UNSIGNED_TYPE__"):     ComplexUShort,
	}
)

// NewABI creates an ABI for a given OS and architecture. The OS and architecture values are the same as used in Go.
// The ABI type map may miss advanced types like complex numbers, etc. If the os/arch pair is not recognized, a
// *ErrUnsupportedOSArch is returned.
func NewABI(os, arch string) (ABI, error) {
	order, ok := abiByteOrders[arch]
	if !ok {
		return ABI{}, fmt.Errorf("unsupported arch: %s", arch)
	}
	types, ok := abiTypes[[2]string{os, arch}]
	if !ok {
		return ABI{}, fmt.Errorf("unsupported os/arch pair: %s-%s", os, arch)
	}
	abi := ABI{
		ByteOrder:  order,
		Types:      make(map[Kind]ABIType, len(types)),
		SignedChar: abiSignedChar[[2]string{os, arch}],
		os:         os,
		arch:       arch,
	}
	// copy the map, so it can be modified by user
	for k, v := range types {
		abi.Types[k] = v
	}
	return abi, nil
}

// NewABIFromEnv uses GOOS and GOARCH values to create a corresponding ABI.
// If those environment variables are not set, an OS/arch of a Go runtime is used.
// It returns a *ErrUnsupportedOSArch if OS/arch pair is not supported.
func NewABIFromEnv() (ABI, error) {
	osv := os.Getenv("GOOS")
	if osv == "" {
		osv = runtime.GOOS
	}
	arch := os.Getenv("GOARCH")
	if arch == "" {
		arch = runtime.GOARCH
	}
	return NewABI(osv, arch)
}

// ABIType describes properties of a non-aggregate type.
type ABIType struct {
	Size       uintptr
	Align      int
	FieldAlign int
}

// ABI describes selected parts of the Application Binary Interface.
type ABI struct {
	ByteOrder binary.ByteOrder
	Types     map[Kind]ABIType
	arch      string
	os        string
	types     map[Kind]Type

	SignedChar bool
}

func (a *ABI) sanityCheck(ctx *context, intMaxWidth int, s Scope) error {
	if intMaxWidth == 0 {
		intMaxWidth = 64
	}

	a.types = map[Kind]Type{}
	for _, k := range []Kind{
		Bool,
		Char,
		Double,
		Enum,
		Float,
		Int,
		Long,
		LongDouble,
		LongLong,
		Ptr,
		SChar,
		Short,
		UChar,
		UInt,
		ULong,
		ULongLong,
		UShort,
		Void,
	} {
		v, ok := a.Types[k]
		if !ok {
			if ctx.err(noPos, "ABI is missing %s", k) {
				return ctx.Err()
			}

			continue
		}

		if (k != Void && v.Size == 0) || v.Align == 0 || v.FieldAlign == 0 ||
			v.Align > math.MaxUint8 || v.FieldAlign > math.MaxUint8 {
			if ctx.err(noPos, "invalid ABI type %s: %+v", k, v) {
				return ctx.Err()
			}
		}

		if integerTypes[k] && v.Size > 8 {
			if ctx.err(noPos, "invalid ABI type %s size: %v, must be <= 8", k, v.Size) {
				return ctx.Err()
			}
		}
		var f flag
		if integerTypes[k] && a.isSignedInteger(k) {
			f = fSigned
		}
		t := &typeBase{
			align:      byte(a.align(k)),
			fieldAlign: byte(a.fieldAlign(k)),
			flags:      f,
			kind:       byte(k),
			size:       uintptr(a.size(k)),
		}
		a.types[k] = t
	}
	if _, ok := a.Types[Int128]; ok {
		t := &typeBase{
			align:      byte(a.align(Int128)),
			fieldAlign: byte(a.fieldAlign(Int128)),
			flags:      fSigned,
			kind:       byte(Int128),
			size:       uintptr(a.size(Int128)),
		}
		a.types[Int128] = t
	}
	if _, ok := a.Types[UInt128]; ok {
		t := &typeBase{
			align:      byte(a.align(UInt128)),
			fieldAlign: byte(a.fieldAlign(UInt128)),
			kind:       byte(UInt128),
			size:       uintptr(a.size(UInt128)),
		}
		a.types[UInt128] = t
	}
	return ctx.Err()
}

func (a *ABI) Type(k Kind) Type { return a.types[k] }

func (a *ABI) align(k Kind) int      { return a.Types[k].Align }
func (a *ABI) fieldAlign(k Kind) int { return a.Types[k].FieldAlign }
func (a *ABI) size(k Kind) int       { return int(a.Types[k].Size) }

func (a *ABI) isSignedInteger(k Kind) bool {
	if !integerTypes[k] {
		internalError()
	}

	switch k {
	case Bool, UChar, UInt, ULong, ULongLong, UShort:
		return false
	case Char:
		return a.SignedChar
	default:
		return true
	}
}

func roundup(n, to int64) int64 {
	if r := n % to; r != 0 {
		return n + to - r
	}

	return n
}

func roundup128(n uint128.Uint128, to uint64) uint128.Uint128 {
	if r := n.Mod(uint128.From64(to)); !r.IsZero() {
		return n.Add64(to).Sub(r)
	}

	return n
}

func rounddown(n, to int64) int64 {
	return n &^ (to - 1)
}

func rounddown128(n uint128.Uint128, to uint64) uint128.Uint128 {
	return n.And(uint128.Uint128{Hi: ^uint64(0), Lo: ^(to - 1)})
}

func normalizeBitFieldWidth(n byte) byte {
	switch {
	case n <= 8:
		return 8
	case n <= 16:
		return 16
	case n <= 32:
		return 32
	case n <= 64:
		return 64
	default:
		panic(todo("internal error: %v", n))
	}
}

func (a *ABI) layout(ctx *context, n Node, t *structType) *structType {
	if t == nil {
		return nil
	}

	if t.typeBase.align < 1 {
		t.typeBase.align = 1
	}
	for _, v := range t.attr {
		if _, ok := v.Has(idGCCStruct); ok {
			return a.gccLayout(ctx, n, t)
		}

		//TODO if _, ok := v.Has(idMSStruct); ok {
		//TODO 	return a.msLayout(ctx, n, t)
		//TODO }
	}

	switch {
	case ctx.cfg.Config3.GCCStructs:
		return a.gccLayout(ctx, n, t)
		//TODO case ctx.cfg.Config3.MSStructs:
		//TODO 	return a.msLayout(ctx, n, t)
	}

	var hasBitfields bool

	defer func() {
		if !hasBitfields {
			return
		}

		m := make(map[uintptr][]*field, len(t.fields))
		for _, f := range t.fields {
			off := f.offset
			m[off] = append(m[off], f)
		}
		for _, s := range m {
			var first *field
			var w byte
			for _, f := range s {
				if first == nil {
					first = f
				}
				if f.isBitField {
					n := f.bitFieldOffset + f.bitFieldWidth
					if n > w {
						w = n
					}
				}
			}
			w = normalizeBitFieldWidth(w)
			for _, f := range s {
				if f.isBitField {
					f.blockStart = first
					f.blockWidth = w
				}
				if a.ByteOrder == binary.BigEndian {
					f.bitFieldOffset = w - f.bitFieldWidth - f.bitFieldOffset
					f.bitFieldMask = (uint64(1)<<f.bitFieldWidth - 1) << f.bitFieldOffset
				}
			}
		}
	}()

	var off int64 // bit offset
	align := int(t.typeBase.align)

	switch {
	case t.Kind() == Union:
		for _, f := range t.fields {
			ft := f.Type()
			sz := ft.Size()
			if n := int64(8 * sz); n > off {
				off = n
			}
			al := ft.FieldAlign()
			if al == 0 {
				al = 1
			}
			if al > align {
				align = al
			}

			if f.isBitField {
				hasBitfields = true
				f.bitFieldMask = 1<<f.bitFieldWidth - 1
			}
			f.promote = integerPromotion(a, ft)
		}
		t.align = byte(align)
		t.fieldAlign = byte(align)
		off = roundup(off, 8*int64(align))
		t.size = uintptr(off >> 3)
		ctx.structs[StructInfo{Size: t.size, Align: t.Align()}] = struct{}{}
	default:
		var i int
		var group byte
		var f, lf *field
		for i, f = range t.fields {
			ft := f.Type()
			var sz uintptr
			switch {
			case ft.Kind() == Array && i == len(t.fields)-1:
				if ft.IsIncomplete() || ft.Len() == 0 {
					t.hasFlexibleMember = true
					f.isFlexible = true
					break
				}

				fallthrough
			default:
				sz = ft.Size()
			}

			bitSize := 8 * int(sz)
			al := ft.FieldAlign()
			if al == 0 {
				al = 1
			}
			if al > align {
				align = al
			}

			switch {
			case f.isBitField:
				hasBitfields = true
				eal := 8 * al
				if eal < bitSize {
					eal = bitSize
				}
				down := off &^ (int64(eal) - 1)
				bitoff := off - down
				downMax := off &^ (int64(bitSize) - 1)
				skip := lf != nil && lf.isBitField && lf.bitFieldWidth == 0 ||
					lf != nil && lf.bitFieldWidth == 0 && ctx.cfg.NoFieldAndBitfieldOverlap
				switch {
				case skip || int(off-downMax)+int(f.bitFieldWidth) > bitSize:
					group = 0
					off = roundup(off, 8*int64(al))
					f.offset = uintptr(off >> 3)
					f.bitFieldOffset = 0
					f.bitFieldMask = 1<<f.bitFieldWidth - 1
					off += int64(f.bitFieldWidth)
					if f.bitFieldWidth == 0 {
						lf = f
						continue
					}
				default:
					f.offset = uintptr(down >> 3)
					f.bitFieldOffset = byte(bitoff)
					f.bitFieldMask = (1<<f.bitFieldWidth - 1) << byte(bitoff)
					off += int64(f.bitFieldWidth)
				}
				group += f.bitFieldWidth
			default:
				if n := group % 64; n != 0 {
					if ctx.cfg.FixBitfieldPadding {
						off += int64(normalizeBitFieldWidth(group-n) - group)
					} else {
						group -= n
						off += int64(normalizeBitFieldWidth(group) - group)
					}
				}
				off0 := off
				off = roundup(off, 8*int64(al))
				f.pad = byte(off-off0) >> 3
				f.offset = uintptr(off) >> 3
				off += 8 * int64(sz)
				group = 0
			}
			f.promote = integerPromotion(a, ft)
			lf = f
		}
		t.align = byte(align)
		t.fieldAlign = byte(align)
		off0 := off
		off = roundup(off, 8*int64(align))
		if f != nil && !f.IsBitField() {
			f.pad = byte(off-off0) >> 3
		}
		t.size = uintptr(off >> 3)
		ctx.structs[StructInfo{Size: t.size, Align: t.Align()}] = struct{}{}
	}
	return t
}

func (a *ABI) Ptr(n Node, t Type) Type {
	base := t.base()
	base.align = byte(a.align(Ptr))
	base.fieldAlign = byte(a.fieldAlign(Ptr))
	base.kind = byte(Ptr)
	base.size = uintptr(a.size(Ptr))
	base.flags &^= fIncomplete
	return &pointerType{
		elem:     t,
		typeBase: base,
	}
}

func (a *ABI) gccLayout(ctx *context, n Node, t *structType) (r *structType) {
	if t.IsPacked() {
		return a.gccPackedLayout(ctx, n, t)
	}

	if t.Kind() == Union {
		var off uint128.Uint128 // In bits.
		align := int(t.typeBase.align)
		for _, f := range t.fields {
			switch {
			case f.isBitField:
				f.offset = 0
				f.bitFieldOffset = 0
				f.bitFieldMask = 1<<f.bitFieldWidth - 1
				if uint64(f.bitFieldWidth) > off.Lo {
					off.Lo = uint64(f.bitFieldWidth)
				}
			default:
				al := f.Type().Align()
				if al > align {
					align = al
				}
				f.offset = 0
				off2 := uint128.From64(uint64(f.Type().Size())).Mul64(8)
				if off2.Cmp(off) > 0 {
					off = off2
				}
			}
			f.promote = integerPromotion(a, f.Type())
		}
		t.align = byte(align)
		t.fieldAlign = byte(align)
		off = roundup128(off, 8*uint64(align))
		t.size = uintptr(off.Rsh(3).Lo)
		ctx.structs[StructInfo{Size: t.size, Align: t.Align()}] = struct{}{}
		return t
	}

	var off uint128.Uint128 // In bits.
	align := int(t.typeBase.align)
	for i, f := range t.fields {
		switch {
		case f.isBitField:
			al := f.Type().Align()

			// http://jkz.wtf/bit-field-packing-in-gcc-and-clang

			// 1. Jump backwards to nearest address that would support this type. For
			// example if we have an int jump to the closest address where an int could be
			// stored according to the platform alignment rules.
			down := rounddown128(off, 8*uint64(al))

			// 2. Get sizeof(current field) bytes from that address.
			alloc := int64(f.Type().Size()) * 8
			need := int64(f.bitFieldWidth)
			if need == 0 && i != 0 {
				off = roundup128(off, 8*uint64(al))
				continue
			}

			if al > align {
				align = al
			}
			used := int64(off.Sub(down).Lo)
			switch {
			case alloc-used >= need:
				// 3. If the number of bits that we need to store can be stored in these bits,
				// put the bits in the lowest possible bits of this block.
				off = down.Add64(uint64(used))
				f.offset = uintptr(down.Rsh(3).Lo)
				f.bitFieldOffset = byte(used)
				f.bitFieldMask = (1<<f.bitFieldWidth - 1) << used
				off = off.Add64(uint64(f.bitFieldWidth))
				f.promote = integerPromotion(a, f.Type())
			default:
				// 4. Otherwise, pad the rest of this block with zeros, and store the bits that
				// make up this bit-field in the lowest bits of the next block.
				off = roundup128(off, 8*uint64(al))
				f.offset = uintptr(off.Rsh(3).Lo)
				f.bitFieldOffset = 0
				f.bitFieldMask = 1<<f.bitFieldWidth - 1
				off = off.Add64(uint64(f.bitFieldWidth))
				f.promote = integerPromotion(a, f.Type())
			}
		default:
			al := f.Type().Align()
			if al > align {
				align = al
			}
			off = roundup128(off, 8*uint64(al))
			f.offset = uintptr(off.Rsh(3).Lo)
			sz := uint128.From64(uint64(f.Type().Size()))
			off = off.Add(sz.Mul64(8))
			f.promote = integerPromotion(a, f.Type())
		}
	}
	var lf *field
	for _, f := range t.fields {
		if lf != nil && !lf.isBitField && !f.isBitField {
			lf.pad = byte(f.offset - lf.offset - lf.Type().Size())
		}
		lf = f
	}
	t.align = byte(align)
	t.fieldAlign = byte(align)
	off0 := off
	off = roundup128(off, 8*uint64(align))
	if lf != nil && !lf.IsBitField() {
		lf.pad = byte(off.Sub(off0).Rsh(3).Lo)
	}
	t.size = uintptr(off.Rsh(3).Lo)
	ctx.structs[StructInfo{Size: t.size, Align: t.Align()}] = struct{}{}
	return t
}

func (a *ABI) gccPackedLayout(ctx *context, n Node, t *structType) (r *structType) {
	switch a.arch {
	case "arm", "arm64":
		return a.gccPackedLayoutARM(ctx, n, t)
	}

	if t.typeBase.flags&fAligned == 0 {
		t.align = 1
	}
	t.fieldAlign = t.align
	if t.Kind() == Union {
		var off int64 // In bits.
		for _, f := range t.fields {
			switch {
			case f.isBitField:
				panic(todo("%v: ", n.Position()))
			default:
				f.offset = 0
				if off2 := 8 * int64(f.Type().Size()); off2 > off {
					off = off2
				}
				f.promote = integerPromotion(a, f.Type())
			}
		}
		off = roundup(off, 8)
		t.size = uintptr(off >> 3)
		ctx.structs[StructInfo{Size: t.size, Align: t.Align()}] = struct{}{}
		return t
	}

	var off int64 // In bits.
	for i, f := range t.fields {
		switch {
		case f.isBitField:
			if f.bitFieldWidth == 0 {
				if i != 0 {
					off = roundup(off, 8*int64(f.Type().Align()))
				}
				continue
			}

			if b := f.Type().base(); b.flags&fAligned != 0 {
				off = roundup(off, 8*int64(a.Types[f.Type().Kind()].Align))
			}
			f.offset = uintptr(off >> 3)
			f.bitFieldOffset = byte(off & 7)
			f.bitFieldMask = (1<<f.bitFieldWidth - 1) << f.bitFieldOffset
			off += int64(f.bitFieldWidth)
			f.promote = integerPromotion(a, f.Type())
		default:
			al := f.Type().Align()
			off = roundup(off, 8*int64(al))
			f.offset = uintptr(off) >> 3
			off += 8 * int64(f.Type().Size())
			f.promote = integerPromotion(a, f.Type())
		}
	}
	var lf *field
	for _, f := range t.fields {
		if lf != nil && !lf.isBitField && !f.isBitField {
			lf.pad = byte(f.offset - lf.offset - lf.Type().Size())
		}
		lf = f
	}
	off0 := off
	off = roundup(off, 8*int64(t.Align()))
	if lf != nil && !lf.IsBitField() {
		lf.pad = byte(off-off0) >> 3
	}
	t.size = uintptr(off >> 3)
	ctx.structs[StructInfo{Size: t.size, Align: t.Align()}] = struct{}{}
	return t
}

func (a *ABI) gccPackedLayoutARM(ctx *context, n Node, t *structType) (r *structType) {
	align := 1
	if t.typeBase.flags&fAligned == 0 {
		t.align = 1
	}
	t.fieldAlign = t.align
	if t.Kind() == Union {
		var off int64 // In bits.
		for _, f := range t.fields {
			switch {
			case f.isBitField:
				panic(todo("%v: ", n.Position()))
			default:
				f.offset = 0
				if off2 := 8 * int64(f.Type().Size()); off2 > off {
					off = off2
				}
				f.promote = integerPromotion(a, f.Type())
			}
		}
		off = roundup(off, 8)
		t.size = uintptr(off >> 3)
		ctx.structs[StructInfo{Size: t.size, Align: t.Align()}] = struct{}{}
		return t
	}

	var off int64 // In bits.
	for i, f := range t.fields {
		switch {
		case f.isBitField:
			if f.bitFieldWidth == 0 {
				al := f.Type().Align()
				if al > align {
					align = al
				}
				if i != 0 {
					off = roundup(off, 8*int64(f.Type().Align()))
				}
				continue
			}

			if b := f.Type().base(); b.flags&fAligned != 0 {
				off = roundup(off, 8*int64(a.Types[f.Type().Kind()].Align))
			}
			f.offset = uintptr(off >> 3)
			f.bitFieldOffset = byte(off & 7)
			f.bitFieldMask = (1<<f.bitFieldWidth - 1) << f.bitFieldOffset
			off += int64(f.bitFieldWidth)
			f.promote = integerPromotion(a, f.Type())
		default:
			al := f.Type().Align()
			off = roundup(off, 8*int64(al))
			f.offset = uintptr(off) >> 3
			off += 8 * int64(f.Type().Size())
			f.promote = integerPromotion(a, f.Type())
		}
	}
	var lf *field
	for _, f := range t.fields {
		if lf != nil && !lf.isBitField && !f.isBitField {
			lf.pad = byte(f.offset - lf.offset - lf.Type().Size())
		}
		lf = f
	}
	if b := t.base(); b.flags&fAligned == 0 {
		t.align = byte(align)
		t.fieldAlign = byte(align)
	}
	off0 := off
	off = roundup(off, 8*int64(t.Align()))
	if lf != nil && !lf.IsBitField() {
		lf.pad = byte(off-off0) >> 3
	}
	t.size = uintptr(off >> 3)
	ctx.structs[StructInfo{Size: t.size, Align: t.Align()}] = struct{}{}
	return t
}

// https://gcc.gnu.org/onlinedocs/gcc/x86-Options.html#x86-Options
//
//	-mno-ms-bitfields
//
// Enable/disable bit-field layout compatible with the native Microsoft Windows
// compiler.
//
// If packed is used on a structure, or if bit-fields are used, it may be that
// the Microsoft ABI lays out the structure differently than the way GCC
// normally does. Particularly when moving packed data between functions
// compiled with GCC and the native Microsoft compiler (either via function
// call or as data in a file), it may be necessary to access either format.
//
// This option is enabled by default for Microsoft Windows targets. This
// behavior can also be controlled locally by use of variable or type
// attributes. For more information, see x86 Variable Attributes and x86 Type
// Attributes.
//
// The Microsoft structure layout algorithm is fairly simple with the exception
// of the bit-field packing. The padding and alignment of members of structures
// and whether a bit-field can straddle a storage-unit boundary are determine
// by these rules:
//
// Structure members are stored sequentially in the order in which they are
// declared: the first member has the lowest memory address and the last member
// the highest.  Every data object has an alignment requirement. The alignment
// requirement for all data except structures, unions, and arrays is either the
// size of the object or the current packing size (specified with either the
// aligned attribute or the pack pragma), whichever is less. For structures,
// unions, and arrays, the alignment requirement is the largest alignment
// requirement of its members. Every object is allocated an offset so that:
// offset % alignment_requirement == 0 Adjacent bit-fields are packed into the
// same 1-, 2-, or 4-byte allocation unit if the integral types are the same
// size and if the next bit-field fits into the current allocation unit without
// crossing the boundary imposed by the common alignment requirements of the
// bit-fields.  MSVC interprets zero-length bit-fields in the following ways:
//
// If a zero-length bit-field is inserted between two bit-fields that are
// normally coalesced, the bit-fields are not coalesced.  For example:
//
// 	struct
// 	 {
// 	   unsigned long bf_1 : 12;
// 	   unsigned long : 0;
// 	   unsigned long bf_2 : 12;
// 	 } t1;
//
// The size of t1 is 8 bytes with the zero-length bit-field. If the zero-length
// bit-field were removed, t1’s size would be 4 bytes.
//
// If a zero-length bit-field is inserted after a bit-field, foo, and the
// alignment of the zero-length bit-field is greater than the member that
// follows it, bar, bar is aligned as the type of the zero-length bit-field.
// For example:
//
// 	struct
// 	 {
// 	   char foo : 4;
// 	   short : 0;
// 	   char bar;
// 	 } t2;
//
// 	struct
// 	 {
// 	   char foo : 4;
// 	   short : 0;
// 	   double bar;
// 	 } t3;
//
// For t2, bar is placed at offset 2, rather than offset 1. Accordingly, the
// size of t2 is 4. For t3, the zero-length bit-field does not affect the
// alignment of bar or, as a result, the size of the structure.
//
// Taking this into account, it is important to note the following:
//
// If a zero-length bit-field follows a normal bit-field, the type of the
// zero-length bit-field may affect the alignment of the structure as whole.
// For example, t2 has a size of 4 bytes, since the zero-length bit-field
// follows a normal bit-field, and is of type short.  Even if a zero-length
// bit-field is not followed by a normal bit-field, it may still affect the
// alignment of the structure:
//
// 	struct
// 	 {
// 	   char foo : 6;
// 	   long : 0;
// 	 } t4;
//
// Here, t4 takes up 4 bytes.
//
// Zero-length bit-fields following non-bit-field members are ignored:
//
// 	struct
// 	 {
// 	   char foo;
// 	   long : 0;
// 	   char bar;
// 	 } t5;
//
// Here, t5 takes up 2 bytes.

func (a *ABI) msLayout(ctx *context, n Node, t *structType) (r *structType) {
	if t.IsPacked() {
		return a.msPackedLayout(ctx, n, t)
	}

	if t.Kind() == Union {
		panic(todo(""))
	}

	var off int64 // In bits.
	align := int(t.typeBase.align)
	var prev *field
	for i, f := range t.fields {
		switch {
		case f.isBitField:
			al := f.Type().Align()
			if prev != nil {
				switch {
				case prev.isBitField && prev.Type().Size() != f.Type().Size():
					off = roundup(off, 8*int64(prev.Type().Align()))
					off = roundup(off, 8*int64(al))
				case !prev.isBitField:
					off = roundup(off, 8*int64(al))
				default:
					// Adjacent bit-fields are packed into the same 1-, 2-, or 4-byte allocation
					// unit if the integral types are the same size and if the next bit-field fits
					// into the current allocation unit without crossing the boundary imposed by
					// the common alignment requirements of the bit-fields.
				}
			}

			// http://jkz.wtf/bit-field-packing-in-gcc-and-clang

			// 1. Jump backwards to nearest address that would support this type. For
			// example if we have an int jump to the closest address where an int could be
			// stored according to the platform alignment rules.
			down := rounddown(off, 8*int64(al))

			// 2. Get sizeof(current field) bytes from that address.
			alloc := int64(f.Type().Size()) * 8
			need := int64(f.bitFieldWidth)
			if need == 0 && i != 0 {
				off = roundup(off, 8*int64(al))
				continue
			}

			if al > align {
				align = al
			}
			used := off - down
			switch {
			case alloc-used >= need:
				// 3. If the number of bits that we need to store can be stored in these bits,
				// put the bits in the lowest possible bits of this block.
				off = down + used
				f.offset = uintptr(down >> 3)
				f.bitFieldOffset = byte(used)
				f.bitFieldMask = (1<<f.bitFieldWidth - 1) << used
				off += int64(f.bitFieldWidth)
				f.promote = integerPromotion(a, f.Type())
			default:
				// 4. Otherwise, pad the rest of this block with zeros, and store the bits that
				// make up this bit-field in the lowest bits of the next block.
				off = roundup(off, 8*int64(al))
				f.offset = uintptr(off >> 3)
				f.bitFieldOffset = 0
				f.bitFieldMask = 1<<f.bitFieldWidth - 1
				off += int64(f.bitFieldWidth)
				f.promote = integerPromotion(a, f.Type())
			}
		default:
			if prev != nil && prev.isBitField {
				off = roundup(off, 8*int64(prev.Type().Align()))
			}
			al := f.Type().Align()
			if al > align {
				align = al
			}
			off = roundup(off, 8*int64(al))
			f.offset = uintptr(off) >> 3
			off += 8 * int64(f.Type().Size())
			f.promote = integerPromotion(a, f.Type())
		}
		prev = f
	}
	var lf *field
	for _, f := range t.fields {
		if lf != nil && !lf.isBitField && !f.isBitField {
			lf.pad = byte(f.offset - lf.offset - lf.Type().Size())
		}
		lf = f
	}
	t.align = byte(align)
	t.fieldAlign = byte(align)
	off0 := off
	off = roundup(off, 8*int64(align))
	if lf != nil && !lf.IsBitField() {
		lf.pad = byte(off-off0) >> 3
	}
	t.size = uintptr(off >> 3)
	ctx.structs[StructInfo{Size: t.size, Align: t.Align()}] = struct{}{}
	return t
}

func (a *ABI) msPackedLayout(ctx *context, n Node, t *structType) (r *structType) {
	if t.typeBase.flags&fAligned == 0 {
		t.align = 1
	}
	t.fieldAlign = t.align
	if t.Kind() == Union {
		panic(todo(""))
		var off int64 // In bits.
		for _, f := range t.fields {
			switch {
			case f.isBitField:
				panic(todo("%v: ", n.Position()))
			default:
				f.offset = 0
				if off2 := 8 * int64(f.Type().Size()); off2 > off {
					off = off2
				}
				f.promote = integerPromotion(a, f.Type())
			}
		}
		off = roundup(off, 8)
		t.size = uintptr(off >> 3)
		ctx.structs[StructInfo{Size: t.size, Align: t.Align()}] = struct{}{}
		return t
	}

	var off int64 // In bits.
	var prev *field
	align := int(t.typeBase.align)
	for i, f := range t.fields {
	out:
		switch {
		case f.isBitField:
			al := f.Type().Align()
			switch {
			case prev != nil && prev.IsBitField() && prev.Type().Size() != f.Type().Size():
				off = mathutil.MaxInt64(off, int64(prev.Offset()*8)+int64(prev.BitFieldOffset()+8*prev.Type().Align()))
				off = roundup(off, 8*int64(align))
				f.offset = uintptr(off >> 3)
				f.bitFieldOffset = 0
				f.bitFieldMask = 1<<f.bitFieldWidth - 1
				off += int64(f.bitFieldWidth)
				f.promote = integerPromotion(a, f.Type())
				break out
			}

			// http://jkz.wtf/bit-field-packing-in-gcc-and-clang

			// 1. Jump backwards to nearest address that would support this type. For
			// example if we have an int jump to the closest address where an int could be
			// stored according to the platform alignment rules.
			down := rounddown(off, 8*int64(al))

			// 2. Get sizeof(current field) bytes from that address.
			alloc := int64(f.Type().Size()) * 8
			need := int64(f.bitFieldWidth)
			if need == 0 && i != 0 {
				off = roundup(off, 8*int64(al))
				continue
			}

			used := off - down
			switch {
			case alloc-used >= need:
				// 3. If the number of bits that we need to store can be stored in these bits,
				// put the bits in the lowest possible bits of this block.
				off = down + used
				f.offset = uintptr(down >> 3)
				f.bitFieldOffset = byte(used)
				f.bitFieldMask = (1<<f.bitFieldWidth - 1) << used
				off += int64(f.bitFieldWidth)
				f.promote = integerPromotion(a, f.Type())
			default:
				// 4. Otherwise, pad the rest of this block with zeros, and store the bits that
				// make up this bit-field in the lowest bits of the next block.
				off = roundup(off, 8*int64(al))
				f.offset = uintptr(off >> 3)
				f.bitFieldOffset = 0
				f.bitFieldMask = 1<<f.bitFieldWidth - 1
				off += int64(f.bitFieldWidth)
				f.promote = integerPromotion(a, f.Type())
			}
		default:
			off = roundup(off, 8)
			f.offset = uintptr(off) >> 3
			off += 8 * int64(f.Type().Size())
			f.promote = integerPromotion(a, f.Type())
		}
		prev = f
	}
	var lf *field
	for _, f := range t.fields {
		if lf != nil && !lf.isBitField && !f.isBitField {
			lf.pad = byte(f.offset - lf.offset - lf.Type().Size())
		}
		lf = f
	}
	t.align = byte(align)
	t.fieldAlign = byte(align)
	switch {
	case lf != nil && lf.IsBitField():
		off = mathutil.MaxInt64(off, int64(lf.Offset()*8)+int64(lf.BitFieldOffset()+8*lf.Type().Align()))
		off = roundup(off, 8*int64(align))
	default:
		off0 := off
		off = roundup(off, 8*int64(align))
		if lf != nil && !lf.IsBitField() {
			lf.pad = byte(off-off0) >> 3
		}
	}
	t.size = uintptr(off >> 3)
	ctx.structs[StructInfo{Size: t.size, Align: t.Align()}] = struct{}{}
	return t
}
