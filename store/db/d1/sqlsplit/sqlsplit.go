// Package sqlsplit divides SQL text into individual statements. The D1 bridge
// transport and the test emulator both need it: a bridge request carries one
// statement per entry, and the emulator mirrors D1 by executing each
// statement of a script separately inside one transaction.
package sqlsplit

import (
	"strings"
	"unicode"
)

// Split divides text at top-level semicolons, honoring string literals,
// quoted identifiers, comments, and the compound body of CREATE TRIGGER
// statements, whose BEGIN ... END block carries semicolons of its own.
// Comments are treated as whitespace and comment-only fragments are dropped.
func Split(text string) []string {
	s := &splitter{}
	for i := 0; i < len(text); i++ {
		c := text[i]
		switch {
		case c == '-' && i+1 < len(text) && text[i+1] == '-':
			s.write(' ')
			end := strings.IndexByte(text[i:], '\n')
			if end < 0 {
				i = len(text)
			} else {
				i += end
			}
		case c == '/' && i+1 < len(text) && text[i+1] == '*':
			s.write(' ')
			end := strings.Index(text[i+2:], "*/")
			if end < 0 {
				i = len(text)
			} else {
				i += end + 3
			}
		case c == '\'' || c == '"' || c == '`':
			end := closingQuote(text, i, c)
			s.writeQuoted(text[i : end+1])
			i = end
		case c == ';':
			// Classify a keyword ending right before the semicolon, such as
			// the END that closes a trigger body, before deciding.
			s.endWord()
			if s.depth == 0 {
				s.flush()
			} else {
				s.current.WriteByte(c)
			}
		default:
			s.write(c)
		}
	}
	s.flush()
	return s.statements
}

// splitter accumulates the current statement and tracks the keywords that
// open and close compound blocks so their inner semicolons do not split.
type splitter struct {
	statements []string
	current    strings.Builder
	word       strings.Builder
	// words counts the keywords seen in the current statement; the first
	// two decide whether it is a CREATE TRIGGER.
	words   []string
	trigger bool
	// depth is the nesting of open blocks: the trigger body plus any CASE
	// expressions inside it. Semicolons split only at depth zero.
	depth int
}

func (s *splitter) write(c byte) {
	s.current.WriteByte(c)
	if c == '_' || c < 0x80 && (unicode.IsLetter(rune(c)) || unicode.IsDigit(rune(c))) {
		s.word.WriteByte(c)
		return
	}
	s.endWord()
}

func (s *splitter) writeQuoted(text string) {
	s.endWord()
	s.current.WriteString(text)
}

// endWord classifies the keyword that just ended.
func (s *splitter) endWord() {
	if s.word.Len() == 0 {
		return
	}
	word := strings.ToUpper(s.word.String())
	s.word.Reset()
	s.words = append(s.words, word)
	if len(s.words) <= 3 {
		s.trigger = isCreateTrigger(s.words)
	}
	if !s.trigger {
		return
	}
	switch word {
	case "BEGIN", "CASE":
		s.depth++
	case "END":
		if s.depth > 0 {
			s.depth--
		}
	default:
	}
}

// isCreateTrigger reports whether the leading keywords open a trigger:
// CREATE [TEMP|TEMPORARY] TRIGGER.
func isCreateTrigger(words []string) bool {
	if len(words) < 2 || words[0] != "CREATE" {
		return false
	}
	if words[1] == "TRIGGER" {
		return true
	}
	return len(words) >= 3 && (words[1] == "TEMP" || words[1] == "TEMPORARY") && words[2] == "TRIGGER"
}

func (s *splitter) flush() {
	s.endWord()
	stmt := strings.TrimSpace(s.current.String())
	s.current.Reset()
	s.words = s.words[:0]
	s.trigger = false
	s.depth = 0
	if stmt != "" {
		s.statements = append(s.statements, stmt)
	}
}

func closingQuote(text string, start int, quote byte) int {
	for i := start + 1; i < len(text); i++ {
		if text[i] != quote {
			continue
		}
		if i+1 < len(text) && text[i+1] == quote {
			i++
			continue
		}
		return i
	}
	return len(text) - 1
}
