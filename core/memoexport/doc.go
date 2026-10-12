// Package memoexport implements the Memos Export Format: a ZIP container that
// carries one user's memos and attachments between Memos instances.
//
// The package owns the container layout, the JSON records, and the reading
// and writing rules defined in docs/design/memos-export-format.md. It has no
// opinion about how records map onto a Memos instance; transports call the
// Writer with data they have already loaded and interpret the records a
// Reader returns.
package memoexport
