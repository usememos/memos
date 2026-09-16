// Package sqlsplit divides a Memos SQL script into its statements. The D1
// bridge transport needs it because a bridge request carries one statement
// per entry, and the test emulator uses it to execute a script statement by
// statement the way D1 does.
//
// The split is a file-layout convention rather than a SQL parser: the scripts
// under store/migration/d1 keep exactly one statement per paragraph, so a
// blank line is the statement boundary. Nothing inside a statement, be it a
// CREATE TABLE body, a trigger body, a string literal, or a comment, may
// contain a blank line. The convention is enforced by the store test suite,
// which applies every script through the emulator.
package sqlsplit

import "strings"

// Split divides text at blank lines. Paragraphs made only of line comments
// are dropped; a statement keeps the comment lines and the trailing
// semicolon it was written with.
func Split(text string) []string {
	var statements []string
	var paragraph []string
	flush := func() {
		if stmt := paragraphStatement(paragraph); stmt != "" {
			statements = append(statements, stmt)
		}
		paragraph = paragraph[:0]
	}
	for _, line := range strings.Split(strings.ReplaceAll(text, "\r\n", "\n"), "\n") {
		if strings.TrimSpace(line) == "" {
			flush()
			continue
		}
		paragraph = append(paragraph, line)
	}
	flush()
	return statements
}

// paragraphStatement returns the paragraph as one statement, or "" when it
// holds no SQL.
func paragraphStatement(lines []string) string {
	hasSQL := false
	for _, line := range lines {
		if !strings.HasPrefix(strings.TrimSpace(line), "--") {
			hasSQL = true
			break
		}
	}
	if !hasSQL {
		return ""
	}
	return strings.TrimSpace(strings.Join(lines, "\n"))
}
