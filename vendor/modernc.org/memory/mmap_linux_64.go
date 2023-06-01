// Copyright 2009 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE-GO file.

//go:build linux && (amd64 || arm64 || mips64 || mips64le || riscv64 || ppc64le)
// +build linux
// +build amd64 arm64 mips64 mips64le riscv64 ppc64le

package memory

import (
	"syscall"
)

// Function syscall.mmap is same for linux/amd64, linux/arm64, linux/mips64,
// linux/mips64le and linux/riscv64.

// https://cs.opensource.google/go/go/+/refs/tags/go1.17.8:src/syscall/zsyscall_linux_amd64.go;l=1575-1584
func mmapSyscall(addr uintptr, length uintptr, prot int, flags int, fd int, offset int64) (xaddr uintptr, err error) {
	r0, _, e1 := syscall.Syscall6(syscall.SYS_MMAP, uintptr(addr), uintptr(length), uintptr(prot), uintptr(flags), uintptr(fd), uintptr(offset))
	xaddr = uintptr(r0)
	if e1 != 0 {
		err = e1
	}
	return
}
