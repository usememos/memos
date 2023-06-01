// Copyright 2019 The CC Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package cc // import "modernc.org/cc/v3"

// Values of Kind
const (
	Invalid Kind = iota

	Array             // T[]
	Bool              // _Bool
	Char              // char
	ComplexChar       // complex char
	ComplexDouble     // complex double
	ComplexFloat      // complex float
	ComplexInt        // complex int
	ComplexLong       // complex long
	ComplexLongDouble // complex long double
	ComplexLongLong   // complex long long
	ComplexShort      // complex short
	ComplexUInt       // complex unsigned
	ComplexULong      // complex unsigned long
	ComplexULongLong  // complex unsigned long long
	ComplexUShort     // complex shor
	Decimal128        // _Decimal128
	Decimal32         // _Decimal32
	Decimal64         // _Decimal64
	Double            // double
	Enum              // enum
	Float             // float
	Float128          // _Float128
	Float32           // _Float32
	Float32x          // _Float32x
	Float64           // _Float64
	Float64x          // _Float64x
	Function          // function
	Int               // int
	Int8              // __int8
	Int16             // __int16
	Int32             // __int32
	Int64             // __int64
	Int128            // __int128
	Long              // long
	LongDouble        // long double
	LongLong          // long long
	Ptr               // pointer
	SChar             // signed char
	Short             // short
	Struct            // struct
	TypedefName       // typedefname
	UChar             // unsigned char
	UInt              // unsigned
	UInt8             // unsigned __int8
	UInt16            // unsigned __int16
	UInt32            // unsigned __int32
	UInt64            // unsigned __int64
	UInt128           // unsigned __int128
	ULong             // unsigned long
	ULongLong         // unsigned long long
	UShort            // unsigned short
	Union             // union
	Void              // void
	Vector            // vector

	typeofExpr
	typeofType

	maxKind
)

// Values of Linkage
const (
	None Linkage = iota
	Internal
	External
)

// Values of StorageClass
const (
	Static StorageClass = iota
	Automatic
	Allocated
)
