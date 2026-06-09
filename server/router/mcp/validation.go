package mcp

import (
	"encoding/json"
	"math"
	"strings"

	googlejsonschema "github.com/google/jsonschema-go/jsonschema"
	"github.com/pkg/errors"
)

func validateToolArguments(schema jsonSchema, arguments map[string]any) error {
	if schema == nil {
		return nil
	}
	if err := validateSchemaValue(schema, "argument", "argument", arguments, schema); err != nil {
		return err
	}
	return validateArgumentsWithJSONSchema(schema, arguments)
}

func validateArgumentsWithJSONSchema(schema jsonSchema, arguments map[string]any) error {
	data, err := json.Marshal(schema)
	if err != nil {
		return errors.Wrap(err, "failed to marshal MCP tool input schema")
	}
	jsonSchema := &googlejsonschema.Schema{}
	if err := json.Unmarshal(data, jsonSchema); err != nil {
		return errors.Wrap(err, "failed to parse MCP tool input schema")
	}
	resolved, err := jsonSchema.Resolve(nil)
	if err != nil {
		return errors.Wrap(err, "failed to resolve MCP tool input schema")
	}
	if err := resolved.Validate(arguments); err != nil {
		return errors.Wrap(err, "MCP tool arguments do not match input schema")
	}
	return nil
}

func validateSchemaValue(schemaValue any, path string, label string, value any, root jsonSchema) error {
	schema, ok := asSchemaMap(schemaValue)
	if !ok {
		return nil
	}
	if ref, ok := schema["$ref"].(string); ok && ref != "" {
		resolved, ok := localSchemaDef(root, ref)
		if !ok {
			return nil
		}
		return validateSchemaValue(resolved, path, label, value, root)
	}
	if value == nil {
		return nil
	}

	types := schemaTypes(schema["type"])
	if len(types) == 0 && schema["properties"] != nil {
		types = []string{"object"}
	}
	for _, schemaType := range types {
		if schemaTypeMatchesValue(schemaType, value) {
			if schemaType == "object" {
				return validateObjectSchema(schema, path, value, root)
			}
			return nil
		}
	}
	if len(types) == 0 {
		return nil
	}
	return errors.Errorf(`%s "%s" must be %s`, label, path, types[0])
}

func validateObjectSchema(schema map[string]any, path string, value any, root jsonSchema) error {
	object, ok := value.(map[string]any)
	if !ok {
		return errors.Errorf(`argument "%s" must be object`, path)
	}

	properties := schemaProperties(schema["properties"])
	for _, required := range requiredNames(schema["required"]) {
		if child, ok := object[required]; !ok || child == nil {
			return errors.Errorf(`missing required argument "%s"`, joinSchemaPath(path, required))
		}
	}

	if additionalProperties, ok := schema["additionalProperties"].(bool); ok && !additionalProperties {
		for name := range object {
			if _, ok := properties[name]; !ok {
				return errors.Errorf(`unknown argument "%s"`, joinSchemaPath(path, name))
			}
		}
	}

	for name, childSchema := range properties {
		childValue, ok := object[name]
		if !ok {
			continue
		}
		if err := validateSchemaValue(childSchema, joinSchemaPath(path, name), "argument", childValue, root); err != nil {
			return err
		}
	}
	return nil
}

func asSchemaMap(value any) (map[string]any, bool) {
	switch typed := value.(type) {
	case jsonSchema:
		return map[string]any(typed), true
	case map[string]any:
		return typed, true
	default:
		return nil, false
	}
}

func schemaProperties(value any) map[string]any {
	switch typed := value.(type) {
	case map[string]any:
		return typed
	case jsonSchema:
		return map[string]any(typed)
	default:
		return map[string]any{}
	}
}

func schemaTypes(value any) []string {
	switch typed := value.(type) {
	case string:
		return []string{typed}
	case []any:
		types := make([]string, 0, len(typed))
		for _, item := range typed {
			if typeName, ok := item.(string); ok {
				types = append(types, typeName)
			}
		}
		return types
	default:
		return nil
	}
}

func requiredNames(value any) []string {
	switch typed := value.(type) {
	case []string:
		return typed
	case []any:
		names := make([]string, 0, len(typed))
		for _, item := range typed {
			if name, ok := item.(string); ok {
				names = append(names, name)
			}
		}
		return names
	default:
		return nil
	}
}

func schemaTypeMatchesValue(schemaType string, value any) bool {
	switch schemaType {
	case "array":
		_, ok := value.([]any)
		return ok
	case "boolean":
		_, ok := value.(bool)
		return ok
	case "integer":
		return isInteger(value)
	case "number":
		return isNumber(value)
	case "object":
		_, ok := value.(map[string]any)
		return ok
	case "string":
		_, ok := value.(string)
		return ok
	default:
		return true
	}
}

func isInteger(value any) bool {
	switch typed := value.(type) {
	case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
		return true
	case float32:
		return math.Trunc(float64(typed)) == float64(typed)
	case float64:
		return math.Trunc(typed) == typed
	default:
		return false
	}
}

func isNumber(value any) bool {
	switch value.(type) {
	case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64, float32, float64:
		return true
	default:
		return false
	}
}

func localSchemaDef(root jsonSchema, ref string) (any, bool) {
	const prefix = "#/$defs/"
	if !strings.HasPrefix(ref, prefix) {
		return nil, false
	}
	defs, ok := root["$defs"].(map[string]any)
	if !ok {
		return nil, false
	}
	return defs[strings.TrimPrefix(ref, prefix)], true
}

func joinSchemaPath(parent string, child string) string {
	if parent == "" || parent == "argument" {
		return child
	}
	return parent + "." + child
}
