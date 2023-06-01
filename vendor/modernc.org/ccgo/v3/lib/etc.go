// Copyright 2020 The CCGO Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package ccgo // import "modernc.org/ccgo/v3/lib"

import (
	"fmt"
	"math"
	"math/big"

	"modernc.org/cc/v3"
)

var (
	reservedNames = map[string]bool{
		"bool":        false, // ccgo can use
		"break":       true,  // keyword
		"case":        true,  // keyword
		"chan":        true,  // keyword
		"const":       true,  // keyword
		"continue":    true,  // keyword
		"default":     true,  // keyword
		"defer":       true,  // keyword
		"else":        true,  // keyword
		"fallthrough": true,  // keyword
		"false":       false, // ccgo can use
		"float32":     false, // ccgo can use
		"float64":     false, // ccgo can use
		"for":         true,  // keyword
		"func":        true,  // keyword
		"go":          true,  // keyword
		"goto":        true,  // keyword
		"if":          true,  // keyword
		"import":      true,  // keyword
		"init":        false, // special name
		"int16":       false, // ccgo can use
		"int32":       false, // ccgo can use
		"int64":       false, // ccgo can use
		"int8":        false, // ccgo can use
		"interface":   true,  // keyword
		"map":         true,  // keyword
		"math":        false, // package name
		"nil":         false, // ccgo can use
		"package":     true,  // keyword
		"range":       true,  // keyword
		"return":      true,  // keyword
		"select":      true,  // keyword
		"struct":      true,  // keyword
		"switch":      true,  // keyword
		"true":        false, // ccgo can use
		"type":        true,  // keyword
		"types":       false, // package name
		"uint16":      false, // ccgo can use
		"uint32":      false, // ccgo can use
		"uint64":      false, // ccgo can use
		"uint8":       false, // ccgo can use
		"uintptr":     false, // ccgo can use
		"unsafe":      false, // package name
		"var":         true,  // keyword
	}

	reservedIds []cc.StringID

	maxInt32  = big.NewInt(math.MaxInt32)
	maxInt64  = big.NewInt(math.MaxInt64)
	maxUint32 = big.NewInt(math.MaxUint32)
	maxUint64 = big.NewInt(0).SetUint64(math.MaxUint64)
	minInt32  = big.NewInt(math.MinInt32)
	minInt64  = big.NewInt(math.MinInt64)
)

func init() {
	for k := range reservedNames {
		reservedIds = append(reservedIds, cc.String(k))
	}
}

type scope map[cc.StringID]int32

func newScope() scope {
	s := scope{}
	for _, k := range reservedIds {
		s[k] = 0
	}
	return s
}

func (s scope) take(t cc.StringID) string {
	if t == 0 {
		panic(todo("internal error"))
	}

	n, ok := s[t]
	if !ok {
		s[t] = 0
		return t.String()
	}

	for {
		n++
		s[t] = n
		r := fmt.Sprintf("%s%d", t, n)
		id := cc.String(r)
		if _, ok := s[id]; !ok {
			s[id] = 0
			return r
		}
	}
}
