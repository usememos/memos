package tokenizer

type TokenType = string

const (
	Underline TokenType = "_"
	Star      TokenType = "*"
	Newline   TokenType = "\n"
	Hash      TokenType = "#"
	Space     TokenType = " "
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
