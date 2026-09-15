package d1

import (
	"bytes"
	"context"
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/pkg/errors"
)

// DefaultEndpoint is the Cloudflare REST API base URL.
const DefaultEndpoint = "https://api.cloudflare.com/client/v4"

// maxBoundParameters is D1's documented per-statement bind limit.
const maxBoundParameters = 100

// Config is the parsed form of a D1 DSN.
//
// DSN grammar:
//
//	d1://<account_id>/<database_id>?token=<api_token>[&endpoint=<base_url>]
//
// The token may be omitted from the DSN and supplied through the
// CLOUDFLARE_API_TOKEN environment variable instead so it stays out of
// process listings and logs.
type Config struct {
	AccountID  string
	DatabaseID string
	Token      string
	Endpoint   string
}

// ParseDSN parses a d1:// DSN.
func ParseDSN(dsn string) (*Config, error) {
	parsed, err := url.Parse(dsn)
	if err != nil {
		return nil, errors.Wrap(err, "failed to parse d1 dsn")
	}
	if parsed.Scheme != "d1" {
		return nil, errors.Errorf("d1 dsn must use the d1:// scheme, got %q", parsed.Scheme)
	}
	config := &Config{
		AccountID:  parsed.Host,
		DatabaseID: strings.Trim(parsed.Path, "/"),
		Token:      parsed.Query().Get("token"),
		Endpoint:   strings.TrimRight(parsed.Query().Get("endpoint"), "/"),
	}
	if config.AccountID == "" {
		return nil, errors.New("d1 dsn is missing the account id: d1://<account_id>/<database_id>")
	}
	if config.DatabaseID == "" || strings.Contains(config.DatabaseID, "/") {
		return nil, errors.New("d1 dsn is missing the database id: d1://<account_id>/<database_id>")
	}
	if config.Token == "" {
		config.Token = os.Getenv("CLOUDFLARE_API_TOKEN")
	}
	if config.Token == "" {
		return nil, errors.New("d1 api token is required: add ?token=<api_token> to the dsn or set CLOUDFLARE_API_TOKEN")
	}
	if config.Endpoint == "" {
		config.Endpoint = DefaultEndpoint
	}
	if err := validateEndpoint(config.Endpoint); err != nil {
		return nil, err
	}
	return config, nil
}

// validateEndpoint rejects endpoints that would send the bearer token in the
// clear. Plain HTTP is allowed only towards loopback, where the test
// emulator listens.
func validateEndpoint(endpoint string) error {
	parsed, err := url.Parse(endpoint)
	if err != nil {
		return errors.Wrap(err, "invalid d1 endpoint")
	}
	if parsed.Host == "" {
		return errors.Errorf("d1 endpoint %q has no host", endpoint)
	}
	switch parsed.Scheme {
	case "https":
		return nil
	case "http":
		if isLoopbackHost(parsed.Hostname()) {
			return nil
		}
		return errors.Errorf("d1 endpoint %q must use https unless it points at loopback", endpoint)
	default:
		return errors.Errorf("d1 endpoint %q must use https", endpoint)
	}
}

func isLoopbackHost(host string) bool {
	if host == "localhost" {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

// Error is a failure reported by the D1 REST API.
type Error struct {
	// Status is the HTTP status code of the response.
	Status int
	// Code is the Cloudflare API error code, when the response carried one.
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
}

// client talks to one D1 database through the Cloudflare REST API.
type client struct {
	httpClient *http.Client
	config     *Config
}

func newClient(config *Config) *client {
	return &client{
		httpClient: &http.Client{Timeout: 60 * time.Second},
		config:     config,
	}
}

type requestStatement struct {
	SQL    string `json:"sql"`
	Params []any  `json:"params,omitempty"`
}

type responseInfo struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type responseMeta struct {
	Changes   json.Number `json:"changes"`
	LastRowID json.Number `json:"last_row_id"`
}

type rawResults struct {
	Columns []string            `json:"columns"`
	Rows    [][]json.RawMessage `json:"rows"`
}

type queryResult struct {
	Success bool            `json:"success"`
	Meta    responseMeta    `json:"meta"`
	Results json.RawMessage `json:"results"`
}

type envelope struct {
	Success bool           `json:"success"`
	Errors  []responseInfo `json:"errors"`
	Result  []queryResult  `json:"result"`
}

// exec runs one statement and returns its rows and change counters.
func (c *client) exec(ctx context.Context, stmt statement) (*result, error) {
	params, err := encodeArgs(stmt.Args)
	if err != nil {
		return nil, err
	}
	results, err := c.raw(ctx, map[string]any{"sql": stmt.SQL, "params": params})
	if err != nil {
		return nil, err
	}
	if len(results) != 1 {
		return nil, errors.Errorf("d1: expected 1 result, got %d", len(results))
	}
	return results[0], nil
}

// script runs a parameter-free, possibly multi-statement SQL text as one
// atomic batch. It backs schema migrations.
func (c *client) script(ctx context.Context, sql string) error {
	_, err := c.raw(ctx, map[string]any{"sql": sql})
	return err
}

// batch runs the statements in order as one transaction: either every
// statement commits or none does.
func (c *client) batch(ctx context.Context, stmts []statement) ([]*result, error) {
	if len(stmts) == 0 {
		return nil, nil
	}
	if len(stmts) == 1 {
		res, err := c.exec(ctx, stmts[0])
		if err != nil {
			return nil, err
		}
		return []*result{res}, nil
	}
	body := make([]requestStatement, 0, len(stmts))
	for _, stmt := range stmts {
		params, err := encodeArgs(stmt.Args)
		if err != nil {
			return nil, err
		}
		body = append(body, requestStatement{SQL: stmt.SQL, Params: params})
	}
	results, err := c.raw(ctx, map[string]any{"batch": body})
	if err != nil {
		return nil, err
	}
	if len(results) != len(stmts) {
		return nil, errors.Errorf("d1: expected %d results, got %d", len(stmts), len(results))
	}
	return results, nil
}

func (c *client) raw(ctx context.Context, body map[string]any) ([]*result, error) {
	payload, err := json.Marshal(body)
	if err != nil {
		return nil, errors.Wrap(err, "failed to encode d1 request")
	}
	responseBody, status, err := c.do(ctx, http.MethodPost, c.databaseURL()+"/raw", payload)
	if err != nil {
		return nil, err
	}
	var env envelope
	if err := decodeJSON(responseBody, &env); err != nil {
		return nil, errors.Wrap(err, "failed to decode d1 response")
	}
	if status != http.StatusOK || !env.Success {
		return nil, envelopeError(status, env.Errors)
	}
	results := make([]*result, 0, len(env.Result))
	for _, item := range env.Result {
		if !item.Success {
			return nil, &Error{Status: status, Message: "statement reported failure"}
		}
		res, err := decodeResult(item)
		if err != nil {
			return nil, err
		}
		results = append(results, res)
	}
	return results, nil
}

// databaseSize returns the database file size reported by the D1 metadata endpoint.
func (c *client) databaseSize(ctx context.Context) (int64, error) {
	responseBody, status, err := c.do(ctx, http.MethodGet, c.databaseURL()+"?fields=file_size", nil)
	if err != nil {
		return -1, err
	}
	var env struct {
		Success bool           `json:"success"`
		Errors  []responseInfo `json:"errors"`
		Result  struct {
			FileSize json.Number `json:"file_size"`
		} `json:"result"`
	}
	if err := decodeJSON(responseBody, &env); err != nil {
		return -1, errors.Wrap(err, "failed to decode d1 database metadata")
	}
	if status != http.StatusOK || !env.Success {
		return -1, envelopeError(status, env.Errors)
	}
	size, err := env.Result.FileSize.Int64()
	if err != nil {
		return -1, errors.Wrap(err, "failed to parse d1 database size")
	}
	return size, nil
}

func (c *client) databaseURL() string {
	return fmt.Sprintf("%s/accounts/%s/d1/database/%s", c.config.Endpoint, url.PathEscape(c.config.AccountID), url.PathEscape(c.config.DatabaseID))
}

func (c *client) do(ctx context.Context, method, target string, payload []byte) ([]byte, int, error) {
	var reader io.Reader
	if payload != nil {
		reader = bytes.NewReader(payload)
	}
	request, err := http.NewRequestWithContext(ctx, method, target, reader)
	if err != nil {
		return nil, 0, errors.Wrap(err, "failed to build d1 request")
	}
	request.Header.Set("Authorization", "Bearer "+c.config.Token)
	request.Header.Set("Accept", "application/json")
	if payload != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	response, err := c.httpClient.Do(request)
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

func envelopeError(status int, infos []responseInfo) error {
	if len(infos) == 0 {
		return &Error{Status: status, Message: http.StatusText(status)}
	}
	messages := make([]string, 0, len(infos))
	for _, info := range infos {
		messages = append(messages, info.Message)
	}
	return &Error{Status: status, Code: infos[0].Code, Message: strings.Join(messages, "; ")}
}

func decodeJSON(data []byte, target any) error {
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.UseNumber()
	return decoder.Decode(target)
}

func decodeResult(item queryResult) (*result, error) {
	res := &result{}
	if item.Meta.Changes != "" {
		changes, err := item.Meta.Changes.Int64()
		if err != nil {
			return nil, errors.Wrap(err, "failed to parse d1 change count")
		}
		res.Changes = changes
	}
	if item.Meta.LastRowID != "" {
		lastRowID, err := item.Meta.LastRowID.Int64()
		if err != nil {
			return nil, errors.Wrap(err, "failed to parse d1 last row id")
		}
		res.LastRowID = lastRowID
	}
	if len(item.Results) == 0 || string(item.Results) == "null" {
		return res, nil
	}
	var raw rawResults
	if err := decodeJSON(item.Results, &raw); err != nil {
		return nil, errors.Wrap(err, "failed to decode d1 rows")
	}
	res.Columns = raw.Columns
	res.Rows = make([][]any, 0, len(raw.Rows))
	for _, rawRow := range raw.Rows {
		row := make([]any, 0, len(rawRow))
		for _, rawValue := range rawRow {
			value, err := decodeValue(rawValue)
			if err != nil {
				return nil, err
			}
			row = append(row, value)
		}
		res.Rows = append(res.Rows, row)
	}
	return res, nil
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
		var bytesValue []byte
		var numbers []json.Number
		if err := decodeJSON(raw, &numbers); err != nil {
			return nil, errors.Wrap(err, "failed to decode d1 blob cell")
		}
		bytesValue = make([]byte, 0, len(numbers))
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
