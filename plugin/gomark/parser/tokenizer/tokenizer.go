package tokenizer

type TokenType = string

const (
	Underline          TokenType = "_"
	Star               TokenType = "*"
	Hash               TokenType = "#"
	Backtick           TokenType = "`"
	LeftSquareBracket  TokenType = "["
	RightSquareBracket TokenType = "]"
	LeftParenthesis    TokenType = "("
	RightParenthesis   TokenType = ")"
	ExclamationMark    TokenType = "!"
	Newline            TokenType = "\n"
	Space              TokenType = " "
)

const (
	Text TokenType = ""
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
			tokens = append(tokens, NewToken(Underline, "_"))
		case '*':
			tokens = append(tokens, NewToken(Star, "*"))
		case '#':
			tokens = append(tokens, NewToken(Hash, "#"))
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
		case '\n':
			tokens = append(tokens, NewToken(Newline, "\n"))
		case ' ':
			tokens = append(tokens, NewToken(Space, " "))
		default:
			var lastToken *Token
			if len(tokens) > 0 {
				lastToken = tokens[len(tokens)-1]
			}
			if lastToken == nil || lastToken.Type != Text {
				tokens = append(tokens, NewToken(Text, string(c)))
			} else {
				lastToken.Value += string(c)
			}
		}
	}
	return tokens
}
