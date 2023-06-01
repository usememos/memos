// Copyright 2019 The CC Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//TODO https://todo.sr.ht/~mcf/cc-issues/34
//TODO http://mcpp.sourceforge.net/ "Provides a validation suite to test C/C++ preprocessor's conformance and quality comprehensively."

//go:generate rm -f lexer.go
//go:generate golex -o lexer.go lexer.l

//go:generate rm -f ast.go
//go:generate yy -o /dev/null -position -astImport "\"fmt\"\n\n\"modernc.org/token\"" -prettyString PrettyString -kind Case -noListKind -noPrivateHelpers -forceOptPos parser.yy

//go:generate stringer -output stringer.go -linecomment -type=Kind,Linkage

//go:generate sh -c "go test -run ^Example |fe"

// Package cc is a C99 compiler front end (Work in progress).
//
// Installation
//
// To install/update cc/v3 invoke:
//
//     $ go get [-u] modernc.org/cc/v3
//
// Online documentation
//
// See https://godoc.org/modernc.org/cc/v3.
//
// Status
//
// Most of the functionality is now working.
//
// Supported platforms
//
// The code is known to work on Darwin, Linux and Windows, but the supported
// features may vary.
//
// Links
//
// Referenced from elsewhere:
//
//  [0]: http://www.open-std.org/jtc1/sc22/wg14/www/docs/n1256.pdf
//  [1]: https://www.spinellis.gr/blog/20060626/cpp.algo.pdf
//  [2]: http://www.open-std.org/jtc1/sc22/wg14/www/docs/n1570.pdf
//  [3]: http://gallium.inria.fr/~fpottier/publis/jourdan-fpottier-2016.pdf
//  [4]: https://gcc.gnu.org/onlinedocs/gcc-8.3.0/gcc/Attribute-Syntax.html#Attribute-Syntax
package cc // import "modernc.org/cc/v3"

import (
	"fmt"
	goscanner "go/scanner"
	gotoken "go/token"
	"hash/maphash"
	"io"
	"math"
	"os"
	"os/exec"
	"reflect"
	"regexp"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"

	"modernc.org/strutil"
	"modernc.org/token"
)

const (
	scopeParent StringID = -iota - 1
	scopeSkip
)

var (
	_ Pragma = (*pragma)(nil)

	cache       = newPPCache()
	dict        = newDictionary()
	dictStrings [math.MaxUint8 + 1]string
	noPos       token.Position

	debugIncludePaths bool
	debugWorkingDir   bool
	isTesting         bool
	isTestingMingw    bool

	idPtrdiffT = dict.sid("ptrdiff_t")
	idSizeT    = dict.sid("size_t")
	idWCharT   = dict.sid("wchar_t")

	token4Pool = sync.Pool{New: func() interface{} { r := make([]token4, 0); return &r }} //DONE benchmrk tuned capacity
	tokenPool  = sync.Pool{New: func() interface{} { r := make([]Token, 0); return &r }}  //DONE benchmrk tuned capacity

	printHooks = strutil.PrettyPrintHooks{
		reflect.TypeOf(Token{}): func(f strutil.Formatter, v interface{}, prefix, suffix string) {
			t := v.(Token)
			if (t == Token{}) {
				return
			}

			f.Format(prefix)
			r := t.Rune
			if p := t.Position(); p.IsValid() {
				f.Format("%v: ", p)
			}
			s := tokName(r)
			if x := s[0]; x >= '0' && x <= '9' {
				s = strconv.QuoteRune(r)
			}
			f.Format("%s", s)
			if s := t.Value.String(); len(s) != 0 {
				f.Format(" %q", s)
			}
			f.Format(suffix)
		},
		reflect.TypeOf((*operand)(nil)): func(f strutil.Formatter, v interface{}, prefix, suffix string) {
			op := v.(*operand)
			f.Format(prefix)
			f.Format("[%v %T(%[2]v)]", op.Type(), op.Value())
			f.Format(suffix)
		},
	}
)

func todo(s string, args ...interface{}) string { //TODO-
	switch {
	case s == "":
		s = fmt.Sprintf(strings.Repeat("%v ", len(args)), args...)
	default:
		s = fmt.Sprintf(s, args...)
	}
	pc, fn, fl, _ := runtime.Caller(1)
	f := runtime.FuncForPC(pc)
	var fns string
	if f != nil {
		fns = f.Name()
		if x := strings.LastIndex(fns, "."); x > 0 {
			fns = fns[x+1:]
		}
	}
	r := fmt.Sprintf("%s:%d:%s: TODOTODO %s", fn, fl, fns, s) //TODOOK
	fmt.Fprintf(os.Stdout, "%s\n", r)
	os.Stdout.Sync()
	return r
}

func trc(s string, args ...interface{}) string { //TODO-
	switch {
	case s == "":
		s = fmt.Sprintf(strings.Repeat("%v ", len(args)), args...)
	default:
		s = fmt.Sprintf(s, args...)
	}
	pc, fn, fl, _ := runtime.Caller(1)
	f := runtime.FuncForPC(pc)
	var fns string
	if f != nil {
		fns = f.Name()
		if x := strings.LastIndex(fns, "."); x > 0 {
			fns = fns[x+1:]
		}
	}
	r := fmt.Sprintf("%s:%d:%s: TRC %s", fn, fl, fns, s)
	fmt.Fprintf(os.Stdout, "%s\n", r)
	os.Stdout.Sync()
	return r
}

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

// String returns a StringID for a given value.
func String(s string) StringID {
	return dict.sid(s)
}

// Linkage represents identifier linkage.
//
// [0]6.2.2: An identifier declared in different scopes or in the same scope
// more than once can be made to refer to the same object or function by a
// process called linkage. There are three kinds of linkage: External,
// Internal, and None.
type Linkage int

// StorageClass determines storage duration.
//
// [0]6.2.4: An object has a storage duration that determines its lifetime.
// There are three storage durations: Static, Automatic, and Allocated.
type StorageClass int

// Pragma defines behavior of the object passed to Config.PragmaHandler.
type Pragma interface {
	Error(msg string, args ...interface{}) // Report error.
	MaxAligment() int                      // Returns the current maximum alignment. May return zero.
	MaxInitialAligment() int               // Support #pragma pack(). Returns the maximum alignment in effect at start. May return zero.
	PopMacro(string)
	PushMacro(string)
	SetAlignment(n int) // Support #pragma pack(n)
}

type pragma struct {
	tok cppToken
	c   *cpp
}

func (p *pragma) Error(msg string, args ...interface{}) { p.c.err(p.tok, msg, args...) }

func (p *pragma) MaxAligment() int { return p.c.ctx.maxAlign }

func (p *pragma) MaxInitialAligment() int { return p.c.ctx.maxAlign0 }

func (p *pragma) SetAlignment(n int) {
	if n <= 0 {
		p.Error("%T.SetAlignment(%d): invalid argument", p, n)
		return
	}

	p.c.ctx.maxAlign = n
}

func (p *pragma) PushMacro(nm string) {
	id := dict.sid(nm)
	if p.c.macroStack == nil {
		p.c.macroStack = map[StringID][]*Macro{}
	}
	if m := p.c.macros[id]; m != nil {
		p.c.macroStack[id] = append(p.c.macroStack[id], p.c.macros[id])
	}
}

func (p *pragma) PopMacro(nm string) {
	id := dict.sid(nm)
	a := p.c.macroStack[id]
	if n := len(a); n != 0 {
		p.c.macros[id] = a[n-1]
		p.c.macroStack[id] = a[:n-1]
	}
}

// PrettyString returns a formatted representation of things produced by this package.
func PrettyString(v interface{}) string {
	return strutil.PrettyString(v, "", "", printHooks)
}

// StringID is a process-unique string numeric identifier. Its zero value
// represents an empty string.
type StringID int32

// String implements fmt.Stringer.
func (n StringID) String() (r string) {
	if n < 256 {
		return dictStrings[byte(n)]
	}

	dict.mu.RLock()
	r = dict.strings[n]
	dict.mu.RUnlock()
	return r
}

// Node is implemented by Token and all AST nodes.
type Node interface {
	Position() token.Position
}

type noder struct{}

func (noder) Position() token.Position { panic(internalError()) }

// Scope maps identifiers to definitions.
type Scope map[StringID][]Node

func (s *Scope) new() (r Scope) {
	if *s == nil {
		*s = Scope{}
	}
	r = Scope{scopeParent: []Node{struct {
		noder
		Scope
	}{Scope: *s}}}
	return r
}

func (s *Scope) declare(nm StringID, n Node) {
	sc := *s
	if sc == nil {
		*s = map[StringID][]Node{nm: {n}}
		// t := ""
		// if x, ok := n.(*Declarator); ok && x.IsTypedefName {
		// 	t = ", typedefname"
		// }
		// dbg("declared %s%s at %v in scope %p", nm, t, n.Position(), *s)
		return
	}

	switch x := n.(type) {
	case *Declarator, *StructDeclarator, *LabeledStatement, *BlockItem:
		// nop
	case *StructOrUnionSpecifier, *EnumSpecifier, *Enumerator:
		for {
			if _, ok := sc[scopeSkip]; !ok {
				break
			}

			sc = sc.Parent()
		}
	default:
		panic(todo("%T", x))
	}

	sc[nm] = append(sc[nm], n)
	// t := ""
	// if x, ok := n.(*Declarator); ok && x.IsTypedefName {
	// 	t = ", typedefname"
	// }
	// dbg("declared %s%s at %v in scope %p", nm, t, n.Position(), sc)
}

// Parent returns s's outer scope, if any.
func (s Scope) Parent() Scope {
	if s == nil {
		return nil
	}

	if x, ok := s[scopeParent]; ok {
		return x[0].(struct {
			noder
			Scope
		}).Scope
	}

	return nil
}

func (s *Scope) typedef(nm StringID, tok Token) *Declarator {
	seq := tok.seq
	for s := *s; s != nil; s = s.Parent() {
		for _, v := range s[nm] {
			switch x := v.(type) {
			case *Declarator:
				if !x.isVisible(seq) {
					continue
				}

				if x.IsTypedefName {
					return x
				}

				return nil
			case *Enumerator:
				return nil
			case *EnumSpecifier, *StructOrUnionSpecifier, *StructDeclarator:
				// nop
			default:
				panic(internalError())
			}
		}
	}
	return nil
}

func (s *Scope) declarator(nm StringID, tok Token) *Declarator {
	seq := tok.seq
	for s := *s; s != nil; s = s.Parent() {
		defs := s[nm]
		for _, v := range defs {
			switch x := v.(type) {
			case *Declarator:
				if !x.isVisible(seq) {
					continue
				}

				for _, v := range defs {
					if x, ok := v.(*Declarator); ok {
						t := x.Type()
						if t != nil && t.Kind() == Function {
							if x.fnDef {
								return x
							}

							continue
						}

						if t != nil && !x.Type().IsIncomplete() {
							return x
						}
					}

				}
				return x
			case *Enumerator:
				return nil
			case *EnumSpecifier, *StructOrUnionSpecifier, *StructDeclarator:
				// nop
			default:
				panic(internalError())
			}
		}
	}
	return nil
}

func (s *Scope) enumerator(nm StringID, tok Token) *Enumerator {
	seq := tok.seq
	for s := *s; s != nil; s = s.Parent() {
		for _, v := range s[nm] {
			switch x := v.(type) {
			case *Declarator:
				if !x.isVisible(seq) {
					continue
				}

				return nil
			case *Enumerator:
				return x
			case *EnumSpecifier, *StructOrUnionSpecifier, *StructDeclarator:
				// nop
			default:
				panic(internalError())
			}
		}
	}
	return nil
}

// Config3 amends behavior of translation phases 1 to 3.
type Config3 struct {
	// If IgnoreInclude is not nil, its MatchString method will be called by the
	// preprocessor with the argument any include directive expands to. If the call
	// evaluates to is true the include directive will be ignored completely.
	IgnoreInclude *regexp.Regexp

	// Name of a macro to use instead of FD_ZERO.
	//
	// Note: Temporary solution will be removed/replaced
	ReplaceMacroFdZero string
	// Name of a macro to use instead of TCL_DEFAULT_DOUBLE_ROUNDING.
	//
	// Note: Temporary solution will be removed/replaced
	ReplaceMacroTclDefaultDoubleRounding string // Name of a macro to use instead of TCL_DEFAULT_DOUBLE_ROUNDING. Note: Temporrary solution will be removed/replaced
	// Name of a macro to use instead of TCL_IEEE_DOUBLE_ROUNDING.
	//
	// Note: Temporary solution will be removed/replaced
	ReplaceMacroTclIeeeDoubleRounding string

	WorkingDir string     // Overrides os.Getwd if non empty.
	Filesystem Filesystem // Overrides filesystem access if not empty.

	MaxSourceLine int // Zero: Scanner will use default buffer. Non zero: Scanner will use max(default buffer size, MaxSourceLine).

	// DisableBuiltinResolution disables resolution of undefined identifiers such
	// that eg. abort, becomes the same as __builtin_abort, prototype of which is
	// expected to be provided by one of the sources passed to Parse, Preprocess or
	// Translate.
	DisableBuiltinResolution bool

	DisableTrigraphs bool // GCC ignores them unless -trigraphs is used: https://gcc.gnu.org/onlinedocs/cpp/Initial-processing.html
	GCCStructs       bool // Assume __attribute__(gcc_struct) applied to structs by default.
	//TODO MSStructs                               bool // Assume __attribute__(ms_struct) applied to structs by default.
	NoFieldAndBitfieldOverlap               bool // Only bitfields can be grouped together.
	PreserveOnlyLastNonBlankSeparator       bool // If PreserveWhiteSpace is true, keep only the last white space, do not combine
	PreserveWhiteSpace                      bool // Including also comments.
	RejectElseExtraTokens                   bool // Pedantic: do not silently accept "#else foo".
	RejectEndifExtraTokens                  bool // Pedantic: do not silently accept "#endif foo".
	RejectFinalBackslash                    bool // Pedantic: do not silently accept "foo\\\n".
	RejectFunctionMacroEmptyReplacementList bool // Pedantic: do not silently accept "#define foo(bar)\n".
	RejectIfdefExtraTokens                  bool // Pedantic: do not silently accept "#ifdef foo bar".
	RejectIfndefExtraTokens                 bool // Pedantic: do not silently accept "#ifndef foo bar".
	RejectIncludeNext                       bool // Pedantic: do not silently accept "#include_next".
	RejectInvalidVariadicMacros             bool // Pedantic: do not silently accept "#define foo(bar...)". Standard allows only #define foo(bar, ...)
	RejectLineExtraTokens                   bool // Pedantic: do not silently accept "#line 1234 \"foo.c\" bar".
	RejectMissingFinalNewline               bool // Pedantic: do not silently accept "foo\nbar".
	RejectUndefExtraTokens                  bool // Pedantic: do not silently accept "#undef foo bar".
	UnsignedEnums                           bool // GCC compatibility: enums with no negative values will have unsigned type.
}

type SharedFunctionDefinitions struct {
	M    map[*FunctionDefinition]struct{}
	m    map[sharedFunctionDefinitionKey]*FunctionDefinition //TODO
	hash maphash.Hash
}

type sharedFunctionDefinitionKey struct {
	pos  StringID
	nm   StringID
	hash uint64
}

// Config amends behavior of translation phase 4 and above. Instances of Config
// are not mutated by this package and it's safe to share/reuse them.
//
// The *Config passed to Parse or Translate should not be mutated afterwards.
type Config struct {
	Config3
	ABI ABI

	PragmaHandler func(Pragma, []Token) // Called on pragmas, other than #pragma STDC ..., if non nil

	// SharedFunctionDefinitions collects function definitions having the same
	// position and definition. This can happen, for example, when a function is
	// defined in a header file included multiple times. Either within a single
	// translation unit or across translation units. In the later case just supply
	// the same SharedFunctionDefinitions in Config when translating/parsing each
	// translation unit.
	SharedFunctionDefinitions *SharedFunctionDefinitions

	// IncludeFileHandler, when non nil, is called by the preprocessor for every
	// successfully included file.
	IncludeFileHandler func(pos gotoken.Position, includePath string)

	MaxErrors int // 0: default (10), < 0: unlimited, n: n.

	CheckExternInlineFnBodies              bool // Translate will consider extern inline function bodies.
	DebugIncludePaths                      bool // Output to stderr.
	DebugWorkingDir                        bool // Output to stderr.
	DoNotTypecheckAsm                      bool
	EnableAssignmentCompatibilityChecking  bool // No such checks performed up to v3.31.0. Currently only partially implemented.
	FixBitfieldPadding                     bool // Fix a bug in calculating field positions after a bitfield.
	InjectTracingCode                      bool // Output to stderr.
	LongDoubleIsDouble                     bool
	PreprocessOnly                         bool
	RejectAnonymousFields                  bool // Pedantic: do not silently accept "struct{int;}".
	RejectCaseRange                        bool // Pedantic: do not silently accept "case 'a'...'z':".
	RejectEmptyCompositeLiterals           bool // Pedantic: do not silently accept "foo = (T){}".
	RejectEmptyDeclarations                bool // Pedantic: do not silently accept "int foo(){};".
	RejectEmptyFields                      bool // Pedantic: do not silently accept "struct {int a;;} foo;".
	RejectEmptyInitializerList             bool // Pedantic: do not silently accept "foo f = {};".
	RejectEmptyStructDeclaration           bool // Pedantic: do not silently accept "struct{; int i}".
	RejectEmptyStructs                     bool // Pedantic: do not silently accept "struct foo {};".
	RejectIncompatibleMacroRedef           bool // Pedantic: do not silently accept "#define MIN(A,B) ...\n#define MIN(a,b) ...\n" etc.
	RejectLabelValues                      bool // Pedantic: do not silently accept "foo: bar(); void *ptr = &&foo;" or "goto *ptr".
	RejectLateBinding                      bool // Pedantic: do not silently accept void f() { g(); } void g() {}
	RejectMissingConditionalExpr           bool // Pedantic: do not silently accept "foo = bar ? : baz;".
	RejectMissingDeclarationSpecifiers     bool // Pedantic: do not silently accept "main() {}".
	RejectMissingFinalStructFieldSemicolon bool // Pedantic: do not silently accept "struct{int i; int j}".
	RejectNestedFunctionDefinitions        bool // Pedantic: do not silently accept nested function definitons.
	RejectParamSemicolon                   bool // Pedantic: do not silently accept "int f(int a; int b)".
	RejectStatementExpressions             bool // Pedantic: do not silently accept "i = ({foo();})".
	RejectTypeof                           bool // Pedantic: do not silently accept "typeof foo" or "typeof(bar*)".
	RejectUninitializedDeclarators         bool // Reject int f() { int j; return j; }
	TrackAssignments                       bool // Collect a list of LHS declarators a declarator is used in RHS or as an function argument.
	doNotSanityCheckComplexTypes           bool // Testing only
	fakeIncludes                           bool // Testing only.
	ignoreErrors                           bool // Testing only.
	ignoreIncludes                         bool // Testing only.
	ignoreUndefinedIdentifiers             bool // Testing only.
}

type context struct {
	ast         *AST
	breakCtx    Node
	breaks      int
	casePromote Type
	cases       []*LabeledStatement // switch
	cfg         *Config
	checkFn     *FunctionDefinition
	closure     map[StringID]struct{}
	continues   int
	enums       map[StringID]Operand //TODO putting this in alphabetical order within the struct causes crashes in VirtualBox/386 ???
	goscanner.ErrorList
	includePaths    []string
	intBits         int
	intMaxWidth     int64 // Set if the preprocessor saw __INTMAX_WIDTH__.
	keywords        map[StringID]rune
	maxAlign        int // If non zero: maximum alignment of members of structures (other than zero-width bitfields).
	maxAlign0       int
	maxErrors       int
	mode            mode
	modes           []mode
	mu              sync.Mutex
	ptrdiffT        Type
	readDelta       int
	sizeT           Type
	structTypes     map[StringID]Type
	structs         map[StructInfo]struct{}
	switches        int
	sysIncludePaths []string
	tuSize0         int64 // Sum of sizes of processed inputs
	tuSources0      int32 // Number of processed inputs
	wcharT          Type

	capture        bool
	evalIdentError bool
}

func newContext(cfg *Config) *context {
	maxErrors := cfg.MaxErrors
	if maxErrors == 0 {
		maxErrors = 10
	}
	return &context{
		cfg:         cfg,
		enums:       map[StringID]Operand{},
		keywords:    keywords,
		maxErrors:   maxErrors,
		structTypes: map[StringID]Type{},
		structs:     map[StructInfo]struct{}{},
	}
}

func (c *context) tuSizeAdd(n int64)    { atomic.AddInt64(&c.tuSize0, n) }
func (c *context) tuSize() int64        { return atomic.LoadInt64(&c.tuSize0) }
func (c *context) tuSourcesAdd(n int32) { atomic.AddInt32(&c.tuSources0, n) }
func (c *context) tuSources() int       { return int(atomic.LoadInt32(&c.tuSources0)) }

func (c *context) stddef(nm StringID, s Scope, tok Token) Type {
	if d := s.typedef(nm, tok); d != nil {
		if t := d.Type(); t != nil && t.Kind() != Invalid {
			return t
		}
	}

	c.errNode(&tok, "front-end: undefined: %s", nm)
	return noType
}

func (c *context) assignmentCompatibilityErrorCond(n Node, a, b Type) (stop bool) {
	if !c.cfg.EnableAssignmentCompatibilityChecking {
		return
	}

	return c.errNode(n, "invalid type combination of conditional operator: %v and %v", a, b)
}

func (c *context) assignmentCompatibilityError(n Node, lhs, rhs Type) (stop bool) {
	if !c.cfg.EnableAssignmentCompatibilityChecking {
		return
	}

	return c.errNode(n, "cannot use %v as type %v in assignment", rhs, lhs)
}

func (c *context) errNode(n Node, msg string, args ...interface{}) (stop bool) {
	return c.err(n.Position(), msg, args...)
}

func (c *context) err(pos token.Position, msg string, args ...interface{}) (stop bool) {
	// dbg("FAIL "+msg, args...)
	//fmt.Printf("FAIL "+msg+"\n", args...)
	if c.cfg.ignoreErrors {
		return false
	}

	s := fmt.Sprintf(msg, args...)
	c.mu.Lock()
	max := c.maxErrors
	switch {
	case max < 0 || max > len(c.ErrorList):
		c.ErrorList.Add(gotoken.Position(pos), s)
	default:
		stop = true
	}
	c.mu.Unlock()
	return stop
}

func (c *context) errs(list goscanner.ErrorList) (stop bool) {
	c.mu.Lock()

	defer c.mu.Unlock()

	max := c.maxErrors
	for _, v := range list {
		switch {
		case max < 0 || max > len(c.ErrorList):
			c.ErrorList = append(c.ErrorList, v)
		default:
			return true
		}
	}
	return false
}

func (c *context) Err() error {
	c.mu.Lock()
	switch x := c.ErrorList.Err().(type) {
	case goscanner.ErrorList:
		x = append(goscanner.ErrorList(nil), x...)
		c.mu.Unlock()
		var lpos gotoken.Position
		w := 0
		for _, v := range x {
			if lpos.Filename != "" {
				if v.Pos.Filename == lpos.Filename && v.Pos.Line == lpos.Line {
					continue
				}
			}

			x[w] = v
			w++
			lpos = v.Pos
		}
		x = x[:w]
		sort.Slice(x, func(i, j int) bool {
			a := x[i]
			b := x[j]
			if !a.Pos.IsValid() && b.Pos.IsValid() {
				return true
			}

			if a.Pos.IsValid() && !b.Pos.IsValid() {
				return false
			}

			if a.Pos.Filename < b.Pos.Filename {
				return true
			}

			if a.Pos.Filename > b.Pos.Filename {
				return false
			}

			if a.Pos.Line < b.Pos.Line {
				return true
			}

			if a.Pos.Line > b.Pos.Line {
				return false
			}

			return a.Pos.Column < b.Pos.Column
		})
		a := make([]string, 0, len(x))
		for _, v := range x {
			a = append(a, v.Error())
		}
		return fmt.Errorf("%s", strings.Join(a, "\n"))
	default:
		c.mu.Unlock()
		return x
	}
}

func (c *context) not(n Node, mode mode) {
	if c.mode&mode != 0 {
		switch mode {
		case mIntConstExpr:
			c.errNode(n, "invalid integer constant expression")
		default:
			panic(internalError())
		}
	}
}

func (c *context) push(mode mode) {
	c.modes = append(c.modes, c.mode)
	c.mode = mode
}

func (c *context) pop() {
	n := len(c.modes)
	c.mode = c.modes[n-1]
	c.modes = c.modes[:n-1]
}

func (c *context) statFile(name string, sys bool) (os.FileInfo, error) {
	fs := c.cfg.Config3.Filesystem
	if fs == nil {
		fs = LocalFS()
	}
	return fs.Stat(name, sys)
}

func (c *context) openFile(name string, sys bool) (io.ReadCloser, error) {
	fs := c.cfg.Config3.Filesystem
	if fs == nil {
		fs = LocalFS()
	}
	return fs.Open(name, sys)
}

// HostConfig returns the system C preprocessor/compiler configuration, or an
// error, if any.  The configuration is obtained by running the command named
// by the cpp argumnent or "cpp" when it's empty.  For the predefined macros
// list the '-dM' options is added. For the include paths lists, the option
// '-v' is added and the output is parsed to extract the "..." include and
// <...> include paths. To add any other options to cpp, list them in opts.
//
// The function relies on a POSIX/GCC compatible C preprocessor installed.
// Execution of HostConfig is not free, so caching of the results is
// recommended.
func HostConfig(cpp string, opts ...string) (predefined string, includePaths, sysIncludePaths []string, err error) {
	if predefined, includePaths, sysIncludePaths, err = hostConfigv3(cpp, opts...); err == nil {
		return predefined, includePaths, sysIncludePaths, nil
	}

	return hostConfigv4(opts)
}

func hostConfigv3(cpp string, opts ...string) (predefined string, includePaths, sysIncludePaths []string, err error) {
	if cpp == "" {
		cpp = "cpp"
	}
	args := append(append([]string{"-dM"}, opts...), os.DevNull)
	pre, err := exec.Command(cpp, args...).Output()
	if err != nil {
		return "", nil, nil, err
	}

	args = append(append([]string{"-v"}, opts...), os.DevNull)
	out, err := exec.Command(cpp, args...).CombinedOutput()
	if err != nil {
		return "", nil, nil, err
	}

	sep := "\n"
	if env("GOOS", runtime.GOOS) == "windows" {
		sep = "\r\n"
	}

	a := strings.Split(string(out), sep)
	for i := 0; i < len(a); {
		switch a[i] {
		case "#include \"...\" search starts here:":
		loop:
			for i = i + 1; i < len(a); {
				switch v := a[i]; {
				case strings.HasPrefix(v, "#") || v == "End of search list.":
					break loop
				default:
					includePaths = append(includePaths, strings.TrimSpace(v))
					i++
				}
			}
		case "#include <...> search starts here:":
			for i = i + 1; i < len(a); {
				switch v := a[i]; {
				case strings.HasPrefix(v, "#") || v == "End of search list.":
					return string(pre), includePaths, sysIncludePaths, nil
				default:
					sysIncludePaths = append(sysIncludePaths, strings.TrimSpace(v))
					i++
				}
			}
		default:
			i++
		}
	}
	return "", nil, nil, fmt.Errorf("failed parsing %s -v output", cpp)
}

func hostConfigv4(opts []string) (predefined string, includePaths, sysIncludePaths []string, err error) {
	for _, cc := range []string{os.Getenv("CC"), "cc", "gcc"} {
		if cc == "" {
			continue
		}

		cc, err = exec.LookPath(cc)
		if err != nil {
			continue
		}

		args := append(opts, "-dM", "-E", "-")
		pre, err := exec.Command(cc, args...).CombinedOutput()
		if err != nil {
			continue
		}

		sep := "\n"
		if env("GOOS", runtime.GOOS) == "windows" {
			sep = "\r\n"
		}
		a := strings.Split(string(pre), sep)
		w := 0
		for _, v := range a {
			if strings.HasPrefix(v, "#") {
				a[w] = v
				w++
			}
		}
		predefined = strings.Join(a[:w], "\n")
		args = append(opts, "-v", "-E", "-")
		out, err := exec.Command(cc, args...).CombinedOutput()
		if err != nil {
			continue
		}

		a = strings.Split(string(out), sep)
		for i := 0; i < len(a); {
			switch a[i] {
			case "#include \"...\" search starts here:":
			loop:
				for i = i + 1; i < len(a); {
					switch v := a[i]; {
					case strings.HasPrefix(v, "#") || v == "End of search list.":
						break loop
					default:
						includePaths = append(includePaths, strings.TrimSpace(v))
						i++
					}
				}
			case "#include <...> search starts here:":
				for i = i + 1; i < len(a); {
					switch v := a[i]; {
					case strings.HasPrefix(v, "#") || v == "End of search list.":
						return predefined, includePaths, sysIncludePaths, nil
					default:
						sysIncludePaths = append(sysIncludePaths, strings.TrimSpace(v))
						i++
					}
				}
			default:
				i++
			}
		}
	}
	return "", nil, nil, fmt.Errorf("cannot determine C compiler configuration")
}

func env(key, val string) string {
	if s := os.Getenv(key); s != "" {
		return s
	}

	return val
}

// Token is a grammar terminal.
type Token struct {
	Rune  rune     // ';' or IDENTIFIER etc.
	Sep   StringID // If Config3.PreserveWhiteSpace is in effect: All preceding white space combined, including comments.
	Value StringID // ";" or "foo" etc.
	Src   StringID
	file  *tokenFile
	macro StringID
	pos   int32
	seq   int32
}

// Seq returns t's sequential number.
//
// Comparing positions as in 'before', 'after' is complicated as tokens in a
// translation unit usually come from more than one source file. Macro
// expansion further complicates that. The solution is sequentially numbering
// the tokens as they are finally seen by the parser, so the usual arithmetic
// '<', '>' operators can be used for that purpose.
func (t Token) Seq() int { return int(t.seq) }

// Macro returns the name of a macro that expanded to this token, if any.
func (t *Token) Macro() StringID { return t.macro }

// String implements fmt.Stringer.
func (t Token) String() string { return t.Value.String() }

// Position implements Node.
func (t *Token) Position() (r token.Position) {
	if t.pos != 0 && t.file != nil {
		r = t.file.PositionFor(token.Pos(t.pos), true)
	}
	return r
}

func tokStr(toks interface{}, sep string) string {
	var b strings.Builder
	switch x := toks.(type) {
	case []token3:
		for i, v := range x {
			if i != 0 {
				b.WriteString(sep)
			}
			b.WriteString(v.String())
		}
	case []token4:
		for i, v := range x {
			if i != 0 {
				b.WriteString(sep)
			}
			b.WriteString(v.String())
		}
	case []cppToken:
		for i, v := range x {
			if i != 0 {
				b.WriteString(sep)
			}
			b.WriteString(v.String())
		}
	case []Token:
		for i, v := range x {
			if i != 0 {
				b.WriteString(sep)
			}
			b.WriteString(v.String())
		}
	default:
		panic(internalError())
	}
	return b.String()
}

func internalError() int {
	panic(fmt.Errorf("%v: internal error", origin(2)))
}

func internalErrorf(s string, args ...interface{}) int {
	s = fmt.Sprintf(s, args)
	panic(fmt.Errorf("%v: %s", origin(2), s))
}

func detectMingw(s string) bool {
	return strings.Contains(s, "#define __MINGW")
}

func nodeSource(n ...Node) (r string) {
	if len(n) == 0 {
		return ""
	}

	var a []*Token
	for _, v := range n {
		Inspect(v, func(n Node, _ bool) bool {
			if x, ok := n.(*Token); ok && x.Seq() != 0 {
				a = append(a, x)
			}
			return true
		})
	}
	sort.Slice(a, func(i, j int) bool {
		return a[i].Seq() < a[j].Seq()
	})
	w := 0
	seq := -1
	for _, v := range a {
		if n := v.Seq(); n != seq {
			seq = n
			a[w] = v
			w++
		}
	}
	a = a[:w]
	var b strings.Builder
	for _, v := range a {
		b.WriteString(v.Sep.String())
		b.WriteString(v.Src.String())
	}
	return b.String()
}
