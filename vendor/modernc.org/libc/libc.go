// Copyright 2020 The Libc Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go.generate echo package libc > ccgo.go
//go:generate go run generate.go
//go:generate go fmt ./...

// Package libc provides run time support for ccgo generated programs and
// implements selected parts of the C standard library.
package libc // import "modernc.org/libc"

//TODO use O_RDONLY etc. from fcntl header

//TODO use t.Alloc/Free where appropriate

import (
	"bufio"
	crand "crypto/rand"
	"fmt"
	"math"
	mbits "math/bits"
	"math/rand"
	"os"
	"runtime"
	"runtime/debug"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	gotime "time"
	"unsafe"

	"github.com/mattn/go-isatty"
	"modernc.org/libc/errno"
	"modernc.org/libc/stdio"
	"modernc.org/libc/sys/types"
	"modernc.org/libc/time"
	"modernc.org/libc/unistd"
	"modernc.org/mathutil"
)

type (
	// RawMem64 represents the biggest uint64 array the runtime can handle.
	RawMem64 [unsafe.Sizeof(RawMem{}) / unsafe.Sizeof(uint64(0))]uint64
)

var (
	allocMu            sync.Mutex
	environInitialized bool
	isWindows          bool
)

// Keep these outside of the var block otherwise go generate will miss them.
var Xenviron uintptr
var Xstdin = newFile(nil, unistd.STDIN_FILENO)
var Xstdout = newFile(nil, unistd.STDOUT_FILENO)
var Xstderr = newFile(nil, unistd.STDERR_FILENO)

func setEnviron() {
	SetEnviron(nil, os.Environ())
}

func Environ() uintptr {
	if !environInitialized {
		SetEnviron(nil, os.Environ())
	}
	return Xenviron
}

func EnvironP() uintptr {
	if !environInitialized {
		SetEnviron(nil, os.Environ())
	}
	return uintptr(unsafe.Pointer(&Xenviron))
}

func X___errno_location(t *TLS) uintptr {
	return X__errno_location(t)
}

// int * __errno_location(void);
func X__errno_location(t *TLS) uintptr {
	return t.errnop
}

func Start(main func(*TLS, int32, uintptr) int32) {
	if dmesgs {
		wd, err := os.Getwd()
		dmesg("%v: %v, wd %v, %v", origin(1), os.Args, wd, err)

		defer func() {
			if err := recover(); err != nil {
				dmesg("%v: CRASH: %v\n%s", origin(1), err, debug.Stack())
			}
		}()
	}
	runtime.LockOSThread()
	t := &TLS{errnop: uintptr(unsafe.Pointer(&errno0))}
	argv := Xcalloc(t, 1, types.Size_t((len(os.Args)+1)*int(uintptrSize)))
	if argv == 0 {
		panic("OOM")
	}

	p := argv
	for _, v := range os.Args {
		s := Xcalloc(t, 1, types.Size_t(len(v)+1))
		if s == 0 {
			panic("OOM")
		}

		copy((*RawMem)(unsafe.Pointer(s))[:len(v):len(v)], v)
		*(*uintptr)(unsafe.Pointer(p)) = s
		p += uintptrSize
	}
	SetEnviron(t, os.Environ())
	audit := false
	if memgrind {
		if s := os.Getenv("LIBC_MEMGRIND_START"); s != "0" {
			MemAuditStart()
			audit = true
		}
	}
	t = NewTLS()
	rc := main(t, int32(len(os.Args)), argv)
	exit(t, rc, audit)
}

func Xexit(t *TLS, status int32) { exit(t, status, false) }

func exit(t *TLS, status int32, audit bool) {
	if len(Covered) != 0 {
		buf := bufio.NewWriter(os.Stdout)
		CoverReport(buf)
		buf.Flush()
	}
	if len(CoveredC) != 0 {
		buf := bufio.NewWriter(os.Stdout)
		CoverCReport(buf)
		buf.Flush()
	}
	for _, v := range atExit {
		v()
	}
	if audit {
		t.Close()
		if tlsBalance != 0 {
			fmt.Fprintf(os.Stderr, "non zero TLS balance: %d\n", tlsBalance)
			status = 1
		}
	}
	X_exit(nil, status)
}

// void _exit(int status);
func X_exit(_ *TLS, status int32) {
	if dmesgs {
		dmesg("%v: EXIT %v", origin(1), status)
	}
	os.Exit(int(status))
}

func SetEnviron(t *TLS, env []string) {
	if environInitialized {
		return
	}

	environInitialized = true
	p := Xcalloc(t, 1, types.Size_t((len(env)+1)*(int(uintptrSize))))
	if p == 0 {
		panic("OOM")
	}

	Xenviron = p
	for _, v := range env {
		s := Xcalloc(t, 1, types.Size_t(len(v)+1))
		if s == 0 {
			panic("OOM")
		}

		copy((*(*RawMem)(unsafe.Pointer(s)))[:len(v):len(v)], v)
		*(*uintptr)(unsafe.Pointer(p)) = s
		p += uintptrSize
	}
}

// void setbuf(FILE *stream, char *buf);
func Xsetbuf(t *TLS, stream, buf uintptr) {
	//TODO panic(todo(""))
}

// size_t confstr(int name, char *buf, size_t len);
func Xconfstr(t *TLS, name int32, buf uintptr, len types.Size_t) types.Size_t {
	panic(todo(""))
}

// int puts(const char *s);
func Xputs(t *TLS, s uintptr) int32 {
	n, err := fmt.Printf("%s\n", GoString(s))
	if err != nil {
		return stdio.EOF
	}

	return int32(n)
}

var (
	randomMu  sync.Mutex
	randomGen = rand.New(rand.NewSource(42))
)

// long int random(void);
func Xrandom(t *TLS) long {
	randomMu.Lock()
	r := randomGen.Int63n(math.MaxInt32 + 1)
	randomMu.Unlock()
	return long(r)
}

func write(b []byte) (int, error) {
	// if dmesgs {
	// 	dmesg("%v: %s", origin(1), b)
	// }
	if _, err := os.Stdout.Write(b); err != nil {
		return -1, err
	}

	return len(b), nil
}

func X__builtin_bzero(t *TLS, s uintptr, n types.Size_t)              { Xbzero(t, s, n) }
func X__builtin_abort(t *TLS)                                         { Xabort(t) }
func X__builtin_abs(t *TLS, j int32) int32                            { return Xabs(t, j) }
func X__builtin_clz(t *TLS, n uint32) int32                           { return int32(mbits.LeadingZeros32(n)) }
func X__builtin_clzl(t *TLS, n ulong) int32                           { return int32(mbits.LeadingZeros64(uint64(n))) }
func X__builtin_clzll(t *TLS, n uint64) int32                         { return int32(mbits.LeadingZeros64(n)) }
func X__builtin_constant_p_impl()                                     { panic(todo("internal error: should never be called")) }
func X__builtin_copysign(t *TLS, x, y float64) float64                { return Xcopysign(t, x, y) }
func X__builtin_copysignf(t *TLS, x, y float32) float32               { return Xcopysignf(t, x, y) }
func X__builtin_copysignl(t *TLS, x, y float64) float64               { return Xcopysign(t, x, y) }
func X__builtin_exit(t *TLS, status int32)                            { Xexit(t, status) }
func X__builtin_expect(t *TLS, exp, c long) long                      { return exp }
func X__builtin_fabs(t *TLS, x float64) float64                       { return Xfabs(t, x) }
func X__builtin_fabsf(t *TLS, x float32) float32                      { return Xfabsf(t, x) }
func X__builtin_fabsl(t *TLS, x float64) float64                      { return Xfabsl(t, x) }
func X__builtin_free(t *TLS, ptr uintptr)                             { Xfree(t, ptr) }
func X__builtin_getentropy(t *TLS, buf uintptr, n types.Size_t) int32 { return Xgetentropy(t, buf, n) }
func X__builtin_huge_val(t *TLS) float64                              { return math.Inf(1) }
func X__builtin_huge_valf(t *TLS) float32                             { return float32(math.Inf(1)) }
func X__builtin_inf(t *TLS) float64                                   { return math.Inf(1) }
func X__builtin_inff(t *TLS) float32                                  { return float32(math.Inf(1)) }
func X__builtin_infl(t *TLS) float64                                  { return math.Inf(1) }
func X__builtin_malloc(t *TLS, size types.Size_t) uintptr             { return Xmalloc(t, size) }
func X__builtin_memcmp(t *TLS, s1, s2 uintptr, n types.Size_t) int32  { return Xmemcmp(t, s1, s2, n) }
func X__builtin_nan(t *TLS, s uintptr) float64                        { return math.NaN() }
func X__builtin_nanf(t *TLS, s uintptr) float32                       { return float32(math.NaN()) }
func X__builtin_nanl(t *TLS, s uintptr) float64                       { return math.NaN() }
func X__builtin_prefetch(t *TLS, addr, args uintptr)                  {}
func X__builtin_printf(t *TLS, s, args uintptr) int32                 { return Xprintf(t, s, args) }
func X__builtin_strchr(t *TLS, s uintptr, c int32) uintptr            { return Xstrchr(t, s, c) }
func X__builtin_strcmp(t *TLS, s1, s2 uintptr) int32                  { return Xstrcmp(t, s1, s2) }
func X__builtin_strcpy(t *TLS, dest, src uintptr) uintptr             { return Xstrcpy(t, dest, src) }
func X__builtin_strlen(t *TLS, s uintptr) types.Size_t                { return Xstrlen(t, s) }
func X__builtin_trap(t *TLS)                                          { Xabort(t) }
func X__isnan(t *TLS, arg float64) int32                              { return X__builtin_isnan(t, arg) }
func X__isnanf(t *TLS, arg float32) int32                             { return Xisnanf(t, arg) }
func X__isnanl(t *TLS, arg float64) int32                             { return Xisnanl(t, arg) }

func Xvfprintf(t *TLS, stream, format, ap uintptr) int32 { return Xfprintf(t, stream, format, ap) }

// int __builtin_popcount (unsigned int x)
func X__builtin_popcount(t *TLS, x uint32) int32 {
	return int32(mbits.OnesCount32(x))
}

// int __builtin_popcountl (unsigned long x)
func X__builtin_popcountl(t *TLS, x ulong) int32 {
	return int32(mbits.OnesCount64(uint64(x)))
}

// char * __builtin___strcpy_chk (char *dest, const char *src, size_t os);
func X__builtin___strcpy_chk(t *TLS, dest, src uintptr, os types.Size_t) uintptr {
	return Xstrcpy(t, dest, src)
}

func X__builtin_mmap(t *TLS, addr uintptr, length types.Size_t, prot, flags, fd int32, offset types.Off_t) uintptr {
	return Xmmap(t, addr, length, prot, flags, fd, offset)
}

// uint16_t __builtin_bswap16 (uint32_t x)
func X__builtin_bswap16(t *TLS, x uint16) uint16 {
	return x<<8 |
		x>>8
}

// uint32_t __builtin_bswap32 (uint32_t x)
func X__builtin_bswap32(t *TLS, x uint32) uint32 {
	return x<<24 |
		x&0xff00<<8 |
		x&0xff0000>>8 |
		x>>24
}

// uint64_t __builtin_bswap64 (uint64_t x)
func X__builtin_bswap64(t *TLS, x uint64) uint64 {
	return x<<56 |
		x&0xff00<<40 |
		x&0xff0000<<24 |
		x&0xff000000<<8 |
		x&0xff00000000>>8 |
		x&0xff0000000000>>24 |
		x&0xff000000000000>>40 |
		x>>56
}

// bool __builtin_add_overflow (type1 a, type2 b, type3 *res)
func X__builtin_add_overflowInt64(t *TLS, a, b int64, res uintptr) int32 {
	r, ovf := mathutil.AddOverflowInt64(a, b)
	*(*int64)(unsafe.Pointer(res)) = r
	return Bool32(ovf)
}

// bool __builtin_add_overflow (type1 a, type2 b, type3 *res)
func X__builtin_add_overflowUint32(t *TLS, a, b uint32, res uintptr) int32 {
	r := a + b
	*(*uint32)(unsafe.Pointer(res)) = r
	return Bool32(r < a)
}

// bool __builtin_add_overflow (type1 a, type2 b, type3 *res)
func X__builtin_add_overflowUint64(t *TLS, a, b uint64, res uintptr) int32 {
	r := a + b
	*(*uint64)(unsafe.Pointer(res)) = r
	return Bool32(r < a)
}

// bool __builtin_sub_overflow (type1 a, type2 b, type3 *res)
func X__builtin_sub_overflowInt64(t *TLS, a, b int64, res uintptr) int32 {
	r, ovf := mathutil.SubOverflowInt64(a, b)
	*(*int64)(unsafe.Pointer(res)) = r
	return Bool32(ovf)
}

// bool __builtin_mul_overflow (type1 a, type2 b, type3 *res)
func X__builtin_mul_overflowInt64(t *TLS, a, b int64, res uintptr) int32 {
	r, ovf := mathutil.MulOverflowInt64(a, b)
	*(*int64)(unsafe.Pointer(res)) = r
	return Bool32(ovf)
}

// bool __builtin_mul_overflow (type1 a, type2 b, type3 *res)
func X__builtin_mul_overflowUint64(t *TLS, a, b uint64, res uintptr) int32 {
	hi, lo := mbits.Mul64(a, b)
	*(*uint64)(unsafe.Pointer(res)) = lo
	return Bool32(hi != 0)
}

// bool __builtin_mul_overflow (type1 a, type2 b, type3 *res)
func X__builtin_mul_overflowUint128(t *TLS, a, b Uint128, res uintptr) int32 {
	r, ovf := a.mulOvf(b)
	*(*Uint128)(unsafe.Pointer(res)) = r
	return Bool32(ovf)
}

func X__builtin_unreachable(t *TLS) {
	fmt.Fprintf(os.Stderr, "unrechable\n")
	os.Stderr.Sync()
	Xexit(t, 1)
}

func X__builtin_snprintf(t *TLS, str uintptr, size types.Size_t, format, args uintptr) int32 {
	return Xsnprintf(t, str, size, format, args)
}

func X__builtin_sprintf(t *TLS, str, format, args uintptr) (r int32) {
	return Xsprintf(t, str, format, args)
}

func X__builtin_memcpy(t *TLS, dest, src uintptr, n types.Size_t) (r uintptr) {
	return Xmemcpy(t, dest, src, n)
}

// void * __builtin___memcpy_chk (void *dest, const void *src, size_t n, size_t os);
func X__builtin___memcpy_chk(t *TLS, dest, src uintptr, n, os types.Size_t) (r uintptr) {
	if os != ^types.Size_t(0) && n < os {
		Xabort(t)
	}

	return Xmemcpy(t, dest, src, n)
}

func X__builtin_memset(t *TLS, s uintptr, c int32, n types.Size_t) uintptr {
	return Xmemset(t, s, c, n)
}

// void * __builtin___memset_chk (void *s, int c, size_t n, size_t os);
func X__builtin___memset_chk(t *TLS, s uintptr, c int32, n, os types.Size_t) uintptr {
	if os < n {
		Xabort(t)
	}

	return Xmemset(t, s, c, n)
}

// size_t __builtin_object_size (const void * ptr, int type)
func X__builtin_object_size(t *TLS, p uintptr, typ int32) types.Size_t {
	return ^types.Size_t(0) //TODO frontend magic
}

var atomicLoadStore16 sync.Mutex

func AtomicLoadNUint16(ptr uintptr, memorder int32) uint16 {
	atomicLoadStore16.Lock()
	r := *(*uint16)(unsafe.Pointer(ptr))
	atomicLoadStore16.Unlock()
	return r
}

func AtomicStoreNUint16(ptr uintptr, val uint16, memorder int32) {
	atomicLoadStore16.Lock()
	*(*uint16)(unsafe.Pointer(ptr)) = val
	atomicLoadStore16.Unlock()
}

// int sprintf(char *str, const char *format, ...);
func Xsprintf(t *TLS, str, format, args uintptr) (r int32) {
	b := printf(format, args)
	r = int32(len(b))
	copy((*RawMem)(unsafe.Pointer(str))[:r:r], b)
	*(*byte)(unsafe.Pointer(str + uintptr(r))) = 0
	return int32(len(b))
}

// int __builtin___sprintf_chk (char *s, int flag, size_t os, const char *fmt, ...);
func X__builtin___sprintf_chk(t *TLS, s uintptr, flag int32, os types.Size_t, format, args uintptr) (r int32) {
	return Xsprintf(t, s, format, args)
}

// void qsort(void *base, size_t nmemb, size_t size, int (*compar)(const void *, const void *));
func Xqsort(t *TLS, base uintptr, nmemb, size types.Size_t, compar uintptr) {
	sort.Sort(&sorter{
		len:  int(nmemb),
		base: base,
		sz:   uintptr(size),
		f: (*struct {
			f func(*TLS, uintptr, uintptr) int32
		})(unsafe.Pointer(&struct{ uintptr }{compar})).f,
		t: t,
	})
}

// void __assert_fail(const char * assertion, const char * file, unsigned int line, const char * function);
func X__assert_fail(t *TLS, assertion, file uintptr, line uint32, function uintptr) {
	fmt.Fprintf(os.Stderr, "assertion failure: %s:%d.%s: %s\n", GoString(file), line, GoString(function), GoString(assertion))
	if memgrind {
		fmt.Fprintf(os.Stderr, "%s\n", debug.Stack())
	}
	os.Stderr.Sync()
	Xexit(t, 1)
}

// int vprintf(const char *format, va_list ap);
func Xvprintf(t *TLS, s, ap uintptr) int32 { return Xprintf(t, s, ap) }

// int vsprintf(char *str, const char *format, va_list ap);
func Xvsprintf(t *TLS, str, format, va uintptr) int32 {
	return Xsprintf(t, str, format, va)
}

// int vsnprintf(char *str, size_t size, const char *format, va_list ap);
func Xvsnprintf(t *TLS, str uintptr, size types.Size_t, format, va uintptr) int32 {
	return Xsnprintf(t, str, size, format, va)
}

// int obstack_vprintf (struct obstack *obstack, const char *template, va_list ap)
func Xobstack_vprintf(t *TLS, obstack, template, va uintptr) int32 {
	panic(todo(""))
}

// extern void _obstack_newchunk(struct obstack *, int);
func X_obstack_newchunk(t *TLS, obstack uintptr, length int32) int32 {
	panic(todo(""))
}

// int _obstack_begin (struct obstack *h, _OBSTACK_SIZE_T size, _OBSTACK_SIZE_T alignment,	void *(*chunkfun) (size_t),  void (*freefun) (void *))
func X_obstack_begin(t *TLS, obstack uintptr, size, alignment int32, chunkfun, freefun uintptr) int32 {
	panic(todo(""))
}

// void obstack_free (struct obstack *h, void *obj)
func Xobstack_free(t *TLS, obstack, obj uintptr) {
	panic(todo(""))
}

// unsigned int sleep(unsigned int seconds);
func Xsleep(t *TLS, seconds uint32) uint32 {
	gotime.Sleep(gotime.Second * gotime.Duration(seconds))
	return 0
}

// size_t strcspn(const char *s, const char *reject);
func Xstrcspn(t *TLS, s, reject uintptr) (r types.Size_t) {
	bits := newBits(256)
	for {
		c := *(*byte)(unsafe.Pointer(reject))
		if c == 0 {
			break
		}

		reject++
		bits.set(int(c))
	}
	for {
		c := *(*byte)(unsafe.Pointer(s))
		if c == 0 || bits.has(int(c)) {
			return r
		}

		s++
		r++
	}
}

// int printf(const char *format, ...);
func Xprintf(t *TLS, format, args uintptr) int32 {
	n, _ := write(printf(format, args))
	return int32(n)
}

// int snprintf(char *str, size_t size, const char *format, ...);
func Xsnprintf(t *TLS, str uintptr, size types.Size_t, format, args uintptr) (r int32) {
	if format == 0 {
		return 0
	}

	b := printf(format, args)
	r = int32(len(b))
	if size == 0 {
		return r
	}

	if len(b)+1 > int(size) {
		b = b[:size-1]
	}
	n := len(b)
	copy((*RawMem)(unsafe.Pointer(str))[:n:n], b)
	*(*byte)(unsafe.Pointer(str + uintptr(n))) = 0
	return r
}

// int __builtin___snprintf_chk(char * str, size_t maxlen, int flag, size_t os, const char * format, ...);
func X__builtin___snprintf_chk(t *TLS, str uintptr, maxlen types.Size_t, flag int32, os types.Size_t, format, args uintptr) (r int32) {
	if os != ^types.Size_t(0) && maxlen > os {
		Xabort(t)
	}

	return Xsnprintf(t, str, maxlen, format, args)
}

// int __builtin___vsnprintf_chk (char *s, size_t maxlen, int flag, size_t os, const char *fmt, va_list ap);
func X__builtin___vsnprintf_chk(t *TLS, str uintptr, maxlen types.Size_t, flag int32, os types.Size_t, format, args uintptr) (r int32) {
	if os != ^types.Size_t(0) && maxlen > os {
		Xabort(t)
	}

	return Xsnprintf(t, str, maxlen, format, args)
}

// int abs(int j);
func Xabs(t *TLS, j int32) int32 {
	if j >= 0 {
		return j
	}

	return -j
}

func Xllabs(tls *TLS, a int64) int64 {
	if a >= int64(0) {
		return a
	}

	return -a
}

func X__builtin_isnan(t *TLS, x float64) int32    { return Bool32(math.IsNaN(x)) }
func X__builtin_llabs(tls *TLS, a int64) int64    { return Xllabs(tls, a) }
func Xacos(t *TLS, x float64) float64             { return math.Acos(x) }
func Xacosh(t *TLS, x float64) float64            { return math.Acosh(x) }
func Xasin(t *TLS, x float64) float64             { return math.Asin(x) }
func Xasinh(t *TLS, x float64) float64            { return math.Asinh(x) }
func Xatan(t *TLS, x float64) float64             { return math.Atan(x) }
func Xatan2(t *TLS, x, y float64) float64         { return math.Atan2(x, y) }
func Xatanh(t *TLS, x float64) float64            { return math.Atanh(x) }
func Xceil(t *TLS, x float64) float64             { return math.Ceil(x) }
func Xceilf(t *TLS, x float32) float32            { return float32(math.Ceil(float64(x))) }
func Xcopysign(t *TLS, x, y float64) float64      { return math.Copysign(x, y) }
func Xcopysignf(t *TLS, x, y float32) float32     { return float32(math.Copysign(float64(x), float64(y))) }
func Xcos(t *TLS, x float64) float64              { return math.Cos(x) }
func Xcosf(t *TLS, x float32) float32             { return float32(math.Cos(float64(x))) }
func Xcosh(t *TLS, x float64) float64             { return math.Cosh(x) }
func Xexp(t *TLS, x float64) float64              { return math.Exp(x) }
func Xfabs(t *TLS, x float64) float64             { return math.Abs(x) }
func Xfabsf(t *TLS, x float32) float32            { return float32(math.Abs(float64(x))) }
func Xfloor(t *TLS, x float64) float64            { return math.Floor(x) }
func Xfmod(t *TLS, x, y float64) float64          { return math.Mod(x, y) }
func Xhypot(t *TLS, x, y float64) float64         { return math.Hypot(x, y) }
func Xisnan(t *TLS, x float64) int32              { return X__builtin_isnan(t, x) }
func Xisnanf(t *TLS, x float32) int32             { return Bool32(math.IsNaN(float64(x))) }
func Xisnanl(t *TLS, x float64) int32             { return Bool32(math.IsNaN(x)) } // ccgo has to handle long double as double as Go does not support long double.
func Xldexp(t *TLS, x float64, exp int32) float64 { return math.Ldexp(x, int(exp)) }
func Xlog(t *TLS, x float64) float64              { return math.Log(x) }
func Xlog10(t *TLS, x float64) float64            { return math.Log10(x) }
func Xlog2(t *TLS, x float64) float64             { return math.Log2(x) }
func Xround(t *TLS, x float64) float64            { return math.Round(x) }
func Xsin(t *TLS, x float64) float64              { return math.Sin(x) }
func Xsinf(t *TLS, x float32) float32             { return float32(math.Sin(float64(x))) }
func Xsinh(t *TLS, x float64) float64             { return math.Sinh(x) }
func Xsqrt(t *TLS, x float64) float64             { return math.Sqrt(x) }
func Xtan(t *TLS, x float64) float64              { return math.Tan(x) }
func Xtanh(t *TLS, x float64) float64             { return math.Tanh(x) }
func Xtrunc(t *TLS, x float64) float64            { return math.Trunc(x) }

var nextRand = uint64(1)

// int rand(void);
func Xrand(t *TLS) int32 {
	nextRand = nextRand*1103515245 + 12345
	return int32(uint32(nextRand / (math.MaxUint32 + 1) % math.MaxInt32))
}

func Xpow(t *TLS, x, y float64) float64 {
	r := math.Pow(x, y)
	if x > 0 && r == 1 && y >= -1.0000000000000000715e-18 && y < -1e-30 {
		r = 0.9999999999999999
	}
	return r
}

func Xfrexp(t *TLS, x float64, exp uintptr) float64 {
	f, e := math.Frexp(x)
	*(*int32)(unsafe.Pointer(exp)) = int32(e)
	return f
}

func Xmodf(t *TLS, x float64, iptr uintptr) float64 {
	i, f := math.Modf(x)
	*(*float64)(unsafe.Pointer(iptr)) = i
	return f
}

// char *strncpy(char *dest, const char *src, size_t n)
func Xstrncpy(t *TLS, dest, src uintptr, n types.Size_t) (r uintptr) {
	r = dest
	for c := *(*int8)(unsafe.Pointer(src)); c != 0 && n > 0; n-- {
		*(*int8)(unsafe.Pointer(dest)) = c
		dest++
		src++
		c = *(*int8)(unsafe.Pointer(src))
	}
	for ; uintptr(n) > 0; n-- {
		*(*int8)(unsafe.Pointer(dest)) = 0
		dest++
	}
	return r
}

// char * __builtin___strncpy_chk (char *dest, const char *src, size_t n, size_t os);
func X__builtin___strncpy_chk(t *TLS, dest, src uintptr, n, os types.Size_t) (r uintptr) {
	if n != ^types.Size_t(0) && os < n {
		Xabort(t)
	}

	return Xstrncpy(t, dest, src, n)
}

// int strcmp(const char *s1, const char *s2)
func Xstrcmp(t *TLS, s1, s2 uintptr) int32 {
	for {
		ch1 := *(*byte)(unsafe.Pointer(s1))
		s1++
		ch2 := *(*byte)(unsafe.Pointer(s2))
		s2++
		if ch1 != ch2 || ch1 == 0 || ch2 == 0 {
			return int32(ch1) - int32(ch2)
		}
	}
}

// size_t strlen(const char *s)
func Xstrlen(t *TLS, s uintptr) (r types.Size_t) {
	if s == 0 {
		return 0
	}

	for ; *(*int8)(unsafe.Pointer(s)) != 0; s++ {
		r++
	}
	return r
}

// char *strcat(char *dest, const char *src)
func Xstrcat(t *TLS, dest, src uintptr) (r uintptr) {
	r = dest
	for *(*int8)(unsafe.Pointer(dest)) != 0 {
		dest++
	}
	for {
		c := *(*int8)(unsafe.Pointer(src))
		src++
		*(*int8)(unsafe.Pointer(dest)) = c
		dest++
		if c == 0 {
			return r
		}
	}
}

// char * __builtin___strcat_chk (char *dest, const char *src, size_t os);
func X__builtin___strcat_chk(t *TLS, dest, src uintptr, os types.Size_t) (r uintptr) {
	return Xstrcat(t, dest, src)
}

// int strncmp(const char *s1, const char *s2, size_t n)
func Xstrncmp(t *TLS, s1, s2 uintptr, n types.Size_t) int32 {
	var ch1, ch2 byte
	for ; n != 0; n-- {
		ch1 = *(*byte)(unsafe.Pointer(s1))
		s1++
		ch2 = *(*byte)(unsafe.Pointer(s2))
		s2++
		if ch1 != ch2 {
			return int32(ch1) - int32(ch2)
		}

		if ch1 == 0 {
			return 0
		}
	}
	return 0
}

// char *strcpy(char *dest, const char *src)
func Xstrcpy(t *TLS, dest, src uintptr) (r uintptr) {
	r = dest
	// src0 := src
	for ; ; dest++ {
		c := *(*int8)(unsafe.Pointer(src))
		src++
		*(*int8)(unsafe.Pointer(dest)) = c
		if c == 0 {
			return r
		}
	}
}

// char *strchr(const char *s, int c)
func Xstrchr(t *TLS, s uintptr, c int32) uintptr {
	for {
		ch2 := *(*byte)(unsafe.Pointer(s))
		if ch2 == byte(c) {
			return s
		}

		if ch2 == 0 {
			return 0
		}

		s++
	}
}

// char *strrchr(const char *s, int c)
func Xstrrchr(t *TLS, s uintptr, c int32) (r uintptr) {
	for {
		ch2 := *(*byte)(unsafe.Pointer(s))
		if ch2 == 0 {
			return r
		}

		if ch2 == byte(c) {
			r = s
		}
		s++
	}
}

// void *memset(void *s, int c, size_t n)
func Xmemset(t *TLS, s uintptr, c int32, n types.Size_t) uintptr {
	if n != 0 {
		c := byte(c & 0xff)

		// This will make sure that on platforms where they are not equally aligned we
		// clear out the first few bytes until allignment
		bytesBeforeAllignment := s % unsafe.Alignof(uint64(0))
		if bytesBeforeAllignment > uintptr(n) {
			bytesBeforeAllignment = uintptr(n)
		}
		b := (*RawMem)(unsafe.Pointer(s))[:bytesBeforeAllignment:bytesBeforeAllignment]
		n -= types.Size_t(bytesBeforeAllignment)
		for i := range b {
			b[i] = c
		}
		if n >= 8 {
			i64 := uint64(c) + uint64(c)<<8 + uint64(c)<<16 + uint64(c)<<24 + uint64(c)<<32 + uint64(c)<<40 + uint64(c)<<48 + uint64(c)<<56
			b8 := (*RawMem64)(unsafe.Pointer(s + bytesBeforeAllignment))[: n/8 : n/8]
			for i := range b8 {
				b8[i] = i64
			}
		}
		if n%8 != 0 {
			b = (*RawMem)(unsafe.Pointer(s + bytesBeforeAllignment + uintptr(n-n%8)))[: n%8 : n%8]
			for i := range b {
				b[i] = c
			}
		}
	}
	return s
}

// void *memcpy(void *dest, const void *src, size_t n);
func Xmemcpy(t *TLS, dest, src uintptr, n types.Size_t) (r uintptr) {
	if n != 0 {
		copy((*RawMem)(unsafe.Pointer(dest))[:n:n], (*RawMem)(unsafe.Pointer(src))[:n:n])
	}
	return dest
}

// int memcmp(const void *s1, const void *s2, size_t n);
func Xmemcmp(t *TLS, s1, s2 uintptr, n types.Size_t) int32 {
	for ; n != 0; n-- {
		c1 := *(*byte)(unsafe.Pointer(s1))
		s1++
		c2 := *(*byte)(unsafe.Pointer(s2))
		s2++
		if c1 < c2 {
			return -1
		}

		if c1 > c2 {
			return 1
		}
	}
	return 0
}

// void *memchr(const void *s, int c, size_t n);
func Xmemchr(t *TLS, s uintptr, c int32, n types.Size_t) uintptr {
	for ; n != 0; n-- {
		if *(*byte)(unsafe.Pointer(s)) == byte(c) {
			return s
		}

		s++
	}
	return 0
}

// void *memmove(void *dest, const void *src, size_t n);
func Xmemmove(t *TLS, dest, src uintptr, n types.Size_t) uintptr {
	if n == 0 {
		return dest
	}

	copy((*RawMem)(unsafe.Pointer(uintptr(dest)))[:n:n], (*RawMem)(unsafe.Pointer(uintptr(src)))[:n:n])
	return dest
}

// void * __builtin___memmove_chk (void *dest, const void *src, size_t n, size_t os);
func X__builtin___memmove_chk(t *TLS, dest, src uintptr, n, os types.Size_t) uintptr {
	if os != ^types.Size_t(0) && os < n {
		Xabort(t)
	}

	return Xmemmove(t, dest, src, n)
}

// char *getenv(const char *name);
func Xgetenv(t *TLS, name uintptr) uintptr {
	return getenv(Environ(), GoString(name))
}

func getenv(p uintptr, nm string) uintptr {
	for ; ; p += uintptrSize {
		q := *(*uintptr)(unsafe.Pointer(p))
		if q == 0 {
			return 0
		}

		s := GoString(q)
		a := strings.SplitN(s, "=", 2)
		if len(a) != 2 {
			panic(todo("%q %q %q", nm, s, a))
		}

		if a[0] == nm {
			return q + uintptr(len(nm)) + 1
		}
	}
}

// char *strstr(const char *haystack, const char *needle);
func Xstrstr(t *TLS, haystack, needle uintptr) uintptr {
	hs := GoString(haystack)
	nd := GoString(needle)
	if i := strings.Index(hs, nd); i >= 0 {
		r := haystack + uintptr(i)
		return r
	}

	return 0
}

// int putc(int c, FILE *stream);
func Xputc(t *TLS, c int32, fp uintptr) int32 {
	return Xfputc(t, c, fp)
}

// int atoi(const char *nptr);
func Xatoi(t *TLS, nptr uintptr) int32 {
	_, neg, _, n, _ := strToUint64(t, nptr, 10)
	switch {
	case neg:
		return int32(-n)
	default:
		return int32(n)
	}
}

// double atof(const char *nptr);
func Xatof(t *TLS, nptr uintptr) float64 {
	n, _ := strToFloatt64(t, nptr, 64)
	// if dmesgs {
	// 	dmesg("%v: %q: %v", origin(1), GoString(nptr), n)
	// }
	return n
}

// int tolower(int c);
func Xtolower(t *TLS, c int32) int32 {
	if c >= 'A' && c <= 'Z' {
		return c + ('a' - 'A')
	}

	return c
}

// int toupper(int c);
func Xtoupper(t *TLS, c int32) int32 {
	if c >= 'a' && c <= 'z' {
		return c - ('a' - 'A')
	}

	return c
}

// int isatty(int fd);
func Xisatty(t *TLS, fd int32) int32 {
	return Bool32(isatty.IsTerminal(uintptr(fd)))
}

// long atol(const char *nptr);
func Xatol(t *TLS, nptr uintptr) long {
	_, neg, _, n, _ := strToUint64(t, nptr, 10)
	switch {
	case neg:
		return long(-n)
	default:
		return long(n)
	}
}

func getLocalLocation() (loc *gotime.Location) {
	loc = gotime.Local
	if r := getenv(Environ(), "TZ"); r != 0 {
		zname := GoString(r)
		zone, off := parseZone(zname)
		loc = gotime.FixedZone(zone, -off)
		loc2, _ := gotime.LoadLocation(zname)
		if loc2 != nil {
			loc = loc2
		}
	}
	return loc

}

// time_t mktime(struct tm *tm);
func Xmktime(t *TLS, ptm uintptr) time.Time_t {
	loc := getLocalLocation()
	tt := gotime.Date(
		int((*time.Tm)(unsafe.Pointer(ptm)).Ftm_year+1900),
		gotime.Month((*time.Tm)(unsafe.Pointer(ptm)).Ftm_mon+1),
		int((*time.Tm)(unsafe.Pointer(ptm)).Ftm_mday),
		int((*time.Tm)(unsafe.Pointer(ptm)).Ftm_hour),
		int((*time.Tm)(unsafe.Pointer(ptm)).Ftm_min),
		int((*time.Tm)(unsafe.Pointer(ptm)).Ftm_sec),
		0,
		loc,
	)
	(*time.Tm)(unsafe.Pointer(ptm)).Ftm_wday = int32(tt.Weekday())
	(*time.Tm)(unsafe.Pointer(ptm)).Ftm_yday = int32(tt.YearDay() - 1)
	return time.Time_t(tt.Unix())
}

// char *strpbrk(const char *s, const char *accept);
func Xstrpbrk(t *TLS, s, accept uintptr) uintptr {
	bits := newBits(256)
	for {
		b := *(*byte)(unsafe.Pointer(accept))
		if b == 0 {
			break
		}

		bits.set(int(b))
		accept++
	}
	for {
		b := *(*byte)(unsafe.Pointer(s))
		if b == 0 {
			return 0
		}

		if bits.has(int(b)) {
			return s
		}

		s++
	}
}

// int strcasecmp(const char *s1, const char *s2);
func Xstrcasecmp(t *TLS, s1, s2 uintptr) int32 {
	for {
		ch1 := *(*byte)(unsafe.Pointer(s1))
		if ch1 >= 'a' && ch1 <= 'z' {
			ch1 = ch1 - ('a' - 'A')
		}
		s1++
		ch2 := *(*byte)(unsafe.Pointer(s2))
		if ch2 >= 'a' && ch2 <= 'z' {
			ch2 = ch2 - ('a' - 'A')
		}
		s2++
		if ch1 != ch2 || ch1 == 0 || ch2 == 0 {
			r := int32(ch1) - int32(ch2)
			return r
		}
	}
}

func Xntohs(t *TLS, netshort uint16) uint16 {
	return uint16((*[2]byte)(unsafe.Pointer(&netshort))[0])<<8 | uint16((*[2]byte)(unsafe.Pointer(&netshort))[1])
}

// uint16_t htons(uint16_t hostshort);
func Xhtons(t *TLS, hostshort uint16) uint16 {
	var a [2]byte
	a[0] = byte(hostshort >> 8)
	a[1] = byte(hostshort)
	return *(*uint16)(unsafe.Pointer(&a))
}

// uint32_t htonl(uint32_t hostlong);
func Xhtonl(t *TLS, hostlong uint32) uint32 {
	var a [4]byte
	a[0] = byte(hostlong >> 24)
	a[1] = byte(hostlong >> 16)
	a[2] = byte(hostlong >> 8)
	a[3] = byte(hostlong)
	return *(*uint32)(unsafe.Pointer(&a))
}

// FILE *fopen(const char *pathname, const char *mode);
func Xfopen(t *TLS, pathname, mode uintptr) uintptr {
	return Xfopen64(t, pathname, mode) //TODO 32 bit
}

func Dmesg(s string, args ...interface{}) {
	if dmesgs {
		dmesg(s, args...)
	}
}

// void sqlite3_log(int iErrCode, const char *zFormat, ...);
func X__ccgo_sqlite3_log(t *TLS, iErrCode int32, zFormat uintptr, args uintptr) {
	// if dmesgs {
	// 	dmesg("%v: iErrCode: %v, msg: %s\n%s", origin(1), iErrCode, printf(zFormat, args), debug.Stack())
	// }
}

// int _IO_putc(int __c, _IO_FILE *__fp);
func X_IO_putc(t *TLS, c int32, fp uintptr) int32 {
	return Xputc(t, c, fp)
}

// int atexit(void (*function)(void));
func Xatexit(t *TLS, function uintptr) int32 {
	AtExit(func() {
		(*struct{ f func(*TLS) })(unsafe.Pointer(&struct{ uintptr }{function})).f(t)
	})
	return 0
}

// int vasprintf(char **strp, const char *fmt, va_list ap);
func Xvasprintf(t *TLS, strp, fmt, ap uintptr) int32 {
	panic(todo(""))
}

func AtomicLoadInt32(addr *int32) (val int32)       { return atomic.LoadInt32(addr) }
func AtomicLoadInt64(addr *int64) (val int64)       { return atomic.LoadInt64(addr) }
func AtomicLoadUint32(addr *uint32) (val uint32)    { return atomic.LoadUint32(addr) }
func AtomicLoadUint64(addr *uint64) (val uint64)    { return atomic.LoadUint64(addr) }
func AtomicLoadUintptr(addr *uintptr) (val uintptr) { return atomic.LoadUintptr(addr) }

func AtomicLoadFloat32(addr *float32) (val float32) {
	return math.Float32frombits(atomic.LoadUint32((*uint32)(unsafe.Pointer(addr))))
}

func AtomicLoadFloat64(addr *float64) (val float64) {
	return math.Float64frombits(atomic.LoadUint64((*uint64)(unsafe.Pointer(addr))))
}

func AtomicLoadPInt32(addr uintptr) (val int32) {
	return atomic.LoadInt32((*int32)(unsafe.Pointer(addr)))
}

func AtomicLoadPInt64(addr uintptr) (val int64) {
	return atomic.LoadInt64((*int64)(unsafe.Pointer(addr)))
}

func AtomicLoadPUint32(addr uintptr) (val uint32) {
	return atomic.LoadUint32((*uint32)(unsafe.Pointer(addr)))
}

func AtomicLoadPUint64(addr uintptr) (val uint64) {
	return atomic.LoadUint64((*uint64)(unsafe.Pointer(addr)))
}

func AtomicLoadPUintptr(addr uintptr) (val uintptr) {
	return atomic.LoadUintptr((*uintptr)(unsafe.Pointer(addr)))
}

func AtomicLoadPFloat32(addr uintptr) (val float32) {
	return math.Float32frombits(atomic.LoadUint32((*uint32)(unsafe.Pointer(addr))))
}

func AtomicLoadPFloat64(addr uintptr) (val float64) {
	return math.Float64frombits(atomic.LoadUint64((*uint64)(unsafe.Pointer(addr))))
}

func AtomicStoreInt32(addr *int32, val int32)       { atomic.StoreInt32(addr, val) }
func AtomicStoreInt64(addr *int64, val int64)       { atomic.StoreInt64(addr, val) }
func AtomicStoreUint32(addr *uint32, val uint32)    { atomic.StoreUint32(addr, val) }
func AtomicStoreUint64(addr *uint64, val uint64)    { atomic.StoreUint64(addr, val) }
func AtomicStoreUintptr(addr *uintptr, val uintptr) { atomic.StoreUintptr(addr, val) }

func AtomicStoreFloat32(addr *float32, val float32) {
	atomic.StoreUint32((*uint32)(unsafe.Pointer(addr)), math.Float32bits(val))
}

func AtomicStoreFloat64(addr *float64, val float64) {
	atomic.StoreUint64((*uint64)(unsafe.Pointer(addr)), math.Float64bits(val))
}

func AtomicStorePInt32(addr uintptr, val int32) {
	atomic.StoreInt32((*int32)(unsafe.Pointer(addr)), val)
}

func AtomicStorePInt64(addr uintptr, val int64) {
	atomic.StoreInt64((*int64)(unsafe.Pointer(addr)), val)
}

func AtomicStorePUint32(addr uintptr, val uint32) {
	atomic.StoreUint32((*uint32)(unsafe.Pointer(addr)), val)
}

func AtomicStorePUint64(addr uintptr, val uint64) {
	atomic.StoreUint64((*uint64)(unsafe.Pointer(addr)), val)
}

func AtomicStorePUintptr(addr uintptr, val uintptr) {
	atomic.StoreUintptr((*uintptr)(unsafe.Pointer(addr)), val)
}

func AtomicStorePFloat32(addr uintptr, val float32) {
	atomic.StoreUint32((*uint32)(unsafe.Pointer(addr)), math.Float32bits(val))
}

func AtomicStorePFloat64(addr uintptr, val float64) {
	atomic.StoreUint64((*uint64)(unsafe.Pointer(addr)), math.Float64bits(val))
}

func AtomicAddInt32(addr *int32, delta int32) (new int32)     { return atomic.AddInt32(addr, delta) }
func AtomicAddInt64(addr *int64, delta int64) (new int64)     { return atomic.AddInt64(addr, delta) }
func AtomicAddUint32(addr *uint32, delta uint32) (new uint32) { return atomic.AddUint32(addr, delta) }
func AtomicAddUint64(addr *uint64, delta uint64) (new uint64) { return atomic.AddUint64(addr, delta) }

func AtomicAddUintptr(addr *uintptr, delta uintptr) (new uintptr) {
	return atomic.AddUintptr(addr, delta)

}

func AtomicAddFloat32(addr *float32, delta float32) (new float32) {
	v := AtomicLoadFloat32(addr) + delta
	AtomicStoreFloat32(addr, v)
	return v
}

func AtomicAddFloat64(addr *float64, delta float64) (new float64) {
	v := AtomicLoadFloat64(addr) + delta
	AtomicStoreFloat64(addr, v)
	return v
}

// size_t mbstowcs(wchar_t *dest, const char *src, size_t n);
func Xmbstowcs(t *TLS, dest, src uintptr, n types.Size_t) types.Size_t {
	panic(todo(""))
}

// int mbtowc(wchar_t *pwc, const char *s, size_t n);
func Xmbtowc(t *TLS, pwc, s uintptr, n types.Size_t) int32 {
	panic(todo(""))
}

// size_t __ctype_get_mb_cur_max(void);
func X__ctype_get_mb_cur_max(t *TLS) types.Size_t {
	panic(todo(""))
}

// int wctomb(char *s, wchar_t wc);
func Xwctomb(t *TLS, s uintptr, wc wchar_t) int32 {
	panic(todo(""))
}

// int mblen(const char *s, size_t n);
func Xmblen(t *TLS, s uintptr, n types.Size_t) int32 {
	panic(todo(""))
}

// ssize_t readv(int fd, const struct iovec *iov, int iovcnt);
func Xreadv(t *TLS, fd int32, iov uintptr, iovcnt int32) types.Ssize_t {
	panic(todo(""))
}

// int openpty(int *amaster, int *aslave, char *name,
//
//	const struct termios *termp,
//	const struct winsize *winp);
func Xopenpty(t *TLS, amaster, aslave, name, termp, winp uintptr) int32 {
	panic(todo(""))
}

// pid_t setsid(void);
func Xsetsid(t *TLS) types.Pid_t {
	panic(todo(""))
}

// int pselect(int nfds, fd_set *readfds, fd_set *writefds,
//
//	fd_set *exceptfds, const struct timespec *timeout,
//	const sigset_t *sigmask);
func Xpselect(t *TLS, nfds int32, readfds, writefds, exceptfds, timeout, sigmask uintptr) int32 {
	panic(todo(""))
}

// int kill(pid_t pid, int sig);
func Xkill(t *TLS, pid types.Pid_t, sig int32) int32 {
	panic(todo(""))
}

// int tcsendbreak(int fd, int duration);
func Xtcsendbreak(t *TLS, fd, duration int32) int32 {
	panic(todo(""))
}

// int wcwidth(wchar_t c);
func Xwcwidth(t *TLS, c wchar_t) int32 {
	panic(todo(""))
}

// int clock_gettime(clockid_t clk_id, struct timespec *tp);
func Xclock_gettime(t *TLS, clk_id int32, tp uintptr) int32 {
	panic(todo(""))
}

// AtExit will attempt to run f at process exit. The execution cannot be
// guaranteed, neither its ordering with respect to any other handlers
// registered by AtExit.
func AtExit(f func()) {
	atExitMu.Lock()
	atExit = append(atExit, f)
	atExitMu.Unlock()
}

func X__ccgo_dmesg(t *TLS, fmt uintptr, va uintptr) {
	if dmesgs {
		dmesg("%s", printf(fmt, va))
	}
}

// int getentropy(void *buffer, size_t length);
//
// The  getentropy() function writes length bytes of high-quality random data
// to the buffer starting at the location pointed to by buffer. The maximum
// permitted value for the length argument is 256.
func Xgetentropy(t *TLS, buffer uintptr, length size_t) int32 {
	const max = 256
	switch {
	case length == 0:
		return 0
	case buffer == 0:
		t.setErrno(errno.EFAULT)
		return -1
	case length > max:
		t.setErrno(errno.EIO)
		return -1
	}

	if _, err := crand.Read((*RawMem)(unsafe.Pointer(buffer))[:length]); err != nil {
		t.setErrno(errno.EIO)
		return -1
	}

	return 0
}

// void * reallocarray(void *ptr, size_t nmemb, size_t size);
func Xreallocarray(t *TLS, ptr uintptr, nmemb, size size_t) uintptr {
	hi, lo := mathutil.MulUint128_64(uint64(nmemb), uint64(size))
	if hi != 0 || lo > uint64(unsafe.Sizeof(RawMem{})) {
		t.setErrno(errno.ENOMEM)
		return 0
	}

	return Xrealloc(t, ptr, size_t(lo))
}

// int setjmp(jmp_buf env);
func Xsetjmp(t *TLS, env uintptr) int32 {
	return 0 //TODO
}

// void longjmp(jmp_buf env, int val);
func Xlongjmp(t *TLS, env uintptr, val int32) {
	panic(todo(""))
}

// https://linux.die.net/man/3/_setjmp
//
// The _longjmp() and _setjmp() functions shall be equivalent to longjmp() and
// setjmp(), respectively, with the additional restriction that _longjmp() and
// _setjmp() shall not manipulate the signal mask.

// int _setjmp(jmp_buf env);
func X_setjmp(t *TLS, env uintptr) int32 {
	return 0 //TODO
}

// void _longjmp(jmp_buf env, int val);
func X_longjmp(t *TLS, env uintptr, val int32) {
	panic(todo(""))
}

// unsigned __sync_add_and_fetch_uint32(*unsigned, unsigned)
func X__sync_add_and_fetch_uint32(t *TLS, p uintptr, v uint32) uint32 {
	return atomic.AddUint32((*uint32)(unsafe.Pointer(p)), v)
}

// unsigned __sync_sub_and_fetch_uint32(*unsigned, unsigned)
func X__sync_sub_and_fetch_uint32(t *TLS, p uintptr, v uint32) uint32 {
	return atomic.AddUint32((*uint32)(unsafe.Pointer(p)), -v)
}

// int sched_yield(void);
func Xsched_yield(t *TLS) {
	runtime.Gosched()
}

// int getc(FILE *stream);
func Xgetc(t *TLS, stream uintptr) int32 {
	return Xfgetc(t, stream)
}

// char *fgets(char *s, int size, FILE *stream);
func Xfgets(t *TLS, s uintptr, size int32, stream uintptr) uintptr {
	var b []byte
out:
	for ; size > 0; size-- {
		switch c := Xfgetc(t, stream); c {
		case '\n':
			b = append(b, byte(c))
			break out
		case stdio.EOF:
			break out
		default:
			b = append(b, byte(c))
		}
	}
	if len(b) == 0 {
		return 0
	}

	b = append(b, 0)
	copy((*RawMem)(unsafe.Pointer(s))[:len(b):len(b)], b)
	return s
}

// void bzero(void *s, size_t n);
func Xbzero(t *TLS, s uintptr, n types.Size_t) {
	b := (*RawMem)(unsafe.Pointer(s))[:n]
	for i := range b {
		b[i] = 0
	}
}

// char *rindex(const char *s, int c);
func Xrindex(t *TLS, s uintptr, c int32) uintptr {
	if s == 0 {
		return 0
	}

	var r uintptr
	for {
		c2 := int32(*(*byte)(unsafe.Pointer(s)))
		if c2 == c {
			r = s
		}

		if c2 == 0 {
			return r
		}

		s++
	}
}

// int isascii(int c);
func Xisascii(t *TLS, c int32) int32 {
	return Bool32(c >= 0 && c <= 0x7f)
}

func X__builtin_isunordered(t *TLS, a, b float64) int32 {
	return Bool32(math.IsNaN(a) || math.IsNaN(b))
}
