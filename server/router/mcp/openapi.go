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
	defs := map[string]any{}
	resolved, err := resolveSchemaValue(spec, schema, defs, map[string]bool{}, true)
	if err != nil {
		return nil, err
	}

	resolvedSchema, ok := resolved.(map[string]any)
	if !ok {
		return nil, errors.New("resolved schema is not an object")
	}
	if len(defs) > 0 {
		resolvedSchema["$defs"] = defs
	}
	return jsonSchema(resolvedSchema), nil
}

func resolveSchemaValue(spec *openAPISpec, value any, defs map[string]any, resolving map[string]bool, inlineRef bool) (any, error) {
	switch typed := value.(type) {
	case jsonSchema:
		return resolveSchemaMap(spec, map[string]any(typed), defs, resolving, inlineRef)
	case map[string]any:
		return resolveSchemaMap(spec, typed, defs, resolving, inlineRef)
	case []any:
		resolved := make([]any, 0, len(typed))
		for _, item := range typed {
			resolvedItem, err := resolveSchemaValue(spec, item, defs, resolving, false)
			if err != nil {
				return nil, err
			}
			resolved = append(resolved, resolvedItem)
		}
		return resolved, nil
	default:
		return value, nil
	}
}

func resolveSchemaMap(spec *openAPISpec, schema map[string]any, defs map[string]any, resolving map[string]bool, inlineRef bool) (map[string]any, error) {
	if ref, ok := schema["$ref"].(string); ok && ref != "" {
		name, err := schemaComponentName(ref)
		if err != nil {
			return nil, err
		}
		if inlineRef {
			return resolveComponentSchema(spec, name, defs, resolving)
		}
		if err := addSchemaDef(spec, name, defs, resolving); err != nil {
			return nil, err
		}
		return map[string]any{"$ref": "#/$defs/" + name}, nil
	}

	resolved := make(map[string]any, len(schema))
	for key, value := range schema {
		resolvedValue, err := resolveSchemaValue(spec, value, defs, resolving, false)
		if err != nil {
			return nil, err
		}
		resolved[key] = resolvedValue
	}
	return resolved, nil
}

func resolveComponentSchema(spec *openAPISpec, name string, defs map[string]any, resolving map[string]bool) (map[string]any, error) {
	component, ok := spec.Components.Schemas[name]
	if !ok {
		return nil, errors.Errorf("schema ref %q not found", schemaComponentRef(name))
	}
	resolving[name] = true
	resolved, err := resolveSchemaMap(spec, map[string]any(component), defs, resolving, false)
	delete(resolving, name)
	if err != nil {
		return nil, err
	}
	if _, ok := defs[name]; ok {
		defs[name] = resolved
	}
	return resolved, nil
}

func addSchemaDef(spec *openAPISpec, name string, defs map[string]any, resolving map[string]bool) error {
	if _, ok := defs[name]; ok {
		return nil
	}
	component, ok := spec.Components.Schemas[name]
	if !ok {
		return errors.Errorf("schema ref %q not found", schemaComponentRef(name))
	}

	defs[name] = map[string]any{}
	if resolving[name] {
		return nil
	}

	resolving[name] = true
	resolved, err := resolveSchemaMap(spec, map[string]any(component), defs, resolving, false)
	delete(resolving, name)
	if err != nil {
		return err
	}
	defs[name] = resolved
	return nil
}

func schemaComponentName(ref string) (string, error) {
	const prefix = "#/components/schemas/"
	if !strings.HasPrefix(ref, prefix) {
		return "", errors.Errorf("unsupported schema ref %q", ref)
	}
	return strings.TrimPrefix(ref, prefix), nil
}

func schemaComponentRef(name string) string {
	return "#/components/schemas/" + name
}

func okSchema() jsonSchema {
	return jsonSchema{
		"type": "object",
		"properties": map[string]any{
			"ok": map[string]any{"type": "boolean"},
		},
	}
}
