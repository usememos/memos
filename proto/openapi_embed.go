package proto

import _ "embed"

//go:embed gen/openapi.yaml
var openAPIYAML []byte

// OpenAPIYAML returns the embedded generated OpenAPI specification.
func OpenAPIYAML() []byte {
	return append([]byte(nil), openAPIYAML...)
}
