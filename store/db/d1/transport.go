package d1

import (
	"bytes"
	"context"
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/pkg/errors"
)

// maxBoundParameters is D1's documented per-statement bind limit.
const maxBoundParameters = 100

// transport executes statements against one D1 database. The REST API and
// the deployment bridge implement it; the driver methods never see which.
type transport interface {
	// exec runs one statement and returns its rows and change counters.
	exec(ctx context.Context, stmt statement) (*result, error)
	// batch runs the statements in order as one transaction: either every
	// statement commits or none does.
	batch(ctx context.Context, stmts []statement) ([]*result, error)
	// script runs a parameter-free, possibly multi-statement SQL text as
	// one atomic unit. It backs schema migrations.
	script(ctx context.Context, sql string) error
	// databaseSize returns the database size in bytes, or -1 when the
	// transport cannot report one.
	databaseSize(ctx context.Context) (int64, error)
}

// newTransport selects the transport for the configured access mode.
func newTransport(config *Config) (transport, error) {
	httpClient := &http.Client{
		Timeout: 60 * time.Second,
		// Neither endpoint redirects, and following one could carry the
		// bearer credential onto a plaintext hop, so redirects surface as
		// errors instead.
		CheckRedirect: func(*http.Request, []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	switch config.Mode {
	case AccessModeREST:
		return &restTransport{httpClient: httpClient, config: config}, nil
	case AccessModeBridge:
		return &bridgeTransport{httpClient: httpClient, config: config}, nil
	default:
		return nil, errors.Errorf("d1: unsupported access mode %q", config.Mode)
	}
}

// Error is a failure reported by the D1 service or the bridge.
type Error struct {
	// Status is the HTTP status code of the response.
	Status int
	// Code is the service error code, when the response carried one.
	Code int
	// Message is the human readable error text.
	Message string
}

func (e *Error) Error() string {
	if e.Code != 0 {
		return fmt.Sprintf("d1: %s (code %d, http %d)", e.Message, e.Code, e.Status)
	}
	return fmt.Sprintf("d1: %s (http %d)", e.Message, e.Status)
}

// statement is one parameterized SQL statement.
type statement struct {
	SQL  string
	Args []any
}

// result is the outcome of one statement.
type result struct {
	Columns   []string
	Rows      [][]any
	Changes   int64
	LastRowID int64
	// SizeAfter is the database size after the statement committed, or 0
	// when the transport did not report it.
	SizeAfter int64
}

// requestStatement is the wire form of a statement shared by both transports.
type requestStatement struct {
	SQL    string `json:"sql"`
	Params []any  `json:"params,omitempty"`
}

// encodeStatements converts statements to their wire form.
func encodeStatements(stmts []statement) ([]requestStatement, error) {
	body := make([]requestStatement, 0, len(stmts))
	for _, stmt := range stmts {
		params, err := encodeArgs(stmt.Args)
		if err != nil {
			return nil, err
		}
		body = append(body, requestStatement{SQL: stmt.SQL, Params: params})
	}
	return body, nil
}

// httpDo posts or gets JSON with an optional bearer credential and returns
// the raw body with the status code.
func httpDo(ctx context.Context, httpClient *http.Client, method, target, token string, payload []byte) ([]byte, int, error) {
	var reader io.Reader
	if payload != nil {
		reader = bytes.NewReader(payload)
	}
	request, err := http.NewRequestWithContext(ctx, method, target, reader)
	if err != nil {
		return nil, 0, errors.Wrap(err, "failed to build d1 request")
	}
	if token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}
	request.Header.Set("Accept", "application/json")
	if payload != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	response, err := httpClient.Do(request)
	if err != nil {
		return nil, 0, errors.Wrap(err, "d1 request failed")
	}
	defer response.Body.Close()
	responseBody, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, response.StatusCode, errors.Wrap(err, "failed to read d1 response")
	}
	return responseBody, response.StatusCode, nil
}

func decodeJSON(data []byte, target any) error {
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.UseNumber()
	return decoder.Decode(target)
}

// decodeRows maps a column list and JSON row arrays onto driver values.
func decodeRows(columns []string, rawRows [][]json.RawMessage) ([][]any, error) {
	rows := make([][]any, 0, len(rawRows))
	for _, rawRow := range rawRows {
		row := make([]any, 0, len(rawRow))
		for _, rawValue := range rawRow {
			value, err := decodeValue(rawValue)
			if err != nil {
				return nil, err
			}
			row = append(row, value)
		}
		if len(row) != len(columns) {
			return nil, errors.Errorf("d1: row has %d cells for %d columns", len(row), len(columns))
		}
		rows = append(rows, row)
	}
	return rows, nil
}

// decodeNumber parses an optional JSON number, treating absence as zero.
func decodeNumber(number json.Number, what string) (int64, error) {
	if number == "" {
		return 0, nil
	}
	value, err := number.Int64()
	if err != nil {
		return 0, errors.Wrapf(err, "failed to parse d1 %s", what)
	}
	return value, nil
}

// decodeValue maps one JSON cell onto the driver.Value domain.
func decodeValue(raw json.RawMessage) (any, error) {
	if len(raw) == 0 {
		return nil, nil
	}
	switch raw[0] {
	case 'n':
		return nil, nil
	case 't':
		return int64(1), nil
	case 'f':
		return int64(0), nil
	case '"':
		var text string
		if err := json.Unmarshal(raw, &text); err != nil {
			return nil, errors.Wrap(err, "failed to decode d1 text cell")
		}
		return text, nil
	case '[':
		// Blobs arrive as arrays of byte values.
		var numbers []json.Number
		if err := decodeJSON(raw, &numbers); err != nil {
			return nil, errors.Wrap(err, "failed to decode d1 blob cell")
		}
		bytesValue := make([]byte, 0, len(numbers))
		for _, number := range numbers {
			b, err := number.Int64()
			if err != nil || b < 0 || b > 255 {
				return nil, errors.Errorf("d1: invalid blob byte %q", number)
			}
			bytesValue = append(bytesValue, byte(b))
		}
		return bytesValue, nil
	case '{':
		return string(raw), nil
	default:
		number := json.Number(bytes.TrimSpace(raw))
		if integer, err := number.Int64(); err == nil {
			return integer, nil
		}
		float, err := number.Float64()
		if err != nil {
			return nil, errors.Wrapf(err, "d1: invalid numeric cell %q", string(raw))
		}
		return float, nil
	}
}

// encodeArgs converts Go arguments to the JSON parameter list D1 accepts.
// Binary values are rejected: blob columns are written with unhex(?) and a
// hex-encoded string because JSON cannot carry raw bytes.
func encodeArgs(args []any) ([]any, error) {
	if len(args) > maxBoundParameters {
		return nil, errors.Errorf("d1: statement binds %d parameters, limit is %d", len(args), maxBoundParameters)
	}
	params := make([]any, 0, len(args))
	for _, arg := range args {
		value, err := driver.DefaultParameterConverter.ConvertValue(arg)
		if err != nil {
			return nil, errors.Wrap(err, "d1: unsupported parameter")
		}
		switch v := value.(type) {
		case nil, int64, float64, string:
			params = append(params, v)
		case bool:
			if v {
				params = append(params, int64(1))
			} else {
				params = append(params, int64(0))
			}
		case []byte:
			return nil, errors.New("d1: binary parameters are not supported; bind hex text through unhex(?)")
		case time.Time:
			params = append(params, v.UTC().Format(time.RFC3339Nano))
		default:
			return nil, errors.Errorf("d1: unsupported parameter type %T", value)
		}
	}
	return params, nil
}
