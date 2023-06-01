// Copyright 2019 The CC Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package cc // import "modernc.org/cc/v3"

import (
	"bytes"
	"fmt"
	"hash/maphash"
	"strings"
)

const (
	unicodePrivateAreaFirst = 0xe000
	unicodePrivateAreaLast  = 0xf8ff
)

var (
	noDeclSpecs        = &DeclarationSpecifiers{}
	panicOnParserError bool //TODOOK

	idChar      = dict.sid("char")
	idComma     = dict.sid(",")
	idConst     = dict.sid("const")
	idEq        = dict.sid("=")
	idFFlush    = dict.sid("fflush")
	idFprintf   = dict.sid("fprintf")
	idFunc      = dict.sid("__func__")
	idLBracket  = dict.sid("[")
	idLParen    = dict.sid("(")
	idRBracket  = dict.sid("]")
	idRParen    = dict.sid(")")
	idSemicolon = dict.sid(";")
	idStatic    = dict.sid("static")
	idStderr    = dict.sid("stderr")
)

// Values of Token.Rune for lexemes.
const (
	_ = iota + unicodePrivateAreaFirst //TODOOK

	ACCUM                  // _Accum
	ADDASSIGN              // +=
	ALIGNAS                // _Alignas
	ALIGNOF                // _Alignof
	ANDAND                 // &&
	ANDASSIGN              // &=
	ARROW                  // ->
	ASM                    // __asm__
	ATOMIC                 // _Atomic
	ATTRIBUTE              // __attribute__
	AUTO                   // auto
	BOOL                   // _Bool
	BREAK                  // break
	BUILTINCHOOSEEXPR      // __builtin_choose_expr
	BUILTINTYPESCOMPATIBLE // __builtin_types_compatible_p
	CASE                   // case
	CHAR                   // char
	CHARCONST              // 'a'
	COMPLEX                // _Complex
	CONST                  // const
	CONTINUE               // continue
	DDD                    // ...
	DEC                    // --
	DECIMAL128             // _Decimal128
	DECIMAL32              // _Decimal32
	DECIMAL64              // _Decimal64
	DEFAULT                // default
	DIVASSIGN              // /=
	DO                     // do
	DOUBLE                 // double
	ELSE                   // else
	ENUM                   // enum
	ENUMCONST              // foo in enum x { foo, bar };
	EQ                     // ==
	EXTERN                 // extern
	FLOAT                  // float
	FLOAT128               // _Float128
	FLOAT16                // __fp16
	FLOAT32                // _Float32
	FLOAT32X               // _Float32x
	FLOAT64                // _Float64
	FLOAT64X               // _Float64x
	FLOAT80                // __float80
	FLOATCONST             // 1.23
	FOR                    // for
	FRACT                  // _Fract
	GEQ                    // >=
	GOTO                   // goto
	IDENTIFIER             // foo
	IF                     // if
	IMAG                   // __imag__
	INC                    // ++
	INLINE                 // inline
	INT                    // int
	INT8                   // __int8
	INT16                  // __int16
	INT32                  // __int32
	INT64                  // __int64
	INT128                 // __int128
	INTCONST               // 42
	LABEL                  // __label__
	LEQ                    // <=
	LONG                   // long
	LONGCHARCONST          // L'a'
	LONGSTRINGLITERAL      // L"foo"
	LSH                    // <<
	LSHASSIGN              // <<=
	MODASSIGN              // %=
	MULASSIGN              // *=
	NEQ                    // !=
	NORETURN               // _Noreturn
	ORASSIGN               // |=
	OROR                   // ||
	PPNUMBER               // .32e.
	PPPASTE                // ##
	PRAGMASTDC             // __pragma_stdc
	REAL                   // __real__
	REGISTER               // register
	RESTRICT               // restrict
	RETURN                 // return
	RSH                    // >>
	RSHASSIGN              // >>=
	SAT                    // _Sat
	SHORT                  // short
	SIGNED                 // signed
	SIZEOF                 // sizeof
	STATIC                 // static
	STRINGLITERAL          // "foo"
	STRUCT                 // struct
	SUBASSIGN              // -=
	SWITCH                 // switch
	THREADLOCAL            // _Thread_local
	TYPEDEF                // typedef
	TYPEDEFNAME            // int_t in typedef int int_t;
	TYPEOF                 // typeof
	UNION                  // union
	UNSIGNED               // unsigned
	VOID                   // void
	VOLATILE               // volatile
	WHILE                  // while
	XORASSIGN              // ^=

	lastTok
)

var (
	tokNames = map[rune]StringID{
		ACCUM:                  dict.sid("ACCUM"),
		ADDASSIGN:              dict.sid("ADDASSIGN"),
		ALIGNAS:                dict.sid("ALIGNAS"),
		ALIGNOF:                dict.sid("ALIGNOF"),
		ANDAND:                 dict.sid("ANDAND"),
		ANDASSIGN:              dict.sid("ANDASSIGN"),
		ARROW:                  dict.sid("ARROW"),
		ASM:                    dict.sid("ASM"),
		ATOMIC:                 dict.sid("ATOMIC"),
		ATTRIBUTE:              dict.sid("ATTRIBUTE"),
		AUTO:                   dict.sid("AUTO"),
		BOOL:                   dict.sid("BOOL"),
		BREAK:                  dict.sid("BREAK"),
		BUILTINCHOOSEEXPR:      dict.sid("BUILTINCHOOSEEXPR"),
		BUILTINTYPESCOMPATIBLE: dict.sid("BUILTINTYPESCOMPATIBLE"),
		CASE:                   dict.sid("CASE"),
		CHAR:                   dict.sid("CHAR"),
		CHARCONST:              dict.sid("CHARCONST"),
		COMPLEX:                dict.sid("COMPLEX"),
		CONST:                  dict.sid("CONST"),
		CONTINUE:               dict.sid("CONTINUE"),
		DDD:                    dict.sid("DDD"),
		DEC:                    dict.sid("DEC"),
		DECIMAL128:             dict.sid("DECIMAL128"),
		DECIMAL32:              dict.sid("DECIMAL32"),
		DECIMAL64:              dict.sid("DECIMAL64"),
		DEFAULT:                dict.sid("DEFAULT"),
		DIVASSIGN:              dict.sid("DIVASSIGN"),
		DO:                     dict.sid("DO"),
		DOUBLE:                 dict.sid("DOUBLE"),
		ELSE:                   dict.sid("ELSE"),
		ENUM:                   dict.sid("ENUM"),
		ENUMCONST:              dict.sid("ENUMCONST"),
		EQ:                     dict.sid("EQ"),
		EXTERN:                 dict.sid("EXTERN"),
		FLOAT128:               dict.sid("FLOAT128"),
		FLOAT16:                dict.sid("FLOAT16"),
		FLOAT32:                dict.sid("FLOAT32"),
		FLOAT32X:               dict.sid("FLOAT32X"),
		FLOAT64:                dict.sid("FLOAT64"),
		FLOAT64X:               dict.sid("FLOAT64X"),
		FLOAT80:                dict.sid("FLOAT80"),
		FLOAT:                  dict.sid("FLOAT"),
		FLOATCONST:             dict.sid("FLOATCONST"),
		FOR:                    dict.sid("FOR"),
		FRACT:                  dict.sid("FRACT"),
		GEQ:                    dict.sid("GEQ"),
		GOTO:                   dict.sid("GOTO"),
		IDENTIFIER:             dict.sid("IDENTIFIER"),
		IF:                     dict.sid("IF"),
		IMAG:                   dict.sid("IMAG"),
		INC:                    dict.sid("INC"),
		INLINE:                 dict.sid("INLINE"),
		INT8:                   dict.sid("INT8"),
		INT16:                  dict.sid("INT16"),
		INT32:                  dict.sid("INT32"),
		INT64:                  dict.sid("INT64"),
		INT128:                 dict.sid("INT128"),
		INT:                    dict.sid("INT"),
		INTCONST:               dict.sid("INTCONST"),
		LABEL:                  dict.sid("LABEL"),
		LEQ:                    dict.sid("LEQ"),
		LONG:                   dict.sid("LONG"),
		LONGCHARCONST:          dict.sid("LONGCHARCONST"),
		LONGSTRINGLITERAL:      dict.sid("LONGSTRINGLITERAL"),
		LSH:                    dict.sid("LSH"),
		LSHASSIGN:              dict.sid("LSHASSIGN"),
		MODASSIGN:              dict.sid("MODASSIGN"),
		MULASSIGN:              dict.sid("MULASSIGN"),
		NEQ:                    dict.sid("NEQ"),
		NORETURN:               dict.sid("NORETURN"),
		ORASSIGN:               dict.sid("ORASSIGN"),
		OROR:                   dict.sid("OROR"),
		PPNUMBER:               dict.sid("PPNUMBER"),
		PPPASTE:                dict.sid("PPPASTE"),
		PRAGMASTDC:             dict.sid("PPPRAGMASTDC"),
		REAL:                   dict.sid("REAL"),
		REGISTER:               dict.sid("REGISTER"),
		RESTRICT:               dict.sid("RESTRICT"),
		RETURN:                 dict.sid("RETURN"),
		RSH:                    dict.sid("RSH"),
		RSHASSIGN:              dict.sid("RSHASSIGN"),
		SAT:                    dict.sid("SAT"),
		SHORT:                  dict.sid("SHORT"),
		SIGNED:                 dict.sid("SIGNED"),
		SIZEOF:                 dict.sid("SIZEOF"),
		STATIC:                 dict.sid("STATIC"),
		STRINGLITERAL:          dict.sid("STRINGLITERAL"),
		STRUCT:                 dict.sid("STRUCT"),
		SUBASSIGN:              dict.sid("SUBASSIGN"),
		SWITCH:                 dict.sid("SWITCH"),
		THREADLOCAL:            dict.sid("THREADLOCAL"),
		TYPEDEF:                dict.sid("TYPEDEF"),
		TYPEDEFNAME:            dict.sid("TYPEDEFNAME"),
		TYPEOF:                 dict.sid("TYPEOF"),
		UNION:                  dict.sid("UNION"),
		UNSIGNED:               dict.sid("UNSIGNED"),
		VOID:                   dict.sid("VOID"),
		VOLATILE:               dict.sid("VOLATILE"),
		WHILE:                  dict.sid("WHILE"),
		XORASSIGN:              dict.sid("XORASSIGN"),
	}

	keywords = map[StringID]rune{

		// [0], 6.4.1
		dict.sid("auto"):     AUTO,
		dict.sid("break"):    BREAK,
		dict.sid("case"):     CASE,
		dict.sid("char"):     CHAR,
		dict.sid("const"):    CONST,
		dict.sid("continue"): CONTINUE,
		dict.sid("default"):  DEFAULT,
		dict.sid("do"):       DO,
		dict.sid("double"):   DOUBLE,
		dict.sid("else"):     ELSE,
		dict.sid("enum"):     ENUM,
		dict.sid("extern"):   EXTERN,
		dict.sid("float"):    FLOAT,
		dict.sid("for"):      FOR,
		dict.sid("goto"):     GOTO,
		dict.sid("if"):       IF,
		dict.sid("inline"):   INLINE,
		dict.sid("int"):      INT,
		dict.sid("long"):     LONG,
		dict.sid("register"): REGISTER,
		dict.sid("restrict"): RESTRICT,
		dict.sid("return"):   RETURN,
		dict.sid("short"):    SHORT,
		dict.sid("signed"):   SIGNED,
		dict.sid("sizeof"):   SIZEOF,
		dict.sid("static"):   STATIC,
		dict.sid("struct"):   STRUCT,
		dict.sid("switch"):   SWITCH,
		dict.sid("typedef"):  TYPEDEF,
		dict.sid("union"):    UNION,
		dict.sid("unsigned"): UNSIGNED,
		dict.sid("void"):     VOID,
		dict.sid("volatile"): VOLATILE,
		dict.sid("while"):    WHILE,

		dict.sid("_Alignas"):      ALIGNAS,
		dict.sid("_Alignof"):      ALIGNOF,
		dict.sid("_Atomic"):       ATOMIC,
		dict.sid("_Bool"):         BOOL,
		dict.sid("_Complex"):      COMPLEX,
		dict.sid("_Noreturn"):     NORETURN,
		dict.sid("_Thread_local"): THREADLOCAL,
		dict.sid("__alignof"):     ALIGNOF,
		dict.sid("__alignof__"):   ALIGNOF,
		dict.sid("__asm"):         ASM,
		dict.sid("__asm__"):       ASM,
		dict.sid("__attribute"):   ATTRIBUTE,
		dict.sid("__attribute__"): ATTRIBUTE,
		dict.sid("__complex"):     COMPLEX,
		dict.sid("__complex__"):   COMPLEX,
		dict.sid("__const"):       CONST,
		dict.sid("__inline"):      INLINE,
		dict.sid("__inline__"):    INLINE,
		dict.sid("__int16"):       INT16,
		dict.sid("__int32"):       INT32,
		dict.sid("__int64"):       INT64,
		dict.sid("__int8"):        INT8,
		dict.sid("__pragma_stdc"): PRAGMASTDC,
		dict.sid("__restrict"):    RESTRICT,
		dict.sid("__restrict__"):  RESTRICT,
		dict.sid("__signed"):      SIGNED,
		dict.sid("__signed__"):    SIGNED,
		dict.sid("__thread"):      THREADLOCAL,
		dict.sid("__typeof"):      TYPEOF,
		dict.sid("__typeof__"):    TYPEOF,
		dict.sid("__volatile"):    VOLATILE,
		dict.sid("__volatile__"):  VOLATILE,
		dict.sid("typeof"):        TYPEOF,
	}

	gccKeywords = map[StringID]rune{
		dict.sid("_Accum"):                       ACCUM,
		dict.sid("_Decimal128"):                  DECIMAL128,
		dict.sid("_Decimal32"):                   DECIMAL32,
		dict.sid("_Decimal64"):                   DECIMAL64,
		dict.sid("_Float128"):                    FLOAT128,
		dict.sid("_Float16"):                     FLOAT16,
		dict.sid("_Float32"):                     FLOAT32,
		dict.sid("_Float32x"):                    FLOAT32X,
		dict.sid("_Float64"):                     FLOAT64,
		dict.sid("_Float64x"):                    FLOAT64X,
		dict.sid("_Fract"):                       FRACT,
		dict.sid("_Sat"):                         SAT,
		dict.sid("__builtin_choose_expr"):        BUILTINCHOOSEEXPR,
		dict.sid("__builtin_types_compatible_p"): BUILTINTYPESCOMPATIBLE,
		dict.sid("__float80"):                    FLOAT80,
		dict.sid("__fp16"):                       FLOAT16,
		dict.sid("__imag"):                       IMAG,
		dict.sid("__imag__"):                     IMAG,
		dict.sid("__int128"):                     INT128,
		dict.sid("__label__"):                    LABEL,
		dict.sid("__real"):                       REAL,
		dict.sid("__real__"):                     REAL,
	}
)

func init() {
	for r := rune(0xe001); r < lastTok; r++ {
		if _, ok := tokNames[r]; !ok {
			panic(internalError())
		}
	}
	for k, v := range keywords {
		gccKeywords[k] = v
	}
}

func tokName(r rune) string {
	switch {
	case r < 0:
		return "<EOF>"
	case r >= unicodePrivateAreaFirst && r <= unicodePrivateAreaLast:
		return tokNames[r].String()
	default:
		return fmt.Sprintf("%+q", r)
	}
}

type parser struct {
	block        *CompoundStatement
	ctx          *context
	currFn       *FunctionDefinition
	declScope    Scope
	fileScope    Scope
	hash         *maphash.Hash
	in           chan *[]Token
	inBuf        []Token
	inBufp       *[]Token
	key          sharedFunctionDefinitionKey
	prev         Token
	resolveScope Scope
	resolvedIn   Scope // Typedef name
	scopes       int
	sepLen       int
	seps         []StringID
	strcatLen    int
	strcats      []StringID
	switches     int

	tok Token

	closed             bool
	errored            bool
	ignoreKeywords     bool
	typedefNameEnabled bool
}

func newParser(ctx *context, in chan *[]Token) *parser {
	s := Scope{}
	var hash *maphash.Hash
	if s := ctx.cfg.SharedFunctionDefinitions; s != nil {
		hash = &s.hash
	}
	return &parser{
		ctx:          ctx,
		declScope:    s,
		fileScope:    s,
		hash:         hash,
		in:           in,
		resolveScope: s,
	}
}

func (p *parser) openScope(skip bool) {
	p.scopes++
	p.declScope = p.declScope.new()
	if skip {
		p.declScope[scopeSkip] = nil
	}
	p.resolveScope = p.declScope
	// var a []string
	// for s := p.declScope; s != nil; s = s.Parent() {
	// 	a = append(a, fmt.Sprintf("%p", s))
	// }
	// trc("openScope(%v) %p: %v", skip, p.declScope, strings.Join(a, " "))
}

func (p *parser) closeScope() {
	// declScope := p.declScope
	p.declScope = p.declScope.Parent()
	p.resolveScope = p.declScope
	p.scopes--
	// var a []string
	// for s := p.declScope; s != nil; s = s.Parent() {
	// 	a = append(a, fmt.Sprintf("%p", s))
	// }
	// trc("%p.closeScope %v", declScope, strings.Join(a, " "))
}

func (p *parser) err0(consume bool, msg string, args ...interface{}) {
	if panicOnParserError { //TODOOK
		s := fmt.Sprintf("FAIL: "+msg, args...)
		panic(fmt.Sprintf("%s\n%s: ", s, PrettyString(p.tok))) //TODOOK
	}
	// s := fmt.Sprintf("FAIL: "+p.tok.Position().String()+": "+msg, args...)
	// caller("%s: %s: ", s, PrettyString(p.tok))
	p.errored = true
	if consume {
		p.tok.Rune = 0
	}
	if p.ctx.err(p.tok.Position(), "`%s`: "+msg, append([]interface{}{p.tok}, args...)...) {
		p.closed = true
	}
}

func (p *parser) err(msg string, args ...interface{}) { p.err0(true, msg, args...) }

func (p *parser) rune() rune {
	if p.tok.Rune == 0 {
		p.next()
	}
	return p.tok.Rune
}

func (p *parser) shift() (r Token) {
	if p.tok.Rune == 0 {
		p.next()
	}
	r = p.tok
	p.tok.Rune = 0
	// dbg("", shift(r))
	return r
}

func (p *parser) unget(toks ...Token) { //TODO injected __func__ has two trailing semicolons, why?
	p.inBuf = append(toks, p.inBuf...)
	// fmt.Printf("unget %q\n", tokStr(toks, "|")) //TODO-
}

func (p *parser) peek(handleTypedefname bool) rune {
	if p.closed {
		return -1
	}

	if len(p.inBuf) == 0 {
		if p.inBufp != nil {
			tokenPool.Put(p.inBufp)
		}
		var ok bool
		if p.inBufp, ok = <-p.in; !ok {
			// dbg("parser: EOF")
			return -1
		}

		p.inBuf = *p.inBufp
		// dbg("parser receives: %q", tokStr(p.inBuf, "|"))
		// fmt.Printf("parser receives %v: %q\n", p.inBuf[0].Position(), tokStr(p.inBuf, "|")) //TODO-
	}
	tok := p.inBuf[0]
	r := tok.Rune
	if r == IDENTIFIER {
		if x, ok := p.ctx.keywords[p.inBuf[0].Value]; ok && !p.ignoreKeywords {
			return x
		}

		if handleTypedefname {
			nm := tok.Value
			seq := tok.seq
			for s := p.resolveScope; s != nil; s = s.Parent() {
				for _, v := range s[nm] {
					switch x := v.(type) {
					case *Declarator:
						if !x.isVisible(seq) {
							continue
						}

						if x.IsTypedefName && p.peek(false) != ':' {
							return TYPEDEFNAME
						}

						return IDENTIFIER
					case *Enumerator:
						return IDENTIFIER
					case *EnumSpecifier, *StructOrUnionSpecifier, *StructDeclarator, *LabeledStatement:
						// nop
					default:
						panic(internalErrorf("%T", x))
					}
				}
			}
		}
	}
	return r
}

func (p *parser) next() {
	if p.closed {
		// dbg("parser: EOF")
		p.tok.Rune = -1
		return
	}

more:
	if len(p.inBuf) == 0 {
		if p.inBufp != nil {
			tokenPool.Put(p.inBufp)
		}
		var ok bool
		if p.inBufp, ok = <-p.in; !ok {
			// dbg("parser: EOF")
			p.closed = true
			p.tok.Rune = -1
			return
		}

		p.inBuf = *p.inBufp
		// dbg("parser receives: %q", tokStr(p.inBuf, "|"))
		// fmt.Printf("parser receives %v: %q\n", p.inBuf[0].Position(), tokStr(p.inBuf, "|")) //TODO-
	}
	p.tok = p.inBuf[0]
	switch p.tok.Rune {
	case STRINGLITERAL, LONGSTRINGLITERAL:
		switch p.prev.Rune {
		case STRINGLITERAL, LONGSTRINGLITERAL:
			p.strcatLen += len(p.tok.Value.String())
			p.strcats = append(p.strcats, p.tok.Value)
			p.sepLen += len(p.tok.Sep.String())
			p.seps = append(p.seps, p.tok.Sep)
			p.inBuf = p.inBuf[1:]
			goto more
		default:
			p.strcatLen = len(p.tok.Value.String())
			p.strcats = []StringID{p.tok.Value}
			p.sepLen = len(p.tok.Sep.String())
			p.seps = []StringID{p.tok.Sep}
			p.prev = p.tok
			p.inBuf = p.inBuf[1:]
			goto more
		}
	default:
		switch p.prev.Rune {
		case STRINGLITERAL, LONGSTRINGLITERAL:
			p.tok = p.prev
			var b bytes.Buffer
			b.Grow(p.strcatLen)
			for _, v := range p.strcats {
				b.WriteString(v.String())
			}
			p.tok.Value = dict.id(b.Bytes())
			b.Reset()
			b.Grow(p.sepLen)
			for _, v := range p.seps {
				b.WriteString(v.String())
			}
			p.tok.Sep = dict.id(b.Bytes())
			p.prev.Rune = 0
		default:
			p.inBuf = p.inBuf[1:]
		}
	}
	p.resolvedIn = nil
out:
	switch p.tok.Rune {
	case IDENTIFIER:
		nm := p.tok.Value
		if x, ok := p.ctx.keywords[nm]; ok && !p.ignoreKeywords {
			p.tok.Rune = x
			break
		}

		if p.typedefNameEnabled {
			seq := p.tok.seq
			// dbg("checking for typedefname in scope %p", p.resolveScope)
			for s := p.resolveScope; s != nil; s = s.Parent() {
				// dbg("scope %p", s)
				for _, v := range s[nm] {
					// dbg("%v: %T", nm, v)
					switch x := v.(type) {
					case *Declarator:
						if !x.isVisible(seq) {
							continue
						}

						// dbg("", x.isVisible(pos), x.IsTypedefName)
						if x.IsTypedefName && p.peek(false) != ':' {
							p.tok.Rune = TYPEDEFNAME
							p.resolvedIn = s
						}

						p.typedefNameEnabled = false
						break out
					case *Enumerator:
						if x.isVisible(seq) {
							break out
						}
					case *EnumSpecifier, *StructOrUnionSpecifier, *StructDeclarator, *LabeledStatement:
						// nop
					default:
						panic(internalError())
					}
				}
			}
		}
	case PPNUMBER:
		switch s := p.tok.Value.String(); {
		case strings.ContainsAny(s, ".+-ijpIJP"):
			p.tok.Rune = FLOATCONST
		case strings.HasPrefix(s, "0x") || strings.HasPrefix(s, "0X"):
			p.tok.Rune = INTCONST
		case strings.ContainsAny(s, "Ee"):
			p.tok.Rune = FLOATCONST
		default:
			p.tok.Rune = INTCONST
		}
	}
	if p.ctx.cfg.SharedFunctionDefinitions != nil {
		p.hashTok()
	}
	// dbg("parser.next p.tok %v", PrettyString(p.tok))
	// fmt.Printf("%s%s/* %s */", p.tok.Sep, p.tok.Value, tokName(p.tok.Rune)) //TODO-
}

func (p *parser) hashTok() {
	n := p.tok.Rune
	for i := 0; i < 4; i++ {
		p.hash.WriteByte(byte(n))
		n >>= 8
	}
	n = int32(p.tok.Value)
	for i := 0; i < 4; i++ {
		p.hash.WriteByte(byte(n))
		n >>= 8
	}
}

// [0], 6.5.1 Primary expressions
//
//  primary-expression:
// 	identifier
// 	constant
// 	string-literal
// 	( expression )
// 	( compound-statement )
func (p *parser) primaryExpression() *PrimaryExpression {
	var kind PrimaryExpressionCase
	var resolvedIn Scope
	var resolvedTo Node
out:
	switch p.rune() {
	case IDENTIFIER:
		kind = PrimaryExpressionIdent
		nm := p.tok.Value
		seq := p.tok.seq
		for s := p.resolveScope; s != nil; s = s.Parent() {
			for _, v := range s[nm] {
				switch x := v.(type) {
				case *Enumerator:
					if x.isVisible(seq) {
						resolvedIn = s
						resolvedTo = x
						p.tok.Rune = ENUMCONST
						kind = PrimaryExpressionEnum
						break out
					}
				case *Declarator:
					if x.IsTypedefName || !x.isVisible(seq) {
						continue
					}

					resolvedIn = s
					resolvedTo = x
					break out
				case *EnumSpecifier, *StructOrUnionSpecifier, *StructDeclarator, *LabeledStatement:
					// nop
				default:
					panic(internalError())
				}
			}
		}

		if !p.ctx.cfg.ignoreUndefinedIdentifiers && p.ctx.cfg.RejectLateBinding {
			p.err0(false, "front-end: undefined: %s", nm)
		}
	case INTCONST:
		kind = PrimaryExpressionInt
	case FLOATCONST:
		kind = PrimaryExpressionFloat
	case ENUMCONST:
		kind = PrimaryExpressionEnum
	case CHARCONST:
		kind = PrimaryExpressionChar
	case LONGCHARCONST:
		kind = PrimaryExpressionLChar
	case STRINGLITERAL:
		kind = PrimaryExpressionString
	case LONGSTRINGLITERAL:
		kind = PrimaryExpressionLString
	case '(':
		t := p.shift()
		switch p.peek(false) {
		case '{':
			if p.ctx.cfg.RejectStatementExpressions {
				p.err0(false, "statement expressions not allowed")
			}
			s := p.compoundStatement(nil, nil)
			var t2 Token
			switch p.rune() {
			case ')':
				t2 = p.shift()
			default:
				p.err("expected )")
			}
			return &PrimaryExpression{Case: PrimaryExpressionStmt, Token: t, CompoundStatement: s, Token2: t2, lexicalScope: p.declScope}
		default:
			e := p.expression()
			var t2 Token
			switch p.rune() {
			case ')':
				t2 = p.shift()
			default:
				p.err("expected )")
			}
			return &PrimaryExpression{Case: PrimaryExpressionExpr, Token: t, Expression: e, Token2: t2, lexicalScope: p.declScope}
		}
	default:
		p.err("expected primary-expression")
		return nil
	}

	return &PrimaryExpression{Case: kind, Token: p.shift(), lexicalScope: p.declScope, resolvedIn: resolvedIn, resolvedTo: resolvedTo}
}

// [0], 6.5.2 Postfix operators
//
//  postfix-expression:
// 	primary-expression
// 	postfix-expression [ expression ]
// 	postfix-expression ( argument-expression-list_opt )
// 	postfix-expression . identifier
// 	postfix-expression -> identifier
// 	postfix-expression ++
// 	postfix-expression --
// 	( type-name ) { initializer-list }
// 	( type-name ) { initializer-list , }
// 	__builtin_types_compatible_p ( type-name , type-name )
func (p *parser) postfixExpression(typ *TypeName) (r *PostfixExpression) {
	var t, t2, t3, t4, t5 Token
out:
	switch {
	case typ != nil:
		switch p.rune() {
		case '{':
			t3 = p.shift()
		default:
			p.err("expected {")
			return nil
		}

		var list *InitializerList
		switch p.rune() {
		case '}':
			if p.ctx.cfg.RejectEmptyInitializerList {
				p.err0(false, "expected initializer-list")
			}
		default:
			list = p.initializerList(nil)
			if p.rune() == ',' {
				t4 = p.shift()
			}
		}
		switch p.rune() {
		case '}':
			t5 = p.shift()
		default:
			p.err("expected }")
		}
		r = &PostfixExpression{Case: PostfixExpressionComplit, Token: t, TypeName: typ, Token2: t2, Token3: t3, InitializerList: list, Token4: t4, Token5: t5}
		break out
	default:
		switch p.rune() {
		case BUILTINCHOOSEEXPR:
			t = p.shift()
			switch p.rune() {
			case '(':
				t2 = p.shift()
			default:
				p.err("expected (")
			}
			expr1 := p.assignmentExpression()
			switch p.rune() {
			case ',':
				t3 = p.shift()
			default:
				p.err("expected ,")
			}
			expr2 := p.assignmentExpression()
			switch p.rune() {
			case ',':
				t4 = p.shift()
			default:
				p.err("expected ,")
			}
			expr3 := p.assignmentExpression()
			switch p.rune() {
			case ')':
				t5 = p.shift()
			default:
				p.err("expected )")
			}
			return &PostfixExpression{Case: PostfixExpressionChooseExpr, Token: t, Token2: t2, Token3: t3, Token4: t4, Token5: t5, AssignmentExpression: expr1, AssignmentExpression2: expr2, AssignmentExpression3: expr3}
		case BUILTINTYPESCOMPATIBLE:
			t = p.shift()
			switch p.rune() {
			case '(':
				t2 = p.shift()
			default:
				p.err("expected (")
			}
			typ := p.typeName()
			switch p.rune() {
			case ',':
				t3 = p.shift()
			default:
				p.err("expected ,")
			}
			typ2 := p.typeName()
			switch p.rune() {
			case ')':
				t4 = p.shift()
			default:
				p.err("expected )")
			}
			return &PostfixExpression{Case: PostfixExpressionTypeCmp, Token: t, Token2: t2, TypeName: typ, Token3: t3, TypeName2: typ2, Token4: t4}
		case '(':
			switch p.peek(true) {
			case VOID, CHAR, SHORT, INT, INT8, INT16, INT32, INT64, INT128, LONG, FLOAT, FLOAT16, FLOAT80, FLOAT32, FLOAT32X, FLOAT64, FLOAT64X, FLOAT128, DECIMAL32, DECIMAL64, DECIMAL128, FRACT, SAT, ACCUM, DOUBLE, SIGNED, UNSIGNED, BOOL, COMPLEX, STRUCT, UNION, ENUM, TYPEDEFNAME, TYPEOF, ATOMIC,
				ATTRIBUTE, CONST, RESTRICT, VOLATILE:
				p.typedefNameEnabled = true
				t = p.shift()
				typ := p.typeName()
				p.typedefNameEnabled = false
				switch p.rune() {
				case ')':
					t2 = p.shift()
				default:
					p.err("expected )")
				}
				switch p.rune() {
				case '{':
					t3 = p.shift()
				default:
					p.err("expected {")
				}
				var list *InitializerList
				switch p.rune() {
				case '}':
					if p.ctx.cfg.RejectEmptyInitializerList {
						p.err0(false, "expected initializer-list")
					}
				default:
					list = p.initializerList(nil)
					if p.rune() == ',' {
						t4 = p.shift()
					}
				}
				switch p.rune() {
				case '}':
					t5 = p.shift()
				default:
					p.err("expected }")
				}
				r = &PostfixExpression{Case: PostfixExpressionComplit, Token: t, TypeName: typ, Token2: t2, Token3: t3, InitializerList: list, Token4: t4, Token5: t5}
				break out
			}

			fallthrough
		default:
			pe := p.primaryExpression()
			if pe == nil {
				return nil
			}

			r = &PostfixExpression{Case: PostfixExpressionPrimary, PrimaryExpression: pe}
		}
	}

	for {
		switch p.rune() {
		case '[':
			t = p.shift()
			e := p.expression()
			switch p.rune() {
			case ']':
				t2 = p.shift()
			default:
				p.err("expected ]")
			}
			r = &PostfixExpression{Case: PostfixExpressionIndex, PostfixExpression: r, Token: t, Expression: e, Token2: t2}
		case '(':
			t = p.shift()
			list := p.argumentExpressionListOpt()
			switch p.rune() {
			case ')':
				t2 = p.shift()
			default:
				p.err("expected )")
			}
			r = &PostfixExpression{Case: PostfixExpressionCall, PostfixExpression: r, Token: t, ArgumentExpressionList: list, Token2: t2}
		case '.':
			t = p.shift()
			switch p.rune() {
			case IDENTIFIER:
				t2 = p.shift()
			default:
				p.err("expected identifier")
			}
			r = &PostfixExpression{Case: PostfixExpressionSelect, PostfixExpression: r, Token: t, Token2: t2}
		case ARROW:
			t = p.shift()
			switch p.rune() {
			case IDENTIFIER:
				t2 = p.shift()
			default:
				p.err("expected identifier")
			}
			r = &PostfixExpression{Case: PostfixExpressionPSelect, PostfixExpression: r, Token: t, Token2: t2}
		case INC:
			r = &PostfixExpression{Case: PostfixExpressionInc, PostfixExpression: r, Token: p.shift()}
		case DEC:
			r = &PostfixExpression{Case: PostfixExpressionDec, PostfixExpression: r, Token: p.shift()}
		default:
			return r
		}
	}
}

//  argument-expression-list:
// 	assignment-expression
// 	argument-expression-list , assignment-expression
func (p *parser) argumentExpressionListOpt() (r *ArgumentExpressionList) {
	if p.rune() == ')' {
		return nil
	}

	e := p.assignmentExpression()
	if e == nil {
		return nil
	}

	r = &ArgumentExpressionList{AssignmentExpression: e}
	for prev := r; ; prev = prev.ArgumentExpressionList {
		switch p.rune() {
		case ',':
			t := p.shift()
			prev.ArgumentExpressionList = &ArgumentExpressionList{Token: t, AssignmentExpression: p.assignmentExpression()}
		case ')':
			return r
		default:
			p.err("expected , or )")
			return r
		}
	}
}

// [0], 6.5.3 Unary operators
//
//  unary-expression:
// 	postfix-expression
// 	++ unary-expression
// 	-- unary-expression
// 	unary-operator cast-expression
// 	sizeof unary-expression
// 	sizeof ( type-name )
// 	&& identifier
// 	_Alignof unary-expression
// 	_Alignof ( type-name )
// 	__imag__ unary-expression
// 	__real__ unary-expression
//
//  unary-operator: one of
// 	& * + - ~ !
func (p *parser) unaryExpression(typ *TypeName) *UnaryExpression {
	if typ != nil {
		return &UnaryExpression{Case: UnaryExpressionPostfix, PostfixExpression: p.postfixExpression(typ), lexicalScope: p.declScope}
	}

	var kind UnaryExpressionCase
	var t, t2, t3 Token
	switch p.rune() {
	case INC:
		t = p.shift()
		return &UnaryExpression{Case: UnaryExpressionInc, Token: t, UnaryExpression: p.unaryExpression(nil), lexicalScope: p.declScope}
	case DEC:
		t = p.shift()
		return &UnaryExpression{Case: UnaryExpressionDec, Token: t, UnaryExpression: p.unaryExpression(nil), lexicalScope: p.declScope}
	case '&':
		kind = UnaryExpressionAddrof
	case '*':
		kind = UnaryExpressionDeref
	case '+':
		kind = UnaryExpressionPlus
	case '-':
		kind = UnaryExpressionMinus
	case '~':
		kind = UnaryExpressionCpl
	case '!':
		kind = UnaryExpressionNot
	case SIZEOF:
		t = p.shift()
		switch p.rune() {
		case '(':
			switch p.peek(true) {
			case VOID, CHAR, SHORT, INT, INT8, INT16, INT32, INT64, INT128, LONG, FLOAT, FLOAT16, FLOAT80, FLOAT32, FLOAT32X, FLOAT64, FLOAT64X, FLOAT128, DECIMAL32, DECIMAL64, DECIMAL128, FRACT, SAT, ACCUM, DOUBLE, SIGNED, UNSIGNED, BOOL, COMPLEX, STRUCT, UNION, ENUM, TYPEDEFNAME, TYPEOF, ATOMIC,
				ATTRIBUTE, CONST, RESTRICT, VOLATILE:
				p.typedefNameEnabled = true
				t2 = p.shift()
				typ := p.typeName()
				p.typedefNameEnabled = false
				switch p.rune() {
				case ')':
					t3 = p.shift()
				default:
					p.err("expected )")
				}
				if p.peek(false) == '{' {
					return &UnaryExpression{Case: UnaryExpressionSizeofExpr, Token: t, UnaryExpression: p.unaryExpression(typ), lexicalScope: p.declScope}
				}

				return &UnaryExpression{Case: UnaryExpressionSizeofType, Token: t, Token2: t2, TypeName: typ, Token3: t3, lexicalScope: p.declScope}
			}

			fallthrough
		default:
			return &UnaryExpression{Case: UnaryExpressionSizeofExpr, Token: t, UnaryExpression: p.unaryExpression(nil), lexicalScope: p.declScope}
		}
	case ANDAND:
		t = p.shift()
		var t2 Token
		switch p.rune() {
		case IDENTIFIER:
			t2 = p.shift()
		default:
			p.err("expected identifier")
		}
		return &UnaryExpression{Case: UnaryExpressionLabelAddr, Token: t, Token2: t2, lexicalScope: p.declScope}
	case ALIGNOF:
		t = p.shift()
		switch p.rune() {
		case '(':
			switch p.peek(true) {
			case VOID, CHAR, SHORT, INT, INT8, INT16, INT32, INT64, INT128, LONG, FLOAT, FLOAT16, FLOAT80, FLOAT32, FLOAT32X, FLOAT64, FLOAT64X, FLOAT128, DECIMAL32, DECIMAL64, DECIMAL128, FRACT, SAT, ACCUM, DOUBLE, SIGNED, UNSIGNED, BOOL, COMPLEX, STRUCT, UNION, ENUM, TYPEDEFNAME, TYPEOF, ATOMIC,
				ATTRIBUTE, CONST, RESTRICT, VOLATILE,
				ALIGNAS:
				t2 = p.shift()
				typ := p.typeName()
				switch p.rune() {
				case ')':
					t3 = p.shift()
				default:
					p.err("expected )")
				}
				return &UnaryExpression{Case: UnaryExpressionAlignofType, Token: t, Token2: t2, TypeName: typ, Token3: t2, lexicalScope: p.declScope}
			default:
				return &UnaryExpression{Case: UnaryExpressionAlignofExpr, Token: t, UnaryExpression: p.unaryExpression(nil), lexicalScope: p.declScope}
			}
		default:
			return &UnaryExpression{Case: UnaryExpressionAlignofExpr, Token: t, UnaryExpression: p.unaryExpression(nil), lexicalScope: p.declScope}
		}
	case IMAG:
		t = p.shift()
		return &UnaryExpression{Case: UnaryExpressionImag, Token: t, UnaryExpression: p.unaryExpression(nil), lexicalScope: p.declScope}
	case REAL:
		t = p.shift()
		return &UnaryExpression{Case: UnaryExpressionReal, Token: t, UnaryExpression: p.unaryExpression(nil), lexicalScope: p.declScope}
	default:
		return &UnaryExpression{Case: UnaryExpressionPostfix, PostfixExpression: p.postfixExpression(nil), lexicalScope: p.declScope}
	}

	t = p.shift()
	return &UnaryExpression{Case: kind, Token: t, CastExpression: p.castExpression(), lexicalScope: p.declScope}
}

// [0], 6.5.4 Cast operators
//
//  cast-expression:
// 	unary-expression
// 	( type-name ) cast-expression
func (p *parser) castExpression() *CastExpression {
	var t, t2 Token
	switch p.rune() {
	case '(':
		switch p.peek(true) {
		case VOID, CHAR, SHORT, INT, INT8, INT16, INT32, INT64, INT128, LONG, FLOAT, FLOAT16, FLOAT80, FLOAT32, FLOAT32X, FLOAT64, FLOAT64X, FLOAT128, DECIMAL32, DECIMAL64, DECIMAL128, FRACT, SAT, ACCUM, DOUBLE, SIGNED, UNSIGNED, BOOL, COMPLEX, STRUCT, UNION, ENUM, TYPEDEFNAME, TYPEOF, ATOMIC,
			ATTRIBUTE, CONST, RESTRICT, VOLATILE:
			p.typedefNameEnabled = true
			t = p.shift()
			typ := p.typeName()
			p.typedefNameEnabled = false
			switch p.rune() {
			case ')':
				t2 = p.shift()
			default:
				p.err("expected )")
			}
			if p.peek(false) == '{' {
				return &CastExpression{Case: CastExpressionUnary, UnaryExpression: p.unaryExpression(typ)}
			}

			return &CastExpression{Case: CastExpressionCast, Token: t, TypeName: typ, Token2: t2, CastExpression: p.castExpression()}
		}

		fallthrough
	default:
		return &CastExpression{Case: CastExpressionUnary, UnaryExpression: p.unaryExpression(nil)}
	}
}

// [0], 6.5.5 Multiplicative operators
//
//  multiplicative-expression:
// 	cast-expression
// 	multiplicative-expression * cast-expression
// 	multiplicative-expression / cast-expression
// 	multiplicative-expression % cast-expression
func (p *parser) multiplicativeExpression() (r *MultiplicativeExpression) {
	r = &MultiplicativeExpression{Case: MultiplicativeExpressionCast, CastExpression: p.castExpression()}
	for {
		var kind MultiplicativeExpressionCase
		switch p.rune() {
		case '*':
			kind = MultiplicativeExpressionMul
		case '/':
			kind = MultiplicativeExpressionDiv
		case '%':
			kind = MultiplicativeExpressionMod
		default:
			return r
		}

		t := p.shift()
		r = &MultiplicativeExpression{Case: kind, MultiplicativeExpression: r, Token: t, CastExpression: p.castExpression()}
	}
}

// [0], 6.5.6 Additive operators
//
//  additive-expression:
// 	multiplicative-expression
// 	additive-expression + multiplicative-expression
// 	additive-expression - multiplicative-expression
func (p *parser) additiveExpression() (r *AdditiveExpression) {
	r = &AdditiveExpression{Case: AdditiveExpressionMul, MultiplicativeExpression: p.multiplicativeExpression()}
	for {
		var kind AdditiveExpressionCase
		switch p.rune() {
		case '+':
			kind = AdditiveExpressionAdd
		case '-':
			kind = AdditiveExpressionSub
		default:
			return r
		}

		t := p.shift()
		r = &AdditiveExpression{Case: kind, AdditiveExpression: r, Token: t, MultiplicativeExpression: p.multiplicativeExpression(), lexicalScope: p.declScope}
	}
}

// [0], 6.5.7 Bitwise shift operators
//
//  shift-expression:
// 	additive-expression
// 	shift-expression << additive-expression
// 	shift-expression >> additive-expression
func (p *parser) shiftExpression() (r *ShiftExpression) {
	r = &ShiftExpression{Case: ShiftExpressionAdd, AdditiveExpression: p.additiveExpression()}
	for {
		var kind ShiftExpressionCase
		switch p.rune() {
		case LSH:
			kind = ShiftExpressionLsh
		case RSH:
			kind = ShiftExpressionRsh
		default:
			return r
		}

		t := p.shift()
		r = &ShiftExpression{Case: kind, ShiftExpression: r, Token: t, AdditiveExpression: p.additiveExpression()}
	}
}

// [0], 6.5.8 Relational operators
//
//  relational-expression:
// 	shift-expression
// 	relational-expression <  shift-expression
// 	relational-expression >  shift-expression
// 	relational-expression <= shift-expression
// 	relational-expression >= shift-expression
func (p *parser) relationalExpression() (r *RelationalExpression) {
	r = &RelationalExpression{Case: RelationalExpressionShift, ShiftExpression: p.shiftExpression()}
	for {
		var kind RelationalExpressionCase
		switch p.rune() {
		case '<':
			kind = RelationalExpressionLt
		case '>':
			kind = RelationalExpressionGt
		case LEQ:
			kind = RelationalExpressionLeq
		case GEQ:
			kind = RelationalExpressionGeq
		default:
			return r
		}

		t := p.shift()
		r = &RelationalExpression{Case: kind, RelationalExpression: r, Token: t, ShiftExpression: p.shiftExpression()}
	}
}

// [0], 6.5.9 Equality operators
//
//  equality-expression:
// 	relational-expression
// 	equality-expression == relational-expression
// 	equality-expression != relational-expression
func (p *parser) equalityExpression() (r *EqualityExpression) {
	r = &EqualityExpression{Case: EqualityExpressionRel, RelationalExpression: p.relationalExpression()}
	for {
		var kind EqualityExpressionCase
		switch p.rune() {
		case EQ:
			kind = EqualityExpressionEq
		case NEQ:
			kind = EqualityExpressionNeq
		default:
			return r
		}

		t := p.shift()
		r = &EqualityExpression{Case: kind, EqualityExpression: r, Token: t, RelationalExpression: p.relationalExpression()}
	}
}

// [0], 6.5.10 Bitwise AND operator
//
//  AND-expression:
// 	equality-expression
// 	AND-expression & equality-expression
func (p *parser) andExpression() (r *AndExpression) {
	r = &AndExpression{Case: AndExpressionEq, EqualityExpression: p.equalityExpression()}
	for {
		switch p.rune() {
		case '&':
			t := p.shift()
			r = &AndExpression{Case: AndExpressionAnd, AndExpression: r, Token: t, EqualityExpression: p.equalityExpression()}
		default:
			return r
		}
	}
}

// [0], 6.5.11 Bitwise exclusive OR operator
//
//  exclusive-OR-expression:
// 	AND-expression
// 	exclusive-OR-expression ^ AND-expression
func (p *parser) exclusiveOrExpression() (r *ExclusiveOrExpression) {
	r = &ExclusiveOrExpression{Case: ExclusiveOrExpressionAnd, AndExpression: p.andExpression()}
	for {
		switch p.rune() {
		case '^':
			t := p.shift()
			r = &ExclusiveOrExpression{Case: ExclusiveOrExpressionXor, ExclusiveOrExpression: r, Token: t, AndExpression: p.andExpression()}
		default:
			return r
		}
	}
}

// [0], 6.5.12 Bitwise inclusive OR operator
//
//  inclusive-OR-expression:
// 	exclusive-OR-expression
// 	inclusive-OR-expression | exclusive-OR-expression
func (p *parser) inclusiveOrExpression() (r *InclusiveOrExpression) {
	r = &InclusiveOrExpression{Case: InclusiveOrExpressionXor, ExclusiveOrExpression: p.exclusiveOrExpression()}
	for {
		switch p.rune() {
		case '|':
			t := p.shift()
			r = &InclusiveOrExpression{Case: InclusiveOrExpressionOr, InclusiveOrExpression: r, Token: t, ExclusiveOrExpression: p.exclusiveOrExpression()}
		default:
			return r
		}
	}
}

// [0], 6.5.13 Logical AND operator
//
//  logical-AND-expression:
// 	inclusive-OR-expression
// 	logical-AND-expression && inclusive-OR-expression
func (p *parser) logicalAndExpression() (r *LogicalAndExpression) {
	r = &LogicalAndExpression{Case: LogicalAndExpressionOr, InclusiveOrExpression: p.inclusiveOrExpression()}
	for {
		switch p.rune() {
		case ANDAND:
			t := p.shift()
			r = &LogicalAndExpression{Case: LogicalAndExpressionLAnd, LogicalAndExpression: r, Token: t, InclusiveOrExpression: p.inclusiveOrExpression()}
		default:
			return r
		}
	}
}

// [0], 6.5.14 Logical OR operator
//
//  logical-OR-expression:
// 	logical-AND-expression
// 	logical-OR-expression || logical-AND-expression
func (p *parser) logicalOrExpression() (r *LogicalOrExpression) {
	r = &LogicalOrExpression{Case: LogicalOrExpressionLAnd, LogicalAndExpression: p.logicalAndExpression()}
	for {
		switch p.rune() {
		case OROR:
			t := p.shift()
			r = &LogicalOrExpression{Case: LogicalOrExpressionLOr, LogicalOrExpression: r, Token: t, LogicalAndExpression: p.logicalAndExpression()}
		default:
			return r
		}
	}
}

// [0], 6.5.15 Conditional operator
//
//  conditional-expression:
// 	logical-OR-expression
// 	logical-OR-expression ? expression : conditional-expression
func (p *parser) conditionalExpression() (r *ConditionalExpression) {
	lo := p.logicalOrExpression()
	var t, t2 Token
	switch p.rune() {
	case '?':
		t = p.shift()
		var e *Expression
		switch p.rune() {
		case ':':
			if p.ctx.cfg.RejectMissingConditionalExpr {
				p.err("expected expression")
			}
		default:
			e = p.expression()
		}
		switch p.rune() {
		case ':':
			t2 = p.shift()
		default:
			p.err("expected :")
		}
		return &ConditionalExpression{Case: ConditionalExpressionCond, LogicalOrExpression: lo, Token: t, Expression: e, Token2: t2, ConditionalExpression: p.conditionalExpression()}
	default:
		return &ConditionalExpression{Case: ConditionalExpressionLOr, LogicalOrExpression: lo}
	}
}

// [0], 6.5.16 Assignment operators
//
//  assignment-expression:
// 	conditional-expression
// 	unary-expression assignment-operator assignment-expression
//
//  assignment-operator: one of
// 	= *= /= %= += -= <<= >>= &= ^= |=
func (p *parser) assignmentExpression() (r *AssignmentExpression) {
	ce := p.conditionalExpression()
	if ce == nil || ce.Case != ConditionalExpressionLOr {
		return &AssignmentExpression{Case: AssignmentExpressionCond, ConditionalExpression: ce, lexicalScope: p.declScope}
	}

	loe := ce.LogicalOrExpression
	if loe == nil || loe.Case != LogicalOrExpressionLAnd {
		return &AssignmentExpression{Case: AssignmentExpressionCond, ConditionalExpression: ce, lexicalScope: p.declScope}
	}

	lae := loe.LogicalAndExpression
	if lae == nil || lae.Case != LogicalAndExpressionOr {
		return &AssignmentExpression{Case: AssignmentExpressionCond, ConditionalExpression: ce, lexicalScope: p.declScope}
	}

	ioe := lae.InclusiveOrExpression
	if ioe == nil || ioe.Case != InclusiveOrExpressionXor {
		return &AssignmentExpression{Case: AssignmentExpressionCond, ConditionalExpression: ce, lexicalScope: p.declScope}
	}

	eoe := ioe.ExclusiveOrExpression
	if eoe == nil || eoe.Case != ExclusiveOrExpressionAnd {
		return &AssignmentExpression{Case: AssignmentExpressionCond, ConditionalExpression: ce, lexicalScope: p.declScope}
	}

	ae := eoe.AndExpression
	if ae == nil || ae.Case != AndExpressionEq {
		return &AssignmentExpression{Case: AssignmentExpressionCond, ConditionalExpression: ce, lexicalScope: p.declScope}
	}

	ee := ae.EqualityExpression
	if ee == nil || ee.Case != EqualityExpressionRel {
		return &AssignmentExpression{Case: AssignmentExpressionCond, ConditionalExpression: ce, lexicalScope: p.declScope}
	}

	re := ee.RelationalExpression
	if re == nil || re.Case != RelationalExpressionShift {
		return &AssignmentExpression{Case: AssignmentExpressionCond, ConditionalExpression: ce, lexicalScope: p.declScope}
	}

	se := re.ShiftExpression
	if se == nil || se.Case != ShiftExpressionAdd {
		return &AssignmentExpression{Case: AssignmentExpressionCond, ConditionalExpression: ce, lexicalScope: p.declScope}
	}

	adde := se.AdditiveExpression
	if adde == nil || adde.Case != AdditiveExpressionMul {
		return &AssignmentExpression{Case: AssignmentExpressionCond, ConditionalExpression: ce, lexicalScope: p.declScope}
	}

	me := adde.MultiplicativeExpression
	if me == nil || me.Case != MultiplicativeExpressionCast {
		return &AssignmentExpression{Case: AssignmentExpressionCond, ConditionalExpression: ce, lexicalScope: p.declScope}
	}

	cast := me.CastExpression
	if cast == nil || cast.Case != CastExpressionUnary {
		return &AssignmentExpression{Case: AssignmentExpressionCond, ConditionalExpression: ce, lexicalScope: p.declScope}
	}

	var kind AssignmentExpressionCase
	switch p.rune() {
	case '=':
		kind = AssignmentExpressionAssign
	case MULASSIGN:
		kind = AssignmentExpressionMul
	case DIVASSIGN:
		kind = AssignmentExpressionDiv
	case MODASSIGN:
		kind = AssignmentExpressionMod
	case ADDASSIGN:
		kind = AssignmentExpressionAdd
	case SUBASSIGN:
		kind = AssignmentExpressionSub
	case LSHASSIGN:
		kind = AssignmentExpressionLsh
	case RSHASSIGN:
		kind = AssignmentExpressionRsh
	case ANDASSIGN:
		kind = AssignmentExpressionAnd
	case XORASSIGN:
		kind = AssignmentExpressionXor
	case ORASSIGN:
		kind = AssignmentExpressionOr
	default:
		return &AssignmentExpression{Case: AssignmentExpressionCond, ConditionalExpression: ce, lexicalScope: p.declScope}
	}

	t := p.shift()
	return &AssignmentExpression{Case: kind, UnaryExpression: cast.UnaryExpression, Token: t, AssignmentExpression: p.assignmentExpression(), lexicalScope: p.declScope}
}

// [0], 6.5.17 Comma operator
//
//  expression:
// 	assignment-expression
// 	expression , assignment-expression
func (p *parser) expression() (r *Expression) {
	r = &Expression{Case: ExpressionAssign, AssignmentExpression: p.assignmentExpression()}
	for {
		switch p.rune() {
		case ',':
			t := p.shift()
			r = &Expression{Case: ExpressionComma, Expression: r, Token: t, AssignmentExpression: p.assignmentExpression()}
		default:
			return r
		}
	}
}

// [0], 6.6 Constant expressions
//
//  constant-expression:
// 	conditional-expression
func (p *parser) constantExpression() (r *ConstantExpression) {
	return &ConstantExpression{ConditionalExpression: p.conditionalExpression()}
}

// [0], 6.7 Declarations
//
//  declaration:
// 	declaration-specifiers init-declarator-list_opt attribute-specifier-list_opt ;
func (p *parser) declaration(ds *DeclarationSpecifiers, d *Declarator) (r *Declaration) {
	defer func() {
		if cs := p.block; cs != nil && r != nil {
			cs.declarations = append(cs.declarations, r)
		}
	}()

	if ds == nil {
		ds = p.declarationSpecifiers(nil, nil)
	}
	if ds == noDeclSpecs {
		ds = nil
	}
	if d == nil {
		switch p.rune() {
		case ';':
			p.typedefNameEnabled = true
			return &Declaration{DeclarationSpecifiers: ds, Token: p.shift()}
		}
	}

	list := p.initDeclaratorList(d, ds.typedef())
	p.typedefNameEnabled = true
	var t Token
	switch p.rune() {
	case ';':
		t = p.shift()
	default:
		p.err("expected ;")
	}
	return &Declaration{DeclarationSpecifiers: ds, InitDeclaratorList: list, Token: t}
}

//  declaration-specifiers:
// 	storage-class-specifier declaration-specifiers_opt
// 	type-specifier declaration-specifiers_opt
// 	type-qualifier declaration-specifiers_opt
// 	function-specifier declaration-specifiers_opt
//	alignment-specifier declaration-specifiers_opt
//	attribute-specifier declaration-specifiers_opt
func (p *parser) declarationSpecifiers(extern, inline *bool) (r *DeclarationSpecifiers) {
	switch p.rune() {
	case TYPEDEF, EXTERN, STATIC, AUTO, REGISTER, THREADLOCAL:
		if extern != nil && p.rune() == EXTERN {
			*extern = true
		}
		r = &DeclarationSpecifiers{Case: DeclarationSpecifiersStorage, StorageClassSpecifier: p.storageClassSpecifier()}
		if r.StorageClassSpecifier.Case == StorageClassSpecifierTypedef {
			r.class = fTypedef
		}
	case VOID, CHAR, SHORT, INT, INT8, INT16, INT32, INT64, INT128, LONG, FLOAT, FLOAT16, FLOAT80, FLOAT32, FLOAT32X, FLOAT64, FLOAT64X, FLOAT128, DECIMAL32, DECIMAL64, DECIMAL128, FRACT, SAT, ACCUM, DOUBLE, SIGNED, UNSIGNED, BOOL, COMPLEX, STRUCT, UNION, ENUM, TYPEDEFNAME, TYPEOF:
		r = &DeclarationSpecifiers{Case: DeclarationSpecifiersTypeSpec, TypeSpecifier: p.typeSpecifier()}
	case CONST, RESTRICT, VOLATILE:
		r = &DeclarationSpecifiers{Case: DeclarationSpecifiersTypeQual, TypeQualifier: p.typeQualifier()}
	case INLINE, NORETURN:
		r = &DeclarationSpecifiers{Case: DeclarationSpecifiersFunc, FunctionSpecifier: p.functionSpecifier(inline)}
	case ALIGNAS:
		r = &DeclarationSpecifiers{Case: DeclarationSpecifiersAlignSpec, AlignmentSpecifier: p.alignmentSpecifier()}
	case ATOMIC:
		switch p.peek(false) {
		case '(':
			r = &DeclarationSpecifiers{Case: DeclarationSpecifiersTypeSpec, TypeSpecifier: p.typeSpecifier()}
		default:
			r = &DeclarationSpecifiers{Case: DeclarationSpecifiersTypeQual, TypeQualifier: p.typeQualifier()}
		}
	case ATTRIBUTE:
		r = &DeclarationSpecifiers{Case: DeclarationSpecifiersAttribute, AttributeSpecifier: p.attributeSpecifier()}
	default:
		p.err("expected declaration-specifiers")
		return nil
	}
	r0 := r
	for prev := r; ; prev = prev.DeclarationSpecifiers {
		switch p.rune() {
		case TYPEDEF, EXTERN, STATIC, AUTO, REGISTER, THREADLOCAL:
			if extern != nil && p.rune() == EXTERN {
				*extern = true
			}
			prev.DeclarationSpecifiers = &DeclarationSpecifiers{Case: DeclarationSpecifiersStorage, StorageClassSpecifier: p.storageClassSpecifier()}
			if prev.DeclarationSpecifiers.StorageClassSpecifier.Case == StorageClassSpecifierTypedef {
				r0.class |= fTypedef
			}
		case VOID, CHAR, SHORT, INT, INT8, INT16, INT32, INT64, INT128, LONG, FLOAT, FLOAT16, FLOAT80, FLOAT32, FLOAT32X, FLOAT64, FLOAT64X, FLOAT128, DECIMAL32, DECIMAL64, DECIMAL128, FRACT, SAT, ACCUM, DOUBLE, SIGNED, UNSIGNED, BOOL, COMPLEX, STRUCT, UNION, ENUM, TYPEDEFNAME, TYPEOF:
			prev.DeclarationSpecifiers = &DeclarationSpecifiers{Case: DeclarationSpecifiersTypeSpec, TypeSpecifier: p.typeSpecifier()}
		case CONST, RESTRICT, VOLATILE:
			prev.DeclarationSpecifiers = &DeclarationSpecifiers{Case: DeclarationSpecifiersTypeQual, TypeQualifier: p.typeQualifier()}
		case INLINE, NORETURN:
			prev.DeclarationSpecifiers = &DeclarationSpecifiers{Case: DeclarationSpecifiersFunc, FunctionSpecifier: p.functionSpecifier(inline)}
		case ALIGNAS:
			prev.DeclarationSpecifiers = &DeclarationSpecifiers{Case: DeclarationSpecifiersAlignSpec, AlignmentSpecifier: p.alignmentSpecifier()}
		case ATOMIC:
			switch p.peek(false) {
			case '(':
				prev.DeclarationSpecifiers = &DeclarationSpecifiers{Case: DeclarationSpecifiersTypeSpec, TypeSpecifier: p.typeSpecifier()}
			default:
				prev.DeclarationSpecifiers = &DeclarationSpecifiers{Case: DeclarationSpecifiersTypeQual, TypeQualifier: p.typeQualifier()}
			}
		case ATTRIBUTE:
			prev.DeclarationSpecifiers = &DeclarationSpecifiers{Case: DeclarationSpecifiersAttribute, AttributeSpecifier: p.attributeSpecifier()}
		default:
			return r
		}
	}
}

//  init-declarator-list:
// 	init-declarator
// 	init-declarator-list , attribute-specifier-list_opt init-declarator
func (p *parser) initDeclaratorList(d *Declarator, isTypedefName bool) (r *InitDeclaratorList) {
	r = &InitDeclaratorList{InitDeclarator: p.initDeclarator(d, isTypedefName)}
	for prev := r; ; prev = prev.InitDeclaratorList {
		switch p.rune() {
		case ',':
			t := p.shift()
			attr := p.attributeSpecifierListOpt()
			// if attr != nil {
			// 	trc("%v: ATTRS", attr.Position())
			// }
			prev.InitDeclaratorList = &InitDeclaratorList{Token: t, AttributeSpecifierList: attr, InitDeclarator: p.initDeclarator(nil, isTypedefName)}
		default:
			return r
		}
	}
}

func (p *parser) attributeSpecifierListOpt() (r *AttributeSpecifierList) {
	if p.rune() == ATTRIBUTE {
		r = p.attributeSpecifierList()
	}
	return r
}

//  init-declarator:
// 	declarator attribute-specifier-list_opt
// 	declarator attribute-specifier-list_opt = initializer
func (p *parser) initDeclarator(d *Declarator, isTypedefName bool) *InitDeclarator {
	if d == nil {
		d = p.declarator(true, isTypedefName, nil)
	}
	attr := p.attributeSpecifierListOpt()
	// if attr != nil {
	// 	trc("%v: ATTRS", attr.Position())
	// }
	switch p.rune() {
	case '=':
		t := p.shift()
		return &InitDeclarator{Case: InitDeclaratorInit, Declarator: d, AttributeSpecifierList: attr, Token: t, Initializer: p.initializer(nil)}
	}

	return &InitDeclarator{Case: InitDeclaratorDecl, Declarator: d, AttributeSpecifierList: attr}
}

// [0], 6.7.1 Storage-class specifiers
//
//  storage-class-specifier:
// 	typedef
// 	extern
// 	static
// 	auto
// 	register
func (p *parser) storageClassSpecifier() *StorageClassSpecifier {
	var kind StorageClassSpecifierCase
	switch p.rune() {
	case TYPEDEF:
		kind = StorageClassSpecifierTypedef
	case EXTERN:
		kind = StorageClassSpecifierExtern
	case STATIC:
		kind = StorageClassSpecifierStatic
	case AUTO:
		kind = StorageClassSpecifierAuto
	case REGISTER:
		kind = StorageClassSpecifierRegister
	case THREADLOCAL:
		kind = StorageClassSpecifierThreadLocal
	default:
		p.err("expected storage-class-specifier")
		return nil
	}

	return &StorageClassSpecifier{Case: kind, Token: p.shift()}
}

// [0], 6.7.2 Type specifiers
//
//  type-specifier:
// 	void
// 	char
// 	short
// 	int
// 	long
// 	float
// 	__fp16
// 	__float80
// 	double
// 	signed
// 	unsigned
// 	_Bool
// 	_Complex
// 	_Float128
// 	struct-or-union-specifier
// 	enum-specifier
// 	typedef-name
// 	typeof ( expression )
// 	typeof ( type-name )
//	atomic-type-specifier
//	_Frac
//	_Sat
//	_Accum
// 	_Float32
func (p *parser) typeSpecifier() *TypeSpecifier {
	var kind TypeSpecifierCase
	switch p.rune() {
	case VOID:
		kind = TypeSpecifierVoid
	case CHAR:
		kind = TypeSpecifierChar
	case SHORT:
		kind = TypeSpecifierShort
	case INT:
		kind = TypeSpecifierInt
	case INT8:
		kind = TypeSpecifierInt8
	case INT16:
		kind = TypeSpecifierInt16
	case INT32:
		kind = TypeSpecifierInt32
	case INT64:
		kind = TypeSpecifierInt64
	case INT128:
		kind = TypeSpecifierInt128
	case LONG:
		kind = TypeSpecifierLong
	case FLOAT:
		kind = TypeSpecifierFloat
	case FLOAT16:
		kind = TypeSpecifierFloat16
	case FLOAT80:
		kind = TypeSpecifierFloat80
	case FLOAT32:
		kind = TypeSpecifierFloat32
	case FLOAT32X:
		kind = TypeSpecifierFloat32x
	case FLOAT64:
		kind = TypeSpecifierFloat64
	case FLOAT64X:
		kind = TypeSpecifierFloat64x
	case FLOAT128:
		kind = TypeSpecifierFloat128
	case DECIMAL32:
		kind = TypeSpecifierDecimal32
	case DECIMAL64:
		kind = TypeSpecifierDecimal64
	case DECIMAL128:
		kind = TypeSpecifierDecimal128
	case DOUBLE:
		kind = TypeSpecifierDouble
	case SIGNED:
		kind = TypeSpecifierSigned
	case UNSIGNED:
		kind = TypeSpecifierUnsigned
	case BOOL:
		kind = TypeSpecifierBool
	case COMPLEX:
		kind = TypeSpecifierComplex
	case FRACT:
		kind = TypeSpecifierFract
	case SAT:
		kind = TypeSpecifierSat
	case ACCUM:
		kind = TypeSpecifierAccum
	case TYPEDEFNAME:
		kind = TypeSpecifierTypedefName
	case STRUCT, UNION:
		r := &TypeSpecifier{Case: TypeSpecifierStructOrUnion, StructOrUnionSpecifier: p.structOrUnionSpecifier()}
		p.typedefNameEnabled = false
		return r
	case ENUM:
		r := &TypeSpecifier{Case: TypeSpecifierEnum, EnumSpecifier: p.enumSpecifier()}
		p.typedefNameEnabled = false
		return r
	case TYPEOF:
		var t, t2, t3 Token
		t = p.shift()
		switch p.rune() {
		case '(':
			t2 = p.shift()
		default:
			p.err("expected (")
		}
		switch p.rune() {
		case VOID, CHAR, SHORT, INT, INT8, INT16, INT32, INT64, INT128, LONG, FLOAT, FLOAT16, FLOAT80, FLOAT32, FLOAT32X, FLOAT64, FLOAT64X, FLOAT128, DECIMAL32, DECIMAL64, DECIMAL128, FRACT, SAT, ACCUM, DOUBLE, SIGNED, UNSIGNED, BOOL, COMPLEX, STRUCT, UNION, ENUM, TYPEDEFNAME, TYPEOF, ATOMIC,
			ATTRIBUTE, CONST, RESTRICT, VOLATILE,
			ALIGNAS:
			typ := p.typeName()
			switch p.rune() {
			case ')':
				t3 = p.shift()
			default:
				p.err("expected )")
			}
			return &TypeSpecifier{Case: TypeSpecifierTypeofType, Token: t, Token2: t2, TypeName: typ, Token3: t3}
		default:
			e := p.expression()
			switch p.rune() {
			case ')':
				t3 = p.shift()
			default:
				p.err("expected )")
			}
			return &TypeSpecifier{Case: TypeSpecifierTypeofExpr, Token: t, Token2: t2, Expression: e, Token3: t3}
		}
	case ATOMIC:
		return &TypeSpecifier{Case: TypeSpecifierAtomic, AtomicTypeSpecifier: p.atomicTypeSpecifier()}
	default:
		p.err("expected type-specifier")
		return nil
	}

	p.typedefNameEnabled = false
	return &TypeSpecifier{Case: kind, Token: p.shift(), resolvedIn: p.resolvedIn}
}

// [0], 6.7.2.1 Structure and union specifiers
//
//  struct-or-union-specifier:
// 	struct-or-union attribute-specifier-list_opt identifier_opt { struct-declaration-list }
// 	struct-or-union attribute-specifier-list_opt identifier
func (p *parser) structOrUnionSpecifier() *StructOrUnionSpecifier {
	switch p.rune() {
	case STRUCT, UNION:
	default:
		p.err("expected struct-or-union-specifier")
		return nil
	}

	sou := p.structOrUnion()
	attr := p.attributeSpecifierListOpt()
	// if attr != nil {
	// 	trc("%v: ATTRS", attr.Position())
	// }
	var t, t2, t3 Token
	switch p.rune() {
	case IDENTIFIER:
		t = p.shift()
		if p.rune() != '{' {
			return &StructOrUnionSpecifier{Case: StructOrUnionSpecifierTag, StructOrUnion: sou, AttributeSpecifierList: attr, Token: t, lexicalScope: p.declScope}
		}

		fallthrough
	case '{':
		maxAlign := p.ctx.maxAlign
		p.openScope(true)
		p.typedefNameEnabled = true
		p.resolveScope = p.declScope.Parent()
		t2 = p.shift()
		var list *StructDeclarationList
		switch p.peek(false) {
		case '}':
			if p.ctx.cfg.RejectEmptyStructs {
				p.err("expected struct-declarator-list")
			}
		default:
			list = p.structDeclarationList()
		}
		p.closeScope()
		switch p.rune() {
		case '}':
			t3 = p.shift()
		default:
			p.err("expected }")
		}
		r := &StructOrUnionSpecifier{Case: StructOrUnionSpecifierDef, StructOrUnion: sou, AttributeSpecifierList: attr, Token: t, Token2: t2, StructDeclarationList: list, Token3: t3, lexicalScope: p.declScope, maxAlign: maxAlign}
		if t.Value != 0 {
			p.declScope.declare(t.Value, r)
		}
		return r
	default:
		p.err("expected identifier or {")
		return nil
	}
}

//  struct-or-union:
// 	struct
// 	union
func (p *parser) structOrUnion() *StructOrUnion {
	var kind StructOrUnionCase
	switch p.rune() {
	case STRUCT:
		kind = StructOrUnionStruct
	case UNION:
		kind = StructOrUnionUnion
	default:
		p.err("expected struct-or-union")
		return nil
	}

	p.typedefNameEnabled = false
	return &StructOrUnion{Case: kind, Token: p.shift()}
}

//  struct-declaration-list:
// 	struct-declaration
// 	struct-declaration-list struct-declaration
func (p *parser) structDeclarationList() (r *StructDeclarationList) {
	r = &StructDeclarationList{StructDeclaration: p.structDeclaration()}
	for prev := r; ; prev = prev.StructDeclarationList {
		switch p.rune() {
		case VOID, CHAR, SHORT, INT, INT8, INT16, INT32, INT64, INT128, LONG, FLOAT, FLOAT16, FLOAT80, FLOAT32, FLOAT32X, FLOAT64, FLOAT64X, FLOAT128, DECIMAL32, DECIMAL64, DECIMAL128, FRACT, SAT, ACCUM, DOUBLE, SIGNED, UNSIGNED, BOOL, COMPLEX, STRUCT, UNION, ENUM, TYPEDEFNAME, TYPEOF, ATOMIC,
			ATTRIBUTE, CONST, RESTRICT, VOLATILE,
			ALIGNAS:
			prev.StructDeclarationList = &StructDeclarationList{StructDeclaration: p.structDeclaration()}
		case ';':
			p.shift()
			if p.ctx.cfg.RejectEmptyFields {
				p.err("expected struct-declaration")
			}
		default:
			return r
		}
	}
}

//  struct-declaration:
// 	specifier-qualifier-list struct-declarator-list ;
func (p *parser) structDeclaration() (r *StructDeclaration) {
	if p.rune() == ';' {
		if p.ctx.cfg.RejectEmptyStructDeclaration {
			p.err("expected struct-declaration")
		}
		return &StructDeclaration{Empty: true, Token: p.shift()}
	}
	sql := p.specifierQualifierList()
	r = &StructDeclaration{SpecifierQualifierList: sql}
	switch p.rune() {
	case ';':
		if p.ctx.cfg.RejectAnonymousFields {
			p.err("expected struct-declarator")
		}
	default:
		r.StructDeclaratorList = p.structDeclaratorList(r)
	}
	var t Token
	p.typedefNameEnabled = true
	switch p.rune() {
	case '}':
		if p.ctx.cfg.RejectMissingFinalStructFieldSemicolon {
			p.err0(false, "expected ;")
		}
	case ';':
		t = p.shift()
	default:
		p.err("expected ;")
	}
	r.Token = t
	return r
}

//  specifier-qualifier-list:
// 	type-specifier specifier-qualifier-list_opt
// 	type-qualifier specifier-qualifier-list_opt
// 	alignment-specifier-qualifier-list_opt
func (p *parser) specifierQualifierList() (r *SpecifierQualifierList) {
	switch p.rune() {
	case VOID, CHAR, SHORT, INT, INT8, INT16, INT32, INT64, INT128, LONG, FLOAT, FLOAT16, FLOAT80, FLOAT32, FLOAT32X, FLOAT64, FLOAT64X, FLOAT128, DECIMAL32, DECIMAL64, DECIMAL128, FRACT, SAT, ACCUM, DOUBLE, SIGNED, UNSIGNED, BOOL, COMPLEX, STRUCT, UNION, ENUM, TYPEDEFNAME, TYPEOF:
		r = &SpecifierQualifierList{Case: SpecifierQualifierListTypeSpec, TypeSpecifier: p.typeSpecifier()}
	case CONST, RESTRICT, VOLATILE:
		r = &SpecifierQualifierList{Case: SpecifierQualifierListTypeQual, TypeQualifier: p.typeQualifier()}
	case ALIGNAS:
		r = &SpecifierQualifierList{Case: SpecifierQualifierListAlignSpec, AlignmentSpecifier: p.alignmentSpecifier()}
	case ATOMIC:
		switch p.peek(false) {
		case '(':
			r = &SpecifierQualifierList{Case: SpecifierQualifierListTypeSpec, TypeSpecifier: p.typeSpecifier()}
		default:
			r = &SpecifierQualifierList{Case: SpecifierQualifierListTypeQual, TypeQualifier: p.typeQualifier()}
		}
	case ATTRIBUTE:
		r = &SpecifierQualifierList{Case: SpecifierQualifierListAttribute, AttributeSpecifier: p.attributeSpecifier()}
	default:
		p.err("expected specifier-qualifier-list: %s", tokName(p.rune()))
		return nil
	}
	for prev := r; ; prev = prev.SpecifierQualifierList {
		switch p.rune() {
		case VOID, CHAR, SHORT, INT, INT8, INT16, INT32, INT64, INT128, LONG, FLOAT, FLOAT16, FLOAT80, FLOAT32, FLOAT32X, FLOAT64, FLOAT64X, FLOAT128, DECIMAL32, DECIMAL64, DECIMAL128, FRACT, SAT, ACCUM, DOUBLE, SIGNED, UNSIGNED, BOOL, COMPLEX, STRUCT, UNION, ENUM, TYPEDEFNAME, TYPEOF:
			prev.SpecifierQualifierList = &SpecifierQualifierList{Case: SpecifierQualifierListTypeSpec, TypeSpecifier: p.typeSpecifier()}
		case CONST, RESTRICT, VOLATILE:
			prev.SpecifierQualifierList = &SpecifierQualifierList{Case: SpecifierQualifierListTypeQual, TypeQualifier: p.typeQualifier()}
		case ALIGNAS:
			prev.SpecifierQualifierList = &SpecifierQualifierList{Case: SpecifierQualifierListAlignSpec, AlignmentSpecifier: p.alignmentSpecifier()}
		case ATOMIC:
			switch p.peek(false) {
			case '(':
				prev.SpecifierQualifierList = &SpecifierQualifierList{Case: SpecifierQualifierListTypeSpec, TypeSpecifier: p.typeSpecifier()}
			default:
				prev.SpecifierQualifierList = &SpecifierQualifierList{Case: SpecifierQualifierListTypeQual, TypeQualifier: p.typeQualifier()}
			}
		case ATTRIBUTE:
			prev.SpecifierQualifierList = &SpecifierQualifierList{Case: SpecifierQualifierListAttribute, AttributeSpecifier: p.attributeSpecifier()}
		default:
			return r
		}
	}
}

//  struct-declarator-list:
// 	struct-declarator
// 	struct-declarator-list , struct-declarator
func (p *parser) structDeclaratorList(decl *StructDeclaration) (r *StructDeclaratorList) {
	r = &StructDeclaratorList{StructDeclarator: p.structDeclarator(decl)}
	for prev := r; ; prev = prev.StructDeclaratorList {
		switch p.rune() {
		case ',':
			t := p.shift()
			prev.StructDeclaratorList = &StructDeclaratorList{Token: t, StructDeclarator: p.structDeclarator(decl)}
		default:
			return r
		}
	}
}

//  struct-declarator:
// 	declarator
// 	declarator_opt : constant-expression attribute-specifier-list_opt
func (p *parser) structDeclarator(decl *StructDeclaration) (r *StructDeclarator) {
	var d *Declarator
	if p.rune() != ':' {
		d = p.declarator(false, false, nil)
	}

	switch p.rune() {
	case ':':
		t := p.shift()
		r = &StructDeclarator{Case: StructDeclaratorBitField, Declarator: d, Token: t, ConstantExpression: p.constantExpression(), decl: decl}
		r.AttributeSpecifierList = p.attributeSpecifierListOpt()
		// if r.AttributeSpecifierList != nil {
		// 	trc("%v: ATTRS", r.AttributeSpecifierList.Position())
		// }
	default:
		r = &StructDeclarator{Case: StructDeclaratorDecl, Declarator: d, decl: decl}
	}
	if d != nil {
		p.declScope.declare(d.Name(), r)
	}
	return r
}

// [0], 6.7.2.2 Enumeration specifiers
//
//  enum-specifier:
// 	enum attribute-specifier-list_opt identifier_opt { enumerator-list }
// 	enum attribute-specifier-list_opt identifier_opt { enumerator-list , }
// 	enum attribute-specifier-list_opt identifier
func (p *parser) enumSpecifier() *EnumSpecifier {
	if p.rune() != ENUM {
		p.err("expected enum")
		return nil
	}

	var t, t2, t3, t4, t5 Token
	p.typedefNameEnabled = false
	t = p.shift()
	attr := p.attributeSpecifierListOpt()
	// if attr != nil {
	// 	trc("%v: ATTRS", attr.Position())
	// }
	if p.rune() == IDENTIFIER {
		t2 = p.shift()
		if p.rune() != '{' {
			return &EnumSpecifier{Case: EnumSpecifierTag, AttributeSpecifierList: attr, Token: t, Token2: t2, lexicalScope: p.declScope}
		}
	}

	if p.rune() != '{' {
		p.err("expected identifier or {")
		return nil
	}

	p.typedefNameEnabled = false
	t3 = p.shift()
	list := p.enumeratorList()
	if p.rune() == ',' {
		t4 = p.shift()
	}

	switch p.rune() {
	case '}':
		t5 = p.shift()
	default:
		p.err("expected }")
	}
	r := &EnumSpecifier{Case: EnumSpecifierDef, AttributeSpecifierList: attr, Token: t, Token2: t2, Token3: t3, EnumeratorList: list, Token4: t4, Token5: t5, lexicalScope: p.declScope}
	if t2.Value != 0 {
		p.declScope.declare(t2.Value, r)
	}
	return r
}

//  enumerator-list:
// 	enumerator
// 	enumerator-list , enumerator
func (p *parser) enumeratorList() *EnumeratorList {
	r := &EnumeratorList{Enumerator: p.enumerator()}
	for prev := r; ; prev = prev.EnumeratorList {
		switch p.rune() {
		case ',':
			if p.peek(false) == '}' {
				return r
			}

			t := p.shift()
			prev.EnumeratorList = &EnumeratorList{Token: t, Enumerator: p.enumerator()}
		default:
			return r
		}
	}
}

//  enumerator:
// 	enumeration-constant attribute-specifier-list_opt
// 	enumeration-constant attribute-specifier-list_opt = constant-expression
func (p *parser) enumerator() (r *Enumerator) {
	if p.rune() != IDENTIFIER {
		p.err("expected enumeration-constant")
		return nil
	}

	t := p.shift()
	attr := p.attributeSpecifierListOpt()
	// if attr != nil {
	// 	trc("%v: ATTRS", attr.Position())
	// }
	if p.rune() != '=' {
		r = &Enumerator{Case: EnumeratorIdent, Token: t, AttributeSpecifierList: attr, lexicalScope: p.declScope}
		p.declScope.declare(t.Value, r)
		return r
	}

	t2 := p.shift()
	r = &Enumerator{Case: EnumeratorExpr, Token: t, AttributeSpecifierList: attr, Token2: t2, ConstantExpression: p.constantExpression(), lexicalScope: p.declScope}
	p.declScope.declare(t.Value, r)
	return r
}

// [2], 6.7.2.4 Atomic type specifiers
//
//  atomic-type-specifier:
// 	_Atomic ( type-name )
func (p *parser) atomicTypeSpecifier() *AtomicTypeSpecifier {
	if p.rune() != ATOMIC {
		p.err("expected _Atomic")
		return nil
	}

	t := p.shift()
	var t2, t3 Token
	switch p.rune() {
	case '(':
		t2 = p.shift()
	default:
		p.err("expected (")
	}
	typ := p.typeName()
	switch p.rune() {
	case ')':
		t3 = p.shift()
	default:
		p.err("expected )")
	}
	return &AtomicTypeSpecifier{Token: t, Token2: t2, TypeName: typ, Token3: t3}
}

// [0], 6.7.3 Type qualifiers
//
//  type-qualifier:
// 	const
// 	restrict
// 	volatile
// 	_Atomic
func (p *parser) typeQualifier() *TypeQualifier {
	switch p.rune() {
	case CONST:
		return &TypeQualifier{Case: TypeQualifierConst, Token: p.shift()}
	case RESTRICT:
		return &TypeQualifier{Case: TypeQualifierRestrict, Token: p.shift()}
	case VOLATILE:
		return &TypeQualifier{Case: TypeQualifierVolatile, Token: p.shift()}
	case ATOMIC:
		return &TypeQualifier{Case: TypeQualifierAtomic, Token: p.shift()}
	default:
		p.err("expected type-qualifier")
		return nil
	}
}

// [0], 6.7.4 Function specifiers
//
//  function-specifier:
// 	inline
// 	_Noreturn
func (p *parser) functionSpecifier(inline *bool) *FunctionSpecifier {
	switch p.rune() {
	case INLINE:
		if inline != nil {
			*inline = true
		}
		return &FunctionSpecifier{Case: FunctionSpecifierInline, Token: p.shift()}
	case NORETURN:
		return &FunctionSpecifier{Case: FunctionSpecifierNoreturn, Token: p.shift()}
	default:
		p.err("expected function-specifier")
		return nil
	}
}

// [0], 6.7.5 Declarators
//
//  declarator:
// 	pointer_opt direct-declarator attribute-specifier-list_opt
func (p *parser) declarator(declare, isTypedefName bool, ptr *Pointer) *Declarator {
	if ptr == nil && (p.rune() == '*' || p.rune() == '^') {
		ptr = p.pointer()
	}
	r := &Declarator{IsTypedefName: isTypedefName, Pointer: ptr, DirectDeclarator: p.directDeclarator(nil)}
	r.AttributeSpecifierList = p.attributeSpecifierListOpt()
	// if r.AttributeSpecifierList != nil {
	// 	trc("%v: ATTRS", r.AttributeSpecifierList.Position())
	// }
	if declare {
		p.declScope.declare(r.Name(), r)
	}
	return r
}

// [2], 6.7.5 Alignment specifier
//
// alignment-specifier:
// 	_Alignas ( type-name )
// 	_Alignas ( constant-expression )
func (p *parser) alignmentSpecifier() *AlignmentSpecifier {
	if p.rune() != ALIGNAS {
		p.err("expected _Alignas")
		return nil
	}

	t := p.shift()
	var t2, t3 Token
	switch p.rune() {
	case '(':
		t2 = p.shift()
	default:
		p.err("expected (")
	}
	switch p.rune() {
	case VOID, CHAR, SHORT, INT, INT8, INT16, INT32, INT64, INT128, LONG, FLOAT, FLOAT16, FLOAT80, FLOAT32, FLOAT32X, FLOAT64, FLOAT64X, FLOAT128, DECIMAL32, DECIMAL64, DECIMAL128, FRACT, SAT, ACCUM, DOUBLE, SIGNED, UNSIGNED, BOOL, COMPLEX, STRUCT, UNION, ENUM, TYPEDEFNAME, TYPEOF, ATOMIC,
		ATTRIBUTE, CONST, RESTRICT, VOLATILE,
		ALIGNAS:
		typ := p.typeName()
		switch p.rune() {
		case ')':
			t3 = p.shift()
		default:
			p.err("expected )")
		}
		return &AlignmentSpecifier{Case: AlignmentSpecifierAlignasType, Token: t, Token2: t2, TypeName: typ, Token3: t3}
	default:
		e := p.constantExpression()
		switch p.rune() {
		case ')':
			t3 = p.shift()
		default:
			p.err("expected )")
		}
		return &AlignmentSpecifier{Case: AlignmentSpecifierAlignasExpr, Token: t, Token2: t2, ConstantExpression: e, Token3: t3}
	}
}

//  direct-declarator:
// 	identifier asm_opt
// 	( attribute-specifier-list_opt declarator )
// 	direct-declarator [ type-qualifier-list_opt assignment-expression_opt ]
// 	direct-declarator [ static type-qualifier-list_opt assignment-expression ]
// 	direct-declarator [ type-qualifier-list static assignment-expression ]
// 	direct-declarator [ type-qualifier-list_opt * ]
// 	direct-declarator ( parameter-type-list )
// 	direct-declarator ( identifier-list_opt )
func (p *parser) directDeclarator(d *DirectDeclarator) (r *DirectDeclarator) {
	switch {
	case d != nil:
		r = d
	default:
		switch p.rune() {
		case IDENTIFIER:
			t := p.shift()
			var a *Asm
			if p.rune() == ASM {
				a = p.asm()
			}
			r = &DirectDeclarator{Case: DirectDeclaratorIdent, Token: t, Asm: a, lexicalScope: p.declScope}
		case '(':
			t := p.shift()
			attr := p.attributeSpecifierListOpt()
			// if attr != nil {
			// 	trc("%v: ATTRS", attr.Position())
			// }
			d := p.declarator(false, false, nil)
			var t2 Token
			switch p.rune() {
			case ')':
				t2 = p.shift()
			default:
				p.err("expected )")
			}
			r = &DirectDeclarator{Case: DirectDeclaratorDecl, Token: t, AttributeSpecifierList: attr, Declarator: d, Token2: t2, lexicalScope: p.declScope}
		default:
			p.err("expected direct-declarator")
			return nil
		}
	}

	var t, t2, t3 Token
	for {
		var e *AssignmentExpression
		switch p.rune() {
		case '[':
			t = p.shift()
			switch p.rune() {
			case ']':
				t2 = p.shift()
				r = &DirectDeclarator{Case: DirectDeclaratorArr, DirectDeclarator: r, Token: t, Token2: t2, lexicalScope: p.declScope}
			case ATTRIBUTE, CONST, RESTRICT, VOLATILE, ATOMIC: // type-qualifier
				list := p.typeQualifierList()
				switch p.rune() {
				case STATIC:
					t2 = p.shift()
					e = p.assignmentExpression()
					switch p.rune() {
					case ']':
						t3 = p.shift()
					default:
						p.err("expected ]")
					}
					r = &DirectDeclarator{Case: DirectDeclaratorArrStatic, DirectDeclarator: r, Token: t, TypeQualifiers: list, Token2: t2, AssignmentExpression: e, Token3: t3, lexicalScope: p.declScope}
				case ']':
					r = &DirectDeclarator{Case: DirectDeclaratorArr, DirectDeclarator: r, Token: t, TypeQualifiers: list, Token2: p.shift(), lexicalScope: p.declScope}
				case '*':
					switch p.peek(false) {
					case ']':
						t2 = p.shift()
						r = &DirectDeclarator{Case: DirectDeclaratorStar, DirectDeclarator: r, Token: t, TypeQualifiers: list, Token2: t2, Token3: p.shift(), lexicalScope: p.declScope}
					default:
						e = p.assignmentExpression()
						switch p.rune() {
						case ']':
							t2 = p.shift()
						default:
							p.err("expected ]")
						}
						r = &DirectDeclarator{Case: DirectDeclaratorArr, DirectDeclarator: r, Token: t, TypeQualifiers: list, AssignmentExpression: e, Token2: t2, lexicalScope: p.declScope}
					}
				default:
					e = p.assignmentExpression()
					switch p.rune() {
					case ']':
						t2 = p.shift()
					default:
						p.err("expected ]")
					}
					r = &DirectDeclarator{Case: DirectDeclaratorArr, DirectDeclarator: r, Token: t, TypeQualifiers: list, AssignmentExpression: e, Token2: t2, lexicalScope: p.declScope}
				}
			case STATIC:
				t2 := p.shift()
				var list *TypeQualifiers
				switch p.peek(false) {
				case ATTRIBUTE, CONST, RESTRICT, VOLATILE, ATOMIC:
					list = p.typeQualifierList()
				}
				e := p.assignmentExpression()
				switch p.rune() {
				case ']':
					t3 = p.shift()
				default:
					p.err("expected ]")
				}
				r = &DirectDeclarator{Case: DirectDeclaratorStaticArr, DirectDeclarator: r, Token: t, Token2: t2, TypeQualifiers: list, AssignmentExpression: e, Token3: t3, lexicalScope: p.declScope}
			case '*':
				if p.peek(false) == ']' {
					t2 = p.shift()
					r = &DirectDeclarator{Case: DirectDeclaratorStar, DirectDeclarator: r, Token: t, Token2: t2, Token3: p.shift(), lexicalScope: p.declScope}
					break
				}

				fallthrough
			default:
				e = p.assignmentExpression()
				switch p.rune() {
				case ']':
					t2 = p.shift()
				default:
					p.err("expected ]")
				}
				r = &DirectDeclarator{Case: DirectDeclaratorArr, DirectDeclarator: r, Token: t, AssignmentExpression: e, Token2: t2, lexicalScope: p.declScope}
			}
		case '(':
			p.openScope(false)
			p.typedefNameEnabled = true
			t = p.shift()
			paramScope := p.declScope
			switch p.rune() {
			case IDENTIFIER:
				list := p.identifierList()
				p.closeScope()
				p.typedefNameEnabled = true
				switch p.rune() {
				case ')':
					t2 = p.shift()
				default:
					p.err("expected )")
				}
				r = &DirectDeclarator{Case: DirectDeclaratorFuncIdent, DirectDeclarator: r, Token: t, IdentifierList: list, Token2: t2, paramScope: paramScope, lexicalScope: p.declScope}
			case ')':
				p.closeScope()
				p.typedefNameEnabled = true
				r = &DirectDeclarator{Case: DirectDeclaratorFuncIdent, DirectDeclarator: r, Token: t, Token2: p.shift(), paramScope: paramScope, lexicalScope: p.declScope}
			default:
				list := p.parameterTypeList()
				p.closeScope()
				p.typedefNameEnabled = true
				switch p.rune() {
				case ')':
					t2 = p.shift()
				default:
					p.err("expected )")
				}
				r = &DirectDeclarator{Case: DirectDeclaratorFuncParam, DirectDeclarator: r, Token: t, ParameterTypeList: list, Token2: t2, paramScope: paramScope, lexicalScope: p.declScope}
			}
		default:
			return r
		}
	}
}

//  pointer:
// 	* type-qualifier-list_opt
// 	* type-qualifier-list_opt pointer
//      ^ type-qualifier-list_opt
func (p *parser) pointer() (r *Pointer) {
	if p.rune() == '^' {
		t := p.shift()
		var list *TypeQualifiers
		switch p.rune() {
		case ATTRIBUTE, CONST, RESTRICT, VOLATILE, ATOMIC:
			list = p.typeQualifierList()
		}

		return &Pointer{Case: PointerBlock, Token: t, TypeQualifiers: list}
	}

	if p.rune() != '*' {
		p.err("expected * or ^")
		return nil
	}

	t := p.shift()
	var list *TypeQualifiers
	switch p.rune() {
	case ATTRIBUTE, CONST, RESTRICT, VOLATILE, ATOMIC:
		list = p.typeQualifierList()
	}

	switch p.rune() {
	case '*':
		return &Pointer{Case: PointerPtr, Token: t, TypeQualifiers: list, Pointer: p.pointer()}
	default:
		return &Pointer{Case: PointerTypeQual, Token: t, TypeQualifiers: list}
	}
}

//  type-qualifier-list:
// 	type-qualifier
// 	attribute-specifier
// 	type-qualifier-list type-qualifier
// 	type-qualifier-list attribute-specifier
func (p *parser) typeQualifierList() (r *TypeQualifiers) {
	switch p.rune() {
	case ATTRIBUTE:
		r = &TypeQualifiers{Case: TypeQualifiersAttribute, AttributeSpecifier: p.attributeSpecifier()}
	default:
		r = &TypeQualifiers{Case: TypeQualifiersTypeQual, TypeQualifier: p.typeQualifier()}
	}
	for prev := r; ; prev = prev.TypeQualifiers {
		switch p.rune() {
		case ATTRIBUTE:
			prev.TypeQualifiers = &TypeQualifiers{Case: TypeQualifiersAttribute, AttributeSpecifier: p.attributeSpecifier()}
		case CONST, RESTRICT, VOLATILE, ATOMIC:
			prev.TypeQualifiers = &TypeQualifiers{TypeQualifier: p.typeQualifier()}
		default:
			return r
		}
	}
}

//  parameter-type-list:
// 	parameter-list
// 	parameter-list , ...
func (p *parser) parameterTypeList() *ParameterTypeList {
	list := p.parameterList()
	switch p.rune() {
	case ',':
		t := p.shift()
		var t2 Token
		switch p.rune() {
		case DDD:
			t2 = p.shift()
		default:
			p.err("expected ...")
		}
		return &ParameterTypeList{Case: ParameterTypeListVar, ParameterList: list, Token: t, Token2: t2}
	default:
		return &ParameterTypeList{Case: ParameterTypeListList, ParameterList: list}
	}
}

//  parameter-list:
// 	parameter-declaration
// 	parameter-list , parameter-declaration
func (p *parser) parameterList() (r *ParameterList) {
	r = &ParameterList{ParameterDeclaration: p.parameterDeclaration()}
	for prev := r; ; prev = prev.ParameterList {
		switch p.rune() {
		case ';':
			if p.ctx.cfg.RejectParamSemicolon {
				p.err0(false, "expected ,")
			}
			fallthrough
		case ',':
			if p.peek(false) == DDD {
				return r
			}

			p.typedefNameEnabled = true
			t := p.shift()
			prev.ParameterList = &ParameterList{Token: t, ParameterDeclaration: p.parameterDeclaration()}
		default:
			return r
		}
	}
}

//  parameter-declaration:
// 	declaration-specifiers declarator attribute-specifier-list_opt
// 	declaration-specifiers abstract-declarator_opt
func (p *parser) parameterDeclaration() *ParameterDeclaration {
	ds := p.declarationSpecifiers(nil, nil)
	switch p.rune() {
	case ',', ')':
		r := &ParameterDeclaration{Case: ParameterDeclarationAbstract, DeclarationSpecifiers: ds}
		return r
	default:
		switch x := p.declaratorOrAbstractDeclarator(ds.typedef()).(type) {
		case *AbstractDeclarator:
			return &ParameterDeclaration{Case: ParameterDeclarationAbstract, DeclarationSpecifiers: ds, AbstractDeclarator: x}
		case *Declarator:
			p.declScope.declare(x.Name(), x)
			attr := p.attributeSpecifierListOpt()
			// if attr != nil {
			// 	trc("%v: ATTRS", attr.Position())
			// }
			return &ParameterDeclaration{Case: ParameterDeclarationDecl, DeclarationSpecifiers: ds, Declarator: x, AttributeSpecifierList: attr}
		default:
			panic(internalError())
		}
	}
}

func (p *parser) declaratorOrAbstractDeclarator(isTypedefName bool) (r Node) {
	var ptr *Pointer
	switch p.rune() {
	case '*', '^':
		ptr = p.pointer()
	}
	switch p.rune() {
	case IDENTIFIER:
		return p.declarator(false, isTypedefName, ptr)
	case '[':
		return p.abstractDeclarator(ptr)
	case '(':
		switch p.peek(true) {
		case ')':
			t := p.shift()
			t2 := p.shift()
			return &AbstractDeclarator{
				Case:    AbstractDeclaratorDecl,
				Pointer: ptr,
				DirectAbstractDeclarator: p.directAbstractDeclarator(
					&DirectAbstractDeclarator{
						Case:   DirectAbstractDeclaratorFunc,
						Token:  t,
						Token2: t2,
					},
				),
			}
		case TYPEDEF, EXTERN, STATIC, AUTO, REGISTER, THREADLOCAL,
			VOID, CHAR, SHORT, INT, INT8, INT16, INT32, INT64, INT128, LONG, FLOAT, FLOAT16, FLOAT80, FLOAT32, FLOAT32X, FLOAT64, FLOAT64X, FLOAT128, DECIMAL32, DECIMAL64, DECIMAL128, FRACT, SAT, ACCUM, DOUBLE, SIGNED, UNSIGNED, BOOL, COMPLEX, STRUCT, UNION, ENUM, TYPEDEFNAME, TYPEOF, ATOMIC,
			CONST, RESTRICT, VOLATILE,
			INLINE, NORETURN, ATTRIBUTE,
			ALIGNAS:
			p.openScope(false)
			paramScope := p.declScope
			p.typedefNameEnabled = true
			t := p.shift()
			list := p.parameterTypeList()
			p.closeScope()
			p.typedefNameEnabled = true
			var t2 Token
			switch p.rune() {
			case ')':
				t2 = p.shift()
			default:
				p.err("expected )")
			}
			return &AbstractDeclarator{
				Case:    AbstractDeclaratorDecl,
				Pointer: ptr,
				DirectAbstractDeclarator: p.directAbstractDeclarator(
					&DirectAbstractDeclarator{
						Case:              DirectAbstractDeclaratorFunc,
						Token:             t,
						ParameterTypeList: list,
						Token2:            t2,
						paramScope:        paramScope,
					},
				),
			}
		}

		t := p.shift()
		switch x := p.declaratorOrAbstractDeclarator(isTypedefName).(type) {
		case *AbstractDeclarator:
			var t2 Token
			switch p.rune() {
			case ')':
				t2 = p.shift()
			default:
				p.err("expected )")
			}
			return &AbstractDeclarator{
				Case:    AbstractDeclaratorDecl,
				Pointer: ptr,
				DirectAbstractDeclarator: p.directAbstractDeclarator(
					&DirectAbstractDeclarator{
						Case:               DirectAbstractDeclaratorDecl,
						Token:              t,
						AbstractDeclarator: x,
						Token2:             t2,
					},
				),
			}
		case *Declarator:
			var t2 Token
			switch p.rune() {
			case ')':
				t2 = p.shift()
			default:
				p.err("expected )")
			}
			return &Declarator{
				Pointer: ptr,
				DirectDeclarator: p.directDeclarator(
					&DirectDeclarator{
						Case:       DirectDeclaratorDecl,
						Token:      t,
						Declarator: x,
						Token2:     t2,
					},
				),
			}
		default:
			panic(internalError())
		}
	case ')', ',':
		return p.abstractDeclarator(ptr)
	default:
		p.err("unexpected %s", p.tok.Value)
		return p.abstractDeclarator(ptr)
	}
}

//  identifier-list:
// 	identifier
// 	identifier-list , identifier
func (p *parser) identifierList() (r *IdentifierList) {
	switch p.rune() {
	case IDENTIFIER:
		r = &IdentifierList{Token: p.shift(), lexicalScope: p.declScope}
	default:
		p.err("expected identifier")
		return nil
	}

	for prev := r; p.rune() == ','; prev = prev.IdentifierList {
		t := p.shift()
		var t2 Token
		switch p.rune() {
		case IDENTIFIER:
			t2 = p.shift()
		default:
			p.err("expected identifier")
		}
		prev.IdentifierList = &IdentifierList{Token: t, Token2: t2, lexicalScope: p.declScope}
	}
	return r
}

// [0], 6.7.6 Type names
//
//  type-name:
// 	specifier-qualifier-list abstract-declarator_opt
func (p *parser) typeName() *TypeName {
	p.typedefNameEnabled = true
	list := p.specifierQualifierList()
	switch p.rune() {
	case ')', ',':
		return &TypeName{SpecifierQualifierList: list}
	case '*', '(', '[':
		return &TypeName{SpecifierQualifierList: list, AbstractDeclarator: p.abstractDeclarator(nil)}
	default:
		p.err("expected ) or * or ( or [ or ,")
		return &TypeName{SpecifierQualifierList: list}
	}
}

//  abstract-declarator:
// 	pointer
// 	pointer_opt direct-abstract-declarator
func (p *parser) abstractDeclarator(ptr *Pointer) *AbstractDeclarator {
	if ptr == nil && (p.rune() == '*' || p.rune() == '^') {
		ptr = p.pointer()
	}
	switch p.rune() {
	case '[', '(':
		return &AbstractDeclarator{Case: AbstractDeclaratorDecl, Pointer: ptr, DirectAbstractDeclarator: p.directAbstractDeclarator(nil)}
	default:
		return &AbstractDeclarator{Case: AbstractDeclaratorPtr, Pointer: ptr}
	}
}

//  direct-abstract-declarator:
// 	( abstract-declarator )
// 	direct-abstract-declarator_opt [ type-qualifier-list_opt assignment-expression_opt ]
// 	direct-abstract-declarator_opt [ static type-qualifier-list_opt assignment-expression ]
// 	direct-abstract-declarator_opt [ type-qualifier-list static assignment-expression ]
// 	direct-abstract-declarator_opt [ * ]
// 	direct-abstract-declarator_opt ( parameter-type-list_opt )
func (p *parser) directAbstractDeclarator(d *DirectAbstractDeclarator) (r *DirectAbstractDeclarator) {
	var t, t2, t3 Token
	switch {
	case d != nil:
		r = d
	default:
		switch p.rune() {
		case '[':
			t = p.shift()
			switch p.rune() {
			case '*':
				t2 = p.shift()
				switch p.rune() {
				case ']':
					t3 = p.shift()
				default:
					p.err("expected ]")
				}
				r = &DirectAbstractDeclarator{Case: DirectAbstractDeclaratorArrStar, Token: t, Token2: t2, Token3: t3}
			case ATTRIBUTE, CONST, RESTRICT, VOLATILE, ATOMIC:
				list := p.typeQualifierList()
				switch p.rune() {
				case STATIC:
					t2 = p.shift()
					e := p.assignmentExpression()
					switch p.rune() {
					case ']':
						t3 = p.shift()
					default:
						p.err("expected ]")
					}
					r = &DirectAbstractDeclarator{Case: DirectAbstractDeclaratorArrStatic, Token: t, TypeQualifiers: list, Token2: t2, AssignmentExpression: e, Token3: t3}
				default:
					e := p.assignmentExpression()
					switch p.rune() {
					case ']':
						t2 = p.shift()
					default:
						p.err("expected ]")
					}
					r = &DirectAbstractDeclarator{Case: DirectAbstractDeclaratorArr, Token: t, TypeQualifiers: list, AssignmentExpression: e, Token2: t2}
				}
			case STATIC:
				t2 = p.shift()
				var list *TypeQualifiers
				switch p.rune() {
				case ATTRIBUTE, CONST, RESTRICT, VOLATILE, ATOMIC:
					list = p.typeQualifierList()
				}
				e := p.assignmentExpression()
				switch p.rune() {
				case ']':
					t3 = p.shift()
				default:
					p.err("expected ]")
				}
				r = &DirectAbstractDeclarator{Case: DirectAbstractDeclaratorStaticArr, Token: t, Token2: t2, TypeQualifiers: list, AssignmentExpression: e, Token3: t3}
			case ']':
				r = &DirectAbstractDeclarator{Case: DirectAbstractDeclaratorArr, Token: t, Token2: p.shift()}
			default:
				e := p.assignmentExpression()
				switch p.rune() {
				case ']':
					t2 = p.shift()
				default:
					p.err("expected ]")
				}
				r = &DirectAbstractDeclarator{Case: DirectAbstractDeclaratorArr, Token: t, AssignmentExpression: e, Token2: t2}
			}
		case '(':
			switch p.peek(true) {
			case ')':
				t := p.shift()
				r = &DirectAbstractDeclarator{Case: DirectAbstractDeclaratorFunc, Token: t, Token2: p.shift()}
			case VOID, CHAR, SHORT, INT, INT8, INT16, INT32, INT64, INT128, LONG, FLOAT, FLOAT16, FLOAT80, FLOAT32, FLOAT32X, FLOAT64, FLOAT64X, FLOAT128, DECIMAL32, DECIMAL64, DECIMAL128, FRACT, SAT, ACCUM, DOUBLE, SIGNED, UNSIGNED, BOOL, COMPLEX, STRUCT, UNION, ENUM, TYPEDEFNAME, TYPEOF, ATOMIC,
				ATTRIBUTE, CONST, RESTRICT, VOLATILE,
				ALIGNAS:
				p.openScope(false)
				paramScope := p.declScope
				p.typedefNameEnabled = true
				t = p.shift()
				list := p.parameterTypeList()
				p.closeScope()
				p.typedefNameEnabled = true
				switch p.rune() {
				case ')':
					t2 = p.shift()
				default:
					p.err("expected )")
				}
				r = &DirectAbstractDeclarator{Case: DirectAbstractDeclaratorFunc, Token: t, ParameterTypeList: list, Token2: t2, paramScope: paramScope}
			default:
				p.openScope(false)
				paramScope := p.declScope
				p.typedefNameEnabled = true
				t = p.shift()
				d := p.abstractDeclarator(nil)
				p.closeScope()
				p.typedefNameEnabled = true
				switch p.rune() {
				case ')':
					t2 = p.shift()
				default:
					p.err("expected )")
				}
				r = &DirectAbstractDeclarator{Case: DirectAbstractDeclaratorDecl, Token: t, AbstractDeclarator: d, Token2: t2, paramScope: paramScope}
			}
		default:
			panic(internalError())
		}
	}

	for {
		switch p.rune() {
		case '(':
			if p.peek(false) == ')' {
				t = p.shift()
				r = &DirectAbstractDeclarator{Case: DirectAbstractDeclaratorFunc, DirectAbstractDeclarator: r, Token: t, Token2: p.shift()}
				break
			}

			p.openScope(false)
			p.typedefNameEnabled = true
			t = p.shift()
			paramScope := p.declScope
			list := p.parameterTypeList()
			p.closeScope()
			p.typedefNameEnabled = true
			switch p.rune() {
			case ')':
				t2 = p.shift()
			default:
				p.err("expected )")
			}
			r = &DirectAbstractDeclarator{Case: DirectAbstractDeclaratorFunc, DirectAbstractDeclarator: r, Token: t, ParameterTypeList: list, Token2: t2, paramScope: paramScope}
		case '[':
			t = p.shift()
			switch p.rune() {
			case '*':
				t2 = p.shift()
				switch p.rune() {
				case ']':
					t3 = p.shift()
				default:
					p.err("expected ]")
				}
				r = &DirectAbstractDeclarator{Case: DirectAbstractDeclaratorArrStar, DirectAbstractDeclarator: r, Token: t, Token2: t2, Token3: t3}
			case ATTRIBUTE, CONST, RESTRICT, VOLATILE, ATOMIC:
				list := p.typeQualifierList()
				switch p.rune() {
				case STATIC:
					t2 = p.shift()
					e := p.assignmentExpression()
					switch p.rune() {
					case ']':
						t3 = p.shift()
					default:
						p.err("expected ]")
					}
					r = &DirectAbstractDeclarator{Case: DirectAbstractDeclaratorArrStatic, DirectAbstractDeclarator: r, Token: t, TypeQualifiers: list, Token2: t2, AssignmentExpression: e, Token3: t3}
				default:
					e := p.assignmentExpression()
					switch p.rune() {
					case ']':
						t2 = p.shift()
					default:
						p.err("expected ]")
					}
					r = &DirectAbstractDeclarator{Case: DirectAbstractDeclaratorArr, DirectAbstractDeclarator: r, Token: t, TypeQualifiers: list, AssignmentExpression: e, Token2: t2}
				}
			case STATIC:
				t2 = p.shift()
				var list *TypeQualifiers
				switch p.rune() {
				case ATTRIBUTE, CONST, RESTRICT, VOLATILE, ATOMIC:
					list = p.typeQualifierList()
				}
				e := p.assignmentExpression()
				switch p.rune() {
				case ']':
					t3 = p.shift()
				default:
					p.err("expected ]")
				}
				r = &DirectAbstractDeclarator{Case: DirectAbstractDeclaratorStaticArr, DirectAbstractDeclarator: r, Token: t, Token2: t2, TypeQualifiers: list, AssignmentExpression: e, Token3: t3}
			case ']':
				r = &DirectAbstractDeclarator{Case: DirectAbstractDeclaratorArr, DirectAbstractDeclarator: r, Token: t, Token2: p.shift()}
			default:
				e := p.assignmentExpression()
				switch p.rune() {
				case ']':
					t2 = p.shift()
				default:
					p.err("expected ]")
				}
				r = &DirectAbstractDeclarator{Case: DirectAbstractDeclaratorArr, DirectAbstractDeclarator: r, Token: t, AssignmentExpression: e, Token2: t2}
			}
		default:
			return r
		}
	}
}

// [0], 6.7.8 Initialization
//
//  initializer:
// 	assignment-expression
// 	{ initializer-list }
// 	{ initializer-list , }
func (p *parser) initializer(parent *Initializer) *Initializer {
	switch p.rune() {
	case '{':
		t := p.shift()
		if p.peek(false) == '}' {
			if p.ctx.cfg.RejectEmptyInitializerList {
				p.err("expected initializer-list")
			}
			return &Initializer{Case: InitializerInitList, Token: t, Token3: p.shift()}
		}

		r := &Initializer{Case: InitializerInitList, Token: t, parent: parent}
		r.InitializerList = p.initializerList(r)
		if p.rune() == ',' {
			r.Token2 = p.shift()
		}
		switch p.rune() {
		case '}':
			r.Token3 = p.shift()
		default:
			p.err("expected }")
		}
		return r
	default:
		return &Initializer{Case: InitializerExpr, AssignmentExpression: p.assignmentExpression(), parent: parent}
	}
}

//  initializer-list:
// 	designation_opt initializer
// 	initializer-list , designation_opt initializer
func (p *parser) initializerList(parent *Initializer) (r *InitializerList) {
	var d *Designation
	switch p.rune() {
	case '[', '.':
		d = p.designation()
	case IDENTIFIER:
		if p.peek(false) == ':' {
			d = p.designation()
		}
	}
	r = &InitializerList{Designation: d, Initializer: p.initializer(parent)}
	for prev := r; ; prev = prev.InitializerList {
		switch p.rune() {
		case ',':
			t := p.tok
			prev.Initializer.trailingComma = &t
			if p.peek(false) == '}' {
				return r
			}

			t = p.shift()
			d = nil
			switch p.rune() {
			case '[', '.':
				d = p.designation()
			case IDENTIFIER:
				if p.peek(false) == ':' {
					d = p.designation()
				}
			}
			prev.InitializerList = &InitializerList{Token: t, Designation: d, Initializer: p.initializer(parent)}
		default:
			return r
		}
	}
}

//  designation:
// 	designator-list =
func (p *parser) designation() *Designation {
	var t Token
	list, colon := p.designatorList()
	if !colon {
		switch p.rune() {
		case '=':
			t = p.shift()
		default:
			p.err("expected =")
		}
	}
	return &Designation{DesignatorList: list, Token: t}
}

//  designator-list:
// 	designator
// 	designator-list designator
func (p *parser) designatorList() (r *DesignatorList, colon bool) {
	d, isCol := p.designator(true)
	if isCol {
		return &DesignatorList{Designator: d}, true
	}

	r = &DesignatorList{Designator: d}
	for prev := r; ; prev = prev.DesignatorList {
		switch p.rune() {
		case '[', '.':
			d, _ = p.designator(false)
			prev.DesignatorList = &DesignatorList{Designator: d}
		default:
			return r, false
		}
	}
}

//  designator:
// 	[ constant-expression ]
// 	. identifier
//	identifier :
func (p *parser) designator(acceptCol bool) (*Designator, bool) {
	var t, t2 Token
	switch p.rune() {
	case '[':
		t = p.shift()
		e := p.constantExpression()
		switch p.rune() {
		case ']':
			t2 = p.shift()
		default:
			p.err("expected ]")
		}
		return &Designator{Case: DesignatorIndex, Token: t, ConstantExpression: e, Token2: t2, lexicalScope: p.declScope}, false
	case '.':
		t = p.shift()
		switch p.rune() {
		case IDENTIFIER:
			t2 = p.shift()
		default:
			p.err("expected identifier")
		}
		return &Designator{Case: DesignatorField, Token: t, Token2: t2, lexicalScope: p.declScope}, false
	case IDENTIFIER:
		if acceptCol && p.peek(false) == ':' {
			t = p.shift()
			return &Designator{Case: DesignatorField2, Token: t, Token2: p.shift(), lexicalScope: p.declScope}, true
		}

		p.err("expected designator")
		return nil, false
	default:
		p.err("expected [ or .")
		return nil, false
	}
}

// [0], 6.8 Statements and blocks
//
//  statement:
// 	labeled-statement
// 	compound-statement
// 	expression-statement
// 	selection-statement
// 	iteration-statement
// 	jump-statement
//	asm-statement
func (p *parser) statement() (r *Statement) {
	var r0 *Statement
	var prevLS, ls *LabeledStatement

	defer func() {
		if ls != nil {
			ls.Statement = r
			r = r0
		}
	}()

	for {
		switch p.rune() {
		case IDENTIFIER:
			switch {
			case p.peek(false) == ':':
				ls = p.labeledStatement()
			default:
				return &Statement{Case: StatementExpr, ExpressionStatement: p.expressionStatement()}
			}
		case '{':
			return &Statement{Case: StatementCompound, CompoundStatement: p.compoundStatement(nil, nil)}
		case IF, SWITCH:
			return &Statement{Case: StatementSelection, SelectionStatement: p.selectionStatement()}
		case WHILE, DO, FOR:
			return &Statement{Case: StatementIteration, IterationStatement: p.iterationStatement()}
		case GOTO, BREAK, CONTINUE, RETURN:
			return &Statement{Case: StatementJump, JumpStatement: p.jumpStatement()}
		case CASE, DEFAULT:
			ls = p.labeledStatement()
		case ASM:
			return &Statement{Case: StatementAsm, AsmStatement: p.asmStatement()}
		default:
			return &Statement{Case: StatementExpr, ExpressionStatement: p.expressionStatement()}
		}

		switch {
		case r0 == nil:
			r0 = &Statement{Case: StatementLabeled, LabeledStatement: ls}
		default:
			prevLS.Statement = &Statement{Case: StatementLabeled, LabeledStatement: ls}
		}
		prevLS = ls
	}
}

// [0], 6.8.1 Labeled statements
//
//  labeled-statement:
// 	identifier : statement
// 	case constant-expression : statement
// 	case constant-expression ... constant-expression : statement
// 	default : statement
func (p *parser) labeledStatement() (r *LabeledStatement) {
	defer func() {
		if r != nil {
			p.block.labeledStmts = append(p.block.labeledStmts, r)
		}
	}()

	var t, t2, t3 Token
	switch p.rune() {
	case IDENTIFIER:
		t = p.shift()
		switch p.rune() {
		case ':':
			t2 = p.shift()
		default:
			p.err("expected :")
			return nil
		}

		attr := p.attributeSpecifierListOpt()
		// if attr != nil {
		// 	trc("%v: ATTRS", attr.Position())
		// }
		p.block.hasLabel()
		r = &LabeledStatement{
			Case: LabeledStatementLabel, Token: t, Token2: t2, AttributeSpecifierList: attr,
			lexicalScope: p.declScope, block: p.block,
		}
		p.declScope.declare(t.Value, r)
		return r
	case CASE:
		if p.switches == 0 {
			p.err("case label not within a switch statement")
		}
		t = p.shift()
		e := p.constantExpression()
		switch p.rune() {
		case DDD:
			if p.ctx.cfg.RejectCaseRange {
				p.err0(false, "expected :")
			}
			t2 = p.shift()
			e2 := p.constantExpression()
			switch p.rune() {
			case ':':
				t3 = p.shift()
			default:
				p.err("expected :")
			}
			return &LabeledStatement{
				Case: LabeledStatementRange, Token: t, ConstantExpression: e,
				Token2: t2, ConstantExpression2: e2, Token3: t3,
				lexicalScope: p.declScope, block: p.block,
			}
		case ':':
			t2 = p.shift()
		default:
			p.err("expected :")
		}
		return &LabeledStatement{
			Case: LabeledStatementCaseLabel, Token: t, ConstantExpression: e,
			Token2: t2, lexicalScope: p.declScope, block: p.block,
		}
	case DEFAULT:
		if p.switches == 0 {
			p.err("'deafult' label not within a switch statement")
		}
		t = p.shift()
		switch p.rune() {
		case ':':
			t2 = p.shift()
		default:
			p.err("expected :")
		}
		return &LabeledStatement{
			Case: LabeledStatementDefault, Token: t, Token2: t2,
			lexicalScope: p.declScope, block: p.block,
		}
	default:
		p.err("expected labeled-statement")
		return &LabeledStatement{}
	}
}

// [0], 6.8.2 Compound statement
//
//  compound-statement:
// 	{ block-item-list_opt }
func (p *parser) compoundStatement(s Scope, inject []Token) (r *CompoundStatement) {
	if p.rune() != '{' {
		p.err("expected {")
		return nil
	}

	r = &CompoundStatement{parent: p.block}
	if fn := p.currFn; fn != nil {
		fn.compoundStatements = append(fn.compoundStatements, r)
	}
	sv := p.block
	if sv != nil {
		sv.children = append(sv.children, r)
	}
	p.block = r
	switch {
	case s != nil:
		p.declScope = s
		p.resolveScope = s
		p.scopes++
		// var a []string
		// for s := p.declScope; s != nil; s = s.Parent() {
		// 	a = append(a, fmt.Sprintf("%p", s))
		// }
		// dbg("using func scope %p: %v", s, strings.Join(a, " "))
	default:
		p.openScope(false)
	}
	s = p.declScope
	p.typedefNameEnabled = true
	t := p.shift()
	if len(inject) != 0 {
		p.unget(inject...)
	}
	list := p.blockItemList()
	var t2 Token
	p.closeScope()
	p.typedefNameEnabled = true
	switch p.rune() {
	case '}':
		t2 = p.shift()
	default:
		p.err("expected }")
	}
	r.Token = t
	r.BlockItemList = list
	r.Token2 = t2
	r.scope = s
	p.block = sv
	return r
}

//  block-item-list:
// 	block-item
// 	block-item-list block-item
func (p *parser) blockItemList() (r *BlockItemList) {
	var prev *BlockItemList
	for p.rune() != '}' && p.rune() > 0 {
		n := &BlockItemList{BlockItem: p.blockItem()}
		if r == nil {
			r = n
			prev = r
			continue
		}

		prev.BlockItemList = n
		prev = n
	}
	return r
}

//  block-item:
// 	declaration
// 	statement
// 	label-declaration
// 	declaration-specifiers declarator compound-statement
func (p *parser) blockItem() *BlockItem {
	switch p.rune() {
	case
		TYPEDEF, EXTERN, STATIC, AUTO, REGISTER, THREADLOCAL,
		VOID, CHAR, SHORT, INT, INT8, INT16, INT32, INT64, INT128, LONG, FLOAT, FLOAT16, FLOAT80, FLOAT32, FLOAT32X, FLOAT64, FLOAT64X, FLOAT128, DECIMAL32, DECIMAL64, DECIMAL128, FRACT, SAT, ACCUM, DOUBLE, SIGNED, UNSIGNED, BOOL, COMPLEX, STRUCT, UNION, ENUM, TYPEDEFNAME, TYPEOF, ATOMIC,
		CONST, RESTRICT, VOLATILE,
		ALIGNAS,
		INLINE, NORETURN, ATTRIBUTE:
		ds := p.declarationSpecifiers(nil, nil)
		switch p.rune() {
		case ';':
			r := &BlockItem{Case: BlockItemDecl, Declaration: p.declaration(ds, nil)}
			p.typedefNameEnabled = true
			return r
		}

		d := p.declarator(true, ds.typedef(), nil)
		switch p.rune() {
		case '{':
			if p.ctx.cfg.RejectNestedFunctionDefinitions {
				p.err0(false, "nested functions not allowed")
			}
			r := &BlockItem{Case: BlockItemFuncDef, DeclarationSpecifiers: ds, Declarator: d, CompoundStatement: p.compoundStatement(d.ParamScope(), p.fn(d.Name()))}
			p.typedefNameEnabled = true
			return r
		default:
			r := &BlockItem{Case: BlockItemDecl, Declaration: p.declaration(ds, d)}
			return r
		}
	case LABEL:
		p.block.hasLabel()
		return &BlockItem{Case: BlockItemLabel, LabelDeclaration: p.labelDeclaration()}
	case PRAGMASTDC:
		return &BlockItem{Case: BlockItemPragma, PragmaSTDC: p.pragmaSTDC()}
	default:
		return &BlockItem{Case: BlockItemStmt, Statement: p.statement()}
	}
}

//  label-declaration
// 	__label__ identifier-list ;
func (p *parser) labelDeclaration() *LabelDeclaration {
	if p.rune() != LABEL {
		p.err("expected __label__")
		return nil
	}

	t := p.shift()
	list := p.identifierList()
	p.typedefNameEnabled = true
	var t2 Token
	switch p.rune() {
	case ';':
		t2 = p.shift()
	default:
		p.err("expected ;")
	}
	return &LabelDeclaration{Token: t, IdentifierList: list, Token2: t2}
}

// [0], 6.8.3 Expression and null statements
//
//  expression-statement:
// 	expression_opt attribute-specifier-list_opt;
func (p *parser) expressionStatement() *ExpressionStatement {
	switch p.rune() {
	case '}':
		p.typedefNameEnabled = true
		return &ExpressionStatement{}
	case ';':
		p.typedefNameEnabled = true
		return &ExpressionStatement{Token: p.shift()}
	case ATTRIBUTE:
		p.typedefNameEnabled = true
		attr := p.attributeSpecifierList()
		// if attr != nil {
		// 	trc("%v: ATTRS", attr.Position())
		// }
		var t Token
		switch p.rune() {
		case ';':
			t = p.shift()
		default:
			p.err("expected ;")
		}
		return &ExpressionStatement{AttributeSpecifierList: attr, Token: t}
	}

	e := p.expression()
	var t Token
	p.typedefNameEnabled = true
	attr := p.attributeSpecifierListOpt()
	// if attr != nil {
	// 	trc("%v: ATTRS", attr.Position())
	// }
	switch p.rune() {
	case ';':
		t = p.shift()
	default:
		p.err("expected ;")
	}
	return &ExpressionStatement{Expression: e, AttributeSpecifierList: attr, Token: t}
}

// [0], 6.8.4 Selection statements
//
//  selection-statement:
//  	if ( expression ) statement
//  	if ( expression ) statement else statement
//  	switch ( expression ) statement
func (p *parser) selectionStatement() *SelectionStatement {
	var t, t2, t3, t4 Token
	switch p.rune() {
	case IF:
		p.openScope(false)
		t = p.shift()
		switch p.rune() {
		case '(':
			t2 = p.shift()
		default:
			p.err("expected (")
		}
		e := p.expression()
		switch p.rune() {
		case ')':
			t3 = p.shift()
		default:
			p.err("expected )")
		}
		p.openScope(false)
		s := p.statement()
		if p.peek(false) != ELSE {
			r := &SelectionStatement{Case: SelectionStatementIf, Token: t, Token2: t2, Expression: e, Token3: t3, Statement: s}
			p.closeScope()
			p.closeScope()
			return r
		}

		p.closeScope()
		p.openScope(false)
		t4 = p.shift()
		r := &SelectionStatement{Case: SelectionStatementIfElse, Token: t, Token2: t2, Expression: e, Token3: t3, Statement: s, Token4: t4, Statement2: p.statement()}
		p.closeScope()
		p.closeScope()
		return r
	case SWITCH:
		p.switches++
		p.openScope(false)
		t = p.shift()
		switch p.rune() {
		case '(':
			t2 = p.shift()
		default:
			p.err("expected (")
		}
		e := p.expression()
		switch p.rune() {
		case ')':
			t3 = p.shift()
		default:
			p.err("expected )")
		}
		p.openScope(false)
		s := p.statement()
		p.closeScope()
		p.closeScope()
		p.switches--
		return &SelectionStatement{Case: SelectionStatementSwitch, Token: t, Token2: t2, Expression: e, Token3: t3, Statement: s}
	default:
		p.err("expected selection-statement")
		return nil
	}
}

// [0], 6.8.5 Iteration statements
//
//  iteration-statement:
// 	while ( expression ) statement
// 	do statement while ( expression ) ;
// 	for ( expression_opt ; expression_opt ; expression_opt ) statement
// 	for ( declaration expression_opt ; expression_opt ) statement
func (p *parser) iterationStatement() (r *IterationStatement) {
	var t, t2, t3, t4, t5 Token
	var e, e2, e3 *Expression
	switch p.rune() {
	case WHILE:
		p.openScope(false)
		t = p.shift()
		if p.rune() != '(' {
			p.err("expected (")
			p.closeScope()
			return nil
		}

		t2 = p.shift()
		e = p.expression()
		switch p.rune() {
		case ')':
			t3 = p.shift()
		default:
			p.err("expected )")
		}
		p.openScope(false)
		r = &IterationStatement{Case: IterationStatementWhile, Token: t, Token2: t2, Expression: e, Token3: t3, Statement: p.statement()}
		p.closeScope()
		p.closeScope()
		return r
	case DO:
		t := p.shift()
		p.openScope(false)
		p.openScope(false)
		s := p.statement()
		p.closeScope()
		switch p.rune() {
		case WHILE:
			t2 = p.shift()
		default:
			p.err("expected while")
			p.closeScope()
			return nil
		}

		if p.rune() != '(' {
			p.err("expected (")
			p.closeScope()
			return nil
		}

		t3 = p.shift()
		e = p.expression()
		switch p.rune() {
		case ')':
			t4 = p.shift()
		default:
			p.err("expected )")
		}
		p.typedefNameEnabled = true
		switch p.rune() {
		case ';':
			t5 = p.shift()
		default:
			p.err("expected ;")
		}
		r = &IterationStatement{Case: IterationStatementDo, Token: t, Statement: s, Token2: t2, Token3: t3, Expression: e, Token4: t4, Token5: t5}
		p.closeScope()
		return r
	case FOR:
		p.openScope(false)
		t = p.shift()
		if p.rune() != '(' {
			p.err("expected (")
			p.closeScope()
			return nil
		}

		t2 = p.shift()
		var d *Declaration
		switch p.rune() {
		case TYPEDEF, EXTERN, STATIC, AUTO, REGISTER, THREADLOCAL,
			VOID, CHAR, SHORT, INT, INT8, INT16, INT32, INT64, INT128, LONG, FLOAT, FLOAT16, FLOAT80, FLOAT32, FLOAT32X, FLOAT64, FLOAT64X, FLOAT128, DECIMAL32, DECIMAL64, DECIMAL128, FRACT, SAT, ACCUM, DOUBLE, SIGNED, UNSIGNED, BOOL, COMPLEX, STRUCT, UNION, ENUM, TYPEDEFNAME, TYPEOF, ATOMIC,
			CONST, RESTRICT, VOLATILE,
			ALIGNAS,
			INLINE, NORETURN, ATTRIBUTE:
			d = p.declaration(nil, nil)
			if p.rune() != ';' {
				e = p.expression()
			}
			switch p.rune() {
			case ';':
				t3 = p.shift()
			default:
				p.err("expected ;")
			}
			if p.rune() != ')' {
				e2 = p.expression()
			}
			switch p.rune() {
			case ')':
				t4 = p.shift()
			default:
				p.err("expected )")
			}
			p.openScope(false)
			r = &IterationStatement{Case: IterationStatementForDecl, Token: t, Token2: t2, Declaration: d, Expression: e, Token3: t3, Expression2: e2, Token4: t4, Statement: p.statement()}
			p.closeScope()
			p.closeScope()
			return r
		default:
			if p.rune() != ';' {
				e = p.expression()
			}
			switch p.rune() {
			case ';':
				t3 = p.shift()
			default:
				p.err("expected ;")
			}
			if p.rune() != ';' {
				e2 = p.expression()
			}
			switch p.rune() {
			case ';':
				t4 = p.shift()
			default:
				p.err("expected ;")
			}
			if p.rune() != ')' {
				e3 = p.expression()
			}
			switch p.rune() {
			case ')':
				t5 = p.shift()
			default:
				p.err("expected )")
			}
			p.openScope(false)
			r = &IterationStatement{Case: IterationStatementFor, Token: t, Token2: t2, Expression: e, Token3: t3, Expression2: e2, Token4: t4, Expression3: e3, Token5: t5, Statement: p.statement()}
			p.closeScope()
			p.closeScope()
			return r
		}
	default:
		p.err("expected iteration-statement")
		return nil
	}
}

// [0], 6.8.6 Jump statements
//
//  jump-statement:
// 	goto identifier ;
// 	goto * expression ;
// 	continue ;
// 	break ;
// 	return expression_opt ;
func (p *parser) jumpStatement() *JumpStatement {
	var t, t2, t3 Token
	var kind JumpStatementCase
	switch p.rune() {
	case GOTO:
		p.typedefNameEnabled = false
		t = p.shift()
		switch p.rune() {
		case IDENTIFIER:
			t2 = p.shift()
		case '*':
			t2 = p.shift()
			p.typedefNameEnabled = true
			e := p.expression()
			switch p.rune() {
			case ';':
				t3 = p.shift()
			default:
				p.err("expected ;")
			}
			return &JumpStatement{Case: JumpStatementGotoExpr, Token: t, Token2: t2, Expression: e, Token3: t3, lexicalScope: p.declScope}
		default:
			p.err("expected identifier or *")
		}
		p.typedefNameEnabled = true
		switch p.rune() {
		case ';':
			t3 = p.shift()
		default:
			p.err("expected ;")
		}
		return &JumpStatement{Case: JumpStatementGoto, Token: t, Token2: t2, Token3: t3, lexicalScope: p.declScope}
	case CONTINUE:
		kind = JumpStatementContinue
	case BREAK:
		kind = JumpStatementBreak
	case RETURN:
		t = p.shift()
		var e *Expression
		if p.rune() != ';' {
			e = p.expression()
		}
		p.typedefNameEnabled = true
		switch p.rune() {
		case ';':
			t2 = p.shift()
		default:
			p.err("expected ;")
		}
		return &JumpStatement{Case: JumpStatementReturn, Token: t, Expression: e, Token2: t2, lexicalScope: p.declScope}
	default:
		p.err("expected jump-statement")
		return nil
	}

	t = p.shift()
	p.typedefNameEnabled = true
	switch p.rune() {
	case ';':
		t2 = p.shift()
	default:
		p.err("expected ;")
	}
	return &JumpStatement{Case: kind, Token: t, Token2: t2, lexicalScope: p.declScope}
}

// [0], 6.9 External definitions
//
//  translation-unit:
// 	external-declaration
// 	translation-unit external-declaration
func (p *parser) translationUnit() (r *TranslationUnit) {
	p.typedefNameEnabled = true
	var prev *TranslationUnit
	for p.rune() >= 0 {
		ed := p.externalDeclaration()
		if ed == nil {
			continue
		}

		t := &TranslationUnit{ExternalDeclaration: ed}
		switch {
		case r == nil:
			r = t
		default:
			prev.TranslationUnit = t
		}
		prev = t
	}
	if r != nil {
		return r
	}

	return &TranslationUnit{}
}

//  external-declaration:
// 	function-definition
// 	declaration
// 	asm-function-definition
// 	;
func (p *parser) externalDeclaration() *ExternalDeclaration {
	var ds *DeclarationSpecifiers
	var inline, extern bool
	if p.ctx.cfg.SharedFunctionDefinitions != nil {
		p.rune()
		p.hash.Reset()
		p.key = sharedFunctionDefinitionKey{pos: dict.sid(p.tok.Position().String())}
		p.hashTok()
	}
	switch p.rune() {
	case TYPEDEF, EXTERN, STATIC, AUTO, REGISTER, THREADLOCAL,
		VOID, CHAR, SHORT, INT, INT8, INT16, INT32, INT64, INT128, LONG, FLOAT, FLOAT16, FLOAT80, FLOAT32, FLOAT32X, FLOAT64, FLOAT64X, FLOAT128, DECIMAL32, DECIMAL64, DECIMAL128, FRACT, SAT, ACCUM, DOUBLE, SIGNED, UNSIGNED, BOOL, COMPLEX, STRUCT, UNION, ENUM, TYPEDEFNAME, TYPEOF, ATOMIC,
		CONST, RESTRICT, VOLATILE,
		INLINE, NORETURN, ATTRIBUTE,
		ALIGNAS:
		ds = p.declarationSpecifiers(&extern, &inline)
	case ';':
		if p.ctx.cfg.RejectEmptyDeclarations {
			p.err("expected external-declaration")
			return nil
		}

		return &ExternalDeclaration{Case: ExternalDeclarationEmpty, Token: p.shift()}
	case ASM:
		return &ExternalDeclaration{Case: ExternalDeclarationAsmStmt, AsmStatement: p.asmStatement()}
	case PRAGMASTDC:
		return &ExternalDeclaration{Case: ExternalDeclarationPragma, PragmaSTDC: p.pragmaSTDC()}
	default:
		if p.ctx.cfg.RejectMissingDeclarationSpecifiers {
			p.err("expected declaration-specifiers")
		}
	}
	if p.rune() == ';' {
		return &ExternalDeclaration{Case: ExternalDeclarationDecl, Declaration: p.declaration(ds, nil)}
	}

	p.rune()
	d := p.declarator(false, ds.typedef(), nil)
	p.declScope.declare(d.Name(), d)
	switch p.rune() {
	case ',', ';', '=', ATTRIBUTE:
		if ds == nil {
			ds = noDeclSpecs
		}
		r := &ExternalDeclaration{Case: ExternalDeclarationDecl, Declaration: p.declaration(ds, d)}
		return r
	case ASM:
		return &ExternalDeclaration{Case: ExternalDeclarationAsm, AsmFunctionDefinition: p.asmFunctionDefinition(ds, d)}
	default:
		fd := p.functionDefinition(ds, d)
		if sfd := p.ctx.cfg.SharedFunctionDefinitions; sfd != nil {
			p.key.nm = d.Name()
			p.key.hash = p.hash.Sum64()
			if ex := sfd.m[p.key]; ex != nil {
				sfd.M[ex] = struct{}{}
				d := ex.Declarator
				p.declScope.declare(d.Name(), d)
				r := &ExternalDeclaration{Case: ExternalDeclarationFuncDef, FunctionDefinition: ex}
				return r
			}

			sfd.m[p.key] = fd
		}

		r := &ExternalDeclaration{Case: ExternalDeclarationFuncDef, FunctionDefinition: fd}
		return r
	}
}

func (p *parser) pragmaSTDC() *PragmaSTDC {
	if p.rune() != PRAGMASTDC {
		p.err("expected __pragma_stdc")
	}

	t := p.shift()  // _Pragma
	t2 := p.shift() // STDC
	t3 := p.shift() // FOO
	t4 := p.shift() // Bar
	return &PragmaSTDC{Token: t, Token2: t2, Token3: t3, Token4: t4}
}

// [0], 6.9.1 Function definitions
//
//  function-definition:
// 	declaration-specifiers declarator declaration-list_opt compound-statement
func (p *parser) functionDefinition(ds *DeclarationSpecifiers, d *Declarator) (r *FunctionDefinition) {
	var list *DeclarationList
	s := d.ParamScope()
	switch {
	case p.rune() != '{': // As in: int f(i) int i; { return i; }
		list = p.declarationList(s)
	case d.DirectDeclarator != nil && d.DirectDeclarator.Case == DirectDeclaratorFuncIdent: // As in: int f(i) { return i; }
		d.DirectDeclarator.idListNoDeclList = true
		for n := d.DirectDeclarator.IdentifierList; n != nil; n = n.IdentifierList {
			tok := n.Token2
			if tok.Value == 0 {
				tok = n.Token
			}
			d := &Declarator{
				IsParameter: true,
				DirectDeclarator: &DirectDeclarator{
					Case:  DirectDeclaratorIdent,
					Token: tok,
				},
			}
			s.declare(tok.Value, d)
			if p.ctx.cfg.RejectMissingDeclarationSpecifiers {
				p.ctx.errNode(&tok, "expected declaration-specifiers")
			}
		}
	}
	p.block = nil
	r = &FunctionDefinition{DeclarationSpecifiers: ds, Declarator: d, DeclarationList: list}
	sv := p.currFn
	p.currFn = r
	r.CompoundStatement = p.compoundStatement(d.ParamScope(), p.fn(d.Name()))
	p.currFn = sv
	return r
}

func (p *parser) fn(nm StringID) (r []Token) {
	if p.ctx.cfg.PreprocessOnly {
		return nil
	}

	pos := p.tok.Position()
	toks := []Token{
		{Rune: STATIC, Value: idStatic, Src: idStatic},
		{Rune: CONST, Value: idConst, Src: idConst},
		{Rune: CHAR, Value: idChar, Src: idChar},
		{Rune: IDENTIFIER, Value: idFunc, Src: idFunc},
		{Rune: '[', Value: idLBracket, Src: idLBracket},
		{Rune: ']', Value: idRBracket, Src: idRBracket},
		{Rune: '=', Value: idEq, Src: idEq},
		{Rune: STRINGLITERAL, Value: nm, Src: nm},
		{Rune: ';', Value: idSemicolon, Src: idSemicolon},
	}
	if p.ctx.cfg.InjectTracingCode {
		id := dict.sid(fmt.Sprintf("%s:%s\n", pos, nm.String()))
		toks = append(toks, []Token{
			{Rune: IDENTIFIER, Value: idFprintf, Src: idFprintf},
			{Rune: '(', Value: idLParen, Src: idLParen},
			{Rune: IDENTIFIER, Value: idStderr, Src: idStderr},
			{Rune: ',', Value: idComma, Src: idComma},
			{Rune: STRINGLITERAL, Value: id, Src: id},
			{Rune: ')', Value: idRParen, Src: idRParen},
			{Rune: ';', Value: idSemicolon, Src: idSemicolon},
			{Rune: IDENTIFIER, Value: idFFlush, Src: idFFlush},
			{Rune: '(', Value: idLParen, Src: idLParen},
			{Rune: IDENTIFIER, Value: idStderr, Src: idStderr},
			{Rune: ')', Value: idRParen, Src: idRParen},
			{Rune: ';', Value: idSemicolon, Src: idSemicolon},
		}...)
	}
	for _, v := range toks {
		v.file = p.tok.file
		v.pos = p.tok.pos
		v.seq = p.tok.seq
		r = append(r, v)
	}
	return r
}

//  declaration-list:
// 	declaration
// 	declaration-list declaration
func (p *parser) declarationList(s Scope) (r *DeclarationList) {
	p.declScope = s
	p.resolveScope = s
	switch ch := p.rune(); ch {
	case TYPEDEF, EXTERN, STATIC, AUTO, REGISTER, THREADLOCAL,
		VOID, CHAR, SHORT, INT, INT8, INT16, INT32, INT64, INT128, LONG, FLOAT, FLOAT16, FLOAT80, FLOAT32, FLOAT32X, FLOAT64, FLOAT64X, FLOAT128, DECIMAL32, DECIMAL64, DECIMAL128, FRACT, SAT, ACCUM, DOUBLE, SIGNED, UNSIGNED, BOOL, COMPLEX, STRUCT, UNION, ENUM, TYPEDEFNAME, TYPEOF, ATOMIC,
		CONST, RESTRICT, VOLATILE,
		ALIGNAS,
		INLINE, NORETURN, ATTRIBUTE:
		r = &DeclarationList{Declaration: p.declaration(nil, nil)}
	default:
		p.err("expected declaration: %s", tokName(ch))
		return nil
	}

	for prev := r; ; prev = prev.DeclarationList {
		switch p.rune() {
		case TYPEDEF, EXTERN, STATIC, AUTO, REGISTER, THREADLOCAL,
			VOID, CHAR, SHORT, INT, INT8, INT16, INT32, INT64, INT128, LONG, FLOAT, FLOAT16, FLOAT80, FLOAT32, FLOAT32X, FLOAT64, FLOAT64X, FLOAT128, DECIMAL32, DECIMAL64, DECIMAL128, FRACT, SAT, ACCUM, DOUBLE, SIGNED, UNSIGNED, BOOL, COMPLEX, STRUCT, UNION, ENUM, TYPEDEFNAME, TYPEOF, ATOMIC,
			CONST, RESTRICT, VOLATILE,
			ALIGNAS,
			INLINE, NORETURN, ATTRIBUTE:
			prev.DeclarationList = &DeclarationList{Declaration: p.declaration(nil, nil)}
		default:
			return r
		}
	}
}

// ----------------------------------------------------------------- Extensions

//  asm-function-definition:
// 	declaration-specifiers declarator asm-statement
func (p *parser) asmFunctionDefinition(ds *DeclarationSpecifiers, d *Declarator) *AsmFunctionDefinition {
	return &AsmFunctionDefinition{DeclarationSpecifiers: ds, Declarator: d, AsmStatement: p.asmStatement()}
}

//  asm-statement:
//  	asm attribute-specifier-list_opt ;
func (p *parser) asmStatement() *AsmStatement {
	a := p.asm()
	attr := p.attributeSpecifierListOpt()
	// if attr != nil {
	// 	trc("%v: ATTRS", attr.Position())
	// }
	var t Token
	switch p.rune() {
	case ';':
		p.typedefNameEnabled = true
		t = p.shift()
	default:
		p.err("expected ';'")
	}

	return &AsmStatement{Asm: a, AttributeSpecifierList: attr, Token: t}
}

//  asm:
// 	asm asm-qualifier-list_opt ( string-literal asm-arg-list_opt )
func (p *parser) asm() *Asm {
	var t, t2, t3, t4 Token
	switch p.rune() {
	case ASM:
		t = p.shift()
	default:
		p.err("expected asm")
	}

	var qlist *AsmQualifierList
	switch p.rune() {
	case VOLATILE, INLINE, GOTO:
		qlist = p.asmQualifierList()
	}

	switch p.rune() {
	case '(':
		t2 = p.shift()
	default:
		p.err("expected (")
	}

	switch p.rune() {
	case STRINGLITERAL:
		t3 = p.shift()
	default:
		p.err("expected string-literal")
	}

	var argList *AsmArgList
	switch p.rune() {
	case ':':
		argList = p.asmArgList()
	}

	switch p.rune() {
	case ')':
		t4 = p.shift()
	default:
		p.err("expected )")
	}

	return &Asm{Token: t, AsmQualifierList: qlist, Token2: t2, Token3: t3, AsmArgList: argList, Token4: t4}
}

//  asm-qualifier-list:
// 	asm-qualifier
// 	asm-qualifier-list asm-qualifier
func (p *parser) asmQualifierList() (r *AsmQualifierList) {
	switch p.rune() {
	case VOLATILE, INLINE, GOTO:
		r = &AsmQualifierList{AsmQualifier: p.asmQualifier()}
	default:
		p.err("expected asm-qualifier-list")
		return nil
	}

	for prev := r; ; prev = prev.AsmQualifierList {
		switch p.rune() {
		case VOLATILE, INLINE, GOTO:
			prev.AsmQualifierList = &AsmQualifierList{AsmQualifier: p.asmQualifier()}
		default:
			return r
		}
	}
}

//  asm-qualifier:
// 	volatile
//  	inline
// 	goto"
func (p *parser) asmQualifier() *AsmQualifier {
	switch p.rune() {
	case VOLATILE:
		return &AsmQualifier{Case: AsmQualifierVolatile, Token: p.shift()}
	case INLINE:
		return &AsmQualifier{Case: AsmQualifierInline, Token: p.shift()}
	case GOTO:
		return &AsmQualifier{Case: AsmQualifierGoto, Token: p.shift()}
	default:
		p.err("expected asm-qualifier")
		return nil
	}
}

//  asm-arg-list:
// 	: ExpressionListOpt
// 	asm-arg-list : expression-list_opt
func (p *parser) asmArgList() (r *AsmArgList) {
	if p.rune() != ':' {
		p.err("expected :")
		return nil
	}

	t := p.shift()
	var list *AsmExpressionList
	switch p.rune() {
	case ':', ')':
	default:
		list = p.asmExpressionList()
	}
	r = &AsmArgList{Token: t, AsmExpressionList: list}
	for prev := r; p.rune() == ':'; prev = prev.AsmArgList {
		t := p.shift()
		switch p.rune() {
		case ':', ')':
		default:
			list = p.asmExpressionList()
		}
		prev.AsmArgList = &AsmArgList{Token: t, AsmExpressionList: list}
	}
	return r
}

//  asm-expression-list:
// 	asm-index_opt assignment-expression
// 	asm-expression-list , asm-index_opt assignment-expression
func (p *parser) asmExpressionList() (r *AsmExpressionList) {
	var x *AsmIndex
	if p.rune() == '[' {
		x = p.asmIndex()
	}

	r = &AsmExpressionList{AsmIndex: x, AssignmentExpression: p.assignmentExpression()}
	for prev := r; p.rune() == ','; prev = prev.AsmExpressionList {
		t := p.shift()
		if p.rune() == '[' {
			x = p.asmIndex()
		}
		prev.AsmExpressionList = &AsmExpressionList{Token: t, AsmIndex: x, AssignmentExpression: p.assignmentExpression()}
	}
	return r
}

//  asm-index:
// 	[ expression ]
func (p *parser) asmIndex() *AsmIndex {
	if p.rune() != '[' {
		p.err("expected [")
		return nil
	}

	t := p.shift()
	e := p.expression()
	var t2 Token
	switch p.rune() {
	case ']':
		t2 = p.shift()
	default:
		p.err("expected ]")
	}
	return &AsmIndex{Token: t, Expression: e, Token2: t2}
}

//  attribute-specifier-list:
// 	attribute-specifier
// 	attribute-specifier-list attribute-specifier
func (p *parser) attributeSpecifierList() (r *AttributeSpecifierList) {
	if p.rune() != ATTRIBUTE {
		p.err("expected __attribute__")
		return nil
	}

	r = &AttributeSpecifierList{AttributeSpecifier: p.attributeSpecifier()}
	for prev := r; p.rune() == ATTRIBUTE; prev = r.AttributeSpecifierList {
		prev.AttributeSpecifierList = &AttributeSpecifierList{AttributeSpecifier: p.attributeSpecifier()}
	}
	return r
}

//  attribute-specifier:
// 	__attribute__ (( attribute-value-list_opt ))
func (p *parser) attributeSpecifier() (r *AttributeSpecifier) {
	if p.rune() != ATTRIBUTE {
		p.err("expected __attribute__")
		return nil
	}

	en := p.typedefNameEnabled
	t := p.shift()
	var t2, t3, t4, t5 Token
	p.ignoreKeywords = true
	switch p.rune() {
	case '(':
		t2 = p.shift()
	default:
		p.err("expected (")
	}
	switch p.rune() {
	case '(':
		t3 = p.shift()
	default:
		p.err("expected (")
	}
	var list *AttributeValueList
	if p.rune() != ')' {
		list = p.attributeValueList()
	}
	p.ignoreKeywords = false
	p.typedefNameEnabled = en
	switch p.rune() {
	case ')':
		t4 = p.shift()
	default:
		p.err("expected )")
	}
	switch p.rune() {
	case ')':
		t5 = p.shift()
	default:
		p.err("expected )")
	}
	return &AttributeSpecifier{Token: t, Token2: t2, Token3: t3, AttributeValueList: list, Token4: t4, Token5: t5}
}

//  attribute-value-list:
// 	attribute-value
// 	attribute-value-list , attribute-value
func (p *parser) attributeValueList() (r *AttributeValueList) {
	r = &AttributeValueList{AttributeValue: p.attributeValue()}
	for prev := r; p.rune() == ','; prev = prev.AttributeValueList {
		t := p.shift()
		prev.AttributeValueList = &AttributeValueList{Token: t, AttributeValue: p.attributeValue()}
	}
	return r
}

//  attribute-value:
// 	identifier
// 	identifier ( expression-list_opt )
func (p *parser) attributeValue() *AttributeValue {
	if p.rune() != IDENTIFIER {
		p.err("expected identifier")
		return nil
	}

	t := p.shift()
	if p.rune() != '(' {
		return &AttributeValue{Case: AttributeValueIdent, Token: t, lexicalScope: p.declScope}
	}

	p.ignoreKeywords = false
	t2 := p.shift()
	var list *ExpressionList
	if p.rune() != ')' {
		list = p.expressionList()
	}
	p.ignoreKeywords = true
	var t3 Token
	switch p.rune() {
	case ')':
		t3 = p.shift()
	default:
		p.err("expected )")
	}
	return &AttributeValue{Case: AttributeValueExpr, Token: t, Token2: t2, ExpressionList: list, Token3: t3, lexicalScope: p.declScope}
}

//  expression-list:
// 	assignment-expression
// 	expression-list , assignment-expression
func (p *parser) expressionList() (r *ExpressionList) {
	r = &ExpressionList{AssignmentExpression: p.assignmentExpression()}
	for prev := r; p.rune() == ','; prev = prev.ExpressionList {
		t := p.shift()
		prev.ExpressionList = &ExpressionList{Token: t, AssignmentExpression: p.assignmentExpression()}
	}
	return r
}
