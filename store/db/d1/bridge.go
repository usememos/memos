package d1

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store/db/d1/sqlsplit"
)

// bridgeTransport talks to a deployment-provided Worker that holds the D1
// binding and speaks the Memos bridge protocol documented in
// docs/design/cloudflare-d1.md. Every request is one atomic batch; the
// Worker runs it through the binding's batch() and returns one result per
// statement.
type bridgeTransport struct {
	httpClient *http.Client
	config     *Config
}

type bridgeRequest struct {
	Statements []requestStatement `json:"statements"`
}

type bridgeMeta struct {
	Changes   json.Number `json:"changes"`
	LastRowID json.Number `json:"last_row_id"`
	SizeAfter json.Number `json:"size_after"`
}

type bridgeResult struct {
	Columns []string            `json:"columns"`
	Rows    [][]json.RawMessage `json:"rows"`
	Meta    bridgeMeta          `json:"meta"`
}

type bridgeResponse struct {
	Results []bridgeResult `json:"results"`
	Error   *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

func (t *bridgeTransport) exec(ctx context.Context, stmt statement) (*result, error) {
	results, err := t.run(ctx, []statement{stmt})
	if err != nil {
		return nil, err
	}
	return results[0], nil
}

func (t *bridgeTransport) batch(ctx context.Context, stmts []statement) ([]*result, error) {
	if len(stmts) == 0 {
		return nil, nil
	}
	return t.run(ctx, stmts)
}

// script splits the text into statements locally, since the bridge carries
// exactly one statement per entry, and runs them as one atomic batch.
func (t *bridgeTransport) script(ctx context.Context, sql string) error {
	parts := sqlsplit.Split(sql)
	if len(parts) == 0 {
		return nil
	}
	stmts := make([]statement, 0, len(parts))
	for _, part := range parts {
		stmts = append(stmts, statement{SQL: part})
	}
	_, err := t.run(ctx, stmts)
	return err
}

// databaseSize reads the size the binding reports after a trivial statement.
// A bridge that omits size_after yields -1.
func (t *bridgeTransport) databaseSize(ctx context.Context) (int64, error) {
	res, err := t.exec(ctx, statement{SQL: "SELECT 1"})
	if err != nil {
		return -1, err
	}
	if res.SizeAfter <= 0 {
		return -1, nil
	}
	return res.SizeAfter, nil
}

func (t *bridgeTransport) run(ctx context.Context, stmts []statement) ([]*result, error) {
	body, err := encodeStatements(stmts)
	if err != nil {
		return nil, err
	}
	payload, err := json.Marshal(bridgeRequest{Statements: body})
	if err != nil {
		return nil, errors.Wrap(err, "failed to encode d1 bridge request")
	}
	responseBody, status, err := httpDo(ctx, t.httpClient, http.MethodPost, t.config.BridgeURL, t.config.Token, payload)
	if err != nil {
		return nil, err
	}
	var response bridgeResponse
	if err := decodeJSON(responseBody, &response); err != nil {
		if status != http.StatusOK {
			return nil, &Error{Status: status, Message: http.StatusText(status)}
		}
		return nil, errors.Wrap(err, "failed to decode d1 bridge response")
	}
	if response.Error != nil {
		return nil, &Error{Status: status, Code: response.Error.Code, Message: response.Error.Message}
	}
	if status != http.StatusOK {
		return nil, &Error{Status: status, Message: http.StatusText(status)}
	}
	if len(response.Results) != len(stmts) {
		return nil, errors.Errorf("d1: bridge returned %d results for %d statements", len(response.Results), len(stmts))
	}
	results := make([]*result, 0, len(response.Results))
	for _, item := range response.Results {
		res, err := decodeBridgeResult(item)
		if err != nil {
			return nil, err
		}
		results = append(results, res)
	}
	return results, nil
}

func decodeBridgeResult(item bridgeResult) (*result, error) {
	res := &result{Columns: item.Columns}
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
	if res.Rows, err = decodeRows(item.Columns, item.Rows); err != nil {
		return nil, err
	}
	return res, nil
}
