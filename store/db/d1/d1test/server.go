// Package d1test runs an in-process emulation of Cloudflare D1 for tests. It
// speaks both protocols the driver uses, the Cloudflare REST API (the /raw
// and /query endpoints, batch bodies, the database metadata endpoint) and the
// Memos bridge protocol, on top of a private SQLite database. It enforces the
// D1 constraints that matter to the driver: foreign keys are on, statements
// are wrapped in an implicit transaction, a batch is atomic, a statement may
// bind at most 100 parameters, and a prepared entry (a bridge statement or a
// parameterized REST entry) holds exactly one statement while a parameter-free
// REST entry is a script. It registers no custom SQL functions, exactly like
// D1.
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

	"modernc.org/libc"
	// SQLite engine behind the emulated service.
	_ "modernc.org/sqlite"
	sqlite3 "modernc.org/sqlite/lib"
)

const (
	accountID   = "test-account"
	databaseID  = "test-database"
	token       = "test-token"
	bridgeToken = "bridge-secret"
	bridgePath  = "/bridge/d1"

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

// DSN returns the REST-mode driver DSN pointing at this server.
func (s *Server) DSN() string {
	return fmt.Sprintf("d1://%s/%s?token=%s&endpoint=%s", accountID, databaseID, token, s.http.URL)
}

// BridgeDSN returns the bridge-mode driver DSN pointing at this server.
func (s *Server) BridgeDSN() string {
	return fmt.Sprintf("d1-bridge://%s%s?token=%s&private=true", strings.TrimPrefix(s.http.URL, "http://"), bridgePath, bridgeToken)
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

type restRequest struct {
	SQL    *string            `json:"sql"`
	Params []any              `json:"params"`
	Batch  []requestStatement `json:"batch"`
}

type bridgeRequest struct {
	Statements []requestStatement `json:"statements"`
}

type apiError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// statementResult is the outcome of one executed statement before it is
// rendered in either protocol's shape.
type statementResult struct {
	columns    []string
	arrayRows  [][]any
	objectRows []map[string]any
	changes    int64
	lastRowID  int64
}

func (s *Server) handle(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == bridgePath {
		s.handleBridge(w, r)
		return
	}
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
	size, err := s.databaseSize(context.Background())
	if err != nil {
		writeErrors(w, http.StatusInternalServerError, 7500, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"errors":  []any{},
		"result": map[string]any{
			"uuid":      databaseID,
			"name":      "memos-test",
			"file_size": size,
		},
	})
}

func (s *Server) databaseSize(ctx context.Context) (int64, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var pageCount, pageSize int64
	if err := s.conn.QueryRowContext(ctx, "PRAGMA page_count").Scan(&pageCount); err != nil {
		return 0, err
	}
	if err := s.conn.QueryRowContext(ctx, "PRAGMA page_size").Scan(&pageSize); err != nil {
		return 0, err
	}
	return pageCount * pageSize, nil
}

// handleQuery serves the REST /raw and /query endpoints.
func (s *Server) handleQuery(w http.ResponseWriter, r *http.Request, rawRows bool) {
	var body restRequest
	if err := decodeBody(r, &body); err != nil {
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

	// A parameterized entry is prepared and must be one statement; a
	// parameter-free entry is a script, executed statement by statement the
	// way D1 does.
	var stmts []requestStatement
	for _, entry := range entries {
		if len(entry.Params) > maxBoundParameters {
			writeErrors(w, http.StatusBadRequest, 7400, fmt.Sprintf("too many bound parameters: %d", len(entry.Params)))
			return
		}
		parts := splitStatements(entry.SQL)
		if len(parts) == 0 {
			writeErrors(w, http.StatusBadRequest, 7400, "empty sql")
			return
		}
		if len(entry.Params) > 0 {
			if len(parts) > 1 {
				writeErrors(w, http.StatusBadRequest, 7500, errMultipleStatements)
				return
			}
			stmts = append(stmts, entry)
			continue
		}
		for _, part := range parts {
			stmts = append(stmts, requestStatement{SQL: part})
		}
	}

	results, err := s.execute(r.Context(), stmts)
	if err != nil {
		writeErrors(w, http.StatusBadRequest, 7500, "D1_ERROR: "+err.Error())
		return
	}
	rendered := make([]map[string]any, 0, len(results))
	for _, res := range results {
		var rows any
		if rawRows {
			rows = map[string]any{"columns": res.columns, "rows": res.arrayRows}
		} else {
			rows = res.objectRows
		}
		rendered = append(rendered, map[string]any{
			"success": true,
			"meta": map[string]any{
				"changed_db":  res.changes > 0,
				"changes":     res.changes,
				"last_row_id": res.lastRowID,
				"duration":    0,
			},
			"results": rows,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"errors":  []any{},
		"result":  rendered,
	})
}

// handleBridge serves the Memos bridge protocol: one atomic batch per
// request, one statement per entry, rows as arrays with a column list.
func (s *Server) handleBridge(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeBridgeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	if r.Header.Get("Authorization") != "Bearer "+bridgeToken {
		writeBridgeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var body bridgeRequest
	if err := decodeBody(r, &body); err != nil {
		writeBridgeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}
	if len(body.Statements) == 0 {
		writeBridgeError(w, http.StatusBadRequest, "request carries no statements")
		return
	}
	for _, entry := range body.Statements {
		if len(entry.Params) > maxBoundParameters {
			writeBridgeError(w, http.StatusBadRequest, fmt.Sprintf("too many bound parameters: %d", len(entry.Params)))
			return
		}
		// Every bridge entry goes through prepare(), which takes exactly one
		// statement.
		if len(splitStatements(entry.SQL)) != 1 {
			writeBridgeError(w, http.StatusBadRequest, "D1_ERROR: "+errMultipleStatements)
			return
		}
	}
	results, err := s.execute(r.Context(), body.Statements)
	if err != nil {
		writeBridgeError(w, http.StatusBadRequest, "D1_ERROR: "+err.Error())
		return
	}
	size, err := s.databaseSize(r.Context())
	if err != nil {
		writeBridgeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	rendered := make([]map[string]any, 0, len(results))
	for _, res := range results {
		rendered = append(rendered, map[string]any{
			"columns": res.columns,
			"rows":    res.arrayRows,
			"meta": map[string]any{
				"changes":     res.changes,
				"last_row_id": res.lastRowID,
				"size_after":  size,
			},
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"results": rendered})
}

// execute runs stmts inside one transaction, mirroring D1's implicit
// transaction per request and its atomic batches.
func (s *Server) execute(ctx context.Context, stmts []requestStatement) ([]*statementResult, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	tx, err := s.conn.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	results := make([]*statementResult, 0, len(stmts))
	for _, stmt := range stmts {
		res, err := runStatement(ctx, tx, stmt)
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

func runStatement(ctx context.Context, tx *sql.Tx, stmt requestStatement) (*statementResult, error) {
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
	res, err := collectRows(ctx, tx, stmt.SQL, args)
	if err != nil {
		return nil, err
	}
	var after int64
	if err := tx.QueryRowContext(ctx, "SELECT total_changes(), last_insert_rowid()").Scan(&after, &res.lastRowID); err != nil {
		return nil, err
	}
	res.changes = after - before
	return res, nil
}

// collectRows executes one statement and drains its result set in both
// shapes. Statements without a result set yield empty slices.
func collectRows(ctx context.Context, tx *sql.Tx, query string, args []any) (*statementResult, error) {
	rows, err := tx.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	columns, err := rows.Columns()
	if err != nil {
		return nil, err
	}
	res := &statementResult{columns: columns, arrayRows: [][]any{}, objectRows: []map[string]any{}}
	for rows.Next() {
		cells := make([]any, len(columns))
		targets := make([]any, len(columns))
		for i := range cells {
			targets[i] = &cells[i]
		}
		if err := rows.Scan(targets...); err != nil {
			return nil, err
		}
		encoded := make([]any, len(columns))
		object := make(map[string]any, len(columns))
		for i, cell := range cells {
			encoded[i] = encodeCell(cell)
			object[columns[i]] = encoded[i]
		}
		res.arrayRows = append(res.arrayRows, encoded)
		res.objectRows = append(res.objectRows, object)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if err := rows.Close(); err != nil {
		return nil, err
	}
	return res, nil
}

// errMultipleStatements is the text D1 returns for a prepared statement that
// holds more than one statement.
const errMultipleStatements = "A prepared SQL statement must contain only one statement."

// splitStatements divides a script into statements the way SQLite's own
// parser would: sqlite3_complete reports where each statement ends, so
// string literals, comments, and trigger bodies never split a statement, and
// text that is only whitespace or comments yields nothing.
func splitStatements(text string) []string {
	statements := []string{}
	start := 0
	for i := 0; i < len(text); i++ {
		if text[i] != ';' || !sqlComplete(text[start:i+1]) {
			continue
		}
		if part := strings.TrimSpace(text[start : i+1]); !sqlBlank(part) {
			statements = append(statements, part)
		}
		start = i + 1
	}
	if tail := strings.TrimSpace(text[start:]); !sqlBlank(tail) {
		statements = append(statements, tail)
	}
	return statements
}

// sqlComplete reports whether text ends with a complete SQL statement.
func sqlComplete(text string) bool {
	tls := libc.NewTLS()
	defer tls.Close()
	cText, err := libc.CString(text)
	if err != nil {
		return false
	}
	defer libc.Xfree(tls, cText)
	return sqlite3.Xsqlite3_complete(tls, cText) != 0
}

// sqlBlank reports whether text holds no SQL: only whitespace, comments, and
// empty statements.
func sqlBlank(text string) bool {
	for {
		text = strings.TrimLeft(text, " \t\r\n;")
		switch {
		case text == "":
			return true
		case strings.HasPrefix(text, "--"):
			if _, rest, found := strings.Cut(text, "\n"); found {
				text = rest
			} else {
				return true
			}
		case strings.HasPrefix(text, "/*"):
			if _, rest, found := strings.Cut(text[2:], "*/"); found {
				text = rest
			} else {
				return true
			}
		default:
			return false
		}
	}
}

func decodeBody(r *http.Request, target any) error {
	decoder := json.NewDecoder(r.Body)
	decoder.UseNumber()
	return decoder.Decode(target)
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

func writeErrors(w http.ResponseWriter, status, code int, message string) {
	writeJSON(w, status, map[string]any{
		"success": false,
		"errors":  []apiError{{Code: code, Message: message}},
		"result":  nil,
	})
}

func writeBridgeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]any{"error": apiError{Message: message}})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
