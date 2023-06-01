// Copyright 2020 The Libc Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build 386 || arm
// +build 386 arm

package libc // import "modernc.org/libc"

const (
	heapSize = 1 << 30 // Adjust for your debugging session requirements and system RAM size.
)

type (
	// RawMem represents the biggest byte array the runtime can handle
	RawMem [1<<31 - 1]byte

	// 32-5*4 = 12 bytes left to pad
	stackHeaderPadding struct {
		a uintptr
		b uintptr
		c uintptr
	}
)

type bits []int

func newBits(n int) (r bits)  { return make(bits, (n+31)>>5) }
func (b bits) has(n int) bool { return b != nil && b[n>>5]&(1<<uint(n&31)) != 0 }
func (b bits) set(n int)      { b[n>>5] |= 1 << uint(n&31) }
