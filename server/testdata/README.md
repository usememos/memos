# HTTP compatibility responses

`http_compat.jsonl` records 142 responses from the Echo implementation at
`ed838e805`, before the migration to `net/http`. `TestHTTPCompatibility` boots
the complete server and checks the same requests against these responses.

The cases cover method handling, CORS, API namespace boundaries, removed API
versions, escaped paths, trailing slashes, and SPA fallback. JSON bodies are
compared structurally because protobuf serialization may vary whitespace.
HTML bodies are represented by a marker, and Content-Length and Last-Modified
are excluded because rebuilding the embedded frontend changes them.

Treat these as the compatibility baseline. Do not regenerate them from the
new implementation to make a failing test pass.
