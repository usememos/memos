package mcp

import (
	"os"
	"strings"

	"github.com/pkg/errors"
	"gopkg.in/yaml.v3"
)

type jsonSchema map[string]any

type openAPISpec struct {
	OpenAPI    string                                  `yaml:"openapi"`
	Paths      map[string]map[string]*openAPIOperation `yaml:"paths"`
	Components openAPIComponents                       `yaml:"components"`
}

type openAPIComponents struct {
	Schemas map[string]jsonSchema `yaml:"schemas"`
}

type openAPIOperation struct {
	OperationID       string                     `yaml:"operationId"`
	Description       string                     `yaml:"description"`
	Parameters        []openAPIParameter         `yaml:"parameters"`
	RequestBody       *openAPIRequestBody        `yaml:"requestBody"`
	Responses         map[string]openAPIResponse `yaml:"responses"`
	Method            string                     `yaml:"-"`
	Path              string                     `yaml:"-"`
	ResponseSchema    jsonSchema                 `yaml:"-"`
	RequestBodySchema jsonSchema                 `yaml:"-"`
}

type openAPIParameter struct {
	Name        string     `yaml:"name"`
	In          string     `yaml:"in"`
	Description string     `yaml:"description"`
	Required    bool       `yaml:"required"`
	Schema      jsonSchema `yaml:"schema"`
}

type openAPIRequestBody struct {
	Required bool                        `yaml:"required"`
	Content  map[string]openAPIMediaType `yaml:"content"`
}

type openAPIResponse struct {
	Description string                      `yaml:"description"`
	Content     map[string]openAPIMediaType `yaml:"content"`
}

type openAPIMediaType struct {
	Schema jsonSchema `yaml:"schema"`
}

func loadOpenAPISpec(path string) (*openAPISpec, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, errors.Wrap(err, "failed to read OpenAPI spec")
	}

	spec := &openAPISpec{}
	if err := yaml.Unmarshal(data, spec); err != nil {
		return nil, errors.Wrap(err, "failed to parse OpenAPI spec")
	}
	if spec.Paths == nil {
		return nil, errors.New("OpenAPI spec has no paths")
	}
	return spec, nil
}

func buildOperationRegistry(spec *openAPISpec) (map[string]*openAPIOperation, error) {
	registry := map[string]*openAPIOperation{}
	for path, pathItem := range spec.Paths {
		for method, operation := range pathItem {
			if operation == nil || operation.OperationID == "" {
				continue
			}
			if _, exists := registry[operation.OperationID]; exists {
				return nil, errors.Errorf("duplicate OpenAPI operationId %q", operation.OperationID)
			}

			operation.Method = strings.ToUpper(method)
			operation.Path = path

			responseSchema, err := operationSuccessResponseSchema(spec, operation)
			if err != nil {
				return nil, errors.Wrapf(err, "failed to resolve response schema for %s", operation.OperationID)
			}
			operation.ResponseSchema = responseSchema

			requestBodySchema, err := operationRequestBodySchema(spec, operation)
			if err != nil {
				return nil, errors.Wrapf(err, "failed to resolve request body schema for %s", operation.OperationID)
			}
			operation.RequestBodySchema = requestBodySchema

			registry[operation.OperationID] = operation
		}
	}
	return registry, nil
}

func operationSuccessResponseSchema(spec *openAPISpec, operation *openAPIOperation) (jsonSchema, error) {
	response, ok := operation.Responses["200"]
	if !ok || response.Content == nil {
		return okSchema(), nil
	}
	mediaType, ok := response.Content["application/json"]
	if !ok || mediaType.Schema == nil {
		return okSchema(), nil
	}
	return resolveSchemaRef(spec, mediaType.Schema)
}

func operationRequestBodySchema(spec *openAPISpec, operation *openAPIOperation) (jsonSchema, error) {
	if operation.RequestBody == nil {
		return nil, nil
	}
	mediaType, ok := operation.RequestBody.Content["application/json"]
	if !ok || mediaType.Schema == nil {
		return jsonSchema{"type": "object"}, nil
	}
	return resolveSchemaRef(spec, mediaType.Schema)
}

func resolveSchemaRef(spec *openAPISpec, schema jsonSchema) (jsonSchema, error) {
	ref, ok := schema["$ref"].(string)
	if !ok || ref == "" {
		return schema, nil
	}

	const prefix = "#/components/schemas/"
	if !strings.HasPrefix(ref, prefix) {
		return nil, errors.Errorf("unsupported schema ref %q", ref)
	}

	name := strings.TrimPrefix(ref, prefix)
	resolved, ok := spec.Components.Schemas[name]
	if !ok {
		return nil, errors.Errorf("schema ref %q not found", ref)
	}
	return resolved, nil
}

func okSchema() jsonSchema {
	return jsonSchema{
		"type": "object",
		"properties": map[string]any{
			"ok": map[string]any{"type": "boolean"},
		},
	}
}
