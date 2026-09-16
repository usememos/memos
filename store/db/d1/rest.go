package d1

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/pkg/errors"
)

// restTransport talks to one D1 database through the Cloudflare REST API
// with an API token.
type restTransport struct {
	httpClient *http.Client
	config     *Config
}

type restInfo struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type restMeta struct {
	Changes   json.Number `json:"changes"`
	LastRowID json.Number `json:"last_row_id"`
	SizeAfter json.Number `json:"size_after"`
}

type restRows struct {
	Columns []string            `json:"columns"`
	Rows    [][]json.RawMessage `json:"rows"`
}

type restResult struct {
	Success bool            `json:"success"`
	Meta    restMeta        `json:"meta"`
	Results json.RawMessage `json:"results"`
}

type restEnvelope struct {
	Success bool         `json:"success"`
	Errors  []restInfo   `json:"errors"`
	Result  []restResult `json:"result"`
}

func (t *restTransport) exec(ctx context.Context, stmt statement) (*result, error) {
	params, err := encodeArgs(stmt.Args)
	if err != nil {
		return nil, err
	}
	results, err := t.raw(ctx, map[string]any{"sql": stmt.SQL, "params": params})
	if err != nil {
		return nil, err
	}
	if len(results) != 1 {
		return nil, errors.Errorf("d1: expected 1 result, got %d", len(results))
	}
	return results[0], nil
}

// script sends the text as one request; the REST API executes the
// semicolon-separated statements as a batch.
func (t *restTransport) script(ctx context.Context, sql string) error {
	_, err := t.raw(ctx, map[string]any{"sql": sql})
	return err
}

func (t *restTransport) batch(ctx context.Context, stmts []statement) ([]*result, error) {
	if len(stmts) == 0 {
		return nil, nil
	}
	if len(stmts) == 1 {
		res, err := t.exec(ctx, stmts[0])
		if err != nil {
			return nil, err
		}
		return []*result{res}, nil
	}
	body, err := encodeStatements(stmts)
	if err != nil {
		return nil, err
	}
	results, err := t.raw(ctx, map[string]any{"batch": body})
	if err != nil {
		return nil, err
	}
	if len(results) != len(stmts) {
		return nil, errors.Errorf("d1: expected %d results, got %d", len(stmts), len(results))
	}
	return results, nil
}

func (t *restTransport) raw(ctx context.Context, body map[string]any) ([]*result, error) {
	payload, err := json.Marshal(body)
	if err != nil {
		return nil, errors.Wrap(err, "failed to encode d1 request")
	}
	responseBody, status, err := httpDo(ctx, t.httpClient, http.MethodPost, t.databaseURL()+"/raw", t.config.Token, payload)
	if err != nil {
		return nil, err
	}
	var env restEnvelope
	if err := decodeJSON(responseBody, &env); err != nil {
		return nil, errors.Wrap(err, "failed to decode d1 response")
	}
	if status != http.StatusOK || !env.Success {
		return nil, restError(status, env.Errors)
	}
	results := make([]*result, 0, len(env.Result))
	for _, item := range env.Result {
		if !item.Success {
			return nil, &Error{Status: status, Message: "statement reported failure"}
		}
		res, err := decodeRESTResult(item)
		if err != nil {
			return nil, err
		}
		results = append(results, res)
	}
	return results, nil
}

// databaseSize returns the file size reported by the D1 metadata endpoint.
func (t *restTransport) databaseSize(ctx context.Context) (int64, error) {
	responseBody, status, err := httpDo(ctx, t.httpClient, http.MethodGet, t.databaseURL()+"?fields=file_size", t.config.Token, nil)
	if err != nil {
		return -1, err
	}
	var env struct {
		Success bool       `json:"success"`
		Errors  []restInfo `json:"errors"`
		Result  struct {
			FileSize json.Number `json:"file_size"`
		} `json:"result"`
	}
	if err := decodeJSON(responseBody, &env); err != nil {
		return -1, errors.Wrap(err, "failed to decode d1 database metadata")
	}
	if status != http.StatusOK || !env.Success {
		return -1, restError(status, env.Errors)
	}
	size, err := env.Result.FileSize.Int64()
	if err != nil {
		return -1, errors.Wrap(err, "failed to parse d1 database size")
	}
	return size, nil
}

func (t *restTransport) databaseURL() string {
	return fmt.Sprintf("%s/accounts/%s/d1/database/%s", t.config.Endpoint, url.PathEscape(t.config.AccountID), url.PathEscape(t.config.DatabaseID))
}

func restError(status int, infos []restInfo) error {
	if len(infos) == 0 {
		return &Error{Status: status, Message: http.StatusText(status)}
	}
	messages := make([]string, 0, len(infos))
	for _, info := range infos {
		messages = append(messages, info.Message)
	}
	return &Error{Status: status, Code: infos[0].Code, Message: strings.Join(messages, "; ")}
}

func decodeRESTResult(item restResult) (*result, error) {
	res := &result{}
	var err error
	if res.Changes, err = decodeNumber(item.Meta.Changes, "change count"); err != nil {
		return nil, err
	}
	if res.LastRowID, err = decodeNumber(item.Meta.LastRowID, "last row id"); err != nil {
		return nil, err
	}
	if res.SizeAfter, err = decodeNumber(item.Meta.SizeAfter, "database size"); err != nil {
		return nil, err
	}
	if len(item.Results) == 0 || string(item.Results) == "null" {
		return res, nil
	}
	var raw restRows
	if err := decodeJSON(item.Results, &raw); err != nil {
		return nil, errors.Wrap(err, "failed to decode d1 rows")
	}
	res.Columns = raw.Columns
	if res.Rows, err = decodeRows(raw.Columns, raw.Rows); err != nil {
		return nil, err
	}
	return res, nil
}
