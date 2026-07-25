package mcp

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"

	"github.com/labstack/echo/v5"
	sdkmcp "github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/pkg/errors"
)

type apiAdapter struct {
	echoServer *echo.Echo
}

func newAPIAdapter(echoServer *echo.Echo) *apiAdapter {
	return &apiAdapter{echoServer: echoServer}
}

func (a *apiAdapter) execute(ctx context.Context, operation *openAPIOperation, arguments map[string]any, authorization string) (*sdkmcp.CallToolResult, error) {
	req, err := buildAPIRequest(ctx, operation, arguments, authorization)
	if err != nil {
		return newToolErrorResult(err.Error()), nil
	}

	recorder := httptest.NewRecorder()
	a.echoServer.ServeHTTP(recorder, req)

	value, err := decodeJSONValue(recorder.Body.Bytes())
	if err != nil {
		return newToolErrorResult(err.Error()), nil
	}
	if recorder.Code < http.StatusOK || recorder.Code >= http.StatusMultipleChoices {
		return newToolErrorResult(apiErrorMessage(recorder.Code, value)), nil
	}
	return newStructuredToolResult(value)
}

func buildAPIRequest(ctx context.Context, operation *openAPIOperation, arguments map[string]any, authorization string) (*http.Request, error) {
	path, err := substitutePathParameters(operation, arguments)
	if err != nil {
		return nil, err
	}

	query := url.Values{}
	for _, parameter := range operation.Parameters {
		if parameter.In != "query" {
			continue
		}
		value, ok := arguments[parameter.Name]
		if !ok || value == nil {
			continue
		}
		query.Set(parameter.Name, valueToString(value))
	}
	if encoded := query.Encode(); encoded != "" {
		path += "?" + encoded
	}

	var body io.Reader
	if operation.RequestBody != nil {
		bodyValue, ok := arguments["body"]
		if !ok || bodyValue == nil {
			if operation.RequestBody.Required {
				return nil, errors.New(`missing required request body "body"`)
			}
			bodyValue = map[string]any{}
		}

		data, err := json.Marshal(bodyValue)
		if err != nil {
			return nil, errors.Wrap(err, "failed to marshal request body")
		}
		body = bytes.NewReader(data)
	}

	req := httptest.NewRequest(operation.Method, path, body).WithContext(ctx)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if authorization != "" {
		req.Header.Set("Authorization", authorization)
	}
	return req, nil
}

func substitutePathParameters(operation *openAPIOperation, arguments map[string]any) (string, error) {
	for _, parameter := range operation.Parameters {
		if parameter.In != "path" {
			continue
		}
		value, ok := arguments[parameter.Name]
		if !ok || value == nil || valueToString(value) == "" {
			return "", errors.Errorf(`missing required path parameter "%s"`, parameter.Name)
		}
	}

	// Resolve placeholders in the order they appear in the path so a nested
	// resource name (e.g. "memos/abc123/reactions/reaction456") can be matched
	// against its already-resolved parent segments. Each placeholder is resolved
	// exactly once from the argument map and cached in resolved, so a value that
	// itself contains a "{" can never be re-expanded into a longer prefix.
	path := operation.Path
	resolved := map[string]string{}
	for _, name := range pathPlaceholderNames(operation.Path) {
		value, ok := arguments[name]
		if !ok {
			continue
		}
		id := trimResourceNamePrefix(operation.Path, name, valueToString(value), resolved)
		resolved[name] = id
		path = strings.ReplaceAll(path, "{"+name+"}", url.PathEscape(id))
	}
	return path, nil
}

// pathPlaceholderNames returns the "{name}" placeholder names in the order they
// appear in path.
func pathPlaceholderNames(path string) []string {
	var names []string
	for {
		start := strings.Index(path, "{")
		if start < 0 {
			break
		}
		endOffset := strings.Index(path[start:], "}")
		if endOffset < 0 {
			break
		}
		end := start + endOffset
		names = append(names, path[start+1:end])
		path = path[end+1:]
	}
	return names
}

// trimResourceNamePrefix accepts canonical resource names for path parameters.
// It uses the already-resolved parent segments so nested names such as
// "memos/abc123/reactions/reaction456" are accepted only when their parent
// segments match the other arguments. Bare IDs pass through unchanged.
func trimResourceNamePrefix(path, parameterName, value string, resolved map[string]string) string {
	placeholder := "/{" + parameterName + "}"
	index := strings.Index(path, placeholder)
	if index < 0 {
		return value
	}

	prefix, ok := resolvedResourceNamePrefix(path[:index], resolved)
	if !ok || prefix == "" {
		return value
	}

	id, ok := strings.CutPrefix(value, prefix+"/")
	if !ok || id == "" || strings.Contains(id, "/") {
		return value
	}
	return id
}

// resolvedResourceNamePrefix rebuilds the collection prefix preceding a
// placeholder by substituting each earlier placeholder with its already-resolved
// bare id. It reads resolved ids from the map instead of recursing, and rejects
// any id that is not a single bare segment, so every iteration removes one "{"
// and the loop always terminates.
func resolvedResourceNamePrefix(prefix string, resolved map[string]string) (string, bool) {
	const apiPrefix = "/api/v1/"
	prefix, ok := strings.CutPrefix(prefix, apiPrefix)
	if !ok {
		return "", false
	}

	for {
		start := strings.Index(prefix, "{")
		if start < 0 {
			break
		}
		endOffset := strings.Index(prefix[start:], "}")
		if endOffset < 0 {
			return "", false
		}
		end := start + endOffset
		parameterName := prefix[start+1 : end]
		id, ok := resolved[parameterName]
		if !ok || id == "" || strings.ContainsAny(id, "/{}") {
			return "", false
		}
		prefix = prefix[:start] + id + prefix[end+1:]
	}

	return strings.Trim(prefix, "/"), true
}

func valueToString(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case bool:
		return strconv.FormatBool(typed)
	case int:
		return strconv.Itoa(typed)
	case int8:
		return strconv.FormatInt(int64(typed), 10)
	case int16:
		return strconv.FormatInt(int64(typed), 10)
	case int32:
		return strconv.FormatInt(int64(typed), 10)
	case int64:
		return strconv.FormatInt(typed, 10)
	case uint:
		return strconv.FormatUint(uint64(typed), 10)
	case uint8:
		return strconv.FormatUint(uint64(typed), 10)
	case uint16:
		return strconv.FormatUint(uint64(typed), 10)
	case uint32:
		return strconv.FormatUint(uint64(typed), 10)
	case uint64:
		return strconv.FormatUint(typed, 10)
	case float32:
		return strconv.FormatFloat(float64(typed), 'f', -1, 32)
	case float64:
		return strconv.FormatFloat(typed, 'f', -1, 64)
	default:
		data, err := json.Marshal(value)
		if err != nil {
			return ""
		}
		return strings.Trim(string(data), `"`)
	}
}

func apiErrorMessage(statusCode int, value any) string {
	status := strings.TrimSpace(strconv.Itoa(statusCode) + " " + http.StatusText(statusCode))
	if object, ok := value.(map[string]any); ok {
		for _, key := range []string{"message", "error"} {
			message, ok := object[key].(string)
			if ok && message != "" {
				return status + ": " + message
			}
		}
	}
	return status
}
