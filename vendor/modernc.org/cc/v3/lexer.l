%{
// Copyright 2019 The CC Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.
%}

%yyc c
%yyn c = s.next()
%yym s.mark = len(s.charBuf)

%{
package cc // import "modernc.org/cc/v3"

func (s *scanner) scan() (r rune) {
%}

c-char				[^'\n\x80\\]|{escape-sequence}
c-char-sequence			{c-char}+
character-constant		'{c-char-sequence}'
comment				"/*"([^*\x80]|\*+[^*/\x80])*\*+\/
comment-not-terminated		"/*"([^*\x80]|\*+[^*/\x80])*(\*+)?\n\x80
digit				[0-9]
escape-sequence			{simple-sequence}|{octal-escape-sequence}|{hexadecimal-escape-sequence}|{universal-character-name}
hex-quad			{hexadecimal-digit}{hexadecimal-digit}{hexadecimal-digit}{hexadecimal-digit}
hexadecimal-digit		[0-9a-fA-F]
hexadecimal-escape-sequence	\\x{hexadecimal-digit}+
identifier			{identifier-nondigit}({identifier-nondigit}|{digit}|"$")*
identifier-nondigit		{nondigit}|"$"|{universal-character-name}
line-comment			"//"[^\n\x80]*
nondigit			[_a-zA-Z\x81]
octal-digit			[0-7]
octal-escape-sequence		\\{octal-digit}{octal-digit}?{octal-digit}?
pp-number			({digit}|\.{digit})({digit}|{identifier-nondigit}|[eEpP]{sign}|\.)*
s-char				[^\x22\n\x80\\]|{escape-sequence}
s-char-sequence			{s-char}+
sign				[-+]
simple-sequence			\\['\x22?\\abefnrtv]
string-literal			\x22{s-char-sequence}?\x22
universal-character-name	\\u{hex-quad}|\\U{hex-quad}{hex-quad}
white-space			[ \t\f\v]

%%
			c := s.initScan()

({white-space}|{comment})*{line-comment}	|
({white-space}|{comment})+{line-comment}?
			return ' '

(({white-space}|{comment})*{comment-not-terminated})+
			return s.unterminatedComment()

"!="			return NEQ
"##"			return PPPASTE
"%:"			return '#'
"%:%:"			return PPPASTE
"%="			return MODASSIGN
"%>"			return '}'
"&&"			return ANDAND
"&="			return ANDASSIGN
"*="			return MULASSIGN
"++"			return INC
"+="			return ADDASSIGN
"--"			return DEC
"-="			return SUBASSIGN
"->"			return ARROW
"..."			return DDD
"/="			return DIVASSIGN
":>"			return ']'
"<%"			return '{'
"<:"			return '['
"<<"			return LSH
"<<="			return LSHASSIGN
"<="			return LEQ
"=="			return EQ
">="			return GEQ
">>"			return RSH
">>="			return RSHASSIGN
"^="			return XORASSIGN
"|="			return ORASSIGN
"||"			return OROR

L{string-literal}	return LONGSTRINGLITERAL
L{character-constant}	return LONGCHARCONST
{character-constant}	return CHARCONST
{identifier}		return IDENTIFIER
{pp-number}		return PPNUMBER
{string-literal}	return STRINGLITERAL

\r?\n			return '\n'

%%
        if c, ok := s.abort(); ok {
                return rune(c)
        }
        
        goto yyAction
}
