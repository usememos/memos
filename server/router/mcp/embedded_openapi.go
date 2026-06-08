package mcp

import _ "embed"

// embeddedOpenAPISpec is a copy of proto/gen/openapi.yaml for runtime startup.
//
//go:embed openapi.yaml
var embeddedOpenAPISpec []byte
