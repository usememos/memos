package configuration

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"path/filepath"
	"regexp"
	"slices"
	"strings"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/types/descriptorpb"

	apipb "github.com/usememos/memos/proto/gen/api"
)

var (
	referencePattern = regexp.MustCompile(`^\$\{(env|file):([^}]*)\}$`)
	envNamePattern   = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)

	// protojson errors can quote the rejected value, which may be a
	// substituted secret. Only these value-free forms are passed on.
	unknownFieldPattern   = regexp.MustCompile(`unknown field "[^"]+"`)
	duplicateFieldPattern = regexp.MustCompile(`duplicate field "[^"]+"`)
	invalidValuePattern   = regexp.MustCompile(`invalid value for [a-z0-9]+ field [A-Za-z0-9_]+`)
	oneofPattern          = regexp.MustCompile(`oneof [A-Za-z0-9_.]+ is already set`)
)

// decodeDocument substitutes references in one file and decodes it strictly.
// It also returns, for each user by index, the optional user fields the file
// declares.
func decodeDocument(content []byte, resolver Resolver) (*apipb.Configuration, map[int][]string, []string, []string) {
	decoder := json.NewDecoder(bytes.NewReader(content))
	decoder.UseNumber()
	r := &jsonReader{decoder: decoder, resolver: resolver}
	value, err := r.value("")
	if err != nil {
		return nil, nil, nil, []string{describeJSONError(err, content)}
	}
	if _, err := decoder.Token(); err != io.EOF {
		return nil, nil, nil, []string{"unexpected data after the JSON document"}
	}
	object, ok := value.(map[string]any)
	if !ok {
		return nil, nil, nil, []string{"the document must be a JSON object"}
	}

	// Marshalling a substituted tree cannot fail: it holds only JSON values.
	normalized, _ := json.Marshal(value)
	document := &apipb.Configuration{}
	if err := (protojson.UnmarshalOptions{}).Unmarshal(normalized, document); err != nil {
		return nil, nil, nil, []string{describeProtoJSONError(err)}
	}

	inspector := &inspector{}
	inspector.message("", value, document.ProtoReflect().Descriptor())
	return document, declaredUserFields(object), inspector.warnings, inspector.problems
}

// optionalUserFields are the User fields managed only when a file declares them.
var optionalUserFields = []string{"displayName", "email"}

// declaredUserFields returns, for each user in a decoded document by index,
// which optional fields the document names, in either JSON or proto spelling.
func declaredUserFields(document map[string]any) map[int][]string {
	users, ok := document["users"].([]any)
	if !ok {
		return nil
	}
	descriptor := (&apipb.User{}).ProtoReflect().Descriptor()
	result := map[int][]string{}
	for i, entry := range users {
		object, ok := entry.(map[string]any)
		if !ok {
			continue
		}
		for _, jsonName := range optionalUserFields {
			field := descriptor.Fields().ByJSONName(jsonName)
			if _, declared := object[jsonName]; declared {
				result[i] = append(result[i], jsonName)
			} else if _, declared := object[string(field.Name())]; declared {
				result[i] = append(result[i], jsonName)
			}
		}
	}
	return result
}

// jsonReader reads a JSON value token by token, substituting references in
// string values and reporting paths in the document's own key spelling.
type jsonReader struct {
	decoder  *json.Decoder
	resolver Resolver
}

func (r *jsonReader) value(path string) (any, error) {
	token, err := r.decoder.Token()
	if err != nil {
		return nil, err
	}
	switch t := token.(type) {
	case json.Delim:
		switch t {
		case '{':
			object := map[string]any{}
			for r.decoder.More() {
				keyToken, err := r.decoder.Token()
				if err != nil {
					return nil, err
				}
				// Inside an object, encoding/json returns every key as a string.
				key, ok := keyToken.(string)
				if !ok {
					return nil, errors.Errorf("%s: object key must be a string", path)
				}
				childPath := joinKey(path, key)
				if _, ok := object[key]; ok {
					return nil, errors.Errorf("%s: duplicate key", childPath)
				}
				child, err := r.value(childPath)
				if err != nil {
					return nil, err
				}
				object[key] = child
			}
			if _, err := r.decoder.Token(); err != nil {
				return nil, err
			}
			return object, nil
		case '[':
			list := []any{}
			for r.decoder.More() {
				child, err := r.value(fmt.Sprintf("%s[%d]", path, len(list)))
				if err != nil {
					return nil, err
				}
				list = append(list, child)
			}
			if _, err := r.decoder.Token(); err != nil {
				return nil, err
			}
			return list, nil
		default:
			return nil, errors.Errorf("unexpected %q", t.String())
		}
	case string:
		return r.substitute(path, t)
	default:
		return token, nil
	}
}

// substitute resolves a string that is exactly one ${env:NAME} or
// ${file:PATH} reference, and turns each $${ into a literal ${. Errors name
// the path and the reference, never a resolved value.
func (r *jsonReader) substitute(path, value string) (string, error) {
	if !hasUnescapedReference(value) {
		return strings.ReplaceAll(value, "$${", "${"), nil
	}
	match := referencePattern.FindStringSubmatch(value)
	if match == nil {
		if strings.HasPrefix(value, "${") && strings.HasSuffix(value, "}") && strings.Count(value, "${") == 1 {
			return "", errors.Errorf("%s: unsupported reference; use ${env:NAME} or ${file:/absolute/path}", path)
		}
		return "", errors.Errorf("%s: a reference must be the whole string value; write $${ for a literal ${", path)
	}
	switch kind, target := match[1], match[2]; kind {
	case "env":
		if !envNamePattern.MatchString(target) {
			return "", errors.Errorf("%s: invalid environment variable name %q", path, target)
		}
		resolved, ok := r.resolver.LookupEnv(target)
		if !ok {
			return "", errors.Errorf("%s: environment variable %s is not set", path, target)
		}
		return resolved, nil
	default:
		if !filepath.IsAbs(target) {
			return "", errors.Errorf("%s: file reference %q must be an absolute path", path, target)
		}
		content, err := r.resolver.ReadFile(target)
		if err != nil {
			return "", errors.Errorf("%s: cannot read %s: %v", path, target, err)
		}
		if len(content) > maxReferencedFileSize {
			return "", errors.Errorf("%s: %s is larger than %d bytes", path, target, maxReferencedFileSize)
		}
		return strings.TrimRight(string(content), "\r\n"), nil
	}
}

func hasUnescapedReference(value string) bool {
	for i := 0; i+1 < len(value); i++ {
		if value[i] == '$' && value[i+1] == '{' && (i == 0 || value[i-1] != '$') {
			return true
		}
	}
	return false
}

func joinKey(path, key string) string {
	if path == "" {
		return key
	}
	return path + "." + key
}

func describeJSONError(err error, content []byte) string {
	var syntaxError *json.SyntaxError
	if errors.As(err, &syntaxError) {
		line, column := position(content, syntaxError.Offset)
		return fmt.Sprintf("line %d, column %d: %s", line, column, syntaxError.Error())
	}
	if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
		return "unexpected end of JSON"
	}
	return err.Error()
}

func position(content []byte, offset int64) (int, int) {
	offset = min(offset, int64(len(content)))
	before := content[:offset]
	line := bytes.Count(before, []byte("\n")) + 1
	column := len(before) - bytes.LastIndexByte(before, '\n') - 1
	return line, column
}

func describeProtoJSONError(err error) string {
	message := err.Error()
	for _, pattern := range []*regexp.Regexp{unknownFieldPattern, duplicateFieldPattern, invalidValuePattern, oneofPattern} {
		if found := pattern.FindString(message); found != "" {
			return found
		}
	}
	return "invalid protobuf JSON; check field names and value types"
}

// inspector walks a decoded document beside its message descriptor and
// reports what protojson accepts but configuration does not: numeric enum
// values and output-only fields. Deprecated fields are warnings.
type inspector struct {
	problems []string
	warnings []string
}

func (in *inspector) message(path string, value any, descriptor protoreflect.MessageDescriptor) {
	object, ok := value.(map[string]any)
	if !ok || strings.HasPrefix(string(descriptor.FullName()), "google.protobuf.") {
		return
	}
	keys := make([]string, 0, len(object))
	for key := range object {
		keys = append(keys, key)
	}
	slices.Sort(keys)
	for _, key := range keys {
		field := descriptor.Fields().ByJSONName(key)
		if field == nil {
			field = descriptor.Fields().ByTextName(key)
		}
		if field == nil || object[key] == nil {
			continue
		}
		in.field(joinKey(path, key), object[key], field)
	}
}

func (in *inspector) field(path string, value any, field protoreflect.FieldDescriptor) {
	if options, ok := field.Options().(*descriptorpb.FieldOptions); ok && options.GetDeprecated() {
		in.warnings = append(in.warnings, path+" is deprecated")
	}
	if isOutputOnly(field) {
		in.problems = append(in.problems, path+" is output only and cannot be configured")
		return
	}

	element := func(elementPath string, elementValue any, kind protoreflect.Kind, message protoreflect.MessageDescriptor) {
		switch kind {
		case protoreflect.EnumKind:
			if _, isNumber := elementValue.(json.Number); isNumber {
				in.problems = append(in.problems, elementPath+": use the enum value name, not its number")
			}
		case protoreflect.MessageKind, protoreflect.GroupKind:
			in.message(elementPath, elementValue, message)
		default:
		}
	}
	switch {
	case field.IsMap():
		object, ok := value.(map[string]any)
		if !ok {
			return
		}
		for key, entry := range object {
			element(path+"."+key, entry, field.MapValue().Kind(), field.MapValue().Message())
		}
	case field.IsList():
		list, ok := value.([]any)
		if !ok {
			return
		}
		for i, entry := range list {
			element(fmt.Sprintf("%s[%d]", path, i), entry, field.Kind(), field.Message())
		}
	default:
		element(path, value, field.Kind(), field.Message())
	}
}
