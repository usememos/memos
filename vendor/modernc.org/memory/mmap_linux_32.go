// Copyright 2009 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE-GO file.

//go:build linux && (386 || arm || mips || mipsle)
// +build linux
// +build 386 arm mips mipsle

package memory

import (
	"syscall"
)

// Function syscall.mmap and syscall.mmap2 are same for linux/386, linux/arm,
// linux/mips and linux/mipsle

// https://cs.opensource.google/go/go/+/refs/tags/go1.17.8:src/syscall/syscall_linux_386.go;l=99-105
func mmapSyscall(addr uintptr, length uintptr, prot int, flags int, fd int, offset int64) (xaddr uintptr, err error) {
	page := uintptr(offset / 4096)
	if offset != int64(page)*4096 {
		return 0, syscall.EINVAL
	}
	return mmap2Syscall(addr, length, prot, flags, fd, page)
}

// https://cs.opensource.google/go/go/+/refs/tags/go1.17.8:src/syscall/zsyscall_linux_386.go;l=1361-1370
func mmap2Syscall(addr uintptr, length uintptr, prot int, flags int, fd int, pageOffset uintptr) (xaddr uintptr, err error) {
	r0, _, e1 := syscall.Syscall6(syscall.SYS_MMAP2, uintptr(addr), uintptr(length), uintptr(prot), uintptr(flags), uintptr(fd), uintptr(pageOffset))
	xaddr = uintptr(r0)
	if e1 != 0 {
		err = e1
	}
	return
}
