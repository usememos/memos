// Copyright 2020 The Libc Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package libc // import "modernc.org/libc"

import (
	"os"
	"strings"
	"unicode"
	"unsafe"

	"golang.org/x/sys/unix"
	"modernc.org/libc/errno"
	"modernc.org/libc/fcntl"
	"modernc.org/libc/signal"
	"modernc.org/libc/sys/types"
	"modernc.org/libc/utime"
	"modernc.org/libc/wctype"
)

// int sigaction(int signum, const struct sigaction *act, struct sigaction *oldact);
func Xsigaction(t *TLS, signum int32, act, oldact uintptr) int32 {
	// 	musl/arch/x86_64/ksigaction.h
	//
	//	struct k_sigaction {
	//		void (*handler)(int);
	//		unsigned long flags;
	//		void (*restorer)(void);
	//		unsigned mask[2];
	//	};
	type k_sigaction struct {
		handler  uintptr
		flags    ulong
		restorer uintptr
		mask     [2]uint32
	}

	var kact, koldact uintptr
	if act != 0 {
		sz := int(unsafe.Sizeof(k_sigaction{}))
		kact = t.Alloc(sz)
		defer t.Free(sz)
		*(*k_sigaction)(unsafe.Pointer(kact)) = k_sigaction{
			handler:  (*signal.Sigaction)(unsafe.Pointer(act)).F__sigaction_handler.Fsa_handler,
			flags:    ulong((*signal.Sigaction)(unsafe.Pointer(act)).Fsa_flags),
			restorer: (*signal.Sigaction)(unsafe.Pointer(act)).Fsa_restorer,
		}
		Xmemcpy(t, kact+unsafe.Offsetof(k_sigaction{}.mask), act+unsafe.Offsetof(signal.Sigaction{}.Fsa_mask), types.Size_t(unsafe.Sizeof(k_sigaction{}.mask)))
	}
	if oldact != 0 {
		panic(todo(""))
	}

	if _, _, err := unix.Syscall6(unix.SYS_RT_SIGACTION, uintptr(signum), kact, koldact, unsafe.Sizeof(k_sigaction{}.mask), 0, 0); err != 0 {
		t.setErrno(err)
		return -1
	}

	if oldact != 0 {
		panic(todo(""))
	}

	return 0
}

// int fcntl(int fd, int cmd, ... /* arg */ );
func Xfcntl64(t *TLS, fd, cmd int32, args uintptr) int32 {
	var arg uintptr
	if args != 0 {
		arg = *(*uintptr)(unsafe.Pointer(args))
	}
	if cmd == fcntl.F_SETFL {
		arg |= unix.O_LARGEFILE
	}
	n, _, err := unix.Syscall(unix.SYS_FCNTL, uintptr(fd), uintptr(cmd), arg)
	if err != 0 {
		// if dmesgs {
		// 	dmesg("%v: fd %v cmd %v", origin(1), fcntlCmdStr(fd), cmd)
		// }
		t.setErrno(err)
		return -1
	}

	// if dmesgs {
	// 	dmesg("%v: %d %s %#x: %d", origin(1), fd, fcntlCmdStr(cmd), arg, n)
	// }
	return int32(n)
}

// int fstatat(int dirfd, const char *pathname, struct stat *statbuf, int flags);
func Xfstatat(t *TLS, dirfd int32, pathname, statbuf uintptr, flags int32) int32 {
	// From golang.org/x/sys/unix/zsyscall_linux_riscv64.go
	if _, _, err := unix.Syscall6(unix.SYS_FSTATAT, uintptr(dirfd), pathname, statbuf, uintptr(flags), 0, 0); err != 0 {
		t.setErrno(err)
		return -1
	}

	return 0
}

// int lstat(const char *pathname, struct stat *statbuf);
func Xlstat64(t *TLS, pathname, statbuf uintptr) int32 {
	// From golang.org/x/sys/unix/syscall_linux_riscv64.go
	return Xfstatat(t, unix.AT_FDCWD, pathname, statbuf, unix.AT_SYMLINK_NOFOLLOW)
}

// int stat(const char *pathname, struct stat *statbuf);
func Xstat64(t *TLS, pathname, statbuf uintptr) int32 {
	// From golang.org/x/sys/unix/syscall_linux_riscv64.go
	return Xfstatat(t, unix.AT_FDCWD, pathname, statbuf, 0)
}

// int fstat(int fd, struct stat *statbuf);
func Xfstat64(t *TLS, fd int32, statbuf uintptr) int32 {
	if _, _, err := unix.Syscall(unix.SYS_FSTAT, uintptr(fd), statbuf, 0); err != 0 {
		// if dmesgs {
		// 	dmesg("%v: fd %d: %v", origin(1), fd, err)
		// }
		t.setErrno(err)
		return -1
	}

	// if dmesgs {
	// 	dmesg("%v: %d size %#x: ok\n%+v", origin(1), fd, (*stat.Stat)(unsafe.Pointer(statbuf)).Fst_size, (*stat.Stat)(unsafe.Pointer(statbuf)))
	// }
	return 0
}

func Xmmap(t *TLS, addr uintptr, length types.Size_t, prot, flags, fd int32, offset types.Off_t) uintptr {
	return Xmmap64(t, addr, length, prot, flags, fd, offset)
}

// void *mmap(void *addr, size_t length, int prot, int flags, int fd, off_t offset);
func Xmmap64(t *TLS, addr uintptr, length types.Size_t, prot, flags, fd int32, offset types.Off_t) uintptr {
	data, _, err := unix.Syscall6(unix.SYS_MMAP, addr, uintptr(length), uintptr(prot), uintptr(flags), uintptr(fd), uintptr(offset))
	if err != 0 {
		// if dmesgs {
		// 	dmesg("%v: %v", origin(1), err)
		// }
		t.setErrno(err)
		return ^uintptr(0) // (void*)-1
	}

	// if dmesgs {
	// 	dmesg("%v: %#x", origin(1), data)
	// }
	return data
}

// void *mremap(void *old_address, size_t old_size, size_t new_size, int flags, ... /* void *new_address */);
func Xmremap(t *TLS, old_address uintptr, old_size, new_size types.Size_t, flags int32, args uintptr) uintptr {
	var arg uintptr
	if args != 0 {
		arg = *(*uintptr)(unsafe.Pointer(args))
	}
	data, _, err := unix.Syscall6(unix.SYS_MREMAP, old_address, uintptr(old_size), uintptr(new_size), uintptr(flags), arg, 0)
	if err != 0 {
		// if dmesgs {
		// 	dmesg("%v: %v", origin(1), err)
		// }
		t.setErrno(err)
		return ^uintptr(0) // (void*)-1
	}

	// if dmesgs {
	// 	dmesg("%v: %#x", origin(1), data)
	// }
	return data
}

// int ftruncate(int fd, off_t length);
func Xftruncate64(t *TLS, fd int32, length types.Off_t) int32 {
	if _, _, err := unix.Syscall(unix.SYS_FTRUNCATE, uintptr(fd), uintptr(length), 0); err != 0 {
		// if dmesgs {
		// 	dmesg("%v: fd %d: %v", origin(1), fd, err)
		// }
		t.setErrno(err)
		return -1
	}

	// if dmesgs {
	// 	dmesg("%v: %d %#x: ok", origin(1), fd, length)
	// }
	return 0
}

// off64_t lseek64(int fd, off64_t offset, int whence);
func Xlseek64(t *TLS, fd int32, offset types.Off_t, whence int32) types.Off_t {
	n, _, err := unix.Syscall(unix.SYS_LSEEK, uintptr(fd), uintptr(offset), uintptr(whence))
	if err != 0 {
		// if dmesgs {
		// 	dmesg("%v: fd %v, off %#x, whence %v: %v", origin(1), fd, offset, whenceStr(whence), err)
		// }
		t.setErrno(err)
		return -1
	}

	// if dmesgs {
	// 	dmesg("%v: fd %v, off %#x, whence %v: %#x", origin(1), fd, offset, whenceStr(whence), n)
	// }
	return types.Off_t(n)
}

// From man utime executed on linux/riscv64:
//
// The utimbuf structure is:
//
//            struct utimbuf {
//                time_t actime;       /* access time */
//                time_t modtime;      /* modification time */
//            };

type utimbuf struct {
	actime  utime.Time_t
	modtime utime.Time_t
}

// int utime(const char *filename, const struct utimbuf *times);
func Xutime(t *TLS, filename, times uintptr) int32 {
	if times == 0 {
		return Xutimes(t, filename, 0)
	}

	n := int(unsafe.Sizeof([2]types.Timeval{}))
	p := t.Alloc(n)
	defer t.Free(n)
	*(*[2]types.Timeval)(unsafe.Pointer(p)) = [2]types.Timeval{
		{Ftv_sec: (*utimbuf)(unsafe.Pointer(times)).actime},
		{Ftv_sec: (*utimbuf)(unsafe.Pointer(times)).modtime},
	}
	return Xutimes(t, filename, p)
}

// unsigned int alarm(unsigned int seconds);
func Xalarm(t *TLS, seconds uint32) uint32 {
	panic(todo(""))
	// No alarm syscall on linux/riscv64. And cannot implement with setitimer as in musl,
	// because of missing defination to constant ITIMER_REAL in types_linux_riscv64.go.
}

// time_t time(time_t *tloc);
func Xtime(t *TLS, tloc uintptr) types.Time_t {
	// From golang.org/x/sys/unix/syscall_linux_riscv64.go
	var tv types.Timeval
	if err := Xgettimeofday(t, uintptr(unsafe.Pointer(&tv)), 0); err != 0 {
		t.setErrno(err)
		return -1
	}

	if tloc != 0 {
		*(*types.Time_t)(unsafe.Pointer(tloc)) = tv.Ftv_sec
	}
	return tv.Ftv_sec
}

// int getrlimit(int resource, struct rlimit *rlim);
func Xgetrlimit64(t *TLS, resource int32, rlim uintptr) int32 {
	if _, _, err := unix.Syscall(unix.SYS_GETRLIMIT, uintptr(resource), uintptr(rlim), 0); err != 0 {
		t.setErrno(err)
		return -1
	}

	return 0
}

// int mkdir(const char *path, mode_t mode);
func Xmkdir(t *TLS, path uintptr, mode types.Mode_t) int32 {
	// From golang.org/x/sys/unix/syscall_linux.go
	return Xmkdirat(t, unix.AT_FDCWD, path, mode)
}

// int symlink(const char *target, const char *linkpath);
func Xsymlink(t *TLS, target, linkpath uintptr) int32 {
	// From golang.org/x/sys/unix/syscall_linux.go
	return Xsymlinkat(t, target, unix.AT_FDCWD, linkpath)
}

// int chmod(const char *pathname, mode_t mode)
func Xchmod(t *TLS, pathname uintptr, mode types.Mode_t) int32 {
	// From golang.org/x/sys/unix/syscall_linux.go
	return Xfchmodat(t, unix.AT_FDCWD, pathname, mode, 0)
}

// int utimes(const char *filename, const struct timeval times[2]);
func Xutimes(t *TLS, filename, times uintptr) int32 {
	return Xutimensat(t, unix.AT_FDCWD, filename, times, 0)
}

// int unlink(const char *pathname);
func Xunlink(t *TLS, pathname uintptr) int32 {
	// From golang.org/x/sys/unix/syscall_linux.go
	return Xunlinkat(t, unix.AT_FDCWD, pathname, 0)
}

// int access(const char *pathname, int mode);
func Xaccess(t *TLS, pathname uintptr, mode int32) int32 {
	// From golang.org/x/sys/unix/syscall_linux.go
	return Xfaccessat(t, unix.AT_FDCWD, pathname, mode, 0)
}

// int rmdir(const char *pathname);
func Xrmdir(t *TLS, pathname uintptr) int32 {
	// From golang.org/x/sys/unix/syscall_linux.go
	return Xunlinkat(t, unix.AT_FDCWD, pathname, unix.AT_REMOVEDIR)
}

// int rename(const char *oldpath, const char *newpath);
func Xrename(t *TLS, oldpath, newpath uintptr) int32 {
	// From golang.org/x/sys/unix/syscall_linux.go
	return Xrenameat(t, unix.AT_FDCWD, oldpath, unix.AT_FDCWD, newpath)
}

// int renameat(int olddirfd, const char *oldpath,	int newdirfd, const char *newpath);
func Xrenameat(t *TLS, olddirfd int32, oldpath uintptr, newdirfd int32, newpath uintptr) int32 {
	// From golang.org/x/sys/unix/syscall_linux_riscv64.go
	return Xrenameat2(t, olddirfd, oldpath, newdirfd, newpath, 0)
}

// int mknod(const char *pathname, mode_t mode, dev_t dev);
func Xmknod(t *TLS, pathname uintptr, mode types.Mode_t, dev types.Dev_t) int32 {
	// From golang.org/x/sys/unix/syscall_linux.go
	return Xmknodat(t, unix.AT_FDCWD, pathname, mode, dev)
}

// int chown(const char *pathname, uid_t owner, gid_t group);
func Xchown(t *TLS, pathname uintptr, owner types.Uid_t, group types.Gid_t) int32 {
	// From golang.org/x/sys/unix/syscall_linux.go
	return Xfchownat(t, unix.AT_FDCWD, pathname, owner, group, 0)
}

// int link(const char *oldpath, const char *newpath);
func Xlink(t *TLS, oldpath, newpath uintptr) int32 {
	// From golang.org/x/sys/unix/syscall_linux.go
	return Xlinkat(t, unix.AT_FDCWD, oldpath, unix.AT_FDCWD, newpath, 0)
}

// int pipe(int pipefd[2]);
func Xpipe(t *TLS, pipefd uintptr) int32 {
	// From golang.org/x/sys/unix/syscall_linux.go
	return Xpipe2(t, pipefd, 0)
}

// int dup2(int oldfd, int newfd);
func Xdup2(t *TLS, oldfd, newfd int32) int32 {
	// From golang.org/x/sys/unix/syscall_linux.go
	return Xdup3(t, oldfd, newfd, 0)
}

// ssize_t readlink(const char *restrict path, char *restrict buf, size_t bufsize);
func Xreadlink(t *TLS, path, buf uintptr, bufsize types.Size_t) types.Ssize_t {
	// From golang.org/x/sys/unix/syscall_linux.go
	return Xreadlinkat(t, unix.AT_FDCWD, path, buf, bufsize)
}

// FILE *fopen64(const char *pathname, const char *mode);
func Xfopen64(t *TLS, pathname, mode uintptr) uintptr {
	m := strings.ReplaceAll(GoString(mode), "b", "")
	var flags int
	switch m {
	case "r":
		flags = os.O_RDONLY
	case "r+":
		flags = os.O_RDWR
	case "w":
		flags = os.O_WRONLY | os.O_CREATE | os.O_TRUNC
	case "w+":
		flags = os.O_RDWR | os.O_CREATE | os.O_TRUNC
	case "a":
		flags = os.O_WRONLY | os.O_CREATE | os.O_APPEND
	case "a+":
		flags = os.O_RDWR | os.O_CREATE | os.O_APPEND
	default:
		panic(m)
	}
	//TODO- flags |= fcntl.O_LARGEFILE

	// From golang.org/x/sys/unix/syscall_linux.go
	fd := Xopenat(t, unix.AT_FDCWD, pathname, int32(flags|unix.O_LARGEFILE), 0666)
	if fd == -1 {
		return 0
	}

	if p := newFile(t, fd); p != 0 {
		return p
	}

	Xclose(t, fd)
	t.setErrno(errno.ENOMEM)
	return 0
}

// int iswspace(wint_t wc);
func Xiswspace(t *TLS, wc wctype.Wint_t) int32 {
	return Bool32(unicode.IsSpace(rune(wc)))
}

// int iswalnum(wint_t wc);
func Xiswalnum(t *TLS, wc wctype.Wint_t) int32 {
	return Bool32(unicode.IsLetter(rune(wc)) || unicode.IsNumber(rune(wc)))
}

func __syscall1(t *TLS, trap, p1 long) long {
	return __syscall(unix.Syscall(uintptr(trap), uintptr(p1), 0, 0))
}

func __syscall3(t *TLS, trap, p1, p2, p3 long) long {
	return __syscall(unix.Syscall(uintptr(trap), uintptr(p1), uintptr(p2), uintptr(p3)))
}

func __syscall4(t *TLS, trap, p1, p2, p3, p4 long) long {
	return __syscall(unix.Syscall6(uintptr(trap), uintptr(p1), uintptr(p2), uintptr(p3), uintptr(p4), 0, 0))
}
