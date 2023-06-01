// Copyright 2011 Evan Shaw. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE-MMAP-GO file.

// Modifications (c) 2022 The Memory Authors.

package memory // import "modernc.org/memory"

import (
	"os"
	"syscall"
	_ "unsafe"
)

const (
	pageSizeLog = 20

	// $ find /usr/include -name syscall.h
	// /usr/include/sys/syscall.h
	// $ grep -ni munmap /usr/include/sys/syscall.h
	// 293:#define     SYS_munmap      117
	// $ grep -ni mmap /usr/include/sys/syscall.h
	// 291:#define	SYS_mmap	115
	// 303:#define	SYS_mmapobj	127
	// 442:#define	SYS_mmap64		214
	// $
	// $ uname -a
	// SunOS omnios64 5.11 omnios-r151044-d3b715b9d1 i86pc i386 i86pc
	// $
	sys_MUNMAP = 117
	sys_MMAP   = 214
)

var (
	osPageMask = osPageSize - 1
	osPageSize = os.Getpagesize()
)

//go:linkname mmapSyscall syscall.mmap
func mmapSyscall(addr uintptr, length uintptr, prot int, flags int, fd int, offset int64) (xaddr uintptr, err error)

func unmap(addr uintptr, size int) error {
	_, _, errno := syscall.Syscall(sys_MUNMAP, addr, uintptr(size), 0)
	if errno != 0 {
		return errno
	}

	return nil
}

// pageSize aligned.
func mmap(size int) (uintptr, int, error) {
	size = roundup(size, osPageSize)
	// The actual mmap syscall varies by architecture. mmapSyscall provides same
	// functionality as the unexported funtion syscall.mmap and is declared in
	// mmap_*_*.go and mmap_fallback.go. To add support for a new architecture,
	// check function mmap in src/syscall/syscall_*_*.go or
	// src/syscall/zsyscall_*_*.go in Go's source code.
	p, err := mmapSyscall(0, uintptr(size+pageSize), syscall.PROT_READ|syscall.PROT_WRITE, syscall.MAP_PRIVATE|syscall.MAP_ANON, -1, 0)
	if err != nil {
		return 0, 0, err
	}

	n := size + pageSize
	if p&uintptr(osPageMask) != 0 {
		panic("internal error")
	}

	mod := int(p) & pageMask
	if mod != 0 {
		m := pageSize - mod
		if err := unmap(p, m); err != nil {
			return 0, 0, err
		}

		n -= m
		p += uintptr(m)
	}

	if p&uintptr(pageMask) != 0 {
		panic("internal error")
	}

	if n-size != 0 {
		if err := unmap(p+uintptr(size), n-size); err != nil {
			return 0, 0, err
		}
	}

	return p, size, nil
}
