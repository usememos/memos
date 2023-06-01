// Copyright 2019 The CC Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package cc // import "modernc.org/cc/v3"

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// Source is a named part of a translation unit. If Value is empty, Name is
// interpreted as a path to file containing the source code.
type Source struct {
	Name       string
	Value      string
	DoNotCache bool // Disable caching of this source
}

// Promote returns the type the operands of a binary operation are promoted to
// or the type and argument passed in a function call is promoted.
func (n *AssignmentExpression) Promote() Type { return n.promote }

type StructInfo struct {
	Size uintptr

	Align int
}

// AST represents a translation unit and its related data.
type AST struct {
	Enums       map[StringID]Operand // Enumeration constants declared in file scope.
	Macros      map[StringID]*Macro  // Macros as defined after parsing.
	PtrdiffType Type
	Scope       Scope // File scope.
	SizeType    Type
	StructTypes map[StringID]Type // Tagged struct/union types declared in file scope.
	// Alignment and size of every struct/union defined in the translation
	// unit. Valid only after Translate.
	Structs map[StructInfo]struct{}
	// TLD contains pruned file scope declarators, ie. either the first one
	// or the first one that has an initializer.
	TLD               map[*Declarator]struct{}
	TrailingSeperator StringID // White space and/or comments preceding EOF.
	TranslationUnit   *TranslationUnit
	WideCharType      Type
	cfg               *Config
	cpp               *cpp
}

// Eval returns the operand that represents the value of m, if it expands to a
// valid constant expression other than an identifier, or an error, if any.
func (n *AST) Eval(m *Macro) (o Operand, err error) {
	defer func() {
		if e := recover(); e != nil {
			o = nil
			err = fmt.Errorf("%v", e)
		}
	}()

	if m.IsFnLike() {
		return nil, fmt.Errorf("cannot evaluate function-like macro")
	}

	n.cpp.ctx.cfg.ignoreErrors = true
	n.cpp.ctx.evalIdentError = true
	v := n.cpp.eval(m.repl)
	switch x := v.(type) {
	case int64:
		return &operand{abi: &n.cfg.ABI, typ: n.cfg.ABI.Type(LongLong), value: Int64Value(x)}, nil
	case uint64:
		return &operand{abi: &n.cfg.ABI, typ: n.cfg.ABI.Type(ULongLong), value: Uint64Value(x)}, nil
	default:
		return nil, fmt.Errorf("unexpected value: %T", x)
	}
}

// Parse preprocesses and parses a translation unit and returns an *AST or
// error, if any.
//
// Search paths listed in includePaths and sysIncludePaths are used to resolve
// #include "foo.h" and #include <foo.h> preprocessing directives respectively.
// A special search path "@" is interpreted as 'the same directory as where the
// file with the #include directive is'.
//
// The sources should typically provide, usually in this particular order:
//
// - predefined macros, eg.
//
//	#define __SIZE_TYPE__ long unsigned int
//
// - built-in declarations, eg.
//
//	int __builtin_printf(char *__format, ...);
//
// - command-line provided directives, eg.
//
//	#define FOO
//	#define BAR 42
//	#undef QUX
//
// - normal C sources, eg.
//
//	int main() {}
//
// All search and file paths should be absolute paths.
//
// If the preprocessed translation unit is empty, the function may return (nil,
// nil).
//
// The parser does only the minimum declarations/identifier resolving necessary
// for correct parsing. Redeclarations are not checked.
//
// Declarators (*Declarator) and StructDeclarators (*StructDeclarator) are
// inserted in the appropriate scopes.
//
// Tagged struct/union specifier definitions (*StructOrUnionSpecifier) are
// inserted in the appropriate scopes.
//
// Tagged enum specifier definitions (*EnumSpecifier) and enumeration constants
// (*Enumerator) are inserted in the appropriate scopes.
//
// Labels (*LabeledStatement) are inserted in the appropriate scopes.
func Parse(cfg *Config, includePaths, sysIncludePaths []string, sources []Source) (*AST, error) {
	return parse(newContext(cfg), includePaths, sysIncludePaths, sources)
}

func parse(ctx *context, includePaths, sysIncludePaths []string, sources []Source) (*AST, error) {
	if s := ctx.cfg.SharedFunctionDefinitions; s != nil {
		if s.M == nil {
			s.M = map[*FunctionDefinition]struct{}{}
		}
		if s.m == nil {
			s.m = map[sharedFunctionDefinitionKey]*FunctionDefinition{}
		}
	}
	if debugWorkingDir || ctx.cfg.DebugWorkingDir {
		switch wd, err := os.Getwd(); err {
		case nil:
			fmt.Fprintf(os.Stderr, "OS working dir: %s\n", wd)
		default:
			fmt.Fprintf(os.Stderr, "OS working dir: error %s\n", err)
		}
		fmt.Fprintf(os.Stderr, "Config.WorkingDir: %s\n", ctx.cfg.WorkingDir)
	}
	if debugIncludePaths || ctx.cfg.DebugIncludePaths {
		fmt.Fprintf(os.Stderr, "include paths: %v\n", includePaths)
		fmt.Fprintf(os.Stderr, "system include paths: %v\n", sysIncludePaths)
	}
	ctx.includePaths = includePaths
	ctx.sysIncludePaths = sysIncludePaths
	var in []source
	for _, v := range sources {
		ts, err := cache.get(ctx, v)
		if err != nil {
			return nil, err
		}

		in = append(in, ts)
	}

	p := newParser(ctx, make(chan *[]Token, 5000)) //DONE benchmark tuned
	var sep StringID
	var ssep []byte
	var seq int32
	cpp := newCPP(ctx)
	go func() {

		defer func() {
			close(p.in)
			ctx.intMaxWidth = cpp.intMaxWidth()
		}()

		toks := tokenPool.Get().(*[]Token)
		*toks = (*toks)[:0]
		for pline := range cpp.translationPhase4(in) {
			line := *pline
			for _, tok := range line {
				switch tok.char {
				case ' ', '\n':
					if ctx.cfg.PreserveOnlyLastNonBlankSeparator {
						if strings.TrimSpace(tok.value.String()) != "" {
							sep = tok.value
						}
						break
					}

					switch {
					case sep != 0:
						ssep = append(ssep, tok.String()...)
					default:
						sep = tok.value
						ssep = append(ssep[:0], sep.String()...)
					}
				default:
					var t Token
					t.Rune = tok.char
					switch {
					case len(ssep) != 0:
						t.Sep = dict.id(ssep)
					default:
						t.Sep = sep
					}
					t.Value = tok.value
					t.Src = tok.src
					t.file = tok.file
					t.macro = tok.macro
					t.pos = tok.pos
					seq++
					t.seq = seq
					*toks = append(*toks, t)
					sep = 0
					ssep = ssep[:0]
				}
			}
			token4Pool.Put(pline)
			var c rune
			if n := len(*toks); n != 0 {
				c = (*toks)[n-1].Rune
			}
			switch c {
			case STRINGLITERAL, LONGSTRINGLITERAL:
				// nop
			default:
				if len(*toks) != 0 {
					p.in <- translationPhase5(ctx, toks)
					toks = tokenPool.Get().(*[]Token)
					*toks = (*toks)[:0]
				}
			}
		}
		if len(*toks) != 0 {
			p.in <- translationPhase5(ctx, toks)
		}
	}()

	tu := p.translationUnit()
	if p.errored { // Must drain
		go func() {
			for range p.in {
			}
		}()
	}

	if err := ctx.Err(); err != nil {
		return nil, err
	}

	if p.errored && !ctx.cfg.ignoreErrors {
		return nil, fmt.Errorf("%v: syntax error", p.tok.Position())
	}

	if p.scopes != 0 {
		panic(internalErrorf("invalid scope nesting but no error reported"))
	}

	ts := sep
	if len(ssep) != 0 {
		ts = dict.id(ssep)
	}
	return &AST{
		Macros:            cpp.macros,
		Scope:             p.fileScope,
		TLD:               map[*Declarator]struct{}{},
		TrailingSeperator: ts,
		TranslationUnit:   tu,
		cfg:               ctx.cfg,
		cpp:               cpp,
	}, nil
}

func translationPhase5(ctx *context, toks *[]Token) *[]Token {
	// [0], 5.1.1.2, 5
	//
	// Each source character set member and escape sequence in character
	// constants and string literals is converted to the corresponding
	// member of the execution character set; if there is no corresponding
	// member, it is converted to an implementation- defined member other
	// than the null (wide) character.
	for i, tok := range *toks {
		var cpt cppToken
		switch tok.Rune {
		case STRINGLITERAL, LONGSTRINGLITERAL:
			cpt.char = tok.Rune
			cpt.value = tok.Value
			cpt.src = tok.Src
			cpt.file = tok.file
			cpt.pos = tok.pos
			(*toks)[i].Value = dict.sid(stringConst(ctx, cpt))
		case CHARCONST, LONGCHARCONST:
			var cpt cppToken
			cpt.char = tok.Rune
			cpt.value = tok.Value
			cpt.src = tok.Src
			cpt.file = tok.file
			cpt.pos = tok.pos
			switch r := charConst(ctx, cpt); {
			case r <= 255:
				(*toks)[i].Value = dict.sid(string(r))
			default:
				switch cpt.char {
				case CHARCONST:
					ctx.err(tok.Position(), "invalid character constant: %s", tok.Value)
				default:
					(*toks)[i].Value = dict.sid(string(r))
				}
			}
		}
	}
	return toks
}

// Preprocess preprocesses a translation unit and outputs the result to w.
//
// Please see Parse for the documentation of the other parameters.
func Preprocess(cfg *Config, includePaths, sysIncludePaths []string, sources []Source, w io.Writer) error {
	ctx := newContext(cfg)
	if debugWorkingDir || ctx.cfg.DebugWorkingDir {
		switch wd, err := os.Getwd(); err {
		case nil:
			fmt.Fprintf(os.Stderr, "OS working dir: %s\n", wd)
		default:
			fmt.Fprintf(os.Stderr, "OS working dir: error %s\n", err)
		}
		fmt.Fprintf(os.Stderr, "Config.WorkingDir: %s\n", ctx.cfg.WorkingDir)
	}
	if debugIncludePaths || ctx.cfg.DebugIncludePaths {
		fmt.Fprintf(os.Stderr, "include paths: %v\n", includePaths)
		fmt.Fprintf(os.Stderr, "system include paths: %v\n", sysIncludePaths)
	}
	ctx.includePaths = includePaths
	ctx.sysIncludePaths = sysIncludePaths
	var in []source
	for _, v := range sources {
		ts, err := cache.get(ctx, v)
		if err != nil {
			return err
		}

		in = append(in, ts)
	}

	var sep StringID
	cpp := newCPP(ctx)
	toks := tokenPool.Get().(*[]Token)
	*toks = (*toks)[:0]
	for pline := range cpp.translationPhase4(in) {
		line := *pline
		for _, tok := range line {
			switch tok.char {
			case ' ', '\n':
				if ctx.cfg.PreserveOnlyLastNonBlankSeparator {
					if strings.TrimSpace(tok.value.String()) != "" {
						sep = tok.value
					}
					break
				}

				switch {
				case sep != 0:
					sep = dict.sid(sep.String() + tok.String())
				default:
					sep = tok.value
				}
			default:
				var t Token
				t.Rune = tok.char
				t.Sep = sep
				t.Value = tok.value
				t.Src = tok.src
				t.file = tok.file
				t.pos = tok.pos
				*toks = append(*toks, t)
				sep = 0
			}
		}
		token4Pool.Put(pline)
		var c rune
		if n := len(*toks); n != 0 {
			c = (*toks)[n-1].Rune
		}
		switch c {
		case STRINGLITERAL, LONGSTRINGLITERAL:
			// nop
		default:
			if len(*toks) != 0 {
				for _, v := range *translationPhase5(ctx, toks) {
					if err := wTok(w, v); err != nil {
						return err
					}
				}
				toks = tokenPool.Get().(*[]Token)
				*toks = (*toks)[:0]
			}
		}
	}
	if len(*toks) != 0 {
		for _, v := range *translationPhase5(ctx, toks) {
			if err := wTok(w, v); err != nil {
				return err
			}
		}
	}
	if _, err := fmt.Fprintln(w); err != nil {
		return err
	}
	return ctx.Err()
}

func wTok(w io.Writer, tok Token) (err error) {
	switch tok.Rune {
	case STRINGLITERAL, LONGSTRINGLITERAL:
		_, err = fmt.Fprintf(w, `%s"%s"`, tok.Sep, cQuotedString(tok.String(), true))
	case CHARCONST, LONGCHARCONST:
		_, err = fmt.Fprintf(w, `%s'%s'`, tok.Sep, cQuotedString(tok.String(), false))
	default:
		_, err = fmt.Fprintf(w, "%s%s", tok.Sep, tok)
	}
	return err
}

func cQuotedString(s string, isString bool) []byte {
	var b []byte
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch c {
		case '\b':
			b = append(b, '\\', 'b')
			continue
		case '\f':
			b = append(b, '\\', 'f')
			continue
		case '\n':
			b = append(b, '\\', 'n')
			continue
		case '\r':
			b = append(b, '\\', 'r')
			continue
		case '\t':
			b = append(b, '\\', 't')
			continue
		case '\\':
			b = append(b, '\\', '\\')
			continue
		case '"':
			switch {
			case isString:
				b = append(b, '\\', '"')
			default:
				b = append(b, '"')
			}
			continue
		case '\'':
			switch {
			case isString:
				b = append(b, '\'')
			default:
				b = append(b, '\\', '\'')
			}
			continue
		}

		switch {
		case c < ' ' || c >= 0x7f:
			b = append(b, '\\', octal(c>>6), octal(c>>3), octal(c))
		default:
			b = append(b, c)
		}
	}
	return b
}

func octal(b byte) byte { return '0' + b&7 }

var trcSource = Source{"<builtin-trc>", `
extern void *stderr;
int fflush(void *stream);
int fprintf(void *stream, const char *format, ...);
`, false}

// Translate parses and typechecks a translation unit  and returns an *AST or
// error, if any.
//
// Please see Parse for the documentation of the parameters.
func Translate(cfg *Config, includePaths, sysIncludePaths []string, sources []Source) (*AST, error) {
	if cfg.InjectTracingCode {
		for i, v := range sources {
			if filepath.Ext(v.Name) == ".c" {
				sources = append(append(append([]Source(nil), sources[:i]...), trcSource), sources[i:]...)
			}
		}
	}
	return translate(newContext(cfg), includePaths, sysIncludePaths, sources)
}

func translate(ctx *context, includePaths, sysIncludePaths []string, sources []Source) (*AST, error) {
	ast, err := parse(ctx, includePaths, sysIncludePaths, sources)
	if err != nil {
		return nil, err
	}

	if ctx, err = ast.typecheck(); err != nil {
		return nil, err
	}

	ast.PtrdiffType = ptrdiffT(ctx, ast.Scope, Token{})
	ast.SizeType = sizeT(ctx, ast.Scope, Token{})
	ast.WideCharType = wcharT(ctx, ast.Scope, Token{})
	return ast, nil
}

// Typecheck determines types of objects and expressions and verifies types are
// valid in the context they are used.
func (n *AST) Typecheck() error {
	_, err := n.typecheck()
	return err
}

func (n *AST) typecheck() (*context, error) {
	ctx := newContext(n.cfg)
	if err := ctx.cfg.ABI.sanityCheck(ctx, int(ctx.intMaxWidth), n.Scope); err != nil {
		return nil, err
	}

	ctx.intBits = int(ctx.cfg.ABI.Types[Int].Size) * 8
	ctx.ast = n
	n.TranslationUnit.check(ctx)
	n.Structs = ctx.structs
	var a []int
	for k := range n.Scope {
		a = append(a, int(k))
	}
	sort.Ints(a)
	for _, v := range a {
		nm := StringID(v)
		defs := n.Scope[nm]
		var r, w int
		for _, v := range defs {
			switch x := v.(type) {
			case *Declarator:
				r += x.Read
				w += x.Write
			}
		}
		for _, v := range defs {
			switch x := v.(type) {
			case *Declarator:
				x.Read = r
				x.Write = w
			}
		}
		var pruned *Declarator
		for _, v := range defs {
			switch x := v.(type) {
			case *Declarator:
				//TODO check compatible types
				switch {
				case x.IsExtern() && !x.fnDef:
					// nop
				case pruned == nil:
					pruned = x
				case pruned.hasInitializer && x.hasInitializer:
					ctx.errNode(x, "multiple initializers for the same symbol")
					continue
				case pruned.fnDef && x.fnDef:
					ctx.errNode(x, "multiple function definitions")
					continue
				case x.hasInitializer || x.fnDef:
					pruned = x
				}
			}
		}
		if pruned == nil {
			continue
		}

		n.TLD[pruned] = struct{}{}
	}
	n.Enums = ctx.enums
	n.StructTypes = ctx.structTypes
	return ctx, ctx.Err()
}

func (n *AlignmentSpecifier) align() int {
	switch n.Case {
	case AlignmentSpecifierAlignasType: // "_Alignas" '(' TypeName ')'
		return n.TypeName.Type().Align()
	case AlignmentSpecifierAlignasExpr: // "_Alignas" '(' ConstantExpression ')'
		return n.ConstantExpression.Operand.Type().Align()
	default:
		panic(internalError())
	}
}

// Closure reports the variables closed over by a nested function (case
// BlockItemFuncDef).
func (n *BlockItem) Closure() map[StringID]struct{} { return n.closure }

// FunctionDefinition returns the nested function (case BlockItemFuncDef).
func (n *BlockItem) FunctionDefinition() *FunctionDefinition { return n.fn }

func (n *Declarator) IsStatic() bool { return n.td != nil && n.td.static() }

// IsImplicit reports whether n was not declared nor defined, only inferred.
func (n *Declarator) IsImplicit() bool { return n.implicit }

func (n *Declarator) isVisible(at int32) bool { return at == 0 || n.DirectDeclarator.ends() < at }

func (n *Declarator) setLHS(lhs *Declarator) {
	if n == nil {
		return
	}

	if n.lhs == nil {
		n.lhs = map[*Declarator]struct{}{}
	}
	n.lhs[lhs] = struct{}{}
}

// LHS reports which declarators n is used in assignment RHS or which function
// declarators n is used in a function argument. To collect this information,
// TrackAssignments in Config must be set during type checking.
// The returned map may contain a nil key. That means that n is assigned to a
// declarator not known at typechecking time.
func (n *Declarator) LHS() map[*Declarator]struct{} { return n.lhs }

// Called reports whether n is involved in expr in expr(callArgs).
func (n *Declarator) Called() bool { return n.called }

// FunctionDefinition returns the function definition associated with n, if any.
func (n *Declarator) FunctionDefinition() *FunctionDefinition {
	return n.funcDefinition
}

// NameTok returns n's declaring name token.
func (n *Declarator) NameTok() (r Token) {
	if n == nil || n.DirectDeclarator == nil {
		return r
	}

	return n.DirectDeclarator.NameTok()
}

// LexicalScope returns the lexical scope of n.
func (n *Declarator) LexicalScope() Scope { return n.DirectDeclarator.lexicalScope }

// Name returns n's declared name.
func (n *Declarator) Name() StringID {
	if n == nil || n.DirectDeclarator == nil {
		return 0
	}

	return n.DirectDeclarator.Name()
}

// ParamScope returns the scope in which n's function parameters are declared
// if the underlying type of n is a function or nil otherwise. If n is part of
// a function definition the scope is the same as the scope of the function
// body.
func (n *Declarator) ParamScope() Scope {
	if n == nil {
		return nil
	}

	return n.DirectDeclarator.ParamScope()
}

// Type returns the type of n.
func (n *Declarator) Type() Type { return n.typ }

// IsExtern reports whether n was declared with storage class specifier 'extern'.
func (n *Declarator) IsExtern() bool { return n.td != nil && n.td.extern() }

func (n *DeclarationSpecifiers) auto() bool        { return n != nil && n.class&fAuto != 0 }
func (n *DeclarationSpecifiers) extern() bool      { return n != nil && n.class&fExtern != 0 }
func (n *DeclarationSpecifiers) register() bool    { return n != nil && n.class&fRegister != 0 }
func (n *DeclarationSpecifiers) static() bool      { return n != nil && n.class&fStatic != 0 }
func (n *DeclarationSpecifiers) threadLocal() bool { return n != nil && n.class&fThreadLocal != 0 }
func (n *DeclarationSpecifiers) typedef() bool     { return n != nil && n.class&fTypedef != 0 }

func (n *DirectAbstractDeclarator) TypeQualifier() Type { return n.typeQualifiers }

func (n *DirectDeclarator) ends() int32 {
	switch n.Case {
	case DirectDeclaratorIdent: // IDENTIFIER
		return n.Token.seq
	case DirectDeclaratorDecl: // '(' Declarator ')'
		return n.Token2.seq
	case DirectDeclaratorArr: // DirectDeclarator '[' TypeQualifierList AssignmentExpression ']'
		return n.Token2.seq
	case DirectDeclaratorStaticArr: // DirectDeclarator '[' "static" TypeQualifierList AssignmentExpression ']'
		return n.Token3.seq
	case DirectDeclaratorArrStatic: // DirectDeclarator '[' TypeQualifierList "static" AssignmentExpression ']'
		return n.Token3.seq
	case DirectDeclaratorStar: // DirectDeclarator '[' TypeQualifierList '*' ']'
		return n.Token3.seq
	case DirectDeclaratorFuncParam: // DirectDeclarator '(' ParameterTypeList ')'
		return n.Token2.seq
	case DirectDeclaratorFuncIdent: // DirectDeclarator '(' IdentifierList ')'
		return n.Token2.seq
	default:
		panic(internalError())
	}
}

func (n *DirectDeclarator) TypeQualifier() Type { return n.typeQualifiers }

// NameTok returns n's declarin name token.
func (n *DirectDeclarator) NameTok() (r Token) {
	for {
		if n == nil {
			return r
		}

		switch n.Case {
		case DirectDeclaratorIdent: // IDENTIFIER
			return n.Token
		case DirectDeclaratorDecl: // '(' Declarator ')'
			return n.Declarator.NameTok()
		default:
			n = n.DirectDeclarator
		}
	}
}

// Name returns n's declared name.
func (n *DirectDeclarator) Name() StringID {
	for {
		if n == nil {
			return 0
		}

		switch n.Case {
		case DirectDeclaratorIdent: // IDENTIFIER
			return n.Token.Value
		case DirectDeclaratorDecl: // '(' Declarator ')'
			return n.Declarator.Name()
		default:
			n = n.DirectDeclarator
		}
	}
}

// ParamScope returns the innermost scope in which function parameters are
// declared for Case DirectDeclaratorFuncParam or DirectDeclaratorFuncIdent or
// nil otherwise.
func (n *DirectDeclarator) ParamScope() Scope {
	if n == nil {
		return nil
	}

	switch n.Case {
	case DirectDeclaratorIdent: // IDENTIFIER
		return nil
	case DirectDeclaratorDecl: // '(' Declarator ')'
		return n.Declarator.ParamScope()
	case DirectDeclaratorArr: // DirectDeclarator '[' TypeQualifierList AssignmentExpression ']'
		return n.DirectDeclarator.ParamScope()
	case DirectDeclaratorStaticArr: // DirectDeclarator '[' "static" TypeQualifierList AssignmentExpression ']'
		return n.DirectDeclarator.ParamScope()
	case DirectDeclaratorArrStatic: // DirectDeclarator '[' TypeQualifierList "static" AssignmentExpression ']'
		return n.DirectDeclarator.ParamScope()
	case DirectDeclaratorStar: // DirectDeclarator '[' TypeQualifierList '*' ']'
		return n.DirectDeclarator.ParamScope()
	case DirectDeclaratorFuncParam: // DirectDeclarator '(' ParameterTypeList ')'
		if s := n.DirectDeclarator.ParamScope(); s != nil {
			return s
		}

		return n.paramScope
	case DirectDeclaratorFuncIdent: // DirectDeclarator '(' IdentifierList ')'
		if s := n.DirectDeclarator.ParamScope(); s != nil {
			return s
		}

		return n.paramScope
	default:
		panic(internalError())
	}
}

func (n *Enumerator) isVisible(at int32) bool { return n.Token.seq < at }

func (n *EnumSpecifier) Type() Type { return n.typ }

// Promote returns the type the operands of the binary operation are promoted to.
func (n *EqualityExpression) Promote() Type { return n.promote }

// Promote returns the type the operands of the binary operation are promoted to.
func (n *AdditiveExpression) Promote() Type { return n.promote }

// Promote returns the type the operands of the binary operation are promoted to.
func (n *MultiplicativeExpression) Promote() Type { return n.promote }

// Promote returns the type the operands of the binary operation are promoted to.
func (n *InclusiveOrExpression) Promote() Type { return n.promote }

// Promote returns the type the operands of the binary operation are promoted to.
func (n *ExclusiveOrExpression) Promote() Type { return n.promote }

// Promote returns the type the operands of the binary operation are promoted to.
func (n *AndExpression) Promote() Type { return n.promote }

func (n *InitDeclarator) Value() *InitializerValue { return n.initializer }

// FirstDesignatorField returns the first field a designator of an union type
// denotes, if any.
func (n *Initializer) FirstDesignatorField() Field { return n.field0 }

// TrailingComma returns the comma token following n, if any.
func (n *Initializer) TrailingComma() *Token { return n.trailingComma }

// IsConst reports whether n is constant.
func (n *Initializer) IsConst() bool { return n == nil || n.isConst }

// IsZero reports whether n is a zero value.
func (n *Initializer) IsZero() bool { return n == nil || n.isZero }

// List returns n as a flattened list of all items that are case
// InitializerExpr.
func (n *Initializer) List() []*Initializer { return n.list }

// Parent returns the parent of n, if any.
func (n *Initializer) Parent() *Initializer { return n.parent }

// Type returns the type this initializer initializes.
func (n *Initializer) Type() Type { return n.typ }

// IsConst reports whether n is constant.
func (n *InitializerList) IsConst() bool { return n == nil || n.isConst }

// IsZero reports whether n is a zero value.
func (n *InitializerList) IsZero() bool { return n == nil || n.isZero }

// List returns n as a flattened list of all items that are case
// InitializerExpr.
func (n *InitializerList) List() []*Initializer {
	if n == nil {
		return nil
	}

	return n.list
}

// IsEmpty reprts whether n is an empty list.
func (n *InitializerList) IsEmpty() bool { return len(n.list) == 0 }

// LexicalScope returns the lexical scope of n.
func (n *JumpStatement) LexicalScope() Scope { return n.lexicalScope }

// LexicalScope returns the lexical scope of n.
func (n *LabeledStatement) LexicalScope() Scope { return n.lexicalScope }

func (n *ParameterDeclaration) Type() Type { return n.typ }

func (n *Pointer) TypeQualifier() Type { return n.typeQualifiers }

// ResolvedIn reports which scope the identifier of cases
// PrimaryExpressionIdent, PrimaryExpressionEnum were resolved in, if any.
func (n *PrimaryExpression) ResolvedIn() Scope { return n.resolvedIn }

// ResolvedTo reports which Node the identifier of cases
// PrimaryExpressionIdent, PrimaryExpressionEnum resolved to, if any.
func (n *PrimaryExpression) ResolvedTo() Node { return n.resolvedTo }

// Promote returns the type the operands of the binary operation are promoted to.
func (n *RelationalExpression) Promote() Type { return n.promote }

// Cases returns the cases a switch statement consist of, in source order.
func (n *SelectionStatement) Cases() []*LabeledStatement { return n.cases }

// Promote returns the type the shift count operand is promoted to.
func (n *ShiftExpression) Promote() Type { return n.promote }

func (n *StructOrUnionSpecifier) Type() Type { return n.typ }

// Promote returns the type the type the switch expression is promoted to.
func (n *SelectionStatement) Promote() Type { return n.promote }

// Type returns the type of n.
func (n *TypeName) Type() Type { return n.typ }

// // LexicalScope returns the lexical scope of n.
// func (n *AttributeValue) LexicalScope() Scope { return n.lexicalScope }

// // Scope returns n's scope.
// func (n *CompoundStatement) Scope() Scope { return n.scope }

// // LexicalScope returns the lexical scope of n.
// func (n *Designator) LexicalScope() Scope { return n.lexicalScope }

// // LexicalScope returns the lexical scope of n.
// func (n *DirectDeclarator) LexicalScope() Scope { return n.lexicalScope }

// LexicalScope returns the lexical scope of n.
func (n *EnumSpecifier) LexicalScope() Scope { return n.lexicalScope }

// // LexicalScope returns the lexical scope of n.
// func (n *IdentifierList) LexicalScope() Scope { return n.lexicalScope }

// // LexicalScope returns the lexical scope of n.
// func (n *PrimaryExpression) LexicalScope() Scope { return n.lexicalScope }

// // LexicalScope returns the lexical scope of n.
// func (n *StructOrUnionSpecifier) LexicalScope() Scope { return n.lexicalScope }

// // ResolvedIn reports which scope the identifier of case
// // TypeSpecifierTypedefName was resolved in, if any.
// func (n *TypeSpecifier) ResolvedIn() Scope { return n.resolvedIn }

func (n *TypeSpecifier) list() (r []*TypeSpecifier) {
	switch n.Case {
	case TypeSpecifierAtomic:
		return n.AtomicTypeSpecifier.list
	default:
		return []*TypeSpecifier{n}
	}
}

// // LexicalScope returns the lexical scope of n.
// func (n *UnaryExpression) LexicalScope() Scope { return n.lexicalScope }

func (n *UnaryExpression) Declarator() *Declarator {
	switch n.Case {
	case UnaryExpressionPostfix: // PostfixExpression
		return n.PostfixExpression.Declarator()
	default:
		return nil
	}
}

func (n *PostfixExpression) Declarator() *Declarator {
	switch n.Case {
	case PostfixExpressionPrimary: // PrimaryExpression
		return n.PrimaryExpression.Declarator()
	default:
		return nil
	}
}

func (n *PrimaryExpression) Declarator() *Declarator {
	switch n.Case {
	case PrimaryExpressionIdent: // IDENTIFIER
		if n.Operand != nil {
			return n.Operand.Declarator()
		}

		return nil
	case PrimaryExpressionExpr: // '(' Expression ')'
		return n.Expression.Declarator()
	default:
		return nil
	}
}

func (n *Expression) Declarator() *Declarator {
	switch n.Case {
	case ExpressionAssign: // AssignmentExpression
		return n.AssignmentExpression.Declarator()
	default:
		return nil
	}
}

func (n *AssignmentExpression) Declarator() *Declarator {
	switch n.Case {
	case AssignmentExpressionCond: // ConditionalExpression
		return n.ConditionalExpression.Declarator()
	default:
		return nil
	}
}

func (n *ConditionalExpression) Declarator() *Declarator {
	switch n.Case {
	case ConditionalExpressionLOr: // LogicalOrExpression
		return n.LogicalOrExpression.Declarator()
	default:
		return nil
	}
}

func (n *LogicalOrExpression) Declarator() *Declarator {
	switch n.Case {
	case LogicalOrExpressionLAnd: // LogicalAndExpression
		return n.LogicalAndExpression.Declarator()
	default:
		return nil
	}
}

func (n *LogicalAndExpression) Declarator() *Declarator {
	switch n.Case {
	case LogicalAndExpressionOr: // InclusiveOrExpression
		return n.InclusiveOrExpression.Declarator()
	default:
		return nil
	}
}

func (n *InclusiveOrExpression) Declarator() *Declarator {
	switch n.Case {
	case InclusiveOrExpressionXor: // ExclusiveOrExpression
		return n.ExclusiveOrExpression.Declarator()
	default:
		return nil
	}
}

func (n *ExclusiveOrExpression) Declarator() *Declarator {
	switch n.Case {
	case ExclusiveOrExpressionAnd: // AndExpression
		return n.AndExpression.Declarator()
	default:
		return nil
	}
}

func (n *AndExpression) Declarator() *Declarator {
	switch n.Case {
	case AndExpressionEq: // EqualityExpression
		return n.EqualityExpression.Declarator()
	default:
		return nil
	}
}

func (n *EqualityExpression) Declarator() *Declarator {
	switch n.Case {
	case EqualityExpressionRel: // RelationalExpression
		return n.RelationalExpression.Declarator()
	default:
		return nil
	}
}

func (n *RelationalExpression) Declarator() *Declarator {
	switch n.Case {
	case RelationalExpressionShift: // ShiftExpression
		return n.ShiftExpression.Declarator()
	default:
		return nil
	}
}

func (n *ShiftExpression) Declarator() *Declarator {
	switch n.Case {
	case ShiftExpressionAdd: // AdditiveExpression
		return n.AdditiveExpression.Declarator()
	default:
		return nil
	}
}

func (n *AdditiveExpression) Declarator() *Declarator {
	switch n.Case {
	case AdditiveExpressionMul: // MultiplicativeExpression
		return n.MultiplicativeExpression.Declarator()
	default:
		return nil
	}
}

func (n *MultiplicativeExpression) Declarator() *Declarator {
	switch n.Case {
	case MultiplicativeExpressionCast: // CastExpression
		return n.CastExpression.Declarator()
	default:
		return nil
	}
}

func (n *CastExpression) Declarator() *Declarator {
	switch n.Case {
	case CastExpressionUnary: // UnaryExpression
		return n.UnaryExpression.Declarator()
	default:
		return nil
	}
}

// Has reports whether n has any of attributes in key.
func (n *AttributeSpecifier) Has(key ...StringID) (*ExpressionList, bool) {
	if n == nil {
		return nil, false
	}

	for list := n.AttributeValueList; list != nil; list = list.AttributeValueList {
		av := list.AttributeValue
		for _, k := range key {
			if av.Token.Value == k {
				switch av.Case {
				case AttributeValueIdent: // IDENTIFIER
					return nil, true
				case AttributeValueExpr: // IDENTIFIER '(' ExpressionList ')'
					return av.ExpressionList, true
				}
			}
		}
	}
	return nil, false
}

// Has reports whether n has any of attributes in key.
func (n *AttributeSpecifierList) Has(key ...StringID) (*ExpressionList, bool) {
	for ; n != nil; n = n.AttributeSpecifierList {
		if exprList, ok := n.AttributeSpecifier.Has(key...); ok {
			return exprList, ok
		}
	}
	return nil, false
}

// Parent returns the CompoundStatement that contains n, if any.
func (n *CompoundStatement) Parent() *CompoundStatement { return n.parent }

// IsJumpTarget returns whether n or any of its children contain a named
// labeled statement.
func (n *CompoundStatement) IsJumpTarget() bool { return n.isJumpTarget }

func (n *CompoundStatement) hasLabel() {
	for ; n != nil; n = n.parent {
		n.isJumpTarget = true
	}
}

// Declarations returns the list of declarations in n.
func (n *CompoundStatement) Declarations() []*Declaration { return n.declarations }

// Children returns the list of n's children.
func (n *CompoundStatement) Children() []*CompoundStatement { return n.children }

// CompoundStatements returns the list of compound statements in n.
func (n *FunctionDefinition) CompoundStatements() []*CompoundStatement { return n.compoundStatements }

// CompoundStatement returns the block containing n.
func (n *LabeledStatement) CompoundStatement() *CompoundStatement { return n.block }

// LabeledStatements returns labeled statements of n.
func (n *CompoundStatement) LabeledStatements() []*LabeledStatement { return n.labeledStmts }

// HasInitializer reports whether d has an initializator.
func (n *Declarator) HasInitializer() bool { return n.hasInitializer }

// Context reports the statement, if any, a break or continue belongs to. Valid
// only after typecheck and for n.Case == JumpStatementBreak or
// JumpStatementContinue.
func (n *JumpStatement) Context() Node { return n.context }

// IsFunctionPrototype reports whether n is a function prototype.
func (n *Declarator) IsFunctionPrototype() bool {
	return n != nil && n.Type() != nil && n.Type().Kind() == Function && !n.fnDef && !n.IsParameter
}

// DeclarationSpecifiers returns the declaration specifiers associated with n or nil.
func (n *Declarator) DeclarationSpecifiers() *DeclarationSpecifiers {
	if x, ok := n.td.(*DeclarationSpecifiers); ok {
		return x
	}

	return nil
}

// SpecifierQualifierList returns the specifier qualifer list associated with n or nil.
func (n *Declarator) SpecifierQualifierList() *SpecifierQualifierList {
	if x, ok := n.td.(*SpecifierQualifierList); ok {
		return x
	}

	return nil
}

// TypeQualifier returns the type qualifiers associated with n or nil.
func (n *Declarator) TypeQualifiers() *TypeQualifiers {
	if x, ok := n.td.(*TypeQualifiers); ok {
		return x
	}

	return nil
}

// StructDeclaration returns the struct declaration associated with n.
func (n *StructDeclarator) StructDeclaration() *StructDeclaration { return n.decl }
