// Copyright 2020 The CCGO Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:generate stringer -output stringer.go -type=exprMode,opKind

// Package ccgo implements the ccgo command.
package ccgo // import "modernc.org/ccgo/v3/lib"

import (
	"bufio"
	"bytes"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"go/ast"
	"go/build"
	"go/parser"
	"go/token"
	"io"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"runtime/debug"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/kballard/go-shellquote"
	"golang.org/x/tools/go/packages"
	"modernc.org/cc/v3"
	"modernc.org/libc"
	"modernc.org/opt"
)

const (
	Version = "3.12.6-20210922111124"

	experimentsEnvVar = "CCGO_EXPERIMENT"
	maxSourceLine     = 1 << 20
)

var (
	_ = libc.Xstdin

	coverExperiment bool
)

func init() {
	s := strings.TrimSpace(os.Getenv(experimentsEnvVar))
	if s == "" {
		return
	}

	for _, v := range strings.Split(s, ",") {
		switch strings.TrimSpace(v) {
		case "cover":
			coverExperiment = true
		}
	}
}

//TODO CPython
//TODO Cython
//TODO gmp
//TODO gofrontend
//TODO gsl
//TODO minigmp
//TODO mpc
//TODO mpfr
//TODO pcre
//TODO pcre2
//TODO quickjs
//TODO redis
//TODO sdl2
//TODO wolfssl
//TODO zdat
//TODO zstd

//TODO 2020-07-17
//
// Fix += and friends
//
// Audit all unsafe.Pointer conversions
//
// Remove double dereferencing **
//
// Shifts must not use n.Promote on left opearand
//
// Un-array
//
// Pass more CSmith tests.

//TODO merge VaList slots of distinct top level statements.

//TODO turn void
//
//	a = b = c = d
//
// where all but the first and last of a, b, c, ... are declarators, into
//
//	c = d
//	b = c
//	a = b

//TODO define and use all tagged struct types, including inner ones, for example SQLite's SrcList_item.

//TODO rewrite return conditionalExpression so it has no closures. Partially done.

//TODO define and restore simple named constants. Having
//
//	#define FOO 42
//	...
//	case FOO:
//
// we do not yet define FOO and generate
//
//	case 42:

//TODO do not generate a terminating semicolon for empty statements.

//TODO replace
//
//	var sqlite3_data_directory uintptr = uintptr(0) /* sqlite3.c:156345:17 */
//
// by
//
//	var sqlite3_data_directory uintptr = 0 /* sqlite3.c:156345:17 */
//
// or
//
//	var sqlite3_data_directory = uintptr(0) /* sqlite3.c:156345:17 */

//TODO drop all non-referenced declarators unless forced by a command line flag.

const (
	builtin = `
#ifdef __PTRDIFF_TYPE__
typedef __PTRDIFF_TYPE__ ptrdiff_t;
#else
#error __PTRDIFF_TYPE__ undefined
#endif

#ifdef __SIZE_TYPE__
typedef __SIZE_TYPE__ size_t;
#else
#error __SIZE_TYPE__ undefined
#endif

#ifdef __WCHAR_TYPE__
typedef __WCHAR_TYPE__ wchar_t;
#else
#error __WCHAR_TYPE__ undefined
#endif

#ifdef __SIZEOF_INT128__
typedef struct { __INT64_TYPE__ lo, hi; } __int128_t;   // must match modernc.org/mathutil.Int128
typedef struct { __UINT64_TYPE__ lo, hi; } __uint128_t; // must match modernc.org/mathutil.Int128
#endif;

#define _FILE_OFFSET_BITS 64
#define __FUNCTION__ __func__
#define __PRETTY_FUNCTION__ __func__
#define __asm __asm__
#define __builtin_constant_p(x) __builtin_constant_p_impl(0, x)
#define __builtin_offsetof(type, member) ((__SIZE_TYPE__)&(((type*)0)->member))
#define __builtin_va_arg(ap, type) ((type)__ccgo_va_arg(ap))
#define __builtin_va_copy(dst, src) dst = src
#define __builtin_va_end(ap) __ccgo_va_end(ap)
#define __builtin_va_start(ap, v) __ccgo_va_start(ap)
#define __ccgo_fd_zero(set) __builtin_memset(set, 0, sizeof(fd_set))
#define __ccgo_tcl_default_double_rounding(set) ((void)0)
#define __ccgo_tcl_ieee_double_rounding(set) ((void)0)
#define __extension__
#define __has_include(...) __has_include_impl(#__VA_ARGS__)
#define __has_include_impl(x)
#define __inline__ inline
#define __signed signed
#define asm __asm__
#define in6addr_any (*__ccgo_in6addr_anyp())

typedef void *__builtin_va_list;
typedef long double __float128;

#if defined(__MINGW32__) || defined(__MINGW64__)
typedef __builtin_va_list va_list;
int gnu_printf(const char *format, ...);
int gnu_scanf(const char *format, ...);
int ms_printf(const char *format, ...);
int ms_scanf(const char *format, ...);
#define _VA_LIST_DEFINED
#define __extension__
#endif

__UINT16_TYPE__ __builtin_bswap16 (__UINT16_TYPE__ x);
__UINT32_TYPE__ __builtin_bswap32 (__UINT32_TYPE__ x);
__UINT64_TYPE__ __builtin_bswap64 (__UINT64_TYPE__ x);
char *__builtin___strcat_chk (char *dest, const char *src, size_t os);
char *__builtin___strcpy_chk (char *dest, const char *src, size_t os);
char *__builtin___strncpy_chk(char *dest, char *src, size_t n, size_t os);
char *__builtin_strchr(const char *s, int c);
char *__builtin_strcpy(char *dest, const char *src);
double __builtin_copysign ( double x, double y );
double __builtin_copysignl (long double x, long double y );
double __builtin_fabs(double x);
double __builtin_huge_val (void);
double __builtin_inf (void);
double __builtin_nan (const char *str);
float __builtin_copysignf ( float x, float y );
float __builtin_fabsf(float x);
float __builtin_huge_valf (void);
float __builtin_inff (void);
float __builtin_nanf (const char *str);
int __builtin___snprintf_chk (char *s, size_t maxlen, int flag, size_t os, const char *fmt, ...);
int __builtin___sprintf_chk (char *s, int flag, size_t os, const char *fmt, ...);
int __builtin___vsnprintf_chk (char *s, size_t maxlen, int flag, size_t os, const char *fmt, __builtin_va_list ap);
int __builtin__snprintf_chk(char * str, size_t maxlen, int flag, size_t strlen, const char * format);
int __builtin_abs(int j);
int __builtin_add_overflow();
int __builtin_clz (unsigned);
int __builtin_isunordered(double x, double y);
int __builtin_clzl (unsigned long);
int __builtin_clzll (unsigned long long);
int __builtin_constant_p_impl(int, ...);
int __builtin_getentropy(void*, size_t);
int __builtin_isnan(double);
int __builtin_memcmp(const void *s1, const void *s2, size_t n);
int __builtin_mul_overflow();
int __builtin_popcount (unsigned int x);
int __builtin_popcountl (unsigned long x);
int __builtin_printf(const char *format, ...);
int __builtin_snprintf(char *str, size_t size, const char *format, ...);
int __builtin_sprintf(char *str, const char *format, ...);
int __builtin_strcmp(const char *s1, const char *s2);
int __builtin_sub_overflow();
long __builtin_expect (long exp, long c);
long double __builtin_fabsl(long double x);
long double __builtin_nanl (const char *str);
long long __builtin_llabs(long long j);
size_t __builtin_object_size (void * ptr, int type);
size_t __builtin_strlen(const char *s);
void *__builtin___memcpy_chk (void *dest, const void *src, size_t n, size_t os);
void *__builtin___memmove_chk (void *dest, const void *src, size_t n, size_t os);
void *__builtin___memset_chk (void *dstpp, int c, size_t len, size_t dstlen);
void *__builtin_malloc(size_t size);
void *__builtin_memcpy(void *dest, const void *src, size_t n);
void *__builtin_memset(void *s, int c, size_t n);
void *__builtin_mmap(void *addr, size_t length, int prot, int flags, int fd, __INTPTR_TYPE__ offset);
void *__ccgo_va_arg(__builtin_va_list ap);
void __builtin_abort(void);
void __builtin_bzero(void *s, size_t n);
void __builtin_exit(int status);
void __builtin_free(void *ptr);
void __builtin_prefetch (const void *addr, ...);
void __builtin_trap (void);
void __builtin_unreachable (void);
void __ccgo_dmesg(char*, ...);
void __ccgo_va_end(__builtin_va_list ap);
void __ccgo_va_start(__builtin_va_list ap);

#define __sync_add_and_fetch(ptr, val) \
	__builtin_choose_expr(	\
		__builtin_types_compatible_p(typeof(*ptr), unsigned),	\
		__sync_add_and_fetch_uint32(ptr, val),	\
		__TODO__	\
	)

#define __sync_fetch_and_add(ptr, val) \
	__TODO__	\

#define __sync_sub_and_fetch(ptr, val) \
	__builtin_choose_expr(	\
		__builtin_types_compatible_p(typeof(*ptr), unsigned),	\
		__sync_sub_and_fetch_uint32(ptr, val),	\
		__TODO__	\
	)

unsigned __sync_add_and_fetch_uint32(unsigned*, unsigned);
unsigned __sync_sub_and_fetch_uint32(unsigned*, unsigned);

#ifdef __APPLE__
int (*__darwin_check_fd_set_overflow)(int, void *, int);
#endif

`
	defaultCrt = "modernc.org/libc"
)

func origin(skip int) string {
	pc, fn, fl, _ := runtime.Caller(skip)
	f := runtime.FuncForPC(pc)
	var fns string
	if f != nil {
		fns = f.Name()
		if x := strings.LastIndex(fns, "."); x > 0 {
			fns = fns[x+1:]
		}
	}
	return fmt.Sprintf("%s:%d:%s", fn, fl, fns)
}

func todo(s string, args ...interface{}) string {
	switch {
	case s == "":
		s = fmt.Sprintf(strings.Repeat("%v ", len(args)), args...)
	default:
		s = fmt.Sprintf(s, args...)
	}
	r := fmt.Sprintf("%s\n\tTODO %s", origin(2), s) //TODOOK
	fmt.Fprintf(os.Stdout, "%s\n", r)
	os.Stdout.Sync()
	return r
}

func trc(s string, args ...interface{}) string {
	switch {
	case s == "":
		s = fmt.Sprintf(strings.Repeat("%v ", len(args)), args...)
	default:
		s = fmt.Sprintf(s, args...)
	}
	r := fmt.Sprintf("%s: TRC %s", origin(2), s)
	fmt.Fprintf(os.Stderr, "%s\n", r)
	os.Stderr.Sync()
	return r
}

// Task represents a compilation job.
type Task struct {
	D                               []string // -D
	I                               []string // -I
	U                               []string // -U
	ar                              string   // $AR, default "ar"
	arLookPath                      string   // LookPath(ar)
	args                            []string
	asts                            []*cc.AST
	capif                           string
	saveConfig                      string // -save-config
	saveConfigErr                   error
	cc                              string // $CC, default "gcc"
	ccLookPath                      string // LookPath(cc)
	cdb                             string // foo.json, use compile DB
	cfg                             *cc.Config
	compiledb                       string // -compiledb
	crt                             string
	crtImportPath                   string // -crt-import-path
	exportDefines                   string // -export-defines
	exportEnums                     string // -export-enums
	exportExterns                   string // -export-externs
	exportFields                    string // -export-fields
	exportStructs                   string // -export-structs
	exportTypedefs                  string // -export-typedefs
	goarch                          string
	goos                            string
	hide                            map[string]struct{} // -hide
	hostConfigCmd                   string              // -host-config-cmd
	hostConfigOpts                  string              // -host-config-opts
	hostIncludes                    []string
	hostPredefined                  string
	hostSysIncludes                 []string
	ignoredIncludes                 string              // -ignored-includes
	ignoredObjects                  map[string]struct{} // -ignore-object
	imported                        []*imported
	includedFiles                   map[string]struct{}
	l                               []string // -l
	loadConfig                      string   // --load-config
	o                               string   // -o
	out                             io.Writer
	pkgName                         string // -pkgname
	replaceFdZero                   string // -replace-fd-zero
	replaceTclDefaultDoubleRounding string // -replace-tcl-default-double-rounding
	replaceTclIeeeDoubleRounding    string // -replace-tcl-default-double-rounding
	scriptFn                        string // -script
	sources                         []cc.Source
	staticLocalsPrefix              string // -static-locals-prefix
	stderr                          io.Writer
	stdout                          io.Writer
	symSearchOrder                  []int                    // >= 0: asts[i], < 0 : imported[-i-1]
	verboseCompiledb                bool                     // -verbose-compiledb
	volatiles                       map[cc.StringID]struct{} // -volatile

	// Path to a binary that will be called instead of executing
	// Task.Main().  Intended to support TestGenerate in stable vs latest
	// modes. This is _not_ supposed to be used when the Task instance is
	// constructed by a ccgo _command_ (ccgo/v3) - it should never set this
	// field. Only programs importing ccgo/v3/lib that opt-in into this
	// feature should ever set it.
	CallOutBinary string

	E                         bool // -E
	allErrors                 bool // -all-errors
	compiledbValid            bool // -compiledb present
	configSaved               bool
	configured                bool // hostPredefined, hostIncludes, hostSysIncludes are valid
	cover                     bool // -cover-instrumentation
	coverC                    bool // -cover-instrumentation-c
	defaultUnExport           bool // -unexported-by-default
	errTrace                  bool // -err-trace
	exportDefinesValid        bool // -export-defines present
	exportEnumsValid          bool // -export-enums present
	exportExternsValid        bool // -export-externs present
	exportFieldsValid         bool // -export-fields present
	exportStructsValid        bool // -export-structs present
	exportTypedefsValid       bool // -export-typedefs present
	fullPathComments          bool // -full-path-comments
	funcSig                   bool // -func-sig
	header                    bool // -header
	ignoreUnsupportedAligment bool // -ignore-unsupported-alignment
	isScripted                bool
	mingw                     bool
	noCapi                    bool // -nocapi
	nostdinc                  bool // -nostdinc
	nostdlib                  bool // -nostdlib
	panicStubs                bool // -panic-stubs
	tracePinning              bool // -trace-pinning
	traceTranslationUnits     bool // -trace-translation-units
	verifyStructs             bool // -verify-structs
	version                   bool // -version
	watch                     bool // -watch-instrumentation
	windows                   bool // -windows
}

// NewTask returns a newly created Task.
func NewTask(args []string, stdout, stderr io.Writer) *Task {
	if dmesgs {
		dmesg("%v: %v", origin(1), args)
	}
	if stdout == nil {
		stdout = os.Stdout
	}
	if stderr == nil {
		stderr = os.Stderr
	}
	return &Task{
		args: args,
		cfg: &cc.Config{
			Config3: cc.Config3{
				MaxSourceLine: maxSourceLine,
			},
			DoNotTypecheckAsm:                     true,
			EnableAssignmentCompatibilityChecking: true,
			LongDoubleIsDouble:                    true,
			SharedFunctionDefinitions:             &cc.SharedFunctionDefinitions{},
		},
		ar:            env("AR", "ar"),
		cc:            env("CC", "gcc"),
		crt:           "libc.",
		crtImportPath: defaultCrt,
		goarch:        env("TARGET_GOARCH", env("GOARCH", runtime.GOARCH)),
		goos:          env("TARGET_GOOS", env("GOOS", runtime.GOOS)),
		hide:          map[string]struct{}{},
		hostConfigCmd: env("CCGO_CPP", ""),
		pkgName:       "main",
		stderr:        stderr,
		stdout:        stdout,
		volatiles:     map[cc.StringID]struct{}{},
	}
}

func env(name, deflt string) (r string) {
	r = deflt
	if s := os.Getenv(name); s != "" {
		r = s
	}
	return r
}

// Get exported symbols from package having import path 'path'.
func (t *Task) capi(path string) (pkgName string, exports map[string]struct{}, err error) {
	// defer func() {
	// 	var a []string
	// 	for k := range exports {
	// 		a = append(a, k)
	// 	}
	// 	sort.Strings(a)
	// 	trc("%s\n%s", path, strings.Join(a, "\n"))
	// }()
	var errModule, errGopath error
	defer func() {
		if err != nil {
			a := []string{err.Error()}
			if errModule != nil {
				a = append(a, fmt.Sprintf("module mode error: %s", errModule))
			}
			if errGopath != nil {
				a = append(a, fmt.Sprintf("gopath mode error: %s", errGopath))
			}
			wd, err2 := os.Getwd()
			err = fmt.Errorf(
				"(wd %q, %v): loading C exports from %s (GOPATH=%v GO111MODULE=%v): %v",
				wd, err2, path, os.Getenv("GOPATH"), os.Getenv("GO111MODULE"), strings.Join(a, "\n\t"),
			)
		}
	}()

	mod := os.Getenv("GO111MODULE")
	if mod == "" || mod == "on" {
		var pkgs []*packages.Package
		pkgs, errModule = packages.Load(
			&packages.Config{
				Mode: packages.NeedFiles,
				Env:  append(os.Environ(), fmt.Sprintf("GOOS=%s", t.goos), fmt.Sprintf("GOARCH=%s", t.goarch)),
			},
			path,
		)
		switch {
		case errModule == nil:
			if len(pkgs) != 1 {
				errModule = fmt.Errorf("expected one package, loaded %d", len(pkgs))
				break
			}

			pkg := pkgs[0]
			if len(pkg.Errors) != 0 {
				var a []string
				for _, v := range pkg.Errors {
					a = append(a, v.Error())
				}
				errModule = fmt.Errorf("%s", strings.Join(a, "\n"))
				break
			}

			return t.capi2(pkg.GoFiles)
		}
	}

	gopath0 := os.Getenv("GOPATH")
	for _, gopath := range strings.Split(gopath0, string(os.PathListSeparator)) {
		if gopath == "" || !filepath.IsAbs(gopath) {
			continue
		}

		ctx := build.Context{
			GOARCH:   t.goarch,
			GOOS:     t.goos,
			GOPATH:   gopath,
			Compiler: "gc",
		}
		arg := filepath.Join(gopath, "src", path)
		pkg, err := ctx.ImportDir(arg, 0)
		if err != nil {
			errGopath = err
			continue
		}

		for i, v := range pkg.GoFiles {
			pkg.GoFiles[i] = filepath.Join(gopath, "src", path, v)
		}
		return t.capi2(pkg.GoFiles)
	}
	return "", nil, fmt.Errorf("cannot load CAPI")
}

func (t *Task) capi2(files []string) (pkgName string, exports map[string]struct{}, err error) {
	exports = map[string]struct{}{}
	base := fmt.Sprintf("capi_%s_%s.go", t.goos, t.goarch)
	var fn string
	for _, v := range files {
		if filepath.Base(v) == base {
			fn = v
			break
		}
	}
	if fn == "" {
		return "", nil, fmt.Errorf("file %s not found", base)
	}

	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, fn, nil, 0)
	if err != nil {
		return "", nil, err
	}

	obj, ok := file.Scope.Objects["CAPI"]
	if !ok {
		return "", nil, fmt.Errorf("CAPI not declared in %s", fn)
	}

	switch obj.Kind {
	case ast.Var:
		// ok
	default:
		return "", nil, fmt.Errorf("unexpected CAPI object kind: %v", obj.Kind)
	}

	spec, ok := obj.Decl.(*ast.ValueSpec)
	if !ok {
		return "", nil, fmt.Errorf("unexpected CAPI object type: %T", obj.Decl)
	}

	if len(spec.Values) != 1 {
		return "", nil, fmt.Errorf("expected one CAPI expression, got %v", len(spec.Values))
	}

	ast.Inspect(spec.Values[0], func(n ast.Node) bool {
		if x, ok := n.(*ast.BasicLit); ok {
			var key string
			if key, err = strconv.Unquote(x.Value); err != nil {
				err = fmt.Errorf("invalid CAPI key value: %s", x.Value)
				return false
			}

			exports[key] = struct{}{}
		}
		return true
	})
	return file.Name.String(), exports, err
}

// Main executes task.
func (t *Task) Main() (err error) {
	if dmesgs {
		defer func() {
			if err != nil {
				// trc("FAIL %p: %q: %v", t, t.args, err)
				dmesg("%v: returning from Task.Main: %v", origin(1), err)
			}
		}()

	}

	defer func() {
		if t.saveConfigErr != nil && err == nil {
			err = t.saveConfigErr
		}
	}()

	if !t.isScripted && coverExperiment {
		defer func() {
			fmt.Fprintf(os.Stderr, "cover report:\n%s\n", coverReport())
		}()
	}
	if t.CallOutBinary != "" {
		if dmesgs {
			dmesg("%v: calling out '%s' instead", origin(1))
		}
		cmd := exec.Command(t.CallOutBinary, t.args[1:]...)
		out, err := cmd.CombinedOutput()
		if err != nil {
			err = fmt.Errorf("%v\n%s", err, out)
		}
		return err
	}

	opts := opt.NewSet()
	opts.Arg("D", true, func(arg, value string) error { t.D = append(t.D, value); return nil })
	opts.Arg("I", true, func(opt, arg string) error { t.I = append(t.I, arg); return nil })
	opts.Arg("U", true, func(arg, value string) error { t.U = append(t.U, value); return nil })
	opts.Arg("compiledb", false, func(arg, value string) error { t.compiledb = value; t.compiledbValid = true; return opt.Skip(nil) })
	opts.Arg("crt-import-path", false, func(arg, value string) error { t.crtImportPath = value; return nil })
	opts.Arg("export-defines", false, func(arg, value string) error { t.exportDefines = value; t.exportDefinesValid = true; return nil })
	opts.Arg("export-enums", false, func(arg, value string) error { t.exportEnums = value; t.exportEnumsValid = true; return nil })
	opts.Arg("export-externs", false, func(arg, value string) error { t.exportExterns = value; t.exportExternsValid = true; return nil })
	opts.Arg("export-fields", false, func(arg, value string) error { t.exportFields = value; t.exportFieldsValid = true; return nil })
	opts.Arg("export-structs", false, func(arg, value string) error { t.exportStructs = value; t.exportStructsValid = true; return nil })
	opts.Arg("export-typedefs", false, func(arg, value string) error { t.exportTypedefs = value; t.exportTypedefsValid = true; return nil })
	opts.Arg("host-config-cmd", false, func(arg, value string) error { t.hostConfigCmd = value; return nil })
	opts.Arg("host-config-opts", false, func(arg, value string) error { t.hostConfigOpts = value; return nil })
	opts.Arg("ignored-includes", false, func(arg, value string) error { t.ignoredIncludes = value; return nil })
	opts.Arg("pkgname", false, func(arg, value string) error { t.pkgName = value; return nil })
	opts.Arg("replace-fd-zero", false, func(arg, value string) error { t.replaceFdZero = value; return nil })
	opts.Arg("replace-tcl-default-double-rounding", false, func(arg, value string) error { t.replaceTclDefaultDoubleRounding = value; return nil })
	opts.Arg("replace-tcl-ieee-double-rounding", false, func(arg, value string) error { t.replaceTclIeeeDoubleRounding = value; return nil })
	opts.Arg("script", false, func(arg, value string) error { t.scriptFn = value; return nil })
	opts.Arg("static-locals-prefix", false, func(arg, value string) error { t.staticLocalsPrefix = value; return nil })

	opts.Opt("E", func(opt string) error { t.E = true; return nil })
	opts.Opt("all-errors", func(opt string) error { t.allErrors = true; return nil })
	opts.Opt("cover-instrumentation", func(opt string) error { t.cover = true; return nil })
	opts.Opt("cover-instrumentation-c", func(opt string) error { t.coverC = true; return nil })
	opts.Opt("err-trace", func(opt string) error { t.errTrace = true; return nil })
	opts.Opt("full-path-comments", func(opt string) error { t.fullPathComments = true; return nil })
	opts.Opt("func-sig", func(opt string) error { t.funcSig = true; return nil })
	opts.Opt("header", func(opt string) error { t.header = true; return nil })
	opts.Opt("ignore-unsupported-alignment", func(opt string) error { t.ignoreUnsupportedAligment = true; return nil })
	opts.Opt("nocapi", func(opt string) error { t.noCapi = true; return nil })
	opts.Opt("nostdinc", func(opt string) error { t.nostdinc = true; return nil })
	opts.Opt("panic-stubs", func(opt string) error { t.panicStubs = true; return nil })
	opts.Opt("trace-pinning", func(opt string) error { t.tracePinning = true; return nil })
	opts.Opt("trace-translation-units", func(opt string) error { t.traceTranslationUnits = true; return nil })
	opts.Opt("unexported-by-default", func(opt string) error { t.defaultUnExport = true; return nil })
	opts.Opt("verbose-compiledb", func(opt string) error { t.verboseCompiledb = true; return nil })
	opts.Opt("verify-structs", func(opt string) error { t.verifyStructs = true; return nil })
	opts.Opt("version", func(opt string) error { t.version = true; return nil })
	opts.Opt("watch-instrumentation", func(opt string) error { t.watch = true; return nil })
	opts.Opt("windows", func(opt string) error { t.windows = true; return nil })

	opts.Opt("trace-included-files", func(opt string) error {
		if t.includedFiles == nil {
			t.includedFiles = map[string]struct{}{}
		}
		prev := t.cfg.IncludeFileHandler
		t.cfg.IncludeFileHandler = func(pos token.Position, pathName string) {
			if prev != nil {
				prev(pos, pathName)
			}
			if _, ok := t.includedFiles[pathName]; !ok {
				t.includedFiles[pathName] = struct{}{}
				fmt.Fprintf(os.Stderr, "#include %s\n", pathName)
			}
		}
		return nil
	})
	opts.Arg("ignore-object", false, func(arg, value string) error {
		if t.ignoredObjects == nil {
			t.ignoredObjects = map[string]struct{}{}
		}
		t.ignoredObjects[value] = struct{}{}
		return nil
	})
	opts.Arg("save-config", false, func(arg, value string) error {
		if value == "" {
			return nil
		}

		abs, err := filepath.Abs(value)
		if err != nil {
			return err
		}

		t.saveConfig = abs
		if t.includedFiles == nil {
			t.includedFiles = map[string]struct{}{}
		}
		prev := t.cfg.IncludeFileHandler
		t.cfg.IncludeFileHandler = func(pos token.Position, pathName string) {
			if prev != nil {
				prev(pos, pathName)
			}
			if _, ok := t.includedFiles[pathName]; !ok {
				t.includedFiles[pathName] = struct{}{}
				full := filepath.Join(abs, pathName)
				switch _, err := os.Stat(full); {
				case err != nil && os.IsNotExist(err):
					// ok
				case err != nil:
					t.saveConfigErr = err
					return
				default:
					return
				}

				b, err := ioutil.ReadFile(pathName)
				if err != nil {
					t.saveConfigErr = err
					return
				}

				dir, _ := filepath.Split(full)
				if err := os.MkdirAll(dir, 0700); err != nil {
					t.saveConfigErr = err
					return
				}

				if err := ioutil.WriteFile(full, b, 0600); err != nil {
					t.saveConfigErr = err
				}
			}
		}
		return nil
	})
	opts.Arg("-load-config", false, func(arg, value string) error {
		if value == "" {
			return nil
		}

		abs, err := filepath.Abs(value)
		if err != nil {
			return err
		}

		t.loadConfig = abs
		return nil
	})
	opts.Arg("volatile", false, func(arg, value string) error {
		for _, v := range strings.Split(strings.TrimSpace(value), ",") {
			t.volatiles[cc.String(v)] = struct{}{}
		}
		return nil
	})
	opts.Opt("nostdlib", func(opt string) error {
		t.nostdlib = true
		t.crt = ""
		t.crtImportPath = ""
		return nil
	})
	opts.Arg("hide", false, func(arg, value string) error {
		value = strings.TrimSpace(value)
		a := strings.Split(value, ",")
		for _, v := range a {
			t.hide[v] = struct{}{}
		}
		return nil
	})
	opts.Arg("l", true, func(arg, value string) error {
		value = strings.TrimSpace(value)
		a := strings.Split(value, ",")
		for _, v := range a {
			t.l = append(t.l, v)
			t.symSearchOrder = append(t.symSearchOrder, -len(t.l))
		}
		return nil
	})
	opts.Arg("o", false, func(arg, value string) error {
		if t.o != "" {
			return fmt.Errorf("multiple argument: -o %s", value)
		}

		t.o = value
		return nil
	})
	if err := opts.Parse(t.args[1:], func(arg string) error {
		if strings.HasPrefix(arg, "-") {
			return fmt.Errorf("unexpected option: %s", arg)
		}

		switch filepath.Ext(arg) {
		case ".h":
			t.symSearchOrder = append(t.symSearchOrder, len(t.sources))
			t.sources = append(t.sources, cc.Source{Name: arg})
		case ".c":
			t.symSearchOrder = append(t.symSearchOrder, len(t.sources))
			t.sources = append(t.sources, cc.Source{Name: arg, DoNotCache: true})
		case ".json":
			t.cdb = arg
			return opt.Skip(nil)
		default:
			return fmt.Errorf("unexpected file type: %s", arg)
		}

		return nil
	}); err != nil {
		switch x := err.(type) {
		case opt.Skip:
			switch {
			case t.compiledbValid: // -compiledb foo.json, create DB
				cmd := []string(x)[1:]
				if len(cmd) == 0 {
					return fmt.Errorf("missing command after -compiledb <file>")
				}

				return t.createCompileDB(cmd)
			case t.cdb != "": // foo.json ..., use DB
				if err := t.configure(); err != nil {
					return err
				}

				return t.useCompileDB(t.cdb, x)
			}

			return err
		default:
			return err
		}
	}

	if t.version {
		gobin, err := exec.LookPath("go")
		var b []byte
		if err == nil {
			var bin string
			bin, err = exec.LookPath(os.Args[0])
			if err == nil {
				b, err = exec.Command(gobin, "version", "-m", bin).CombinedOutput()
			}
		}
		if err == nil {
			fmt.Fprintf(t.stdout, "%s", b)
			return nil
		}

		fmt.Fprintf(t.stdout, "%s\n", Version)
		return nil
	}

	if t.scriptFn != "" {
		return t.scriptBuild(t.scriptFn)
	}

	if len(t.sources) == 0 {
		return fmt.Errorf("no input files specified")
	}

	if t.crtImportPath != "" {
		t.l = append(t.l, t.crtImportPath)
		t.symSearchOrder = append(t.symSearchOrder, -len(t.l))
		m := map[string]struct{}{}
		for _, v := range t.l {
			v = strings.TrimSpace(v)
			if _, ok := m[v]; !ok {
				t.imported = append(t.imported, &imported{path: v})
				m[v] = struct{}{}
			}
		}
		t.imported[len(t.imported)-1].used = true // crt is always imported
	}

	if err := t.configure(); err != nil {
		return err
	}

	abi, err := cc.NewABI(t.goos, t.goarch)
	if err != nil {
		return err
	}
	abi.Types[cc.LongDouble] = abi.Types[cc.Double]

	var re *regexp.Regexp
	if t.ignoredIncludes != "" {
		if re, err = regexp.Compile(t.ignoredIncludes); err != nil {
			return err
		}
	}

	t.cfg.ABI = abi
	t.cfg.ReplaceMacroFdZero = t.replaceFdZero
	t.cfg.ReplaceMacroTclDefaultDoubleRounding = t.replaceTclDefaultDoubleRounding
	t.cfg.ReplaceMacroTclIeeeDoubleRounding = t.replaceTclIeeeDoubleRounding
	t.cfg.Config3.IgnoreInclude = re
	t.cfg.Config3.NoFieldAndBitfieldOverlap = true
	t.cfg.Config3.PreserveWhiteSpace = t.saveConfig == ""
	t.cfg.Config3.UnsignedEnums = true

	if t.mingw = detectMingw(t.hostPredefined); t.mingw {
		t.windows = true
	}
	if t.nostdinc {
		t.hostIncludes = nil
		t.hostSysIncludes = nil
	}
	var sources []cc.Source
	if t.hostPredefined != "" {
		sources = append(sources, cc.Source{Name: "<predefined>", Value: t.hostPredefined})
	}
	sources = append(sources, cc.Source{Name: "<builtin>", Value: builtin})
	if len(t.D) != 0 {
		var a []string
		for _, v := range t.D {
			if i := strings.IndexByte(v, '='); i > 0 {
				a = append(a, fmt.Sprintf("#define %s %s", v[:i], v[i+1:]))
				continue
			}

			a = append(a, fmt.Sprintf("#define %s 1", v))
		}
		a = append(a, "\n")
		sources = append(sources, cc.Source{Name: "<defines>", Value: strings.Join(a, "\n"), DoNotCache: true})
	}
	if len(t.U) != 0 {
		var a []string
		for _, v := range t.U {
			a = append(a, fmt.Sprintf("#undef %s", v))
		}
		a = append(a, "\n")
		sources = append(sources, cc.Source{Name: "<undefines>", Value: strings.Join(a, "\n"), DoNotCache: true})
	}

	// https://pubs.opengroup.org/onlinepubs/9699919799/utilities/c99.html
	//
	// Headers whose names are enclosed in double-quotes ( "" ) shall be
	// searched for first in the directory of the file with the #include
	// line, then in directories named in -I options, and last in the usual
	// places
	includePaths := append([]string{"@"}, t.I...)
	includePaths = append(includePaths, t.hostIncludes...)
	includePaths = append(includePaths, t.hostSysIncludes...)
	// For headers whose names are enclosed in angle brackets ( "<>" ), the
	// header shall be searched for only in directories named in -I options
	// and then in the usual places.
	sysIncludePaths := append(t.I, t.hostSysIncludes...)
	if t.traceTranslationUnits {
		fmt.Printf("target: %s/%s\n", t.goos, t.goarch)
		if t.hostConfigCmd != "" {
			fmt.Printf("host config cmd: %s\n", t.hostConfigCmd)
		}
	}
	for i, v := range t.sources {
		tuSources := append(sources, v)
		out := t.stdout
		if t.saveConfig != "" {
			out = io.Discard
			t.E = true
		}
		if t.E {
			t.cfg.PreprocessOnly = true
			if err := cc.Preprocess(t.cfg, includePaths, sysIncludePaths, tuSources, out); err != nil {
				return err
			}
			memGuard(i, t.isScripted)
			continue
		}

		var t0 time.Time
		if t.traceTranslationUnits {
			fmt.Printf("C front end %d/%d: %s ... ", i+1, len(t.sources), v.Name)
			t0 = time.Now()
		}
		ast, err := cc.Translate(t.cfg, includePaths, sysIncludePaths, tuSources)
		if err != nil {
			return err
		}

		if t.traceTranslationUnits {
			fmt.Println(time.Since(t0))
		}
		t.asts = append(t.asts, ast)
		memGuard(i, t.isScripted)
	}
	if t.E || t.isScripted {
		return nil
	}

	return t.link()
}

func (t *Task) configure() (err error) {
	if t.configured {
		return nil
	}

	type jsonConfig struct {
		Predefined      string
		IncludePaths    []string
		SysIncludePaths []string
		OS              string
		Arch            string
	}

	t.configured = true
	if t.loadConfig != "" {
		path := filepath.Join(t.loadConfig, "config.json")
		// trc("%p: LOAD_CONFIG(%s)", t, path)
		b, err := ioutil.ReadFile(path)
		if err != nil {
			return err
		}

		loadConfig := &jsonConfig{}
		if err := json.Unmarshal(b, loadConfig); err != nil {
			return err
		}

		t.goos = loadConfig.OS
		t.goarch = loadConfig.Arch
		for _, v := range loadConfig.IncludePaths {
			t.hostIncludes = append(t.hostIncludes, filepath.Join(t.loadConfig, v))
		}
		for _, v := range loadConfig.SysIncludePaths {
			t.hostSysIncludes = append(t.hostSysIncludes, filepath.Join(t.loadConfig, v))
		}
		t.hostPredefined = loadConfig.Predefined
		return nil
	}

	hostConfigOpts := strings.Split(t.hostConfigOpts, ",")
	if t.hostConfigOpts == "" {
		hostConfigOpts = nil
	}
	if t.hostPredefined, t.hostIncludes, t.hostSysIncludes, err = cc.HostConfig(t.hostConfigCmd, hostConfigOpts...); err != nil {
		return err
	}

	if t.saveConfig != "" && !t.configSaved {
		t.configSaved = true
		// trc("%p: SAVE_CONFIG(%s)", t, t.saveConfig)
		cfg := &jsonConfig{
			Predefined:      t.hostPredefined,
			IncludePaths:    t.hostIncludes,
			SysIncludePaths: t.hostSysIncludes,
			OS:              t.goos,
			Arch:            t.goarch,
		}
		b, err := json.Marshal(cfg)
		if err != nil {
			return err
		}

		full := filepath.Join(t.saveConfig, "config.json")
		if err := os.MkdirAll(t.saveConfig, 0700); err != nil {
			return err
		}

		if err := ioutil.WriteFile(full, b, 0600); err != nil {
			return err
		}
	}

	return nil
}

func (t *Task) setLookPaths() (err error) {
	if t.ccLookPath, err = exec.LookPath(t.cc); err != nil {
		return err
	}

	t.arLookPath, err = exec.LookPath(t.ar)
	return err
}

func (t *Task) link() (err error) {
	if len(t.asts) == 0 {
		return fmt.Errorf("no objects to link")
	}

	if t.o == "" {
		t.o = fmt.Sprintf("a_%s_%s.go", t.goos, t.goarch)
	}
	dir := filepath.Dir(t.o)
	t.capif = filepath.Join(dir, fmt.Sprintf("capi_%s_%s.go", t.goos, t.goarch))
	f, err2 := os.Create(t.o)
	if err2 != nil {
		return err2
	}

	defer func() {
		if e := f.Close(); e != nil && err == nil {
			err = e
			return
		}

		if out, e := exec.Command("gofmt", "-r", "(x) -> x", "-l", "-s", "-w", t.o).CombinedOutput(); e != nil && err == nil {
			err = fmt.Errorf(strings.Join([]string{string(out), e.Error()}, ": "))
		}
		if out, e := exec.Command("gofmt", "-l", "-s", "-w", t.o).CombinedOutput(); e != nil && err == nil {
			err = fmt.Errorf(strings.Join([]string{string(out), e.Error()}, ": "))
		}
	}()

	w := bufio.NewWriter(f)

	defer func() {
		if e := w.Flush(); e != nil && err == nil {
			err = e
		}
	}()

	t.out = w
	p, err := newProject(t)
	if err != nil {
		return err
	}

	return p.main()
}

func (t *Task) scriptBuild(fn string) error {
	f, err := os.Open(fn)
	if err != nil {
		return err
	}

	defer f.Close()

	r := csv.NewReader(f)
	r.Comment = '#'
	r.FieldsPerRecord = -1
	r.TrimLeadingSpace = true
	script, err := r.ReadAll()
	if err != nil {
		return err
	}

	return t.scriptBuild2(script)
}

func (t *Task) scriptBuild2(script [][]string) error {
	var ldir string
	ccgo := []string{t.args[0]}
	for i, line := range script {
		dir := line[0]
		args := line[1:]
		for _, v := range args {
			if strings.HasSuffix(v, ".c") || strings.HasSuffix(v, ".h") {
				v = filepath.Join(dir, v)
				t.symSearchOrder = append(t.symSearchOrder, len(t.sources))
				t.sources = append(t.sources, cc.Source{Name: v})
			}
		}
		cmd := append(ccgo, args...)
		if t.traceTranslationUnits {
			if dir != ldir {
				fmt.Println(dir)
				ldir = dir
			}
			fmt.Printf("%s\n", cmd)
		}
		t2 := NewTask(append(ccgo, args...), t.stdout, t.stderr)
		t2.cfg.IncludeFileHandler = t.cfg.IncludeFileHandler
		t2.cfg.SharedFunctionDefinitions = t.cfg.SharedFunctionDefinitions
		t2.configSaved = t.configSaved
		t2.configured = t.configured
		t2.hostIncludes = t.hostIncludes
		t2.hostPredefined = t.hostPredefined
		t2.hostSysIncludes = t.hostSysIncludes
		t2.includedFiles = t.includedFiles
		t2.isScripted = true
		t2.loadConfig = t.loadConfig
		t2.replaceFdZero = t.replaceFdZero
		t2.replaceTclDefaultDoubleRounding = t.replaceTclDefaultDoubleRounding
		t2.replaceTclIeeeDoubleRounding = t.replaceTclIeeeDoubleRounding
		t2.saveConfig = t.saveConfig
		if err := inDir(dir, t2.Main); err != nil {
			return err
		}

		t.asts = append(t.asts, t2.asts...)
		if i == 0 {
			t.cfg = t2.cfg
		}
	}
	if t.crtImportPath != "" {
		t.l = append(t.l, t.crtImportPath)
		t.symSearchOrder = append(t.symSearchOrder, -len(t.l))
		m := map[string]struct{}{}
		for _, v := range t.l {
			v = strings.TrimSpace(v)
			if _, ok := m[v]; !ok {
				t.imported = append(t.imported, &imported{path: v})
				m[v] = struct{}{}
			}
		}
		t.imported[len(t.imported)-1].used = true // crt is always imported
	}
	if t.saveConfig != "" {
		return nil
	}

	return t.link()
}

type cdb struct {
	items       []*cdbItem
	outputIndex map[string][]*cdbItem
}

func (db *cdb) find(obj map[string]*cdbItem, nm string, ver, seqLimit int, path []string, cc, ar string, ignored map[string]struct{}) error {
	// trc("%v: nm %q ver %v seqLimit %v path %q cc %q ar %q", origin(1), nm, ver, seqLimit, path, cc, ar)
	var item *cdbItem
	var k string
	switch {
	case ver < 0:
		// find highest ver with .seq < seqLimit
		for i, v := range db.outputIndex[nm] {
			if v.seq >= seqLimit {
				break
			}

			item = v
			ver = i
		}
		if item == nil {
			ver = -1
			for _, v := range db.items {
				if seqLimit >= 0 && v.seq >= seqLimit {
					break
				}

				if filepath.Base(v.Output) == filepath.Base(nm) {
					item = v
					ver = v.ver
					break
				}
			}
		}

		k = fmt.Sprintf("%s#%d", nm, ver)
	default:
		// match ver exactly
		k = fmt.Sprintf("%s#%d", nm, ver)
		if obj[k] != nil {
			return nil
		}

		items := db.outputIndex[nm]
		switch {
		case ver < len(items):
			panic(todo("", nm, ver, seqLimit))
		default:
			n := -1
			for _, v := range db.items {
				if seqLimit >= 0 && v.seq >= seqLimit {
					break
				}

				if filepath.Base(v.Output) == filepath.Base(nm) {
					n++
					if n == ver {
						item = v
						break
					}
				}
			}
		}
	}
	if item == nil {
		for k := range ignored {
			if k == nm || strings.HasSuffix(nm, k) {
				return nil
			}
		}

		return fmt.Errorf("not found in compile DB: %s (max seq %d), path %v", k, seqLimit, path)
	}

	if obj[k] != nil {
		return nil
	}

	obj[k] = item
	var errs []string
	for _, v := range item.sources(cc, ar) {
		if err := db.find(obj, v, -1, item.seq, append(path, nm), cc, ar, ignored); err != nil {
			errs = append(errs, err.Error())
		}
	}
	if len(errs) != 0 {
		sort.Strings(errs)
		w := 0
		for _, v := range errs {
			if w == 0 || w > 0 && v != errs[w-1] {
				errs[w] = v
				w++
			}
		}
		errs = errs[:w]
		return fmt.Errorf("%s", strings.Join(errs, "\n"))
	}

	return nil
}

func suffixNum(s string, dflt int) (string, int) {
	x := strings.LastIndexByte(s, '#')
	if x < 0 {
		return s, dflt
	}

	// foo#42
	// 012345
	// x == 3
	num := s[x+1:]
	n, err := strconv.ParseUint(num, 10, 32)
	if err != nil {
		return s, dflt
	}

	return s[:x], int(n)
}

func (t *Task) useCompileDB(fn string, args []string) error {
	if err := t.setLookPaths(); err != nil {
		return err
	}

	var cdb cdb
	f, err := os.Open(fn)
	if err != nil {
		return err
	}

	de := json.NewDecoder(f)
	err = de.Decode(&cdb.items)
	f.Close()
	if err != nil {
		return err
	}

	cdb.outputIndex = map[string][]*cdbItem{}
	for i, v := range cdb.items {
		v.seq = i
		if len(v.Arguments) == 0 {
			if len(v.Command) == 0 {
				return fmt.Errorf("either arguments or command is required: %+v", v)
			}

			if v.Arguments, err = shellquote.Split(v.Command); err != nil {
				return err
			}
		}

		k := v.output(t.ccLookPath, t.arLookPath)
		a := cdb.outputIndex[k]
		v.ver = len(a)
		cdb.outputIndex[k] = append(a, v)
	}
	obj := map[string]*cdbItem{}
	notFound := false
	for _, v := range args {
		v, ver := suffixNum(v, 0)
		if err := cdb.find(obj, v, ver, -1, nil, t.ccLookPath, t.arLookPath, t.ignoredObjects); err != nil {
			notFound = true
			fmt.Fprintln(os.Stderr, err)
		}
	}
	if notFound {
		var a []string
		for k, v := range cdb.outputIndex {
			for _, w := range v {
				a = append(a, fmt.Sprintf("%5d %s", w.seq, k))
			}
		}
		sort.Strings(a)
		fmt.Fprintf(os.Stderr, "compile DB index:\n\t%s\n", strings.Join(a, "\n\t"))
	}

	var a []string
	for k := range obj {
		a = append(a, k)
	}
	sort.Strings(a)
	return t.cdbBuild(obj, a)
}

func (t *Task) cdbBuild(obj map[string]*cdbItem, list []string) error {
	var script [][]string
	for _, nm := range list {
		it := obj[nm]
		if !strings.HasSuffix(it.Output, ".o") || it.Arguments[0] != t.cc {
			continue
		}

		args, err := it.ccgoArgs(t.cc)
		if err != nil {
			return err
		}

		for _, v := range t.D {
			args = append(args, "-D"+v)
		}
		for _, v := range t.U {
			args = append(args, "-U"+v)
		}

		line := append([]string{it.Directory}, args...)
		script = append(script, line)
	}
	return t.scriptBuild2(script)
}

func (t *Task) createCompileDB(command []string) (rerr error) {
	if err := t.setLookPaths(); err != nil {
		return err
	}

	cwd, err := os.Getwd()
	if err != nil {
		return err
	}

	f, err := os.Create(t.compiledb)
	if err != nil {
		return err
	}

	defer func() {
		if err := f.Close(); err != nil && rerr == nil {
			rerr = err
		}
	}()

	cwr := newCDBWriter(f)

	defer func() {
		if err := cwr.finish(); err != nil && rerr == nil {
			rerr = err
		}
	}()

	var cmd *exec.Cmd
	var parser func(s string) ([]string, error)
out:
	switch t.goos {
	case "darwin", "freebsd", "netbsd":
		switch command[0] {
		case "make", "gmake":
			// ok
		default:
			return fmt.Errorf("usupported build command: %s", command[0])
		}

		sh, err := exec.LookPath("sh")
		if err != nil {
			return err
		}

		command = append([]string{sh, "-c"}, join(" ", command[0], "SHELL='sh -x'", command[1:]))
		cmd = exec.Command(command[0], command[1:]...)
		parser = makeXParser
	case "openbsd":
		switch command[0] {
		case "make", "gmake":
			// ok
		default:
			return fmt.Errorf("usupported build command: %s", command[0])
		}

		sh, err := exec.LookPath("sh")
		if err != nil {
			return err
		}

		command = append([]string{sh, "-c"}, join(" ", command[0], "SHELL='sh -x'", command[1:]))
		cmd = exec.Command(command[0], command[1:]...)
		parser = makeXParser2
	case "windows":
		if command[0] != "make" && command[0] != "make.exe" {
			return fmt.Errorf("usupported build command: %s", command[0])
		}

		switch s := runtime.GOOS; s {
		case "windows":
			argv := append([]string{"-d"}, command[1:]...)
			if !strings.HasSuffix(command[0], ".exe") {
				command[0] += ".exe"
			}
			cmd = exec.Command(command[0], argv...)
			parser = makeDParser
			break out
		case "linux":
			// ok
		default:
			return fmt.Errorf("usupported cross compile host: %s", s)
		}

		fallthrough
	default:
		strace, err := exec.LookPath("strace")
		if err != nil {
			return err
		}

		argv := append([]string{"-f", "-s1000000", "-e", "trace=execve"}, command...)
		cmd = exec.Command(strace, argv...)
		parser = straceParser
	}
	cmd.Env = append(os.Environ(), "LC_ALL=C")
	cw := t.newCdbMakeWriter(cwr, cwd, parser)
	switch {
	case t.verboseCompiledb:
		cmd.Stdout = io.MultiWriter(cw, os.Stdout)
	default:
		cmd.Stdout = cw
	}
	cmd.Stderr = cmd.Stdout
	if dmesgs {
		dmesg("%v: %v", origin(1), cmd.Args)
	}
	if err := cmd.Run(); err != nil {
		if dmesgs {
			dmesg("%v: cmd.Run: %v", origin(1), err)
		}
		return err
	}

	return cw.err
}

func makeDParser(s string) ([]string, error) {
	const prefix = "CreateProcess("
	if !strings.HasPrefix(s, prefix) {
		return nil, nil
	}

	// s: `CreateProcess(C:\Program Files\CodeBlocks\MinGW\bin\gcc.exe,gcc -O3 -Wall -c -o compress.o compress.c,...)`
	s = s[len(prefix):]
	// s: `C:\Program Files\CodeBlocks\MinGW\bin\gcc.exe,gcc -O3 -Wall -c -o compress.o compress.c,...)`
	x := strings.IndexByte(s, ',')
	if x < 0 {
		return nil, nil
	}

	cmd := s[:x]
	// cmd: `C:\Program Files\CodeBlocks\MinGW\bin\gcc.exe`

	s = s[x+1:]
	// s: `gcc -O3 -Wall -c -o compress.o compress.c,...)`
	if x = strings.LastIndexByte(s, ','); x < 0 {
		return nil, nil
	}

	s = s[:x]
	// s: `gcc -O3 -Wall -c -o compress.o compress.c`
	a, err := shellquote.Split(strings.TrimSpace(s))
	if err != nil || len(a) == 0 {
		return nil, err
	}

	return append([]string{cmd}, a[1:]...), nil
}

func isCreateArchive(s string) bool {
	// ar modifiers may be in any order so sort characters in s before checking.
	// This turns eg `rc` into `cr`.
	b := []byte(s)
	sort.Slice(b, func(i, j int) bool { return b[i] < b[j] })
	switch string(b) {
	case "cq", "cr", "crs", "cru", "r":
		return true
	}
	return false
}

func hasPlusPrefix(s string) (n int, r string) {
	for strings.HasPrefix(s, "+") {
		n++
		s = s[1:]
	}
	return n, s
}

func makeXParser(s string) (r []string, err error) {
	switch {
	case strings.HasPrefix(s, "libtool: link: ar "):
		s = s[len("libtool: link:"):]
	case strings.HasPrefix(s, "libtool: compile: "):
		s = s[len("libtool: compile:"):]
		for strings.HasPrefix(s, "  ") {
			s = s[1:]
		}
	default:
		var n int
		if n, s = hasPlusPrefix(s); n == 0 {
			return nil, nil
		}
	}

	if !strings.HasPrefix(s, " ") {
		return nil, nil
	}

	s = s[1:]
	if dmesgs {
		dmesg("%v: source line `%s`, caller %v:", origin(1), s, origin(2))
	}
	r, err = shellquote.Split(s)
	if dmesgs {
		dmesg("%v: shellquote.Split -> %v %[2]q, %v", origin(1), r, err)
	}
	if err != nil {
		if strings.Contains(err.Error(), "Unterminated single-quoted string") {
			return nil, nil // ignore
		}
	}
	if len(r) != 0 && filepath.Base(r[0]) == "libtool" {
		r[0] = "libtool"
	}
	return r, err
}

func makeXParser2(s string) (r []string, err error) {
	s = strings.TrimSpace(s)
	switch {
	case strings.HasPrefix(s, "libtool: link: ar "):
		s = s[len("libtool: link:"):]
	case strings.HasPrefix(s, "libtool: compile: "):
		s = s[len("libtool: compile:"):]
		for strings.HasPrefix(s, "  ") {
			s = s[1:]
		}
	default:
		var n int
		if n, s = hasPlusPrefix(s); n != 0 {
			return nil, nil
		}
	}

	if dmesgs {
		dmesg("%v: source line `%s`, caller %v:", origin(1), s, origin(2))
	}
	r, err = shellquote.Split(s)
	if dmesgs {
		dmesg("%v: shellquote.Split -> %v %[2]q, %v", origin(1), r, err)
	}
	if err != nil {
		if strings.Contains(err.Error(), "Unterminated single-quoted string") {
			return nil, nil // ignore
		}
	}
	if len(r) != 0 && filepath.Base(r[0]) == "libtool" {
		r[0] = "libtool"
	}
	return r, err
}

func straceParser(s string) ([]string, error) {
	prefix := "execve("
	if strings.HasPrefix(s, "[pid ") {
		s = strings.TrimSpace(s[strings.IndexByte(s, ']')+1:])
	}
	if !strings.HasPrefix(s, prefix) || !strings.HasSuffix(s, ") = 0") {
		return nil, nil
	}

	// s: `execve("/usr/bin/ar", ["ar", "cr", "libtcl8.6.a", "regcomp.o", ... "bn_s_mp_sqr.o", "bn_s_mp_sub.o"], 0x55e6bbf49648 /* 60 vars */) = 0`
	s = s[len(prefix):]
	// s: `"/usr/bin/ar", ["ar", "cr", "libtcl8.6.a", "regcomp.o", ... "bn_s_mp_sqr.o", "bn_s_mp_sub.o"], 0x55e6bbf49648 /* 60 vars */) = 0`
	a := strings.SplitN(s, ", [", 2)
	// a[0]: `"/usr/bin/ar"`, a[1]: `"ar", "cr", "libtcl8.6.a", "regcomp.o", ... "bn_s_mp_sqr.o", "bn_s_mp_sub.o"], 0x55e6bbf49648 /* 60 vars */) = 0`
	args := a[1]
	// args: `"ar", "cr", "libtcl8.6.a", "regcomp.o", ... "bn_s_mp_sqr.o", "bn_s_mp_sub.o"], 0x55e6bbf49648 /* 60 vars */) = 0`
	args = args[:strings.LastIndex(args, "], ")]
	// args: `"ar", "cr", "libtcl8.6.a", "regcomp.o", ... "bn_s_mp_sqr.o", "bn_s_mp_sub.o"`
	argv, err := shellquote.Split(args)
	if err != nil {
		return nil, err
	}

	words, err := shellquote.Split(a[0])
	if err != nil {
		return nil, err
	}

	argv[0] = words[0]
	for i, v := range argv {
		if strings.HasSuffix(v, ",") {
			v = v[:len(v)-1]
		}
		if v2, err := strconv.Unquote(`"` + v + `"`); err == nil {
			v = v2
		}
		argv[i] = v
	}

	return argv, nil
}

type cdbItem struct {
	Arguments []string `json:"arguments"`
	Command   string   `json:"command,omitempty"`
	Directory string   `json:"directory"`
	File      string   `json:"file"`
	Output    string   `json:"output,omitempty"`

	seq int
	ver int
}

func (it *cdbItem) cmpString() string { return fmt.Sprint(*it) }

func (it *cdbItem) ccgoArgs(cc string) (r []string, err error) {
	switch it.Arguments[0] {
	case cc:
		set := opt.NewSet()
		set.Arg("D", true, func(opt, arg string) error { r = append(r, "-D"+arg); return nil })
		set.Arg("I", true, func(opt, arg string) error { r = append(r, "-I"+arg); return nil })
		set.Arg("MF", true, func(opt, arg string) error { return nil })
		set.Arg("MT", true, func(opt, arg string) error { return nil })
		set.Arg("O", true, func(opt, arg string) error { return nil })
		set.Arg("U", true, func(opt, arg string) error { r = append(r, "-U"+arg); return nil })
		set.Arg("o", true, func(opt, arg string) error { return nil })
		set.Arg("std", true, func(opt, arg string) error { return nil })
		set.Opt("MD", func(opt string) error { return nil })
		set.Opt("MMD", func(opt string) error { return nil })
		set.Opt("MP", func(opt string) error { return nil })
		set.Opt("ansi", func(opt string) error { return nil })
		set.Opt("c", func(opt string) error { return nil })
		set.Opt("g", func(opt string) error { return nil })
		set.Opt("pedantic", func(opt string) error { return nil })
		set.Opt("pipe", func(opt string) error { return nil })
		set.Opt("pthread", func(opt string) error { return nil })
		set.Opt("s", func(opt string) error { return nil })
		set.Opt("w", func(opt string) error { return nil })
		if err := set.Parse(it.Arguments[1:], func(arg string) error {
			switch {
			case strings.HasSuffix(arg, ".c"):
				r = append(r, arg)
			case

				strings.HasPrefix(arg, "-W"),
				strings.HasPrefix(arg, "-f"),
				strings.HasPrefix(arg, "-m"):

				// nop
			case strings.HasPrefix(arg, ">"):
				return opt.Skip(nil)
			default:
				return fmt.Errorf("unknown/unsupported CC option: %s", arg)
			}

			return nil
		}); err != nil {
			switch err.(type) {
			case opt.Skip:
				// ok
			default:
				return nil, err
			}
		}

		return r, nil
	default:
		return nil, fmt.Errorf("command not supported: %q", it.Arguments[0])
	}
}

func (it *cdbItem) output(cc, ar string) (r string) {
	if it.Output != "" {
		return it.Output
	}

	if len(it.Arguments) == 0 {
		return ""
	}

	switch it.Arguments[0] {
	case cc:
		for i, v := range it.Arguments {
			if v == "-o" && i < len(it.Arguments)-1 {
				it.Output = filepath.Join(it.Directory, it.Arguments[i+1])
				break
			}
		}
		if it.Output == "" && strings.HasSuffix(it.File, ".c") {
			for _, v := range it.Arguments {
				if v == "-c" {
					bn := filepath.Base(it.File)
					it.Output = filepath.Join(it.Directory, bn[:len(bn)-2]+".o")
					break
				}
			}
		}
	case ar:
		if isCreateArchive(it.Arguments[1]) {
			it.Output = filepath.Join(it.Directory, it.Arguments[2])
		}
	case "libtool":
		for i, v := range it.Arguments {
			if v == "-o" && i < len(it.Arguments)-1 {
				it.Output = filepath.Join(it.Directory, it.Arguments[i+1])
			}
		}
	}
	return it.Output
}

func (it *cdbItem) sources(cc, ar string) (r []string) {
	if len(it.Arguments) == 0 {
		return nil
	}

	switch arg0 := it.Arguments[0]; arg0 {
	case
		"libtool",
		ar,
		filepath.Base(ar),
		cc:

		var prev string
		for _, v := range it.Arguments {
			switch prev {
			case "-o", "-MT", "-MF":
				// nop
			default:
				if strings.HasSuffix(v, ".o") {
					r = append(r, filepath.Join(it.Directory, v))
				}
			}
			prev = v
		}
		return r
	default:
		panic(todo("cc: %q ar: %q it: %+v", cc, ar, it))
	}
}

type cdbMakeWriter struct {
	ar     string
	arBase string
	b      bytes.Buffer
	cc     string
	dir    string
	err    error
	it     cdbItem
	parser func(s string) ([]string, error)
	prefix string
	sc     *bufio.Scanner
	t      *Task
	w      *cdbWriter
}

func (t *Task) newCdbMakeWriter(w *cdbWriter, dir string, parser func(s string) ([]string, error)) *cdbMakeWriter {
	const sz = 1 << 16
	r := &cdbMakeWriter{
		ar:     t.arLookPath,
		arBase: filepath.Base(t.arLookPath),
		cc:     t.ccLookPath,
		dir:    dir,
		parser: parser,
		t:      t,
		w:      w,
	}
	r.sc = bufio.NewScanner(&r.b)
	r.sc.Buffer(make([]byte, sz), sz)
	return r
}

func (w *cdbMakeWriter) fail(err error) {
	if w.err == nil {
		w.err = fmt.Errorf("%v (%v)", err, origin(2))
	}
}

func (w *cdbMakeWriter) Write(b []byte) (int, error) {
	w.b.Write(b)
	for bytes.Contains(w.b.Bytes(), []byte{'\n'}) {
		if !w.sc.Scan() {
			panic(todo("internal error"))
		}

		s := w.sc.Text()
		if strings.HasSuffix(s, "\\") {
			w.prefix += s[:len(s)-1]
			continue
		}

		s = w.prefix + s
		w.prefix = ""
		s = strings.TrimSpace(s)
		if edx := strings.Index(s, "Entering directory"); edx >= 0 {
			s = s[edx+len("Entering directory"):]
			s = strings.TrimSpace(s)
			if len(s) == 0 {
				continue
			}

			if (s[0] == '\'' || s[0] == '`') && s[len(s)-1] == '\'' {
				s = s[1:]
				if len(s) == 0 {
					continue
				}

				s = s[:len(s)-1]
			}
			s = `"` + s + `"`
			dir, err := strconv.Unquote(s)
			if err != nil {
				w.fail(err)
				continue
			}

			dir = filepath.Clean(dir)
			if dir == w.dir {
				continue
			}

			w.dir = dir
			fmt.Printf("cd %s\n", dir)
			continue
		}

		if dmesgs {
			dmesg("%v: source line `%s`", origin(1), s)
		}
		args, err := w.parser(s)
		if dmesgs {
			dmesg("%v: parser -> %v %[2]q, %v", origin(1), args, err)
		}
		if err != nil {
			w.fail(err)
			continue
		}

		if len(args) == 0 {
			continue
		}

		// TODO: change so eg handleGCC returns []cdbItem, skip if none.

		w.it = cdbItem{}

		err = nil
		switch args[0] {
		case w.cc:
			if w.t.verboseCompiledb {
				fmt.Printf("source line: %q\n", s)
			}
			fmt.Printf("CCGO CC: %q\n", args)
			err = w.handleGCC(args)
		case w.ar:
			fallthrough
		case w.arBase:
			if isCreateArchive(args[1]) {
				if w.t.verboseCompiledb {
					fmt.Printf("source line: %q\n", s)
				}
				fmt.Printf("CCGO AR: %q\n", args)
				err = w.handleAR(args)
			}
		case "libtool":
			if w.t.verboseCompiledb {
				fmt.Printf("source line: %q\n", s)
			}
			fmt.Printf("CCGO LIBTOOL: %q\n", args)
			err = w.handleLibtool(args)
		}
		if err != nil {
			w.fail(err)
			continue
		}

		if w.it.Output != "" {
			w.w.add(w.it)
		}
	}
	return len(b), nil
}

func (w *cdbMakeWriter) handleLibtool(args []string) error {
	w.it = cdbItem{
		Arguments: args,
		Directory: w.dir,
	}
	for i, v := range args {
		switch {
		case v == "-o" && i < len(args)-1:
			w.it.Output = filepath.Join(w.dir, args[i+1])
		}
	}
	w.it.output(w.cc, w.ar)
	return nil
}

func (w *cdbMakeWriter) handleAR(args []string) error {
	w.it = cdbItem{
		Arguments: args,
		Directory: w.dir,
	}
	// TODO: assumes isCreateArchive has already been checked
	w.it.Output = filepath.Join(w.dir, args[2])
	return nil
}

func (w *cdbMakeWriter) handleGCC(args []string) error {
	w.it = cdbItem{
		Arguments: args,
		Directory: w.dir,
	}
	for i, v := range args {
		switch {
		case v == "-o" && i < len(args)-1:
			w.it.Output = filepath.Join(w.dir, args[i+1])
		case strings.HasSuffix(v, ".c"):
			if w.it.File != "" {
				return fmt.Errorf("multiple .c files: %s", v)
			}

			w.it.File = filepath.Clean(v)
		}
	}
	w.it.output(w.cc, w.ar)
	return nil
}

type cdbWriter struct {
	w     *bufio.Writer
	items []cdbItem
}

func newCDBWriter(w io.Writer) *cdbWriter {
	return &cdbWriter{w: bufio.NewWriter(w)}
}

func (w *cdbWriter) add(item cdbItem) {
	w.items = append(w.items, item)
}

func (w *cdbWriter) finish() error {
	enc := json.NewEncoder(w.w)
	enc.SetIndent("", "    ")
	if err := enc.Encode(w.items); err != nil {
		return err
	}
	return w.w.Flush()
}

func join(sep string, a ...interface{}) string {
	var b []string
	for _, v := range a {
		switch x := v.(type) {
		case string:
			b = append(b, x)
		case []string:
			b = append(b, x...)
		default:
			panic(todo("internal error: %T", x))
		}
	}
	return strings.Join(b, sep)
}

func inDir(dir string, f func() error) (err error) {
	var cwd string
	if cwd, err = os.Getwd(); err != nil {
		return err
	}

	defer func() {
		if err2 := os.Chdir(cwd); err2 != nil {
			err = err2
		}
	}()

	if err = os.Chdir(dir); err != nil {
		return err
	}

	return f()
}

func detectMingw(s string) bool {
	return strings.Contains(s, "#define __MINGW")
}

func memGuard(i int, force bool) {
	if totalRam == 0 || totalRam > 64e9 {
		return
	}

	var ms runtime.MemStats
	runtime.ReadMemStats(&ms)
	switch {
	case ms.Alloc < totalRam/2:
		return
	case ms.Alloc < (8*totalRam)/10:
		if force {
			break
		}

		switch {
		case totalRam < 1e9:
			// ok
		case totalRam < 16e9:
			if i&1 == 1 {
				return
			}
		default:
			if i&3 != 3 {
				return
			}
		}
	}

	debug.FreeOSMemory()
}
