// Copyright 2019 The CC Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package cc // import "modernc.org/cc/v3"

import (
	"bytes"
	"fmt"
	gotoken "go/token"
	"math"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"modernc.org/token"
)

const (
	maxIncludeLevel = 200 // gcc, std is at least 15.
)

var (
	_ tokenReader = (*cpp)(nil)
	_ tokenWriter = (*cpp)(nil)

	idCOUNTER                  = dict.sid("__COUNTER__")
	idCxLimitedRange           = dict.sid("CX_LIMITED_RANGE")
	idDATE                     = dict.sid("__DATE__")
	idDefault                  = dict.sid("DEFAULT")
	idDefined                  = dict.sid("defined")
	idEmptyString              = dict.sid(`""`)
	idFILE                     = dict.sid("__FILE__")
	idFPContract               = dict.sid("FP_CONTRACT")
	idFdZero                   = dict.sid("FD_ZERO")
	idFenvAccess               = dict.sid("FENV_ACCESS")
	idGNUC                     = dict.sid("__GNUC__")
	idHasIncludeImpl           = dict.sid("__has_include_impl")
	idIntMaxWidth              = dict.sid("__INTMAX_WIDTH__")
	idL                        = dict.sid("L")
	idLINE                     = dict.sid("__LINE__")
	idNL                       = dict.sid("\n")
	idOff                      = dict.sid("OFF")
	idOn                       = dict.sid("ON")
	idOne                      = dict.sid("1")
	idPragmaSTDC               = dict.sid("__pragma_stdc")
	idSTDC                     = dict.sid("STDC")
	idTIME                     = dict.sid("__TIME__")
	idTclDefaultDoubleRounding = dict.sid("TCL_DEFAULT_DOUBLE_ROUNDING")
	idTclIeeeDoubleRounding    = dict.sid("TCL_IEEE_DOUBLE_ROUNDING")
	idVaArgs                   = dict.sid("__VA_ARGS__")
	idZero                     = dict.sid("0")

	cppTokensPool = sync.Pool{New: func() interface{} { r := []cppToken{}; return &r }}

	protectedMacros = hideSet{ // [0], 6.10.8, 4
		dict.sid("__STDC_HOSTED__"):          {},
		dict.sid("__STDC_IEC_559_COMPLEX__"): {},
		dict.sid("__STDC_IEC_559__"):         {},
		dict.sid("__STDC_ISO_10646__"):       {},
		dict.sid("__STDC_MB_MIGHT_NEQ_WC__"): {},
		dict.sid("__STDC_VERSION__"):         {},
		dict.sid("__STDC__"):                 {},
		idCOUNTER:                            {},
		idDATE:                               {},
		idFILE:                               {},
		idLINE:                               {},
		idTIME:                               {},
	}
)

type tokenReader interface {
	read() (cppToken, bool)
	unget(cppToken)
	ungets([]cppToken)
}

type tokenWriter interface {
	write(cppToken)
	writes([]cppToken)
}

// token4 is produced by translation phase 4.
type token4 struct {
	file *tokenFile //TODO sort fields
	token3
}

func (t *token4) Position() (r token.Position) {
	if t.pos != 0 && t.file != nil {
		r = t.file.PositionFor(token.Pos(t.pos), true)
	}
	return r
}

type hideSet map[StringID]struct{}

type cppToken struct {
	token4
	hs hideSet
}

func (t *cppToken) has(nm StringID) bool { _, ok := t.hs[nm]; return ok }

type cppWriter struct {
	toks []cppToken
}

func (w *cppWriter) write(tok cppToken)     { w.toks = append(w.toks, tok) }
func (w *cppWriter) writes(toks []cppToken) { w.toks = append(w.toks, toks...) }

type ungetBuf []cppToken

func (u *ungetBuf) unget(t cppToken) { *u = append(*u, t) }

func (u *ungetBuf) read() (t cppToken) {
	s := *u
	n := len(s) - 1
	t = s[n]
	*u = s[:n]
	return t
}
func (u *ungetBuf) ungets(toks []cppToken) {
	s := *u
	for i := len(toks) - 1; i >= 0; i-- {
		s = append(s, toks[i])
	}
	*u = s
}

func cppToksStr(toks []cppToken, sep string) string {
	var b strings.Builder
	for i, v := range toks {
		if i != 0 {
			b.WriteString(sep)
		}
		b.WriteString(v.String())
	}
	return b.String()
}

func cppToksStr2(toks [][]cppToken) string {
	panic(todo(""))
	var a []string
	for _, v := range toks {
		a = append(a, fmt.Sprintf("%q", cppToksStr(v, "|")))
	}
	return fmt.Sprint(a)
}

type cppReader struct {
	buf []cppToken
	ungetBuf
}

func (r *cppReader) read() (tok cppToken, ok bool) {
	if len(r.ungetBuf) != 0 {
		return r.ungetBuf.read(), true
	}

	if len(r.buf) == 0 {
		return tok, false
	}

	tok = r.buf[0]
	r.buf = r.buf[1:]
	return tok, true
}

type cppScanner []cppToken

func (s *cppScanner) peek() (r cppToken) {
	r.char = -1
	if len(*s) == 0 {
		return r
	}

	return (*s)[0]
}

func (s *cppScanner) next() (r cppToken) {
	r.char = -1
	if len(*s) == 0 {
		return r
	}

	*s = (*s)[1:]
	return s.peek()
}

func (s *cppScanner) Pos() token.Pos {
	if len(*s) == 0 {
		return 0
	}

	return (*s)[0].Pos()
}

// Macro represents a preprocessor macro definition.
type Macro struct {
	fp    []StringID
	repl  []token3
	repl2 []Token

	name token4
	pos  int32

	isFnLike      bool
	namedVariadic bool // foo..., note no comma before ellipsis.
	variadic      bool
}

// Position reports the position of the macro definition.
func (m *Macro) Position() token.Position {
	if m.pos != 0 && m.name.file != nil {
		return m.name.file.PositionFor(token.Pos(m.pos), true)
	}
	return token.Position{}
}

// Parameters return the list of function-like macro parameters.
func (m *Macro) Parameters() []StringID { return m.fp }

// ReplacementTokens return the list of tokens m is replaced with. Tokens in
// the returned list have only the Rune and Value fields valid.
func (m *Macro) ReplacementTokens() []Token {
	if m.repl2 != nil {
		return m.repl2
	}

	m.repl2 = make([]Token, len(m.repl))
	for i, v := range m.repl {
		m.repl2[i] = Token{Rune: v.char, Value: v.value, Src: v.src}
	}
	return m.repl2
}

// IsFnLike reports whether m is a function-like macro.
func (m *Macro) IsFnLike() bool { return m.isFnLike }

func (m *Macro) isNamedVariadicParam(nm StringID) bool {
	return m.namedVariadic && nm == m.fp[len(m.fp)-1]
}

func (m *Macro) param2(varArgs []cppToken, ap [][]cppToken, nm StringID, out *[]cppToken, argIndex *int) bool {
	*out = nil
	if nm == idVaArgs || m.isNamedVariadicParam(nm) {
		if !m.variadic {
			return false
		}

		*out = append([]cppToken(nil), varArgs...)
		return true
	}

	for i, v := range m.fp {
		if v == nm {
			if i < len(ap) {
				a := ap[i]
				for len(a) != 0 && a[0].char == ' ' {
					a = a[1:]
				}
				*out = a
			}
			if argIndex != nil {
				*argIndex = i
			}
			return true
		}
	}
	return false
}

func (m *Macro) param(varArgs []cppToken, ap [][]cppToken, nm StringID, out *[]cppToken) bool {
	// trc("select (A) varArgs %q, ap %v, nm %q, out %q", cppToksStr(varArgs, "|"), cppToksStr2(ap), nm, cppToksStr(*out, "|"))
	// defer func() {
	// 	trc("select (A) varArgs %q, ap %v, nm %q, out %q", cppToksStr(varArgs, "|"), cppToksStr2(ap), nm, cppToksStr(*out, "|"))
	// }()
	return m.param2(varArgs, ap, nm, out, nil)
}

// --------------------------------------------------------------- Preprocessor

type cpp struct {
	counter      int
	counterMacro Macro
	ctx          *context
	dateMacro    Macro
	file         *tokenFile
	fileMacro    Macro
	in           chan []token3
	inBuf        []token3
	includeLevel int
	lineMacro    Macro
	macroStack   map[StringID][]*Macro
	macros       map[StringID]*Macro
	out          chan *[]token4
	outBuf       *[]token4
	pragmaOpBuf  []token4
	rq           chan struct{}
	timeMacro    Macro
	ungetBuf

	last rune

	intmaxChecked bool
	nonFirstRead  bool
	seenEOF       bool
	inPragmaOp    bool
}

func newCPP(ctx *context) *cpp {
	b := token4Pool.Get().(*[]token4)
	*b = (*b)[:0]
	r := &cpp{
		ctx:        ctx,
		macroStack: map[StringID][]*Macro{},
		macros:     map[StringID]*Macro{},
		outBuf:     b,
	}
	r.counterMacro = Macro{repl: []token3{{char: PPNUMBER}}}
	r.dateMacro = Macro{repl: []token3{{char: STRINGLITERAL}}}
	r.timeMacro = Macro{repl: []token3{{char: STRINGLITERAL}}}
	r.fileMacro = Macro{repl: []token3{{char: STRINGLITERAL}}}
	r.lineMacro = Macro{repl: []token3{{char: PPNUMBER}}}
	r.macros = map[StringID]*Macro{
		idCOUNTER: &r.counterMacro,
		idDATE:    &r.dateMacro,
		idFILE:    &r.fileMacro,
		idLINE:    &r.lineMacro,
		idTIME:    &r.timeMacro,
	}
	t := time.Now()
	// This macro expands to a string constant that describes the date on which the
	// preprocessor is being run. The string constant contains eleven characters
	// and looks like "Feb 12 1996". If the day of the month is less than 10, it is
	// padded with a space on the left.
	r.dateMacro.repl[0].value = dict.sid(t.Format("\"Jan _2 2006\""))
	// This macro expands to a string constant that describes the time at which the
	// preprocessor is being run. The string constant contains eight characters and
	// looks like "23:59:01".
	r.timeMacro.repl[0].value = dict.sid(t.Format("\"15:04:05\""))
	return r
}

func (c *cpp) cppToks(toks []token3) (r []cppToken) {
	r = make([]cppToken, len(toks))
	for i, v := range toks {
		r[i].token4.token3 = v
		r[i].token4.file = c.file
	}
	return r
}

func (c *cpp) err(n node, msg string, args ...interface{}) (stop bool) {
	var position token.Position
	switch x := n.(type) {
	case nil:
	case token4:
		position = x.Position()
	default:
		if p := n.Pos(); p.IsValid() {
			position = c.file.PositionFor(p, true)
		}
	}
	return c.ctx.err(position, msg, args...)
}

func (c *cpp) read() (cppToken, bool) {
	if len(c.ungetBuf) != 0 {
		return c.ungetBuf.read(), true
	}

	if len(c.inBuf) == 0 {
		if c.seenEOF {
			return cppToken{}, false
		}

		if c.nonFirstRead {
			c.rq <- struct{}{}
		}
		c.nonFirstRead = true

		var ok bool
		if c.inBuf, ok = <-c.in; !ok {
			c.seenEOF = true
			return cppToken{}, false
		}
	}

	tok := c.inBuf[0]
	c.inBuf = c.inBuf[1:]
	return cppToken{token4{token3: tok, file: c.file}, nil}, true
}

func (c *cpp) write(tok cppToken) {
	if tok.char == ' ' && c.last == ' ' {
		return
	}

	if c.ctx.cfg.PreprocessOnly {
		switch {
		case
			//TODO cover ALL the bad combinations
			c.last == '+' && tok.char == '+',
			c.last == '+' && tok.char == INC,
			c.last == '-' && tok.char == '-',
			c.last == '-' && tok.char == DEC,
			c.last == IDENTIFIER && tok.char == IDENTIFIER,
			c.last == PPNUMBER && tok.char == '+', //TODO not when ends in a digit
			c.last == PPNUMBER && tok.char == '-': //TODO not when ends in a digit

			sp := tok
			sp.char = ' '
			sp.value = idSpace
			*c.outBuf = append(*c.outBuf, sp.token4)
		}
	}

	//dbg("%T.write %q", c, tok)
	c.last = tok.char
	switch {
	case c.inPragmaOp:
	out:
		switch tok.char {
		case ')':
			c.inPragmaOp = false
			b := c.pragmaOpBuf
			if len(b) == 0 || b[0].char != '(' {
				c.err(b[0], "expected (")
				break
			}

			var a []string
			for _, v := range b[1:] {
				if v.char != STRINGLITERAL {
					c.err(v, "expected string literal")
					break out
				}

				a = append(a, v.String())
			}

			if len(a) == 0 {
				break
			}

			for i, v := range a {
				// [0], 6.10.9, 1
				if v[0] == 'L' {
					v = v[1:]
				}
				v = v[1 : len(v)-1]
				v = strings.ReplaceAll(v, `\"`, `"`)
				a[i] = "#pragma " + strings.ReplaceAll(v, `\\`, `\`) + "\n"
			}
			src := strings.Join(a, "")
			s := newScanner0(c.ctx, strings.NewReader(src), tokenNewFile("", len(src)), 4096)
			if ppf := s.translationPhase3(); ppf != nil {
				ppf.translationPhase4(c)
			}
		default:
			c.pragmaOpBuf = append(c.pragmaOpBuf, tok.token4)
		}
	default:
		switch {
		case tok.char == '\n':
			*c.outBuf = append(*c.outBuf, tok.token4)
			c.out <- c.outBuf
			b := token4Pool.Get().(*[]token4)
			*b = (*b)[:0]
			c.outBuf = b
		case tok.char == IDENTIFIER && tok.value == idPragmaOp:
			if len(*c.outBuf) != 0 {
				tok.char = '\n'
				tok.value = 0
				*c.outBuf = append(*c.outBuf, tok.token4)
				c.out <- c.outBuf
				b := token4Pool.Get().(*[]token4)
				*b = (*b)[:0]
				c.outBuf = b
			}
			c.inPragmaOp = true
			c.pragmaOpBuf = c.pragmaOpBuf[:0]
		default:
			*c.outBuf = append(*c.outBuf, tok.token4)
		}
	}
}

func ltrim4(toks []token4) []token4 {
	for len(toks) != 0 && toks[0].char == ' ' {
		toks = toks[1:]
	}
	return toks
}

func (c *cpp) writes(toks []cppToken) {
	for _, v := range toks {
		c.write(v)
	}
}

// [1]pg 1.
//
// expand(TS) /* recur, substitute, pushback, rescan */
// {
// 	if TS is {} then
//		// ---------------------------------------------------------- A
// 		return {};
//
// 	else if TS is T^HS • TS’ and T is in HS then
//		//----------------------------------------------------------- B
// 		return T^HS • expand(TS’);
//
// 	else if TS is T^HS • TS’ and T is a "()-less macro" then
//		// ---------------------------------------------------------- C
// 		return expand(subst(ts(T), {}, {}, HS \cup {T}, {}) • TS’ );
//
// 	else if TS is T^HS •(•TS’ and T is a "()’d macro" then
//		// ---------------------------------------------------------- D
// 		check TS’ is actuals • )^HS’ • TS’’ and actuals are "correct for T"
// 		return expand(subst(ts(T), fp(T), actuals,(HS \cap HS’) \cup {T }, {}) • TS’’);
//
//	// ------------------------------------------------------------------ E
// 	note TS must be T^HS • TS’
// 	return T^HS • expand(TS’);
// }
func (c *cpp) expand(ts tokenReader, w tokenWriter, expandDefined bool) {
	// trc("==== expand enter")
start:
	tok, ok := ts.read()
	tok.file = c.file
	// First, if TS is the empty set, the result is the empty set.
	if !ok {
		// ---------------------------------------------------------- A
		// return {};
		// trc("---- expand A")
		return
	}

	// dbg("expand start %q", tok)
	if tok.char == IDENTIFIER {
		nm := tok.value
		if nm == idDefined && expandDefined {
			c.parseDefined(tok, ts, w)
			goto start
		}

		// Otherwise, if the token sequence begins with a token whose
		// hide set contains that token, then the result is the token
		// sequence beginning with that token (including its hide set)
		// followed by the result of expand on the rest of the token
		// sequence.
		if tok.has(nm) {
			// -------------------------------------------------- B
			// return T^HS • expand(TS’);
			// trc("---- expand B")
			// trc("expand write %q", tok)
			w.write(tok)
			goto start
		}

		m := c.macros[nm]
		if m != nil && !m.isFnLike {
			// Otherwise, if the token sequence begins with an
			// object-like macro, the result is the expansion of
			// the rest of the token sequence beginning with the
			// sequence returned by subst invoked with the
			// replacement token sequence for the macro, two empty
			// sets, the union of the macro’s hide set and the
			// macro itself, and an empty set.
			switch nm {
			case idLINE:
				c.lineMacro.repl[0].value = dict.sid(fmt.Sprint(tok.Position().Line))
			case idCOUNTER:
				c.counterMacro.repl[0].value = dict.sid(fmt.Sprint(c.counter))
				c.counter++
			case idTclDefaultDoubleRounding:
				if c.ctx.cfg.ReplaceMacroTclDefaultDoubleRounding != "" {
					m = c.macros[dict.sid(c.ctx.cfg.ReplaceMacroTclDefaultDoubleRounding)]
				}
			case idTclIeeeDoubleRounding:
				if c.ctx.cfg.ReplaceMacroTclIeeeDoubleRounding != "" {
					m = c.macros[dict.sid(c.ctx.cfg.ReplaceMacroTclIeeeDoubleRounding)]
				}
			}
			if m != nil {
				// -------------------------------------------------- C
				// return expand(subst(ts(T), {}, {}, HS \cup {T}, {}) • TS’ );
				// trc("---- expand C")
				hs := hideSet{nm: {}}
				for k, v := range tok.hs {
					hs[k] = v
				}
				os := cppTokensPool.Get().(*[]cppToken)
				toks := c.subst(m, c.cppToks(m.repl), nil, nil, nil, hs, os, expandDefined)
				for i := range toks {
					toks[i].pos = tok.pos
				}
				if len(toks) == 1 {
					toks[0].macro = nm
				}
				ts.ungets(toks)
				(*os) = (*os)[:0]
				cppTokensPool.Put(os)
				goto start
			}
		}

		if m != nil && m.isFnLike {
			switch nm {
			case idFdZero:
				if c.ctx.cfg.ReplaceMacroFdZero != "" {
					m = c.macros[dict.sid(c.ctx.cfg.ReplaceMacroFdZero)]
				}
			}
			if m != nil {
				// -------------------------------------------------- D
				// check TS’ is actuals • )^HS’ • TS’’ and actuals are "correct for T"
				// return expand(subst(ts(T), fp(T), actuals,(HS \cap HS’) \cup {T }, {}) • TS’’);
				// trc("---- expand D")
				hs := tok.hs
				var skip []cppToken
			again:
				t2, ok := ts.read()
				if !ok {
					// dbg("expand write %q", tok)
					w.write(tok)
					ts.ungets(skip)
					goto start
				}

				skip = append(skip, t2)
				switch t2.char {
				case '\n', ' ':
					goto again
				case '(':
					// ok
				default:
					w.write(tok)
					ts.ungets(skip)
					goto start
				}

				varArgs, ap, hs2 := c.actuals(m, ts)
				if nm == idHasIncludeImpl { //TODO-
					if len(ap) != 1 || len(ap[0]) != 1 {
						panic(todo("internal error"))
					}

					arg := ap[0][0].value.String()
					switch {
					case strings.HasPrefix(arg, `"\"`): // `"\"stdio.h\""`
						arg = arg[2:len(arg)-3] + `"` // -> `"stdio.h"`
					case strings.HasPrefix(arg, `"<`): // `"<stdio.h>"`
						arg = arg[1 : len(arg)-1] // -> `<stdio.h>`
					default:
						arg = ""
					}
					var tok3 token3
					tok3.char = PPNUMBER
					tok3.value = idZero
					if arg != "" {
						if _, err := c.hasInclude(&tok, arg); err == nil {
							tok3.value = idOne
						}
					}
					tok := cppToken{token4{token3: tok3, file: c.file}, nil}
					ts.ungets([]cppToken{tok})
					goto start
				}

				switch {
				case len(hs2) == 0:
					hs2 = hideSet{nm: {}}
				default:
					nhs := hideSet{}
					for k := range hs {
						if _, ok := hs2[k]; ok {
							nhs[k] = struct{}{}
						}
					}
					nhs[nm] = struct{}{}
					hs2 = nhs
				}
				os := cppTokensPool.Get().(*[]cppToken)
				toks := c.subst(m, c.cppToks(m.repl), m.fp, varArgs, ap, hs2, os, expandDefined)
				for i := range toks {
					toks[i].pos = tok.pos
				}
				ts.ungets(toks)
				(*os) = (*os)[:0]
				cppTokensPool.Put(os)
				goto start
			}
		}
	}

	// ------------------------------------------------------------------ E
	// note TS must be T^HS • TS’
	// return T^HS • expand(TS’);
	// trc("---- expand E")
	// trc("expand write %q", tok)
	w.write(tok)
	goto start
}

func (c *cpp) hasInclude(n Node, nm string) (rs string, err error) {
	// nm0 := nm
	// defer func() { //TODO-
	// 	trc("nm0 %q nm %q rs %q err %v", nm0, nm, rs, err)
	// }()
	var (
		b     byte
		paths []string
		sys   bool
	)
	switch {
	case nm != "" && nm[0] == '"':
		paths = c.ctx.includePaths
		b = '"'
	case nm != "" && nm[0] == '<':
		paths = c.ctx.sysIncludePaths
		sys = true
		b = '>'
	case nm == "":
		return "", fmt.Errorf("%v: invalid empty include argument", n.Position())
	default:
		return "", fmt.Errorf("%v: invalid include argument %s", n.Position(), nm)
	}

	x := strings.IndexByte(nm[1:], b)
	if x < 0 {
		return "", fmt.Errorf("%v: invalid include argument %s", n.Position(), nm)
	}

	nm = filepath.FromSlash(nm[1 : x+1])
	switch {
	case filepath.IsAbs(nm):
		fi, err := c.ctx.statFile(nm, sys)
		if err != nil {
			return "", fmt.Errorf("%v: %s", n.Position(), err)
		}

		if fi.IsDir() {
			return "", fmt.Errorf("%v: %s is a directory, not a file", n.Position(), nm)
		}

		return nm, nil
	default:
		dir := filepath.Dir(c.file.Name())
		for _, v := range paths {
			if v == "@" {
				v = dir
			}

			var p string
			switch {
			case strings.HasPrefix(nm, "./"):
				wd := c.ctx.cfg.WorkingDir
				if wd == "" {
					var err error
					if wd, err = os.Getwd(); err != nil {
						return "", fmt.Errorf("%v: cannot determine working dir: %v", n.Position(), err)
					}
				}
				p = filepath.Join(wd, nm)
			default:
				p = filepath.Join(v, nm)
			}
			fi, err := c.ctx.statFile(p, sys)
			if err != nil || fi.IsDir() {
				continue
			}

			return p, nil
		}
		wd, _ := os.Getwd()
		return "", fmt.Errorf("include file not found: %s (wd %s)\nsearch paths:\n\t%s", nm, wd, strings.Join(paths, "\n\t"))
	}
}

func (c *cpp) actuals(m *Macro, r tokenReader) (varArgs []cppToken, ap [][]cppToken, hs hideSet) {
	var lvl, n int
	varx := len(m.fp)
	if m.namedVariadic {
		varx--
	}
	var last rune
	for {
		t, ok := r.read()
		if !ok {
			c.err(t, "unexpected EOF")
			return nil, nil, nil
		}

		// 6.10.3, 10
		//
		// Within the sequence of preprocessing tokens making up an
		// invocation of a function-like macro, new-line is considered
		// a normal white-space character.
		if t.char == '\n' {
			t.char = ' '
			t.value = idSpace
		}
		if t.char == ' ' && last == ' ' {
			continue
		}

		last = t.char
		switch t.char {
		case ',':
			if lvl == 0 {
				if n >= varx && (len(varArgs) != 0 || !isWhite(t.char)) {
					varArgs = append(varArgs, t)
				}
				n++
				continue
			}
		case ')':
			if lvl == 0 {
				for len(ap) < len(m.fp) {
					ap = append(ap, nil)
				}
				for i, v := range ap {
					ap[i] = c.trim(v)
				}
				// for i, v := range ap {
				// 	dbg("%T.actuals %v/%v %q", c, i, len(ap), tokStr(v, "|"))
				// }
				return c.trim(varArgs), ap, t.hs
			}
			lvl--
		case '(':
			lvl++
		}
		if n >= varx && (len(varArgs) != 0 || !isWhite(t.char)) {
			varArgs = append(varArgs, t)
		}
		for len(ap) <= n {
			ap = append(ap, []cppToken{})
		}
		ap[n] = append(ap[n], t)
	}
}

// [1]pg 2.
//
// subst(IS, FP, AP, HS, OS) /* substitute args, handle stringize and paste */
// {
// 	if IS is {} then
//		// ---------------------------------------------------------- A
// 		return hsadd(HS, OS);
//
// 	else if IS is # • T • IS’ and T is FP[i] then
//		// ---------------------------------------------------------- B
// 		return subst(IS’, FP, AP, HS, OS • stringize(select(i, AP)));
//
// 	else if IS is ## • T • IS’ and T is FP[i] then
//	{
//		// ---------------------------------------------------------- C
// 		if select(i, AP) is {} then /* only if actuals can be empty */
//			// -------------------------------------------------- D
// 			return subst(IS’, FP, AP, HS, OS);
// 		else
//			// -------------------------------------------------- E
// 			return subst(IS’, FP, AP, HS, glue(OS, select(i, AP)));
// 	}
//
// 	else if IS is ## • T^HS’ • IS’ then
//		// ---------------------------------------------------------- F
// 		return subst(IS’, FP, AP, HS, glue(OS, T^HS’));
//
// 	else if IS is T • ##^HS’ • IS’ and T is FP[i] then
//	{
//		// ---------------------------------------------------------- G
// 		if select(i, AP) is {} then /* only if actuals can be empty */
//		{
//			// -------------------------------------------------- H
// 			if IS’ is T’ • IS’’ and T’ is FP[j] then
//				// ------------------------------------------ I
// 				return subst(IS’’, FP, AP, HS, OS • select(j, AP));
// 			else
//				// ------------------------------------------ J
// 				return subst(IS’, FP, AP, HS, OS);
// 		}
//		else
//			// -------------------------------------------------- K
// 			return subst(##^HS’ • IS’, FP, AP, HS, OS • select(i, AP));
//
//	}
//
// 	else if IS is T • IS’ and T is FP[i] then
//		// ---------------------------------------------------------- L
// 		return subst(IS’, FP, AP, HS, OS • expand(select(i, AP)));
//
//	// ------------------------------------------------------------------ M
// 	note IS must be T^HS’ • IS’
// 	return subst(IS’, FP, AP, HS, OS • T^HS’);
// }
//
// A quick overview of subst is that it walks through the input sequence, IS,
// building up an output sequence, OS, by handling each token from left to
// right. (The order that this operation takes is left to the implementation
// also, walking from left to right is more natural since the rest of the
// algorithm is constrained to this ordering.) Stringizing is easy, pasting
// requires trickier handling because the operation has a bunch of
// combinations. After the entire input sequence is finished, the updated hide
// set is applied to the output sequence, and that is the result of subst.
func (c *cpp) subst(m *Macro, is []cppToken, fp []StringID, varArgs []cppToken, ap [][]cppToken, hs hideSet, os *[]cppToken, expandDefined bool) (r []cppToken) {
	var ap0 [][]cppToken
	for _, v := range ap {
		ap0 = append(ap0, append([]cppToken(nil), v...))
	}
	// trc("==== subst: is %q, fp, %v ap@%p %v", cppToksStr(is, "|"), fp, &ap, cppToksStr2(ap))
start:
	// trc("start: is %q, fp %v, ap@%p %v, os %q", cppToksStr(is, "|"), fp, &ap, cppToksStr2(ap), cppToksStr(*os, "|"))
	if len(is) == 0 {
		// ---------------------------------------------------------- A
		// return hsadd(HS, OS);
		// trc("---- A")
		// trc("subst RETURNS %q", cppToksStr(*os, "|"))
		return c.hsAdd(hs, os)
	}

	tok := is[0]
	var arg []cppToken
	if tok.char == '#' {
		if len(is) > 1 && is[1].char == IDENTIFIER && m.param(varArgs, ap0, is[1].value, &arg) {
			// -------------------------------------------------- B
			// return subst(IS’, FP, AP, HS, OS • stringize(select(i, AP)));
			// trc("---- subst B")
			*os = append(*os, c.stringize(arg))
			is = is[2:]
			goto start
		}
	}

	if tok.char == PPPASTE {
		if len(is) > 1 && is[1].char == IDENTIFIER && m.param(varArgs, ap0, is[1].value, &arg) {
			// -------------------------------------------------- C
			// trc("---- subst C")
			if len(arg) == 0 {
				// TODO "only if actuals can be empty"
				// ------------------------------------------ D
				// return subst(IS’, FP, AP, HS, OS);
				// trc("---- D")
				if c := len(*os); c != 0 && (*os)[c-1].char == ',' {
					*os = (*os)[:c-1]
				}
				is = is[2:]
				goto start
			}

			// -------------------------------------------------- E
			// return subst(IS’, FP, AP, HS, glue(OS, select(i, AP)));
			// trc("---- subst E, arg %q", cppToksStr(arg, "|"))
			*os = c.glue(*os, arg)
			is = is[2:]
			goto start
		}

		if len(is) > 1 {
			// -------------------------------------------------- F
			// return subst(IS’, FP, AP, HS, glue(OS, T^HS’));
			// trc("---- subst F")
			*os = c.glue(*os, is[1:2])
			is = is[2:]
			goto start
		}
	}

	if tok.char == IDENTIFIER && (len(is) > 1 && is[1].char == PPPASTE) && m.param(varArgs, ap0, tok.value, &arg) {
		// ---------------------------------------------------------- G
		// trc("---- subst G")
		if len(arg) == 0 {
			// TODO "only if actuals can be empty"
			// -------------------------------------------------- H
			// trc("---- subst H")
			is = is[2:] // skip T##
			if len(is) > 0 && is[0].char == IDENTIFIER && m.param(varArgs, ap, is[0].value, &arg) {
				// -------------------------------------------------- I
				// return subst(IS’’, FP, AP, HS, OS • select(j, AP));
				// trc("---- subst I")
				*os = append(*os, arg...)
				is = is[1:]
				goto start
			} else {
				// -------------------------------------------------- J
				// return subst(IS’, FP, AP, HS, OS);
				// trc("---- subst J")
				goto start
			}
		}

		// ---------------------------------------------------------- K
		// return subst(##^HS’ • IS’, FP, AP, HS, OS • select(i, AP));
		// trc("---- subst K")
		*os = append(*os, arg...)
		is = is[1:]
		goto start
	}

	ax := -1
	if tok.char == IDENTIFIER && m.param2(varArgs, ap, tok.value, &arg, &ax) {
		// ------------------------------------------ L
		// return subst(IS’, FP, AP, HS, OS • expand(select(i, AP)));
		// trc("---- subst L")
		// if toks, ok := cache[tok.value]; ok {
		// 	os = append(os, toks...)
		// 	is = is[1:]
		// 	goto start
		// }

		sel := cppReader{buf: arg}
		var w cppWriter
		// trc("---- L(1) ap@%p %v", &ap, cppToksStr2(ap))
		c.expand(&sel, &w, expandDefined)
		// trc("---- L(2) ap@%p %v", &ap, cppToksStr2(ap))
		*os = append(*os, w.toks...)
		if ax >= 0 {
			ap[ax] = w.toks
		}
		is = is[1:]
		goto start
	}

	// ------------------------------------------------------------------ M
	// note IS must be T^HS’ • IS’
	// return subst(IS’, FP, AP, HS, OS • T^HS’);
	*os = append(*os, tok)
	is = is[1:]
	// trc("---- subst M: is %q, os %q", cppToksStr(is, "|"), cppToksStr(*os, "|"))
	goto start
}

// paste last of left side with first of right side
//
// [1] pg. 3
//
//TODO implement properly [0], 6.10.3.3, 2. Must rescan the resulting token(s).
//
// $ cat main.c
// #include <stdio.h>
//
// #define foo(a, b) a ## b
//
// int main() {
// 	int i = 42;
// 	i foo(+, +);
// 	printf("%i\n", i);
// 	return 0;
// }
// $ rm -f a.out ; gcc -Wall main.c && ./a.out ; echo $?
// 43
// 0
// $
//
// ----------------------------------------------------------------------------
//	glue(LS,RS ) /* paste last of left side with first of right side */
//	{
//		if LS is L^HS and RS is R^HS’ • RS’ then
//			return L&R^(HS∩HS’) • RS’;	/* undefined if L&R is invalid */

//		// note LS must be L HS • LS’
//		return L^HS • glue(LS’,RS );
//	}
func (c *cpp) glue(ls, rs []cppToken) (out []cppToken) {
	// trc("ls %q, rs %q", cppToksStr(ls, "|"), cppToksStr(rs, "|"))
	if len(rs) == 0 {
		return ls
	}

	if len(ls) == 0 {
		return rs
	}

	l := ls[len(ls)-1]
	ls = ls[:len(ls)-1]
	r := rs[0]
	rs = rs[1:]

	if l.char == IDENTIFIER && l.value == idL && r.char == STRINGLITERAL {
		l.char = LONGSTRINGLITERAL
	}
	l.value = dict.sid(l.String() + r.String())
	return append(append(ls, l), rs...)
}

// Given a token sequence, stringize returns a single string literal token
// containing the concatenated spellings of the tokens.
//
// [1] pg. 3
func (c *cpp) stringize(s0 []cppToken) (r cppToken) {
	// 6.10.3.2
	//
	// Each occurrence of white space between the argument’s preprocessing
	// tokens becomes a single space character in the character string
	// literal.
	s := make([]cppToken, 0, len(s0))
	var last rune
	for i := range s0 {
		t := s0[i]
		if isWhite(t.char) {
			t.char = ' '
			t.value = idSpace
			if last == ' ' {
				continue
			}
		}

		last = t.char
		s = append(s, t)
	}

	// White space before the first preprocessing token and after the last
	// preprocessing token composing the argument is deleted.
	s = c.trim(s)

	// The character string literal corresponding to an empty argument is
	// ""
	if len(s) == 0 {
		r.hs = nil
		r.char = STRINGLITERAL
		r.value = idEmptyString
		return r
	}

	var a []string
	// Otherwise, the original spelling of each preprocessing token in the
	// argument is retained in the character string literal, except for
	// special handling for producing the spelling of string literals and
	// character constants: a \ character is inserted before each " and \
	// character of a character constant or string literal (including the
	// delimiting " characters), except that it is implementation-defined
	// whether a \ character is inserted before the \ character beginning a
	// universal character name.
	for _, v := range s {
		s := v.String()
		switch v.char {
		case CHARCONST, STRINGLITERAL:
			s = strings.ReplaceAll(s, `\`, `\\`)
			s = strings.ReplaceAll(s, `"`, `\"`)
		case LONGCHARCONST, LONGSTRINGLITERAL:
			panic("TODO")
		}
		a = append(a, s)
	}
	r = s[0]
	r.hs = nil
	r.char = STRINGLITERAL
	r.value = dict.sid(`"` + strings.Join(a, "") + `"`)
	return r
}

func (c *cpp) trim(toks []cppToken) []cppToken {
	for len(toks) != 0 && isWhite(toks[0].char) {
		toks = toks[1:]
	}
	for len(toks) != 0 && isWhite(toks[len(toks)-1].char) {
		toks = toks[:len(toks)-1]
	}
	return toks
}

func (c *cpp) hsAdd(hs hideSet, toks *[]cppToken) []cppToken {
	for i, v := range *toks {
		if v.hs == nil {
			v.hs = hideSet{}
		}
		for k, w := range hs {
			v.hs[k] = w
		}
		v.file = c.file
		(*toks)[i] = v
	}
	return *toks
}

func (c *cpp) parseDefined(tok cppToken, r tokenReader, w tokenWriter) {
	toks := []cppToken{tok}
	if tok = c.scanToNonBlankToken(&toks, r, w); tok.char < 0 {
		return
	}

	switch tok.char {
	case IDENTIFIER:
		// ok
	case '(':
		if tok = c.scanToNonBlankToken(&toks, r, w); tok.char < 0 {
			return
		}

		if tok.char != IDENTIFIER {
			w.writes(toks)
			return
		}

		tok2 := c.scanToNonBlankToken(&toks, r, w)
		if tok2.char < 0 {
			return
		}

		if tok2.char != ')' {
			w.writes(toks)
			return
		}
	}

	tok.char = PPNUMBER
	switch _, ok := c.macros[tok.value]; {
	case ok:
		tok.value = idOne
	default:
		tok.value = idZero
	}
	w.write(tok)
}

func (c *cpp) scanToNonBlankToken(toks *[]cppToken, r tokenReader, w tokenWriter) cppToken {
	tok, ok := r.read()
	if !ok {
		w.writes(*toks)
		tok.char = -1
		return tok
	}

	*toks = append(*toks, tok)
	if tok.char == ' ' || tok.char == '\n' {
		if tok, ok = r.read(); !ok {
			w.writes(*toks)
			tok.char = -1
			return tok
		}

		*toks = append(*toks, tok)
	}
	return (*toks)[len(*toks)-1]
}

// [0], 6.10.1
func (c *cpp) evalInclusionCondition(expr []token3) (r bool) {
	if !c.intmaxChecked {
		if m := c.macros[idIntMaxWidth]; m != nil && len(m.repl) != 0 {
			if val := c.intMaxWidth(); val != 0 && val != 64 {
				c.err(m.name, "%s is %v, but only 64 is supported", idIntMaxWidth, val)
			}
		}
		c.intmaxChecked = true
	}

	val := c.eval(expr)
	return val != nil && c.isNonZero(val)
}

func (c *cpp) intMaxWidth() int64 {
	if m := c.macros[idIntMaxWidth]; m != nil && len(m.repl) != 0 {
		switch x := c.eval(m.repl).(type) {
		case nil:
			return 0
		case int64:
			return x
		case uint64:
			return int64(x)
		default:
			panic(internalError())
		}
	}
	return 0
}

func (c *cpp) eval(expr []token3) interface{} {
	toks := make([]cppToken, len(expr))
	for i, v := range expr {
		toks[i] = cppToken{token4{token3: v}, nil}
	}
	var w cppWriter
	c.expand(&cppReader{buf: toks}, &w, true)
	toks = w.toks
	p := 0
	for _, v := range toks {
		switch v.char {
		case ' ', '\n':
			// nop
		default:
			toks[p] = v
			p++
		}
	}
	toks = toks[:p]
	s := cppScanner(toks)
	val := c.expression(&s, true)
	switch s.peek().char {
	case -1, '#':
		// ok
	default:
		t := s.peek()
		c.err(t, "unexpected %s", tokName(t.char))
		return nil
	}
	return val
}

// [0], 6.5.17 Comma operator
//
//  expression:
// 	assignment-expression
// 	expression , assignment-expression
func (c *cpp) expression(s *cppScanner, eval bool) interface{} {
	for {
		r := c.assignmentExpression(s, eval)
		if s.peek().char != ',' {
			return r
		}

		s.next()
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
func (c *cpp) assignmentExpression(s *cppScanner, eval bool) interface{} {
	return c.conditionalExpression(s, eval)
}

// [0], 6.5.15 Conditional operator
//
//  conditional-expression:
//		logical-OR-expression
//		logical-OR-expression ? expression : conditional-expression
func (c *cpp) conditionalExpression(s *cppScanner, eval bool) interface{} {
	expr := c.logicalOrExpression(s, eval)
	if s.peek().char == '?' {
		s.next()
		exprIsNonZero := c.isNonZero(expr)
		expr2 := c.conditionalExpression(s, exprIsNonZero)
		if tok := s.peek(); tok.char != ':' {
			c.err(tok, "expected ':'")
			return expr
		}

		s.next()
		expr3 := c.conditionalExpression(s, !exprIsNonZero)

		// [0] 6.5.15
		//
		// 5. If both the second and third operands have arithmetic type, the result
		// type that would be determined by the usual arithmetic conversions, were they
		// applied to those two operands, is the type of the result.
		x := c.operand(expr2)
		y := c.operand(expr3)
		if x != nil && y != nil {
			x, y = usualArithmeticConversions(c.ctx, nil, x, y, false)
			expr2 = c.fromOperand(x)
			expr3 = c.fromOperand(y)
		}

		switch {
		case exprIsNonZero:
			expr = expr2
		default:
			expr = expr3
		}
	}
	return expr
}

func (c *cpp) operand(v interface{}) Operand {
	switch x := v.(type) {
	case int64:
		return &operand{typ: &typeBase{size: 8, kind: byte(LongLong), flags: fSigned}, value: Int64Value(x)}
	case uint64:
		return &operand{typ: &typeBase{size: 8, kind: byte(ULongLong)}, value: Uint64Value(x)}
	default:
		return nil
	}
}

func (c *cpp) fromOperand(op Operand) interface{} {
	switch x := op.Value().(type) {
	case Int64Value:
		return int64(x)
	case Uint64Value:
		return uint64(x)
	default:
		return nil
	}
}

// [0], 6.5.14 Logical OR operator
//
//  logical-OR-expression:
//		logical-AND-expression
//		logical-OR-expression || logical-AND-expression
func (c *cpp) logicalOrExpression(s *cppScanner, eval bool) interface{} {
	lhs := c.logicalAndExpression(s, eval)
	for s.peek().char == OROR {
		s.next()
		if c.isNonZero(lhs) {
			eval = false
		}
		rhs := c.logicalAndExpression(s, eval)
		if c.isNonZero(lhs) || c.isNonZero(rhs) {
			lhs = int64(1)
		}
	}
	return lhs
}

// [0], 6.5.13 Logical AND operator
//
//  logical-AND-expression:
//		inclusive-OR-expression
//		logical-AND-expression && inclusive-OR-expression
func (c *cpp) logicalAndExpression(s *cppScanner, eval bool) interface{} {
	lhs := c.inclusiveOrExpression(s, eval)
	for s.peek().char == ANDAND {
		s.next()
		if c.isZero(lhs) {
			eval = false
		}
		rhs := c.inclusiveOrExpression(s, eval)
		if c.isZero(lhs) || c.isZero(rhs) {
			lhs = int64(0)
		}
	}
	return lhs
}

func (c *cpp) isZero(val interface{}) bool {
	switch x := val.(type) {
	case int64:
		return x == 0
	case uint64:
		return x == 0
	}
	panic(internalError())
}

// [0], 6.5.12 Bitwise inclusive OR operator
//
//  inclusive-OR-expression:
//		exclusive-OR-expression
//		inclusive-OR-expression | exclusive-OR-expression
func (c *cpp) inclusiveOrExpression(s *cppScanner, eval bool) interface{} {
	lhs := c.exclusiveOrExpression(s, eval)
	for s.peek().char == '|' {
		s.next()
		rhs := c.exclusiveOrExpression(s, eval)
		if eval {
			switch x := lhs.(type) {
			case int64:
				switch y := rhs.(type) {
				case int64:
					lhs = x | y
				case uint64:
					lhs = uint64(x) | y
				}
			case uint64:
				switch y := rhs.(type) {
				case int64:
					lhs = x | uint64(y)
				case uint64:
					lhs = x | y
				}
			}
		}
	}
	return lhs
}

// [0], 6.5.11 Bitwise exclusive OR operator
//
//  exclusive-OR-expression:
//		AND-expression
//		exclusive-OR-expression ^ AND-expression
func (c *cpp) exclusiveOrExpression(s *cppScanner, eval bool) interface{} {
	lhs := c.andExpression(s, eval)
	for s.peek().char == '^' {
		s.next()
		rhs := c.andExpression(s, eval)
		if eval {
			switch x := lhs.(type) {
			case int64:
				switch y := rhs.(type) {
				case int64:
					lhs = x ^ y
				case uint64:
					lhs = uint64(x) ^ y
				}
			case uint64:
				switch y := rhs.(type) {
				case int64:
					lhs = x ^ uint64(y)
				case uint64:
					lhs = x ^ y
				}
			}
		}
	}
	return lhs
}

// [0], 6.5.10 Bitwise AND operator
//
//  AND-expression:
// 		equality-expression
// 		AND-expression & equality-expression
func (c *cpp) andExpression(s *cppScanner, eval bool) interface{} {
	lhs := c.equalityExpression(s, eval)
	for s.peek().char == '&' {
		s.next()
		rhs := c.equalityExpression(s, eval)
		if eval {
			switch x := lhs.(type) {
			case int64:
				switch y := rhs.(type) {
				case int64:
					lhs = x & y
				case uint64:
					lhs = uint64(x) & y
				}
			case uint64:
				switch y := rhs.(type) {
				case int64:
					lhs = x & uint64(y)
				case uint64:
					lhs = x & y
				}
			}
		}
	}
	return lhs
}

// [0], 6.5.9 Equality operators
//
//  equality-expression:
//		relational-expression
//		equality-expression == relational-expression
//		equality-expression != relational-expression
func (c *cpp) equalityExpression(s *cppScanner, eval bool) interface{} {
	lhs := c.relationalExpression(s, eval)
	for {
		var v bool
		switch s.peek().char {
		case EQ:
			s.next()
			rhs := c.relationalExpression(s, eval)
			if eval {
				switch x := lhs.(type) {
				case int64:
					switch y := rhs.(type) {
					case int64:
						v = x == y
					case uint64:
						v = uint64(x) == y
					}
				case uint64:
					switch y := rhs.(type) {
					case int64:
						v = x == uint64(y)
					case uint64:
						v = x == y
					}
				}
			}
		case NEQ:
			s.next()
			rhs := c.relationalExpression(s, eval)
			if eval {
				switch x := lhs.(type) {
				case int64:
					switch y := rhs.(type) {
					case int64:
						v = x != y
					case uint64:
						v = uint64(x) != y
					}
				case uint64:
					switch y := rhs.(type) {
					case int64:
						v = x != uint64(y)
					case uint64:
						v = x != y
					}
				}
			}
		default:
			return lhs
		}
		switch {
		case v:
			lhs = int64(1)
		default:
			lhs = int64(0)
		}
	}
}

// [0], 6.5.8 Relational operators
//
//  relational-expression:
//		shift-expression
//		relational-expression <  shift-expression
//		relational-expression >  shift-expression
//		relational-expression <= shift-expression
//		relational-expression >= shift-expression
func (c *cpp) relationalExpression(s *cppScanner, eval bool) interface{} {
	lhs := c.shiftExpression(s, eval)
	for {
		var v bool
		switch s.peek().char {
		case '<':
			s.next()
			rhs := c.shiftExpression(s, eval)
			if eval {
				switch x := lhs.(type) {
				case int64:
					switch y := rhs.(type) {
					case int64:
						v = x < y
					case uint64:
						v = uint64(x) < y
					}
				case uint64:
					switch y := rhs.(type) {
					case int64:
						v = x < uint64(y)
					case uint64:
						v = x < y
					}
				}
			}
		case '>':
			s.next()
			rhs := c.shiftExpression(s, eval)
			if eval {
				switch x := lhs.(type) {
				case int64:
					switch y := rhs.(type) {
					case int64:
						v = x > y
					case uint64:
						v = uint64(x) > y
					}
				case uint64:
					switch y := rhs.(type) {
					case int64:
						v = x > uint64(y)
					case uint64:
						v = x > y
					}
				}
			}
		case LEQ:
			s.next()
			rhs := c.shiftExpression(s, eval)
			if eval {
				switch x := lhs.(type) {
				case int64:
					switch y := rhs.(type) {
					case int64:
						v = x <= y
					case uint64:
						v = uint64(x) <= y
					}
				case uint64:
					switch y := rhs.(type) {
					case int64:
						v = x <= uint64(y)
					case uint64:
						v = x <= y
					}
				}
			}
		case GEQ:
			s.next()
			rhs := c.shiftExpression(s, eval)
			if eval {
				switch x := lhs.(type) {
				case int64:
					switch y := rhs.(type) {
					case int64:
						v = x >= y
					case uint64:
						v = uint64(x) >= y
					}
				case uint64:
					switch y := rhs.(type) {
					case int64:
						v = x >= uint64(y)
					case uint64:
						v = x >= y
					}
				}
			}
		default:
			return lhs
		}
		switch {
		case v:
			lhs = int64(1)
		default:
			lhs = int64(0)
		}
	}
}

// [0], 6.5.7 Bitwise shift operators
//
//  shift-expression:
//		additive-expression
//		shift-expression << additive-expression
//		shift-expression >> additive-expression
func (c *cpp) shiftExpression(s *cppScanner, eval bool) interface{} {
	lhs := c.additiveExpression(s, eval)
	for {
		switch s.peek().char {
		case LSH:
			s.next()
			rhs := c.additiveExpression(s, eval)
			if eval {
				switch x := lhs.(type) {
				case int64:
					switch y := rhs.(type) {
					case int64:
						lhs = x << uint(y)
					case uint64:
						lhs = uint64(x) << uint(y)
					}
				case uint64:
					switch y := rhs.(type) {
					case int64:
						lhs = x << uint(y)
					case uint64:
						lhs = x << uint(y)
					}
				}
			}
		case RSH:
			s.next()
			rhs := c.additiveExpression(s, eval)
			if eval {
				switch x := lhs.(type) {
				case int64:
					switch y := rhs.(type) {
					case int64:
						lhs = x >> uint(y)
					case uint64:
						lhs = uint64(x) >> uint(y)
					}
				case uint64:
					switch y := rhs.(type) {
					case int64:
						lhs = x >> uint(y)
					case uint64:
						lhs = x >> uint(y)
					}
				}
			}
		default:
			return lhs
		}
	}
}

// [0], 6.5.6 Additive operators
//
//  additive-expression:
//		multiplicative-expression
//		additive-expression + multiplicative-expression
//		additive-expression - multiplicative-expression
func (c *cpp) additiveExpression(s *cppScanner, eval bool) interface{} {
	lhs := c.multiplicativeExpression(s, eval)
	for {
		switch s.peek().char {
		case '+':
			s.next()
			rhs := c.multiplicativeExpression(s, eval)
			if eval {
				switch x := lhs.(type) {
				case int64:
					switch y := rhs.(type) {
					case int64:
						lhs = x + y
					case uint64:
						lhs = uint64(x) + y
					}
				case uint64:
					switch y := rhs.(type) {
					case int64:
						lhs = x + uint64(y)
					case uint64:
						lhs = x + y
					}
				}
			}
		case '-':
			s.next()
			rhs := c.multiplicativeExpression(s, eval)
			if eval {
				switch x := lhs.(type) {
				case int64:
					switch y := rhs.(type) {
					case int64:
						lhs = x - y
					case uint64:
						lhs = uint64(x) - y
					}
				case uint64:
					switch y := rhs.(type) {
					case int64:
						lhs = x - uint64(y)
					case uint64:
						lhs = x - y
					}
				}
			}
		default:
			return lhs
		}
	}
}

// [0], 6.5.5 Multiplicative operators
//
//  multiplicative-expression:
//		unary-expression // [0], 6.10.1, 1.
//		multiplicative-expression * unary-expression
//		multiplicative-expression / unary-expression
//		multiplicative-expression % unary-expression
func (c *cpp) multiplicativeExpression(s *cppScanner, eval bool) interface{} {
	lhs := c.unaryExpression(s, eval)
	for {
		switch s.peek().char {
		case '*':
			s.next()
			rhs := c.unaryExpression(s, eval)
			if eval {
				switch x := lhs.(type) {
				case int64:
					switch y := rhs.(type) {
					case int64:
						lhs = x * y
					case uint64:
						lhs = uint64(x) * y
					}
				case uint64:
					switch y := rhs.(type) {
					case int64:
						lhs = x * uint64(y)
					case uint64:
						lhs = x * y
					}
				}
			}
		case '/':
			tok := s.next()
			rhs := c.unaryExpression(s, eval)
			if eval {
				switch x := lhs.(type) {
				case int64:
					switch y := rhs.(type) {
					case int64:
						if y == 0 {
							c.err(tok, "division by zero")
							break
						}

						lhs = x / y
					case uint64:
						if y == 0 {
							c.err(tok, "division by zero")
							break
						}

						lhs = uint64(x) / y
					}
				case uint64:
					switch y := rhs.(type) {
					case int64:
						if y == 0 {
							c.err(tok, "division by zero")
							break
						}

						lhs = x / uint64(y)
					case uint64:
						if y == 0 {
							c.err(tok, "division by zero")
							break
						}

						lhs = x / y
					}
				}
			}
		case '%':
			tok := s.next()
			rhs := c.unaryExpression(s, eval)
			if eval {
				switch x := lhs.(type) {
				case int64:
					switch y := rhs.(type) {
					case int64:
						if y == 0 {
							c.err(tok, "division by zero")
							break
						}

						lhs = x % y
					case uint64:
						if y == 0 {
							c.err(tok, "division by zero")
							break
						}

						lhs = uint64(x) % y
					}
				case uint64:
					switch y := rhs.(type) {
					case int64:
						if y == 0 {
							c.err(tok, "division by zero")
							break
						}

						lhs = x % uint64(y)
					case uint64:
						if y == 0 {
							c.err(tok, "division by zero")
							break
						}

						lhs = x % y
					}
				}
			}
		default:
			return lhs
		}
	}
}

// [0], 6.5.3 Unary operators
//
//  unary-expression:
//		primary-expression
//		unary-operator unary-expression
//
//  unary-operator: one of
//		+ - ~ !
func (c *cpp) unaryExpression(s *cppScanner, eval bool) interface{} {
	switch s.peek().char {
	case '+':
		s.next()
		return c.unaryExpression(s, eval)
	case '-':
		s.next()
		expr := c.unaryExpression(s, eval)
		if eval {
			switch x := expr.(type) {
			case int64:
				expr = -x
			case uint64:
				expr = -x
			}
		}
		return expr
	case '~':
		s.next()
		expr := c.unaryExpression(s, eval)
		if eval {
			switch x := expr.(type) {
			case int64:
				expr = ^x
			case uint64:
				expr = ^x
			}
		}
		return expr
	case '!':
		s.next()
		expr := c.unaryExpression(s, eval)
		if eval {
			var v bool
			switch x := expr.(type) {
			case int64:
				v = x == 0
			case uint64:
				v = x == 0
			}
			switch {
			case v:
				expr = int64(1)
			default:
				expr = int64(0)
			}
		}
		return expr
	default:
		return c.primaryExpression(s, eval)
	}
}

// [0], 6.5.1 Primary expressions
//
//  primary-expression:
//		identifier
//		constant
//		( expression )
func (c *cpp) primaryExpression(s *cppScanner, eval bool) interface{} {
	switch tok := s.peek(); tok.char {
	case CHARCONST, LONGCHARCONST:
		s.next()
		r := charConst(c.ctx, tok)
		return int64(r)
	case IDENTIFIER:
		if c.ctx.evalIdentError {
			panic("cannot evaluate identifier")
		}

		s.next()
		if s.peek().char == '(' {
			s.next()
			n := 1
		loop:
			for n != 0 {
				switch s.peek().char {
				case '(':
					n++
				case ')':
					n--
				case -1:
					c.err(s.peek(), "expected )")
					break loop
				}
				s.next()
			}
		}
		return int64(0)
	case PPNUMBER:
		s.next()
		return c.intConst(tok)
	case '(':
		s.next()
		expr := c.expression(s, eval)
		if s.peek().char == ')' {
			s.next()
		}
		return expr
	default:
		return int64(0)
	}
}

// [0], 6.4.4.1 Integer constants
//
//  integer-constant:
//		decimal-constant integer-suffix_opt
//		octal-constant integer-suffix_opt
//		hexadecimal-constant integer-suffix_opt
//
//  decimal-constant:
//		nonzero-digit
//		decimal-constant digit
//
//  octal-constant:
//		0
//		octal-constant octal-digit
//
//  hexadecimal-prefix: one of
//		0x 0X
//
//  integer-suffix_opt: one of
//		u ul ull l lu ll llu
func (c *cpp) intConst(tok cppToken) (r interface{}) {
	var n uint64
	s0 := tok.String()
	s := strings.TrimRight(s0, "uUlL")
	switch {
	case strings.HasPrefix(s, "0x") || strings.HasPrefix(s, "0X"):
		var err error
		if n, err = strconv.ParseUint(s[2:], 16, 64); err != nil {
			c.err(tok, "%v", err)
			return int64(0)
		}
	case strings.HasPrefix(s, "0"):
		var err error
		if n, err = strconv.ParseUint(s, 8, 64); err != nil {
			c.err(tok, "%v", err)
			return int64(0)
		}
	default:
		var err error
		if n, err = strconv.ParseUint(s, 10, 64); err != nil {
			c.err(tok, "%v", err)
			return int64(0)
		}
	}

	suffix := s0[len(s):]
	if suffix == "" {
		if n > math.MaxInt64 {
			return n
		}

		return int64(n)
	}

	switch suffix = strings.ToLower(suffix); suffix {
	default:
		c.err(tok, "invalid suffix: %v", s0)
		fallthrough
	case
		"l",
		"ll":

		if n > math.MaxInt64 {
			return n
		}

		return int64(n)
	case
		"llu",
		"lu",
		"u",
		"ul",
		"ull":

		return n
	}
}

func charConst(ctx *context, tok cppToken) rune {
	s := tok.String()
	switch tok.char {
	case LONGCHARCONST:
		s = s[1:] // Remove leading 'L'.
		fallthrough
	case CHARCONST:
		s = s[1 : len(s)-1] // Remove outer 's.
		if len(s) == 1 {
			return rune(s[0])
		}

		var r rune
		var n int
		switch s[0] {
		case '\\':
			r, n = decodeEscapeSequence(ctx, tok, s)
			if r < 0 {
				r = -r
			}
		default:
			r, n = utf8.DecodeRuneInString(s)
		}
		if n != len(s) {
			ctx.errNode(&tok, "invalid character constant")
		}
		return r
	}
	panic(internalError())
}

// escape-sequence		{simple-sequence}|{octal-escape-sequence}|{hexadecimal-escape-sequence}|{universal-character-name}
// simple-sequence		\\['\x22?\\abfnrtv]
// octal-escape-sequence	\\{octal-digit}{octal-digit}?{octal-digit}?
// hexadecimal-escape-sequence	\\x{hexadecimal-digit}+
func decodeEscapeSequence(ctx *context, tok cppToken, s string) (rune, int) {
	if s[0] != '\\' {
		panic(internalError())
	}

	if len(s) == 1 {
		return rune(s[0]), 1
	}

	r := rune(s[1])
	switch r {
	case '\'', '"', '?', '\\':
		return r, 2
	case 'a':
		return 7, 2
	case 'b':
		return 8, 2
	case 'e':
		return 0x1b, 2
	case 'f':
		return 12, 2
	case 'n':
		return 10, 2
	case 'r':
		return 13, 2
	case 't':
		return 9, 2
	case 'v':
		return 11, 2
	case 'x':
		v, n := 0, 2
	loop2:
		for i := 2; i < len(s); i++ {
			r := s[i]
			switch {
			case r >= '0' && r <= '9', r >= 'a' && r <= 'f', r >= 'A' && r <= 'F':
				v = v<<4 | decodeHex(r)
				n++
			default:
				break loop2
			}
		}
		return -rune(v & 0xff), n
	case 'u', 'U':
		return decodeUCN(s)
	}

	if r < '0' || r > '7' {
		panic(internalError())
	}

	v, n := 0, 1
	ok := false
loop:
	for i := 1; i < len(s); i++ {
		r := s[i]
		switch {
		case i < 4 && r >= '0' && r <= '7':
			ok = true
			v = v<<3 | (int(r) - '0')
			n++
		default:
			break loop
		}
	}
	if !ok {
		ctx.errNode(&tok, "invalid octal sequence")
	}
	return -rune(v), n
}

// universal-character-name	\\u{hex-quad}|\\U{hex-quad}{hex-quad}
func decodeUCN(s string) (rune, int) {
	if s[0] != '\\' {
		panic(internalError())
	}

	s = s[1:]
	switch s[0] {
	case 'u':
		return rune(decodeHexQuad(s[1:])), 6
	case 'U':
		return rune(decodeHexQuad(s[1:])<<16 | decodeHexQuad(s[5:])), 10
	}
	panic(internalError())
}

// hex-quad	{hexadecimal-digit}{hexadecimal-digit}{hexadecimal-digit}{hexadecimal-digit}
func decodeHexQuad(s string) int {
	n := 0
	for i := 0; i < 4; i++ {
		n = n<<4 | decodeHex(s[i])
	}
	return n
}

func decodeHex(r byte) int {
	switch {
	case r >= '0' && r <= '9':
		return int(r) - '0'
	default:
		x := int(r) &^ 0x20
		return x - 'A' + 10
	}
}

func (c *cpp) isNonZero(val interface{}) bool {
	switch x := val.(type) {
	case int64:
		return x != 0
	case uint64:
		return x != 0
	}
	panic(internalError())
}

type ppLine interface {
	getToks() []token3
}

type ppIfGroupDirective interface {
	evalInclusionCondition(*cpp) bool
}

type ppElifDirective struct {
	toks []token3
	expr []token3
}

func (n *ppElifDirective) getToks() []token3 { return n.toks }

type ppElseDirective struct {
	toks []token3
}

func (n *ppElseDirective) getToks() []token3 { return n.toks }

type ppEndifDirective struct {
	toks []token3
}

func (n *ppEndifDirective) getToks() []token3 { return n.toks }

type ppEmptyDirective struct {
	toks []token3
}

func (n *ppEmptyDirective) getToks() []token3 { return n.toks }

func (n *ppEmptyDirective) translationPhase4(c *cpp) {
	// nop
}

type ppIncludeDirective struct {
	arg  []token3
	toks []token3

	includeNext bool // false: #include, true: #include_next
}

func (n *ppIncludeDirective) getToks() []token3 { return n.toks }

func (n *ppIncludeDirective) translationPhase4(c *cpp) {
	if c.ctx.cfg.ignoreIncludes {
		return
	}

	args := make([]cppToken, 0, len(n.arg))
	for _, v := range n.arg {
		switch v.char {
		case ' ', '\t', '\v', '\f':
			// nop
		default:
			args = append(args, cppToken{token4{token3: v}, nil})
		}
	}
	var sb strings.Builder
	for _, v := range args {
		sb.WriteString(v.String())
	}
	nm := strings.TrimSpace(sb.String())
	if nm == "" {
		c.err(n.toks[0], "invalid empty include argument")
		return
	}

	switch nm[0] {
	case '"', '<':
		// ok
	default:
		var w cppWriter
		c.expand(&cppReader{buf: args}, &w, false)
		x := 0
		for _, v := range w.toks {
			switch v.char {
			case ' ', '\t', '\v', '\f':
				// nop
			default:
				w.toks[x] = v
				x++
			}
		}
		w.toks = w.toks[:x]
		nm = strings.TrimSpace(cppToksStr(w.toks, ""))
	}
	toks := n.toks
	if c.ctx.cfg.RejectIncludeNext {
		c.err(toks[0], "#include_next is a GCC extension")
		return
	}

	if c.ctx.cfg.fakeIncludes {
		c.send([]token3{{char: STRINGLITERAL, value: dict.sid(nm), src: dict.sid(nm)}, {char: '\n', value: idNL}})
		return
	}

	if re := c.ctx.cfg.IgnoreInclude; re != nil && re.MatchString(nm) {
		return
	}

	if c.includeLevel == maxIncludeLevel {
		c.err(toks[0], "too many include levels")
		return
	}

	c.includeLevel++

	defer func() { c.includeLevel-- }()

	var (
		b     byte
		paths []string
		sys   bool
	)
	switch {
	case nm != "" && nm[0] == '"':
		paths = c.ctx.includePaths
		b = '"'
	case nm != "" && nm[0] == '<':
		paths = c.ctx.sysIncludePaths
		sys = true
		b = '>'
	case nm == "":
		c.err(toks[0], "invalid empty include argument")
		return
	default:
		c.err(toks[0], "invalid include argument %s", nm)
		return
	}

	x := strings.IndexByte(nm[1:], b)
	if x < 0 {
		c.err(toks[0], "invalid include argument %s", nm)
		return
	}

	nm = filepath.FromSlash(nm[1 : x+1])
	var path string
	switch {
	case filepath.IsAbs(nm):
		path = nm
	default:
		dir := filepath.Dir(c.file.Name())
		if n.includeNext {
			nmDir, _ := filepath.Split(nm)
			for i, v := range paths {
				if w, err := filepath.Abs(v); err == nil {
					v = w
				}
				v = filepath.Join(v, nmDir)
				if v == dir {
					paths = paths[i+1:]
					break
				}
			}
		}
		for _, v := range paths {
			if v == "@" {
				v = dir
			}

			p := filepath.Join(v, nm)
			fi, err := c.ctx.statFile(p, sys)
			if err != nil || fi.IsDir() {
				continue
			}

			path = p
			break
		}
	}

	if path == "" {
		wd, _ := os.Getwd()
		c.err(toks[0], "include file not found: %s (wd %s)\nsearch paths:\n\t%s", nm, wd, strings.Join(paths, "\n\t"))
		return
	}

	if h := c.ctx.cfg.IncludeFileHandler; h != nil {
		var position gotoken.Position
		if p := toks[0].Pos(); p.IsValid() {
			position = gotoken.Position(c.file.PositionFor(p, true))
		}
		apath, err := filepath.Abs(path)
		if err != nil {
			c.err(toks[0], "%s: cannot compute absolute path: %v", path, err)
		}
		h(position, apath)
	}
	cf, err := cache.getFile(c.ctx, path, sys, false)
	if err != nil {
		c.err(toks[0], "%s: %v", path, err)
		return
	}

	pf, err := cf.ppFile()
	if err != nil {
		c.err(toks[0], "%s: %v", path, err)
		return
	}

	saveFile := c.file
	saveFileMacro := c.fileMacro.repl[0].value

	c.file = pf.file
	c.fileMacro.repl[0].value = dict.sid(fmt.Sprintf("%q", c.file.Name()))

	defer func() {
		c.file = saveFile
		c.fileMacro.repl[0].value = saveFileMacro
	}()

	pf.translationPhase4(c)
}

func (c *cpp) send(toks []token3) {
	c.in <- toks
	<-c.rq
}

func (c *cpp) identicalReplacementLists(a, b []token3) bool {
	for len(a) != 0 && a[0].char == ' ' {
		a = a[1:]
	}
	for len(b) != 0 && b[0].char == ' ' {
		b = b[1:]
	}
	for len(a) != 0 && a[len(a)-1].char == ' ' {
		a = a[:len(a)-1]
	}
	for len(b) != 0 && b[len(b)-1].char == ' ' {
		b = b[:len(b)-1]
	}
	if len(a) != len(b) {
		return false
	}

	for i, v := range a {
		w := b[i]
		if v.char != w.char || v.value != w.value {
			return false
		}
	}
	return true
}

func stringConst(ctx *context, t cppToken) string {
	s := t.String()
	switch t.char {
	case LONGSTRINGLITERAL:
		s = s[1:] // Remove leading 'L'.
		fallthrough
	case STRINGLITERAL:
		var buf bytes.Buffer
		for i := 1; i < len(s)-1; {
			switch c := s[i]; c {
			case '\\':
				r, n := decodeEscapeSequence(ctx, t, s[i:])
				switch {
				case r < 0:
					buf.WriteByte(byte(-r))
				default:
					buf.WriteRune(r)
				}
				i += n
			default:
				buf.WriteByte(c)
				i++
			}
		}
		return buf.String()
	}
	panic(internalError())
}

// -------------------------------------------------------- Translation phase 4

// [0], 5.1.1.2, 4
//
// Preprocessing directives are executed, macro invocations are expanded, and
// _Pragma unary operator expressions are executed. If a character sequence
// that matches the syntax of a universal character name is produced by token
// concatenation (6.10.3.3), the behavior is undefined. A #include
// preprocessing directive causes the named header or source file to be
// processed from phase 1 through phase 4, recursively. All preprocessing
// directives are then deleted.
func (c *cpp) translationPhase4(in []source) chan *[]token4 {
	c.rq = make(chan struct{})       // Must be unbufferred
	c.in = make(chan []token3)       // Must be unbufferred
	c.out = make(chan *[]token4, 10) //DONE benchmark tuned

	go func() {
		defer close(c.out)

		c.expand(c, c, false)
	}()

	go func() {
		defer close(c.in)

		for _, v := range in {
			pf, err := v.ppFile()
			if err != nil {
				c.err(nil, "%s", err)
				break
			}

			c.file = pf.file
			c.fileMacro.repl[0].value = dict.sid(fmt.Sprintf("%q", c.file.Name()))
			pf.translationPhase4(c)
		}
	}()

	return c.out
}

type ppErrorDirective struct {
	toks []token3
	msg  []token3
}

func (n *ppErrorDirective) getToks() []token3 { return n.toks }

func (n *ppErrorDirective) translationPhase4(c *cpp) {
	var b strings.Builder
	for _, v := range n.msg {
		b.WriteString(v.String())
	}
	c.err(n.toks[0], "%s", strings.TrimSpace(b.String()))
}

type ppPragmaDirective struct {
	toks []token3
	args []token3
}

func (n *ppPragmaDirective) getToks() []token3 { return n.toks }

func (n *ppPragmaDirective) translationPhase4(c *cpp) { parsePragma(c, n.args) }

func parsePragma(c *cpp, args0 []token3) {
	if len(args0) == 1 { // \n
		return
	}

	if t := args0[0]; t.char == IDENTIFIER && t.value == idSTDC {
		p := t
		p.char = PRAGMASTDC
		p.value = idPragmaSTDC
		send := []token3{p, {char: ' ', value: idSpace, src: idSpace, pos: t.pos}}
		args := ltrim3(args0[1:])
		if len(args) == 0 {
			c.err(args[0], "expected argument of STDC")
			return
		}

		if t = args[0]; t.char != IDENTIFIER {
			c.err(t, "expected identifier")
			return
		}

		switch t.value {
		case idFPContract, idFenvAccess, idCxLimitedRange:
			// ok
		default:
			c.err(t, "expected FP_CONTRACT or FENV_ACCESS or CX_LIMITED_RANGE")
			return
		}

		args = ltrim3(args[1:])
		if len(args) == 0 {
			c.err(args[0], "expected ON or OFF or DEFAULT")
			return
		}

		if t = args[0]; t.char != IDENTIFIER {
			c.err(t, "expected identifier")
			return
		}

		switch t.value {
		case idOn, idOff, idDefault:
			c.writes(c.cppToks(append(send, args0...)))
		default:
			c.err(t, "expected ON or OFF or DEFAULT")
			return
		}
	}

	if c.ctx.cfg.PragmaHandler == nil {
		return
	}

	var toks []cppToken
	for _, v := range args0[:len(args0)-1] {
		toks = append(toks, cppToken{token4: token4{file: c.file, token3: v}})
	}
	if len(toks) == 0 {
		return
	}

	var toks2 []Token
	var sep StringID
	for _, tok := range toks {
		switch tok.char {
		case ' ', '\n':
			if c.ctx.cfg.PreserveOnlyLastNonBlankSeparator {
				if strings.TrimSpace(tok.value.String()) != "" {
					sep = tok.value
				}
				break
			}

			switch {
			case sep != 0:
				sep = dict.sid(sep.String() + tok.String()) //TODO quadratic
			default:
				sep = tok.value
			}
		default:
			var t Token
			t.Rune = tok.char
			t.Sep = sep
			t.Value = tok.value
			t.file = tok.file
			t.pos = tok.pos
			toks2 = append(toks2, t)
			sep = 0
		}
	}
	if len(toks2) == 0 {
		return
	}

	// dbg("%v: %q", c.file.PositionFor(args0[0].Pos(), true), tokStr(toks2, "|"))
	c.ctx.cfg.PragmaHandler(&pragma{tok: toks[0], c: c}, toks2)
}

type ppNonDirective struct {
	toks []token3
}

func (n *ppNonDirective) getToks() []token3 { return n.toks }

func (n *ppNonDirective) translationPhase4(c *cpp) {
	// nop
}

type ppTextLine struct {
	toks []token3
}

func (n *ppTextLine) getToks() []token3 { return n.toks }

func (n *ppTextLine) translationPhase4(c *cpp) { c.send(n.toks) }

type ppLineDirective struct {
	toks    []token3
	args    []token3
	nextPos int
}

func (n *ppLineDirective) getToks() []token3 { return n.toks }

func (n *ppLineDirective) translationPhase4(c *cpp) {
	toks := expandArgs(c, n.args)
	if len(toks) == 0 {
		return
	}

	switch t := toks[0]; t.char {
	case PPNUMBER:
		ln, err := strconv.ParseInt(t.String(), 10, 31)
		if err != nil || ln < 1 {
			c.err(t, "expected positive integer less or equal 2147483647")
			return
		}

		for len(toks) != 0 && toks[0].char == ' ' {
			toks = toks[1:]
		}
		if len(toks) == 1 {
			c.file.AddLineInfo(int(n.nextPos)-1, c.file.Name(), int(ln))
			return
		}

		toks = toks[1:]
		for len(toks) != 0 && toks[0].char == ' ' {
			toks = toks[1:]
		}
		if len(toks) == 0 {
			c.file.AddLineInfo(int(n.nextPos)-1, c.file.Name(), int(ln))
			return
		}

		switch t := toks[0]; t.char {
		case STRINGLITERAL:
			s := t.String()
			s = s[1 : len(s)-1]
			c.file.AddLineInfo(int(n.nextPos)-1, s, int(ln))
			c.fileMacro.repl[0].value = t.value
			for len(toks) != 0 && toks[0].char == ' ' {
				toks = toks[1:]
			}
			if len(toks) != 0 && c.ctx.cfg.RejectLineExtraTokens {
				c.err(toks[0], "expected new-line")
			}
		default:
			c.err(t, "expected string literal")
			return
		}
	default:
		c.err(toks[0], "expected integer literal")
		return
	}
}

func expandArgs(c *cpp, args []token3) []cppToken {
	var w cppWriter
	var toks []cppToken
	for _, v := range args {
		toks = append(toks, cppToken{token4: token4{file: c.file, token3: v}})
	}
	c.expand(&cppReader{buf: toks}, &w, true)
	return w.toks
}

type ppUndefDirective struct {
	name token3
	toks []token3
}

func (n *ppUndefDirective) getToks() []token3 { return n.toks }

func (n *ppUndefDirective) translationPhase4(c *cpp) {
	nm := n.name.value
	if _, ok := protectedMacros[nm]; ok || nm == idDefined {
		c.err(n.name, "cannot undefine a protected name")
		return
	}

	// dbg("#undef %s", nm)
	delete(c.macros, nm)
}

type ppIfdefDirective struct {
	name StringID
	toks []token3
}

func (n *ppIfdefDirective) evalInclusionCondition(c *cpp) bool { _, ok := c.macros[n.name]; return ok }

func (n *ppIfdefDirective) getToks() []token3 { return n.toks }

type ppIfndefDirective struct {
	name StringID
	toks []token3
}

func (n *ppIfndefDirective) evalInclusionCondition(c *cpp) bool {
	_, ok := c.macros[n.name]
	return !ok
}

func (n *ppIfndefDirective) getToks() []token3 { return n.toks }

type ppIfDirective struct {
	toks []token3
	expr []token3
}

func (n *ppIfDirective) getToks() []token3 { return n.toks }

func (n *ppIfDirective) evalInclusionCondition(c *cpp) bool {
	return c.evalInclusionCondition(n.expr)
}

type ppDefineObjectMacroDirective struct {
	name            token3
	toks            []token3
	replacementList []token3
}

func (n *ppDefineObjectMacroDirective) getToks() []token3 { return n.toks }

func (n *ppDefineObjectMacroDirective) translationPhase4(c *cpp) {
	nm := n.name.value
	m := c.macros[nm]
	if m != nil {
		if _, ok := protectedMacros[nm]; ok || nm == idDefined {
			c.err(n.name, "cannot define protected name")
			return
		}

		if m.isFnLike {
			c.err(n.name, "redefinition of a function-like macro with an object-like one")
		}

		if !c.identicalReplacementLists(n.replacementList, m.repl) && c.ctx.cfg.RejectIncompatibleMacroRedef {
			c.err(n.name, "redefinition with different replacement list")
			return
		}
	}

	// find first non-blank token to claim as our location
	var pos int32
	for _, t := range n.toks {
		if t.char != ' ' {
			pos = t.pos
			break
		}
	}

	// dbg("#define %s %s // %v", n.name, tokStr(n.replacementList, " "), c.file.PositionFor(n.name.Pos(), true))
	c.macros[nm] = &Macro{pos: pos, name: token4{token3: n.name, file: c.file}, repl: n.replacementList}
	if nm != idGNUC {
		return
	}

	c.ctx.keywords = gccKeywords
}

type ppDefineFunctionMacroDirective struct {
	identifierList  []token3
	toks            []token3
	replacementList []token3

	name token3

	namedVariadic bool // foo..., note no comma before ellipsis.
	variadic      bool
}

func (n *ppDefineFunctionMacroDirective) getToks() []token3 { return n.toks }

func (n *ppDefineFunctionMacroDirective) translationPhase4(c *cpp) {
	nm := n.name.value
	m := c.macros[nm]
	if m != nil {
		if _, ok := protectedMacros[nm]; ok || nm == idDefined {
			c.err(n.name, "cannot define protected name")
			return
		}

		if !m.isFnLike && c.ctx.cfg.RejectIncompatibleMacroRedef {
			c.err(n.name, "redefinition of an object-like macro with a function-like one")
			return
		}

		ok := len(m.fp) == len(n.identifierList)
		if ok {
			for i, v := range m.fp {
				if v != n.identifierList[i].value {
					ok = false
					break
				}
			}
		}
		if !ok && (len(n.replacementList) != 0 || len(m.repl) != 0) && c.ctx.cfg.RejectIncompatibleMacroRedef {
			c.err(n.name, "redefinition with different formal parameters")
			return
		}

		if !c.identicalReplacementLists(n.replacementList, m.repl) && c.ctx.cfg.RejectIncompatibleMacroRedef {
			c.err(n.name, "redefinition with different replacement list")
			return
		}

		if m.variadic != n.variadic && c.ctx.cfg.RejectIncompatibleMacroRedef {
			c.err(n.name, "redefinition differs in being variadic")
			return
		}
	}
	nms := map[StringID]struct{}{}
	for _, v := range n.identifierList {
		if _, ok := nms[v.value]; ok {
			c.err(v, "duplicate identifier %s", v.value)
		}
	}
	var fp []StringID
	for _, v := range n.identifierList {
		fp = append(fp, v.value)
	}
	// dbg("#define %s %s // %v", n.name, tokStr(n.replacementList, " "), c.file.PositionFor(n.name.Pos(), true))
	c.macros[nm] = &Macro{fp: fp, isFnLike: true, name: token4{token3: n.name, file: c.file}, repl: n.replacementList, variadic: n.variadic, namedVariadic: n.namedVariadic}
}

// [0], 6.10.1
//
//  elif-group:
//  		# elif constant-expression new-line group_opt
type ppElifGroup struct {
	elif   *ppElifDirective
	groups []ppGroup
}

func (n *ppElifGroup) evalInclusionCondition(c *cpp) bool {
	if !c.evalInclusionCondition(n.elif.expr) {
		return false
	}

	for _, v := range n.groups {
		v.translationPhase4(c)
	}
	return true
}

// [0], 6.10.1
//
//  else-group:
//  		# else new-line group_opt
type ppElseGroup struct {
	elseLine *ppElseDirective
	groups   []ppGroup
}

func (n *ppElseGroup) translationPhase4(c *cpp) {
	if n == nil {
		return
	}

	for _, v := range n.groups {
		v.translationPhase4(c)
	}
}

// [0], 6.10.1
//
//  PreprocessingFile:
//  		GroupOpt
type ppFile struct {
	file   *tokenFile
	groups []ppGroup
}

func (n *ppFile) translationPhase4(c *cpp) {
	c.ctx.tuSourcesAdd(1)
	if f := n.file; f != nil {
		c.ctx.tuSizeAdd(int64(f.Size()))
	}
	for _, v := range n.groups {
		v.translationPhase4(c)
	}
}

// [0], 6.10.1
//
//  group-part:
//  		if-section
//  		control-line
//  		text-line
//  		# non-directive
type ppGroup interface {
	translationPhase4(*cpp)
}

// [0], 6.10.1
//
//  if-group:
//  		# if constant-expression new-line group opt
//  		# ifdef identifier new-line group opt
//  		# ifndef identifier new-line group opt
type ppIfGroup struct {
	directive ppIfGroupDirective
	groups    []ppGroup
}

func (n *ppIfGroup) evalInclusionCondition(c *cpp) bool {
	if !n.directive.evalInclusionCondition(c) {
		return false
	}

	for _, v := range n.groups {
		v.translationPhase4(c)
	}
	return true
}

// [0], 6.10.1
//
// if-section:
// 		if-group elif-groups_opt else-group_opt endif-line
type ppIfSection struct {
	ifGroup    *ppIfGroup
	elifGroups []*ppElifGroup
	elseGroup  *ppElseGroup
	endifLine  *ppEndifDirective
}

func (n *ppIfSection) translationPhase4(c *cpp) {
	if !n.ifGroup.evalInclusionCondition(c) {
		for _, v := range n.elifGroups {
			if v.evalInclusionCondition(c) {
				return
			}
		}

		n.elseGroup.translationPhase4(c)
	}
}
