// Package sqlsplit divides SQL text into individual statements. The D1 bridge
// transport and the test emulator both need it: a bridge request carries one
// statement per entry, and the emulator mirrors D1 by executing each
// statement of a script separately inside one transaction.
package sqlsplit

import "strings"

// Split divides text at top-level semicolons, honoring string literals,
// quoted identifiers, and comments. Comment-only fragments are dropped.
func Split(text string) []string {
	var statements []string
	var current strings.Builder
	flush := func() {
		stmt := strings.TrimSpace(current.String())
		current.Reset()
		if stmt != "" && !isCommentOnly(stmt) {
			statements = append(statements, stmt)
		}
	}
	for i := 0; i < len(text); i++ {
		c := text[i]
		switch {
		case c == '-' && i+1 < len(text) && text[i+1] == '-':
			end := strings.IndexByte(text[i:], '\n')
			if end < 0 {
				i = len(text)
			} else {
				i += end
			}
		case c == '/' && i+1 < len(text) && text[i+1] == '*':
			end := strings.Index(text[i+2:], "*/")
			if end < 0 {
				i = len(text)
			} else {
				i += end + 3
			}
		case c == '\'' || c == '"' || c == '`':
			end := closingQuote(text, i, c)
			current.WriteString(text[i : end+1])
			i = end
		case c == ';':
			flush()
		default:
			current.WriteByte(c)
		}
	}
	flush()
	return statements
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

func isCommentOnly(stmt string) bool {
	for _, line := range strings.Split(stmt, "\n") {
		line = strings.TrimSpace(line)
		if line != "" && !strings.HasPrefix(line, "--") {
			return false
		}
	}
	return true
}
