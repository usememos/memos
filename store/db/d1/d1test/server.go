// Package d1test runs an in-process emulation of the Cloudflare D1 REST API
// for tests. It speaks the same JSON protocol the driver uses (the /raw and
// /query endpoints, batch bodies, the database metadata endpoint) on top of a
// private SQLite database, and enforces the D1 constraints that matter to the
// driver: foreign keys are on, statements are wrapped in an implicit
// transaction, a batch is atomic, and a statement may bind at most 100
// parameters. It registers no custom SQL functions, exactly like D1.
package d1test

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	// SQLite engine behind the emulated service.
	_ "modernc.org/sqlite"
)

const (
	accountID  = "test-account"
	databaseID = "test-database"
	token      = "test-token"

	maxBoundParameters = 100
)

// Server is one emulated D1 database reachable over HTTP.
type Server struct {
	http *httptest.Server
	db   *sql.DB
	conn *sql.Conn
	mu   sync.Mutex
}

// New starts a fresh emulated database that is torn down with the test.
func New(t testing.TB) *Server {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:?_pragma=foreign_keys(1)")
	if err != nil {
		t.Fatalf("d1test: open sqlite: %v", err)
	}
	db.SetMaxOpenConns(1)
	conn, err := db.Conn(context.Background())
	if err != nil {
		t.Fatalf("d1test: acquire sqlite connection: %v", err)
	}
	s := &Server{db: db, conn: conn}
	s.http = httptest.NewServer(http.HandlerFunc(s.handle))
	t.Cleanup(s.Close)
	return s
}

// DSN returns the driver DSN pointing at this server.
func (s *Server) DSN() string {
	return fmt.Sprintf("d1://%s/%s?token=%s&endpoint=%s", accountID, databaseID, token, s.http.URL)
}

// Close stops the server and discards the database.
func (s *Server) Close() {
	s.http.Close()
	_ = s.conn.Close()
	_ = s.db.Close()
}

type requestStatement struct {
	SQL    string `json:"sql"`
	Params []any  `json:"params"`
}

type requestBody struct {
	SQL    *string            `json:"sql"`
	Params []any              `json:"params"`
	Batch  []requestStatement `json:"batch"`
}

type apiError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

func (s *Server) handle(w http.ResponseWriter, r *http.Request) {
	if r.Header.Get("Authorization") != "Bearer "+token {
		writeErrors(w, http.StatusForbidden, 10000, "Authentication error")
		return
	}
	prefix := fmt.Sprintf("/accounts/%s/d1/database/%s", accountID, databaseID)
	if !strings.HasPrefix(r.URL.Path, prefix) {
		writeErrors(w, http.StatusNotFound, 7404, "database not found")
		return
	}
	switch rest := strings.TrimPrefix(r.URL.Path, prefix); {
	case rest == "" && r.Method == http.MethodGet:
		s.handleMetadata(w)
	case rest == "/raw" && r.Method == http.MethodPost:
		s.handleQuery(w, r, true)
	case rest == "/query" && r.Method == http.MethodPost:
		s.handleQuery(w, r, false)
	default:
		writeErrors(w, http.StatusNotFound, 7404, "unknown route")
	}
}

func (s *Server) handleMetadata(w http.ResponseWriter) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var pageCount, pageSize int64
	if err := s.conn.QueryRowContext(context.Background(), "PRAGMA page_count").Scan(&pageCount); err != nil {
		writeErrors(w, http.StatusInternalServerError, 7500, err.Error())
		return
	}
	if err := s.conn.QueryRowContext(context.Background(), "PRAGMA page_size").Scan(&pageSize); err != nil {
		writeErrors(w, http.StatusInternalServerError, 7500, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"errors":  []any{},
		"result": map[string]any{
			"uuid":      databaseID,
			"name":      "memos-test",
			"file_size": pageCount * pageSize,
		},
	})
}

func (s *Server) handleQuery(w http.ResponseWriter, r *http.Request, rawRows bool) {
	var body requestBody
	decoder := json.NewDecoder(r.Body)
	decoder.UseNumber()
	if err := decoder.Decode(&body); err != nil {
		writeErrors(w, http.StatusBadRequest, 7400, "invalid request body: "+err.Error())
		return
	}
	var entries []requestStatement
	switch {
	case body.SQL != nil:
		entries = []requestStatement{{SQL: *body.SQL, Params: body.Params}}
	case len(body.Batch) > 0:
		entries = body.Batch
	default:
		writeErrors(w, http.StatusBadRequest, 7400, "request must carry sql or batch")
		return
	}

	// Expand every entry into single statements; a parameterized entry must
	// hold exactly one statement because D1 documents no binding rule for
	// several.
	var stmts []requestStatement
	for _, entry := range entries {
		parts := splitStatements(entry.SQL)
		if len(parts) == 0 {
			writeErrors(w, http.StatusBadRequest, 7400, "empty sql")
			return
		}
		if len(parts) > 1 && len(entry.Params) > 0 {
			writeErrors(w, http.StatusBadRequest, 7400, "params cannot be bound to multiple statements")
			return
		}
		if len(entry.Params) > maxBoundParameters {
			writeErrors(w, http.StatusBadRequest, 7400, fmt.Sprintf("too many bound parameters: %d", len(entry.Params)))
			return
		}
		for _, part := range parts {
			stmts = append(stmts, requestStatement{SQL: part, Params: entry.Params})
		}
	}

	results, err := s.execute(r.Context(), stmts, rawRows)
	if err != nil {
		writeErrors(w, http.StatusBadRequest, 7500, "D1_ERROR: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"errors":  []any{},
		"result":  results,
	})
}

// execute runs stmts inside one transaction, mirroring D1's implicit
// transaction per request and its atomic batches.
func (s *Server) execute(ctx context.Context, stmts []requestStatement, rawRows bool) ([]map[string]any, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	tx, err := s.conn.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	results := make([]map[string]any, 0, len(stmts))
	for _, stmt := range stmts {
		res, err := runStatement(ctx, tx, stmt, rawRows)
		if err != nil {
			_ = tx.Rollback()
			return nil, err
		}
		results = append(results, res)
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return results, nil
}

func runStatement(ctx context.Context, tx *sql.Tx, stmt requestStatement, rawRows bool) (map[string]any, error) {
	args := make([]any, 0, len(stmt.Params))
	for _, param := range stmt.Params {
		args = append(args, decodeParam(param))
	}
	// changes() reports the last write even after a read, so the statement's
	// own count is the total_changes() delta across its execution.
	var before int64
	if err := tx.QueryRowContext(ctx, "SELECT total_changes()").Scan(&before); err != nil {
		return nil, err
	}
	columns, arrayRows, objectRows, err := collectRows(ctx, tx, stmt.SQL, args, rawRows)
	if err != nil {
		return nil, err
	}
	var after, lastRowID int64
	if err := tx.QueryRowContext(ctx, "SELECT total_changes(), last_insert_rowid()").Scan(&after, &lastRowID); err != nil {
		return nil, err
	}
	changes := after - before
	var results any
	if rawRows {
		results = map[string]any{"columns": columns, "rows": arrayRows}
	} else {
		results = objectRows
	}
	return map[string]any{
		"success": true,
		"meta": map[string]any{
			"changed_db":  changes > 0,
			"changes":     changes,
			"last_row_id": lastRowID,
			"duration":    0,
		},
		"results": results,
	}, nil
}

// collectRows executes one statement and drains its result set in the
// requested shape. Statements without a result set yield empty slices.
func collectRows(ctx context.Context, tx *sql.Tx, query string, args []any, rawRows bool) ([]string, [][]any, []map[string]any, error) {
	rows, err := tx.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, nil, nil, err
	}
	defer rows.Close()
	columns, err := rows.Columns()
	if err != nil {
		return nil, nil, nil, err
	}
	arrayRows := [][]any{}
	objectRows := []map[string]any{}
	for rows.Next() {
		cells := make([]any, len(columns))
		targets := make([]any, len(columns))
		for i := range cells {
			targets[i] = &cells[i]
		}
		if err := rows.Scan(targets...); err != nil {
			return nil, nil, nil, err
		}
		encoded := make([]any, len(columns))
		for i, cell := range cells {
			encoded[i] = encodeCell(cell)
		}
		if rawRows {
			arrayRows = append(arrayRows, encoded)
			continue
		}
		object := make(map[string]any, len(columns))
		for i, column := range columns {
			object[column] = encoded[i]
		}
		objectRows = append(objectRows, object)
	}
	if err := rows.Err(); err != nil {
		return nil, nil, nil, err
	}
	if err := rows.Close(); err != nil {
		return nil, nil, nil, err
	}
	return columns, arrayRows, objectRows, nil
}

// decodeParam maps a JSON parameter onto a SQLite bind value.
func decodeParam(param any) any {
	switch v := param.(type) {
	case json.Number:
		if integer, err := v.Int64(); err == nil {
			return integer
		}
		if float, err := v.Float64(); err == nil {
			return float
		}
		return v.String()
	case bool:
		if v {
			return int64(1)
		}
		return int64(0)
	default:
		return v
	}
}

// encodeCell maps a SQLite value onto its D1 JSON representation. Blobs are
// emitted as arrays of byte values.
func encodeCell(cell any) any {
	switch v := cell.(type) {
	case []byte:
		values := make([]int, len(v))
		for i, b := range v {
			values[i] = int(b)
		}
		return values
	case time.Time:
		return v.UTC().Format(time.RFC3339Nano)
	default:
		return v
	}
}

// splitStatements divides SQL text at top-level semicolons, honoring string
// literals, quoted identifiers, and comments.
func splitStatements(text string) []string {
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

func writeErrors(w http.ResponseWriter, status, code int, message string) {
	writeJSON(w, status, map[string]any{
		"success": false,
		"errors":  []apiError{{Code: code, Message: message}},
		"result":  nil,
	})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
