// Copyright 2017 The Memory Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build amd64 || arm64
// +build amd64 arm64

package memory

import (
	_ "unsafe"
)

// Function syscall.mmap for darwin and openbsd calls internal/abi.FuncPCABI0,
// which is implemented as a compile intrinsic so the code cannot be reused.
// Using go:linkname directive to link mmapSyscall to syscall.mmap

//go:linkname mmapSyscall syscall.mmap
func mmapSyscall(addr uintptr, length uintptr, prot int, flags int, fd int, offset int64) (xaddr uintptr, err error)
