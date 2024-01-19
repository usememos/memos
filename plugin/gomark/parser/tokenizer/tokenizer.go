package tokenizer

type TokenType = string

const (
	Underscore         TokenType = "_"
	Asterisk           TokenType = "*"
	PoundSign          TokenType = "#"
	Backtick           TokenType = "`"
	LeftSquareBracket  TokenType = "["
	RightSquareBracket TokenType = "]"
	LeftParenthesis    TokenType = "("
	RightParenthesis   TokenType = ")"
	ExclamationMark    TokenType = "!"
	Tilde              TokenType = "~"
	Hyphen             TokenType = "-"
	PlusSign           TokenType = "+"
	Dot                TokenType = "."
	LessThan           TokenType = "<"
	GreaterThan        TokenType = ">"
	DollarSign         TokenType = "$"
	EqualSign          TokenType = "="
	Pipe               TokenType = "|"
	Colon              TokenType = ":"
	Caret              TokenType = "^"
	Backslash          TokenType = "\\"
	Newline            TokenType = "\n"
	Space              TokenType = " "
)

const (
	Number TokenType = "number"
	Text   TokenType = ""
)

type Token struct {
	Type  TokenType
	Value string
}

func NewToken(tp, text string) *Token {
	return &Token{
		Type:  tp,
		Value: text,
	}
}

func Tokenize(text string) []*Token {
	tokens := []*Token{}
	for _, c := range text {
		switch c {
		case '_':
			tokens = append(tokens, NewToken(Underscore, "_"))
		case '*':
			tokens = append(tokens, NewToken(Asterisk, "*"))
		case '#':
			tokens = append(tokens, NewToken(PoundSign, "#"))
		case '`':
			tokens = append(tokens, NewToken(Backtick, "`"))
		case '[':
			tokens = append(tokens, NewToken(LeftSquareBracket, "["))
		case ']':
			tokens = append(tokens, NewToken(RightSquareBracket, "]"))
		case '(':
			tokens = append(tokens, NewToken(LeftParenthesis, "("))
		case ')':
			tokens = append(tokens, NewToken(RightParenthesis, ")"))
		case '!':
			tokens = append(tokens, NewToken(ExclamationMark, "!"))
		case '~':
			tokens = append(tokens, NewToken(Tilde, "~"))
		case '-':
			tokens = append(tokens, NewToken(Hyphen, "-"))
		case '<':
			tokens = append(tokens, NewToken(LessThan, "<"))
		case '>':
			tokens = append(tokens, NewToken(GreaterThan, ">"))
		case '+':
			tokens = append(tokens, NewToken(PlusSign, "+"))
		case '.':
			tokens = append(tokens, NewToken(Dot, "."))
		case '$':
			tokens = append(tokens, NewToken(DollarSign, "$"))
		case '=':
			tokens = append(tokens, NewToken(EqualSign, "="))
		case '|':
			tokens = append(tokens, NewToken(Pipe, "|"))
		case ':':
			tokens = append(tokens, NewToken(Colon, ":"))
		case '^':
			tokens = append(tokens, NewToken(Caret, "^"))
		case '\\':
			tokens = append(tokens, NewToken(Backslash, `\`))
		case '\n':
			tokens = append(tokens, NewToken(Newline, "\n"))
		case ' ':
			tokens = append(tokens, NewToken(Space, " "))
		default:
			var prevToken *Token
			if len(tokens) > 0 {
				prevToken = tokens[len(tokens)-1]
			}

			isNumber := c >= '0' && c <= '9'
			if prevToken != nil {
				if (prevToken.Type == Text && !isNumber) || (prevToken.Type == Number && isNumber) {
					prevToken.Value += string(c)
					continue
				}
			}

			if isNumber {
				tokens = append(tokens, NewToken(Number, string(c)))
			} else {
				tokens = append(tokens, NewToken(Text, string(c)))
			}
		}
	}
	return tokens
}

func (t *Token) String() string {
	return t.Value
}

func Stringify(tokens []*Token) string {
	text := ""
	for _, token := range tokens {
		text += token.String()
	}
	return text
}

func Split(tokens []*Token, delimiter TokenType) [][]*Token {
	result := make([][]*Token, 0)
	current := make([]*Token, 0)
	for _, token := range tokens {
		if token.Type == delimiter {
			if len(current) > 0 {
				result = append(result, current)
				current = make([]*Token, 0)
			}
		} else {
			current = append(current, token)
		}
	}
	if len(current) > 0 {
		result = append(result, current)
	}
	return result
}
