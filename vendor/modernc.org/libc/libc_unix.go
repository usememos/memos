// Copyright 2020 The Libc Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build linux || darwin || freebsd || netbsd || openbsd
// +build linux darwin freebsd netbsd openbsd

package libc // import "modernc.org/libc"

import (
	"bufio"
	"io/ioutil"
	"math"
	"math/rand"
	"os"
	gosignal "os/signal"
	"reflect"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
	"unsafe"

	guuid "github.com/google/uuid"
	"golang.org/x/sys/unix"
	"modernc.org/libc/errno"
	"modernc.org/libc/grp"
	"modernc.org/libc/poll"
	"modernc.org/libc/pwd"
	"modernc.org/libc/signal"
	"modernc.org/libc/stdio"
	"modernc.org/libc/stdlib"
	"modernc.org/libc/sys/types"
	ctime "modernc.org/libc/time"
)

var staticGetpwnam pwd.Passwd

func init() {
	atExit = append(atExit, func() { closePasswd(&staticGetpwnam) })
}

// sighandler_t signal(int signum, sighandler_t handler);
func Xsignal(t *TLS, signum int32, handler uintptr) uintptr { //TODO use sigaction?
	signalsMu.Lock()

	defer signalsMu.Unlock()

	r := signals[signum]
	signals[signum] = handler
	switch handler {
	case signal.SIG_DFL:
		panic(todo("%v %#x", syscall.Signal(signum), handler))
	case signal.SIG_IGN:
		switch r {
		case signal.SIG_DFL:
			gosignal.Ignore(syscall.Signal(signum)) //TODO
		case signal.SIG_IGN:
			gosignal.Ignore(syscall.Signal(signum))
		default:
			panic(todo("%v %#x", syscall.Signal(signum), handler))
		}
	default:
		switch r {
		case signal.SIG_DFL:
			c := make(chan os.Signal, 1)
			gosignal.Notify(c, syscall.Signal(signum))
			go func() { //TODO mechanism to stop/cancel
				for {
					<-c
					var f func(*TLS, int32)
					*(*uintptr)(unsafe.Pointer(&f)) = handler
					tls := NewTLS()
					f(tls, signum)
					tls.Close()
				}
			}()
		case signal.SIG_IGN:
			panic(todo("%v %#x", syscall.Signal(signum), handler))
		default:
			panic(todo("%v %#x", syscall.Signal(signum), handler))
		}
	}
	return r
}

// void rewind(FILE *stream);
func Xrewind(t *TLS, stream uintptr) {
	Xfseek(t, stream, 0, stdio.SEEK_SET)
}

// int putchar(int c);
func Xputchar(t *TLS, c int32) int32 {
	if _, err := write([]byte{byte(c)}); err != nil {
		return stdio.EOF
	}

	return int32(c)
}

// int gethostname(char *name, size_t len);
func Xgethostname(t *TLS, name uintptr, slen types.Size_t) int32 {
	if slen < 0 {
		t.setErrno(errno.EINVAL)
		return -1
	}

	if slen == 0 {
		return 0
	}

	s, err := os.Hostname()
	if err != nil {
		panic(todo(""))
	}

	n := len(s)
	if len(s) >= int(slen) {
		n = int(slen) - 1
	}
	sh := (*reflect.StringHeader)(unsafe.Pointer(&s))
	copy((*RawMem)(unsafe.Pointer(name))[:n:n], (*RawMem)(unsafe.Pointer(sh.Data))[:n:n])
	*(*byte)(unsafe.Pointer(name + uintptr(n))) = 0
	return 0
}

// int remove(const char *pathname);
func Xremove(t *TLS, pathname uintptr) int32 {
	panic(todo(""))
}

// long pathconf(const char *path, int name);
func Xpathconf(t *TLS, path uintptr, name int32) long {
	panic(todo(""))
}

// ssize_t recvfrom(int sockfd, void *buf, size_t len, int flags, struct sockaddr *src_addr, socklen_t *addrlen);
func Xrecvfrom(t *TLS, sockfd int32, buf uintptr, len types.Size_t, flags int32, src_addr, addrlen uintptr) types.Ssize_t {
	panic(todo(""))
}

// ssize_t sendto(int sockfd, const void *buf, size_t len, int flags, const struct sockaddr *dest_addr, socklen_t addrlen);
func Xsendto(t *TLS, sockfd int32, buf uintptr, len types.Size_t, flags int32, src_addr uintptr, addrlen socklen_t) types.Ssize_t {
	panic(todo(""))
}

// void srand48(long int seedval);
func Xsrand48(t *TLS, seedval long) {
	panic(todo(""))
}

// long int lrand48(void);
func Xlrand48(t *TLS) long {
	panic(todo(""))
}

// ssize_t sendmsg(int sockfd, const struct msghdr *msg, int flags);
func Xsendmsg(t *TLS, sockfd int32, msg uintptr, flags int32) types.Ssize_t {
	panic(todo(""))
}

// int poll(struct pollfd *fds, nfds_t nfds, int timeout);
func Xpoll(t *TLS, fds uintptr, nfds poll.Nfds_t, timeout int32) int32 {
	if nfds == 0 {
		panic(todo(""))
	}

	// if dmesgs {
	// 	dmesg("%v: %#x %v %v, %+v", origin(1), fds, nfds, timeout, (*[1000]unix.PollFd)(unsafe.Pointer(fds))[:nfds:nfds])
	// }
	n, err := unix.Poll((*[1000]unix.PollFd)(unsafe.Pointer(fds))[:nfds:nfds], int(timeout))
	// if dmesgs {
	// 	dmesg("%v: %v %v", origin(1), n, err)
	// }
	if err != nil {
		t.setErrno(err)
		return -1
	}

	return int32(n)
}

// ssize_t recvmsg(int sockfd, struct msghdr *msg, int flags);
func Xrecvmsg(t *TLS, sockfd int32, msg uintptr, flags int32) types.Ssize_t {
	n, _, err := unix.Syscall(unix.SYS_RECVMSG, uintptr(sockfd), msg, uintptr(flags))
	if err != 0 {
		t.setErrno(err)
		return -1
	}

	return types.Ssize_t(n)
}

// struct cmsghdr *CMSG_NXTHDR(struct msghdr *msgh, struct cmsghdr *cmsg);
func X__cmsg_nxthdr(t *TLS, msgh, cmsg uintptr) uintptr {
	panic(todo(""))
}

// wchar_t *wcschr(const wchar_t *wcs, wchar_t wc);
func Xwcschr(t *TLS, wcs uintptr, wc wchar_t) wchar_t {
	panic(todo(""))
}

// gid_t getegid(void);
func Xgetegid(t *TLS) types.Gid_t {
	panic(todo(""))
}

// gid_t getgid(void);
func Xgetgid(t *TLS) types.Gid_t {
	panic(todo(""))
}

// void *shmat(int shmid, const void *shmaddr, int shmflg);
func Xshmat(t *TLS, shmid int32, shmaddr uintptr, shmflg int32) uintptr {
	panic(todo(""))
}

// int shmctl(int shmid, int cmd, struct shmid_ds *buf);
func Xshmctl(t *TLS, shmid, cmd int32, buf uintptr) int32 {
	panic(todo(""))
}

// int shmdt(const void *shmaddr);
func Xshmdt(t *TLS, shmaddr uintptr) int32 {
	panic(todo(""))
}

// int getresuid(uid_t *ruid, uid_t *euid, uid_t *suid);
func Xgetresuid(t *TLS, ruid, euid, suid uintptr) int32 {
	panic(todo(""))
}

// int getresgid(gid_t *rgid, gid_t *egid, gid_t *sgid);
func Xgetresgid(t *TLS, rgid, egid, sgid uintptr) int32 {
	panic(todo(""))
}

// FILE *tmpfile(void);
func Xtmpfile(t *TLS) uintptr {
	f, err := ioutil.TempFile("", "tmpfile-")
	if err != nil {
		t.setErrno(err)
		return 0
	}

	cf := newFile(t, int32(f.Fd()))
	AtExit(func() {
		nm := f.Name()
		file(cf).close(t)
		os.Remove(nm)
	})

	return cf
}

// FILE *fdopen(int fd, const char *mode);
func Xfdopen(t *TLS, fd int32, mode uintptr) uintptr {
	m := strings.ReplaceAll(GoString(mode), "b", "")
	switch m {
	case
		"a",
		"a+",
		"r",
		"r+",
		"w",
		"w+":
	default:
		t.setErrno(errno.EINVAL)
		return 0
	}

	if p := newFile(t, fd); p != 0 {
		return p
	}

	t.setErrno(errno.EINVAL)
	return 0
}

// struct passwd *getpwnam(const char *name);
func Xgetpwnam(t *TLS, name uintptr) uintptr {
	f, err := os.Open("/etc/passwd")
	if err != nil {
		panic(todo("", err))
	}

	defer f.Close()

	sname := GoString(name)
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		s := strings.TrimSpace(sc.Text())
		if s == "" || strings.HasPrefix(s, "#") {
			continue
		}

		// eg. "root:x:0:0:root:/root:/bin/bash"
		a := strings.Split(s, ":")
		if len(a) < 7 {
			panic(todo(""))
		}

		if a[0] == sname {
			uid, err := strconv.Atoi(a[2])
			if err != nil {
				panic(todo(""))
			}

			gid, err := strconv.Atoi(a[3])
			if err != nil {
				panic(todo(""))
			}

			closePasswd(&staticGetpwnam)
			gecos := a[4]
			if strings.Contains(gecos, ",") {
				a := strings.Split(gecos, ",")
				gecos = a[0]
			}
			initPasswd(t, &staticGetpwnam, a[0], a[1], uint32(uid), uint32(gid), gecos, a[5], a[6])
			return uintptr(unsafe.Pointer(&staticGetpwnam))
		}
	}

	if sc.Err() != nil {
		panic(todo(""))
	}

	return 0
}

// int getpwnam_r(char *name, struct passwd *pwd, char *buf, size_t buflen, struct passwd **result);
func Xgetpwnam_r(t *TLS, name, cpwd, buf uintptr, buflen types.Size_t, result uintptr) int32 {
	f, err := os.Open("/etc/passwd")
	if err != nil {
		panic(todo("", err))
	}

	defer f.Close()

	sname := GoString(name)
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		s := strings.TrimSpace(sc.Text())
		if s == "" || strings.HasPrefix(s, "#") {
			continue
		}

		// eg. "root:x:0:0:root:/root:/bin/bash"
		a := strings.Split(s, ":")
		if len(a) < 7 {
			panic(todo("%q", s))
		}

		if a[0] == sname {
			uid, err := strconv.Atoi(a[2])
			if err != nil {
				panic(todo(""))
			}

			gid, err := strconv.Atoi(a[3])
			if err != nil {
				panic(todo(""))
			}

			gecos := a[4]
			if strings.Contains(gecos, ",") {
				a := strings.Split(gecos, ",")
				gecos = a[0]
			}
			var v pwd.Passwd
			if initPasswd2(t, buf, buflen, &v, a[0], a[1], uint32(uid), uint32(gid), gecos, a[5], a[6]) {
				*(*pwd.Passwd)(unsafe.Pointer(cpwd)) = v
				*(*uintptr)(unsafe.Pointer(result)) = cpwd
				return 0
			}

			*(*uintptr)(unsafe.Pointer(result)) = 0
			return errno.ERANGE
		}
	}

	if sc.Err() != nil {
		panic(todo(""))
	}

	*(*uintptr)(unsafe.Pointer(result)) = 0
	return 0
}

func init() {
	atExit = append(atExit, func() { closeGroup(&staticGetgrgid) })
}

var staticGetgrgid grp.Group

// struct group *getgrgid(gid_t gid);
func Xgetgrgid(t *TLS, gid uint32) uintptr {
	f, err := os.Open("/etc/group")
	if err != nil {
		panic(todo(""))
	}

	defer f.Close()

	sid := strconv.Itoa(int(gid))
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		s := strings.TrimSpace(sc.Text())
		if s == "" || strings.HasPrefix(s, "#") {
			continue
		}

		// eg. "root:x:0:"
		a := strings.Split(s, ":")
		if len(a) < 4 {
			panic(todo("%q", s))
		}

		if a[2] == sid {
			closeGroup(&staticGetgrgid)
			var names []string
			if a[3] != "" {
				names = strings.Split(a[3], ",")
			}
			initGroup(t, &staticGetgrgid, a[0], a[1], gid, names)
			return uintptr(unsafe.Pointer(&staticGetgrgid))
		}
	}

	if sc.Err() != nil {
		panic(todo(""))
	}

	return 0
}

// int getgrgid_r(gid_t gid, struct group *grp, char *buf, size_t buflen, struct group **result);
func Xgetgrgid_r(t *TLS, gid uint32, pGrp, buf uintptr, buflen types.Size_t, result uintptr) int32 {
	f, err := os.Open("/etc/group")
	if err != nil {
		panic(todo(""))
	}

	defer f.Close()

	sid := strconv.Itoa(int(gid))
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		s := strings.TrimSpace(sc.Text())
		if s == "" || strings.HasPrefix(s, "#") {
			continue
		}

		// eg. "root:x:0:"
		a := strings.Split(s, ":")
		if len(a) < 4 {
			panic(todo("%q", s))
		}

		if a[2] == sid {
			var names []string
			if a[3] != "" {
				names = strings.Split(a[3], ",")
			}
			var x grp.Group
			if initGroup2(buf, buflen, &x, a[0], a[1], gid, names) {
				*(*grp.Group)(unsafe.Pointer(pGrp)) = x
				*(*uintptr)(unsafe.Pointer(result)) = pGrp
				return 0
			}

			*(*uintptr)(unsafe.Pointer(result)) = 0
			return 0
		}
	}

	if sc.Err() != nil {
		panic(todo(""))
	}

	*(*uintptr)(unsafe.Pointer(result)) = 0
	return 0
}

func initPasswd2(t *TLS, buf uintptr, buflen types.Size_t, p *pwd.Passwd, name, pwd string, uid, gid uint32, gecos, dir, shell string) bool {
	p.Fpw_name, buf, buflen = bufString(buf, buflen, name)
	if buf == 0 {
		return false
	}

	p.Fpw_passwd, buf, buflen = bufString(buf, buflen, pwd)
	if buf == 0 {
		return false
	}

	p.Fpw_uid = uid
	p.Fpw_gid = gid
	if buf == 0 {
		return false
	}

	p.Fpw_gecos, buf, buflen = bufString(buf, buflen, gecos)
	if buf == 0 {
		return false
	}

	p.Fpw_dir, buf, buflen = bufString(buf, buflen, dir)
	if buf == 0 {
		return false
	}

	p.Fpw_shell, buf, buflen = bufString(buf, buflen, shell)
	if buf == 0 {
		return false
	}

	return true
}

func bufString(buf uintptr, buflen types.Size_t, s string) (uintptr, uintptr, types.Size_t) {
	buf0 := buf
	rq := len(s) + 1
	if rq > int(buflen) {
		return 0, 0, 0
	}

	copy((*RawMem)(unsafe.Pointer(buf))[:len(s):len(s)], s)
	buf += uintptr(len(s))
	*(*byte)(unsafe.Pointer(buf)) = 0
	return buf0, buf + 1, buflen - types.Size_t(rq)
}

func closeGroup(p *grp.Group) {
	Xfree(nil, p.Fgr_name)
	Xfree(nil, p.Fgr_passwd)
	if p := p.Fgr_mem; p != 0 {
		for {
			q := *(*uintptr)(unsafe.Pointer(p))
			if q == 0 {
				break
			}

			Xfree(nil, q)
			p += unsafe.Sizeof(uintptr(0))
		}
	}
	*p = grp.Group{}
}

func initGroup(t *TLS, p *grp.Group, name, pwd string, gid uint32, names []string) {
	p.Fgr_name = cString(t, name)
	p.Fgr_passwd = cString(t, pwd)
	p.Fgr_gid = gid
	a := Xcalloc(t, 1, types.Size_t(unsafe.Sizeof(uintptr(0)))*types.Size_t((len(names)+1)))
	if a == 0 {
		panic("OOM")
	}

	for p := a; len(names) != 0; p += unsafe.Sizeof(uintptr(0)) {
		*(*uintptr)(unsafe.Pointer(p)) = cString(t, names[0])
		names = names[1:]
	}
	p.Fgr_mem = a
}

func initGroup2(buf uintptr, buflen types.Size_t, p *grp.Group, name, pwd string, gid uint32, names []string) bool {
	p.Fgr_name, buf, buflen = bufString(buf, buflen, name)
	if buf == 0 {
		return false
	}

	p.Fgr_passwd, buf, buflen = bufString(buf, buflen, pwd)
	if buf == 0 {
		return false
	}

	p.Fgr_gid = gid
	rq := unsafe.Sizeof(uintptr(0)) * uintptr(len(names)+1)
	if rq > uintptr(buflen) {
		return false
	}

	a := buf
	buf += rq
	for ; len(names) != 0; buf += unsafe.Sizeof(uintptr(0)) {
		if len(names[0])+1 > int(buflen) {
			return false
		}

		*(*uintptr)(unsafe.Pointer(buf)), buf, buflen = bufString(buf, buflen, names[0])
		names = names[1:]
	}
	*(*uintptr)(unsafe.Pointer(buf)) = 0
	p.Fgr_mem = a
	return true
}

func init() {
	atExit = append(atExit, func() { closeGroup(&staticGetgrgid) })
}

var staticGetpwuid pwd.Passwd

func init() {
	atExit = append(atExit, func() { closePasswd(&staticGetpwuid) })
}

func closePasswd(p *pwd.Passwd) {
	Xfree(nil, p.Fpw_name)
	Xfree(nil, p.Fpw_passwd)
	Xfree(nil, p.Fpw_gecos)
	Xfree(nil, p.Fpw_dir)
	Xfree(nil, p.Fpw_shell)
	*p = pwd.Passwd{}
}

var staticGetgrnam grp.Group

func init() {
	atExit = append(atExit, func() { closeGroup(&staticGetgrnam) })
}

// struct passwd *getpwuid(uid_t uid);
func Xgetpwuid(t *TLS, uid uint32) uintptr {
	f, err := os.Open("/etc/passwd")
	if err != nil {
		panic(todo("", err))
	}

	defer f.Close()

	sid := strconv.Itoa(int(uid))
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		s := strings.TrimSpace(sc.Text())
		if len(s) == 0 || strings.HasPrefix(s, "#") {
			continue
		}

		// eg. "root:x:0:0:root:/root:/bin/bash"
		a := strings.Split(s, ":")
		if len(a) < 7 {
			panic(todo("%q", s))
		}

		if a[2] == sid {
			uid, err := strconv.Atoi(a[2])
			if err != nil {
				panic(todo(""))
			}

			gid, err := strconv.Atoi(a[3])
			if err != nil {
				panic(todo(""))
			}

			closePasswd(&staticGetpwuid)
			gecos := a[4]
			if strings.Contains(gecos, ",") {
				a := strings.Split(gecos, ",")
				gecos = a[0]
			}
			initPasswd(t, &staticGetpwuid, a[0], a[1], uint32(uid), uint32(gid), gecos, a[5], a[6])
			return uintptr(unsafe.Pointer(&staticGetpwuid))
		}
	}

	if sc.Err() != nil {
		panic(todo(""))
	}

	return 0
}

func initPasswd(t *TLS, p *pwd.Passwd, name, pwd string, uid, gid uint32, gecos, dir, shell string) {
	p.Fpw_name = cString(t, name)
	p.Fpw_passwd = cString(t, pwd)
	p.Fpw_uid = uid
	p.Fpw_gid = gid
	p.Fpw_gecos = cString(t, gecos)
	p.Fpw_dir = cString(t, dir)
	p.Fpw_shell = cString(t, shell)
}

// struct group *getgrnam(const char *name);
func Xgetgrnam(t *TLS, name uintptr) uintptr {
	f, err := os.Open("/etc/group")
	if err != nil {
		panic(todo(""))
	}

	defer f.Close()

	sname := GoString(name)
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		s := strings.TrimSpace(sc.Text())
		if len(s) == 0 || strings.HasPrefix(s, "#") {
			continue
		}

		// eg. "root:x:0:"
		a := strings.Split(s, ":")
		if len(a) < 4 {
			panic(todo("%q", s))
		}

		if a[0] == sname {
			closeGroup(&staticGetgrnam)
			gid, err := strconv.Atoi(a[2])
			if err != nil {
				panic(todo(""))
			}

			var names []string
			if a[3] != "" {
				names = strings.Split(a[3], ",")
			}
			initGroup(t, &staticGetgrnam, a[0], a[1], uint32(gid), names)
			return uintptr(unsafe.Pointer(&staticGetgrnam))
		}
	}

	if sc.Err() != nil {
		panic(todo(""))
	}

	return 0
}

// int getgrnam_r(const char *name, struct group *grp, char *buf, size_t buflen, struct group **result);
func Xgetgrnam_r(t *TLS, name, pGrp, buf uintptr, buflen types.Size_t, result uintptr) int32 {
	f, err := os.Open("/etc/group")
	if err != nil {
		panic(todo(""))
	}

	defer f.Close()

	sname := GoString(name)
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		s := strings.TrimSpace(sc.Text())
		if len(s) == 0 || strings.HasPrefix(s, "#") {
			continue
		}

		// eg. "root:x:0:"
		a := strings.Split(s, ":")
		if len(a) < 4 {
			panic(todo("%q", s))
		}

		if a[0] == sname {
			gid, err := strconv.Atoi(a[2])
			if err != nil {
				panic(todo(""))
			}

			var names []string
			if a[3] != "" {
				names = strings.Split(a[3], ",")
			}
			var x grp.Group
			if initGroup2(buf, buflen, &x, a[0], a[1], uint32(gid), names) {
				*(*grp.Group)(unsafe.Pointer(pGrp)) = x
				*(*uintptr)(unsafe.Pointer(result)) = pGrp
				return 0
			}

			*(*uintptr)(unsafe.Pointer(result)) = 0
			return 0
		}
	}

	if sc.Err() != nil {
		panic(todo(""))
	}

	*(*uintptr)(unsafe.Pointer(result)) = 0
	return 0
}

// int getpwuid_r(uid_t uid, struct passwd *pwd, char *buf, size_t buflen, struct passwd **result);
func Xgetpwuid_r(t *TLS, uid types.Uid_t, cpwd, buf uintptr, buflen types.Size_t, result uintptr) int32 {
	f, err := os.Open("/etc/passwd")
	if err != nil {
		panic(todo("", err))
	}

	defer f.Close()

	sid := strconv.Itoa(int(uid))
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		s := strings.TrimSpace(sc.Text())
		if len(s) == 0 || strings.HasPrefix(s, "#") {
			continue
		}

		// eg. "root:x:0:0:root:/root:/bin/bash"
		a := strings.Split(s, ":")
		if len(a) < 7 {
			panic(todo("%q", s))
		}

		if a[2] == sid {
			uid, err := strconv.Atoi(a[2])
			if err != nil {
				panic(todo(""))
			}

			gid, err := strconv.Atoi(a[3])
			if err != nil {
				panic(todo(""))
			}

			gecos := a[4]
			if strings.Contains(gecos, ",") {
				a := strings.Split(gecos, ",")
				gecos = a[0]
			}
			var v pwd.Passwd
			if initPasswd2(t, buf, buflen, &v, a[0], a[1], uint32(uid), uint32(gid), gecos, a[5], a[6]) {
				*(*pwd.Passwd)(unsafe.Pointer(cpwd)) = v
				*(*uintptr)(unsafe.Pointer(result)) = cpwd
				return 0
			}

			*(*uintptr)(unsafe.Pointer(result)) = 0
			return errno.ERANGE
		}
	}

	if sc.Err() != nil {
		panic(todo(""))
	}

	*(*uintptr)(unsafe.Pointer(result)) = 0
	return 0
}

// int mkostemp(char *template, int flags);
func Xmkostemp(t *TLS, template uintptr, flags int32) int32 {
	len := uintptr(Xstrlen(t, template))
	x := template + uintptr(len-6)
	for i := uintptr(0); i < 6; i++ {
		if *(*byte)(unsafe.Pointer(x + i)) != 'X' {
			t.setErrno(errno.EINVAL)
			return -1
		}
	}

	fd, err := tempFile(template, x, flags)
	if err != nil {
		t.setErrno(err)
		return -1
	}

	return int32(fd)
}

// void uuid_generate_random(uuid_t out);
func Xuuid_generate_random(t *TLS, out uintptr) {
	x := guuid.New()
	copy((*RawMem)(unsafe.Pointer(out))[:], x[:])
}

// void uuid_unparse(uuid_t uu, char *out);
func Xuuid_unparse(t *TLS, uu, out uintptr) {
	s := (*guuid.UUID)(unsafe.Pointer(uu)).String()
	copy((*RawMem)(unsafe.Pointer(out))[:], s)
	*(*byte)(unsafe.Pointer(out + uintptr(len(s)))) = 0
}

var staticRandomData = &rand.Rand{}

// char *initstate(unsigned seed, char *state, size_t size);
func Xinitstate(t *TLS, seed uint32, statebuf uintptr, statelen types.Size_t) uintptr {
	staticRandomData = rand.New(rand.NewSource(int64(seed)))
	return 0
}

// char *setstate(const char *state);
func Xsetstate(t *TLS, state uintptr) uintptr {
	t.setErrno(errno.EINVAL) //TODO
	return 0
}

// The initstate_r() function is like initstate(3) except that it initializes
// the state in the object pointed to by buf, rather than initializing the
// global state  variable.   Before  calling this function, the buf.state field
// must be initialized to NULL.  The initstate_r() function records a pointer
// to the statebuf argument inside the structure pointed to by buf.  Thus,
// state‐ buf should not be deallocated so long as buf is still in use.  (So,
// statebuf should typically be allocated as a static variable, or allocated on
// the heap using malloc(3) or similar.)
//
// char *initstate_r(unsigned int seed, char *statebuf, size_t statelen, struct random_data *buf);
func Xinitstate_r(t *TLS, seed uint32, statebuf uintptr, statelen types.Size_t, buf uintptr) int32 {
	if buf == 0 {
		panic(todo(""))
	}

	randomDataMu.Lock()

	defer randomDataMu.Unlock()

	randomData[buf] = rand.New(rand.NewSource(int64(seed)))
	return 0
}

var (
	randomData   = map[uintptr]*rand.Rand{}
	randomDataMu sync.Mutex
)

// int mkstemps(char *template, int suffixlen);
func Xmkstemps(t *TLS, template uintptr, suffixlen int32) int32 {
	return Xmkstemps64(t, template, suffixlen)
}

// int mkstemps(char *template, int suffixlen);
func Xmkstemps64(t *TLS, template uintptr, suffixlen int32) int32 {
	len := uintptr(Xstrlen(t, template))
	x := template + uintptr(len-6) - uintptr(suffixlen)
	for i := uintptr(0); i < 6; i++ {
		if *(*byte)(unsafe.Pointer(x + i)) != 'X' {
			t.setErrno(errno.EINVAL)
			return -1
		}
	}

	fd, err := tempFile(template, x, 0)
	if err != nil {
		t.setErrno(err)
		return -1
	}

	return int32(fd)
}

// int mkstemp(char *template);
func Xmkstemp(t *TLS, template uintptr) int32 {
	return Xmkstemp64(t, template)
}

// int mkstemp(char *template);
func Xmkstemp64(t *TLS, template uintptr) int32 {
	return Xmkstemps64(t, template, 0)
}

// int random_r(struct random_data *buf, int32_t *result);
func Xrandom_r(t *TLS, buf, result uintptr) int32 {
	randomDataMu.Lock()

	defer randomDataMu.Unlock()

	mr := randomData[buf]
	if stdlib.RAND_MAX != math.MaxInt32 {
		panic(todo(""))
	}
	*(*int32)(unsafe.Pointer(result)) = mr.Int31()
	return 0
}

// int strerror_r(int errnum, char *buf, size_t buflen);
func Xstrerror_r(t *TLS, errnum int32, buf uintptr, buflen size_t) int32 {
	panic(todo(""))
}

// void endpwent(void);
func Xendpwent(t *TLS) {
	// nop
}

var ctimeStaticBuf [32]byte

// char *ctime(const time_t *timep);
func Xctime(t *TLS, timep uintptr) uintptr {
	return Xctime_r(t, timep, uintptr(unsafe.Pointer(&ctimeStaticBuf[0])))
}

// char *ctime_r(const time_t *timep, char *buf);
func Xctime_r(t *TLS, timep, buf uintptr) uintptr {
	ut := *(*ctime.Time_t)(unsafe.Pointer(timep))
	tm := time.Unix(int64(ut), 0).Local()
	s := tm.Format(time.ANSIC) + "\n\x00"
	copy((*RawMem)(unsafe.Pointer(buf))[:26:26], s)
	return buf
}
