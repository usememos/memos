package tokenizer

func tokenize(text string) []*Token {
	tokens := []*Token{}
	for _, c := range text {
		switch c {
		case '_':
			tokens = append(tokens, NewToken(Underline, "_"))
		case '*':
			tokens = append(tokens, NewToken(Star, "*"))
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
