package configuration

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"slices"
	"strconv"
	"strings"

	"google.golang.org/genproto/googleapis/api/annotations"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/types/descriptorpb"

	apipb "github.com/usememos/memos/proto/gen/api"
)

// Placeholders printed in place of values a plan must not reveal.
const (
	sensitivePlaceholder = "(sensitive)"
	writeOnlyPlaceholder = "(write-only)"
)

// sensitiveFields are the fields a plan compares but never prints: the same
// secrets API responses leave out. User.password is write-only and is never
// read back to compare at all.
var sensitiveFields = []protoreflect.FullName{
	"memos.api.OAuth2Config.client_secret",
	"memos.api.InstanceSetting.StorageSetting.S3Config.access_key_secret",
	"memos.api.InstanceSetting.Storage.S3Config.access_key_secret",
	"memos.api.InstanceSetting.NotificationSetting.EmailSetting.smtp_password",
	"memos.api.InstanceSetting.AIProviderConfig.api_key",
	"memos.api.User.password",
}

func isSensitive(field protoreflect.FieldDescriptor) bool {
	return slices.Contains(sensitiveFields, field.FullName())
}

func isOutputOnly(field protoreflect.FieldDescriptor) bool {
	options, ok := field.Options().(*descriptorpb.FieldOptions)
	if !ok {
		return false
	}
	behaviors, ok := proto.GetExtension(options, annotations.E_FieldBehavior).([]annotations.FieldBehavior)
	return ok && slices.Contains(behaviors, annotations.FieldBehavior_OUTPUT_ONLY)
}

// diffResource lists the fields that differ between two resources of the
// same kind, by JSON-name path, skipping the resource name and every path
// ignored covers. A nil before means the resource does not exist yet, so
// every set field of after is listed with an empty before.
func diffResource(before, after proto.Message, ignored []string) []*apipb.FieldChange {
	d := &differ{ignored: ignored, creating: before == nil}
	if before == nil {
		before = after.ProtoReflect().Type().New().Interface()
	}
	d.message("", before.ProtoReflect(), after.ProtoReflect())
	return d.changes
}

type differ struct {
	ignored  []string
	creating bool
	changes  []*apipb.FieldChange
}

func (d *differ) message(path string, before, after protoreflect.Message) {
	fields := after.Descriptor().Fields()
	for i := range fields.Len() {
		field := fields.Get(i)
		if path == "" && field.Name() == "name" {
			continue
		}
		if isOutputOnly(field) {
			continue
		}
		fieldPath := joinKey(path, field.JSONName())
		if coveredBy(fieldPath, d.ignored) {
			continue
		}
		d.field(fieldPath, field, before, after)
	}
}

func (d *differ) field(path string, field protoreflect.FieldDescriptor, before, after protoreflect.Message) {
	beforeSet, afterSet := before.Has(field), after.Has(field)
	if !beforeSet && !afterSet {
		return
	}
	beforeValue, afterValue := before.Get(field), after.Get(field)
	switch {
	case field.IsList() && isMessageKind(field) && beforeValue.List().Len() == afterValue.List().Len():
		// Lists of the same length are compared element by element, so a change
		// deep in one storage or AI provider names its own path.
		for i := range afterValue.List().Len() {
			d.message(fmt.Sprintf("%s[%d]", path, i), beforeValue.List().Get(i).Message(), afterValue.List().Get(i).Message())
		}
	case !field.IsList() && !field.IsMap() && isMessageKind(field):
		// An unset message reads as an empty one, so a message set on only one
		// side is listed field by field, the way a created resource is.
		d.message(path, beforeValue.Message(), afterValue.Message())
	default:
		if valuesEqual(field, beforeValue, afterValue) {
			return
		}
		change := &apipb.FieldChange{Path: path, After: renderField(field, afterValue)}
		if !d.creating {
			change.Before = renderField(field, beforeValue)
		}
		d.changes = append(d.changes, change)
	}
}

func isMessageKind(field protoreflect.FieldDescriptor) bool {
	return field.Kind() == protoreflect.MessageKind || field.Kind() == protoreflect.GroupKind
}

func valuesEqual(field protoreflect.FieldDescriptor, a, b protoreflect.Value) bool {
	switch {
	case field.IsList():
		if a.List().Len() != b.List().Len() {
			return false
		}
		for i := range a.List().Len() {
			if !elementEqual(field, a.List().Get(i), b.List().Get(i)) {
				return false
			}
		}
		return true
	case field.IsMap():
		if a.Map().Len() != b.Map().Len() {
			return false
		}
		equal := true
		a.Map().Range(func(key protoreflect.MapKey, value protoreflect.Value) bool {
			other := b.Map().Get(key)
			equal = b.Map().Has(key) && elementEqual(field.MapValue(), value, other)
			return equal
		})
		return equal
	default:
		return elementEqual(field, a, b)
	}
}

func elementEqual(field protoreflect.FieldDescriptor, a, b protoreflect.Value) bool {
	switch field.Kind() {
	case protoreflect.MessageKind, protoreflect.GroupKind:
		return proto.Equal(a.Message().Interface(), b.Message().Interface())
	case protoreflect.BytesKind:
		return string(a.Bytes()) == string(b.Bytes())
	default:
		return a.Interface() == b.Interface()
	}
}

// renderField prints a field value as JSON, with sensitive values replaced.
func renderField(field protoreflect.FieldDescriptor, value protoreflect.Value) string {
	if isSensitive(field) {
		if value.String() == "" {
			return `""`
		}
		return sensitivePlaceholder
	}
	switch {
	case field.IsList():
		elements := make([]string, 0, value.List().Len())
		for i := range value.List().Len() {
			elements = append(elements, renderElement(field, value.List().Get(i)))
		}
		return "[" + strings.Join(elements, ", ") + "]"
	case field.IsMap():
		entries := []string{}
		value.Map().Range(func(key protoreflect.MapKey, entry protoreflect.Value) bool {
			entries = append(entries, strconv.Quote(key.String())+": "+renderElement(field.MapValue(), entry))
			return true
		})
		slices.Sort(entries)
		return "{" + strings.Join(entries, ", ") + "}"
	default:
		return renderElement(field, value)
	}
}

func renderElement(field protoreflect.FieldDescriptor, value protoreflect.Value) string {
	switch field.Kind() {
	case protoreflect.MessageKind, protoreflect.GroupKind:
		message := proto.Clone(value.Message().Interface())
		maskSensitive(message.ProtoReflect(), sensitivePlaceholder)
		rendered, err := protojson.MarshalOptions{UseProtoNames: false}.Marshal(message)
		if err != nil {
			return "(unprintable)"
		}
		// protojson output spacing is deliberately unstable; reformat it.
		var compact any
		if json.Unmarshal(rendered, &compact) != nil {
			return "(unprintable)"
		}
		stable, _ := json.Marshal(compact)
		return string(stable)
	case protoreflect.EnumKind:
		if enumValue := field.Enum().Values().ByNumber(value.Enum()); enumValue != nil {
			return string(enumValue.Name())
		}
		return strconv.Itoa(int(value.Enum()))
	case protoreflect.StringKind:
		return strconv.Quote(value.String())
	case protoreflect.BytesKind:
		return strconv.Quote(base64.StdEncoding.EncodeToString(value.Bytes()))
	default:
		return fmt.Sprint(value.Interface())
	}
}

// maskSensitive replaces every non-empty sensitive string in message, at any depth, with placeholder.
func maskSensitive(message protoreflect.Message, placeholder string) {
	message.Range(func(field protoreflect.FieldDescriptor, value protoreflect.Value) bool {
		switch {
		case isSensitive(field) && field.Kind() == protoreflect.StringKind && !field.IsList():
			if value.String() != "" {
				message.Set(field, protoreflect.ValueOfString(placeholder))
			}
		case field.IsList() && isMessageKind(field):
			for i := range value.List().Len() {
				maskSensitive(value.List().Get(i).Message(), placeholder)
			}
		case field.IsMap() && isMessageKind(field.MapValue()):
			value.Map().Range(func(_ protoreflect.MapKey, entry protoreflect.Value) bool {
				maskSensitive(entry.Message(), placeholder)
				return true
			})
		case !field.IsList() && !field.IsMap() && isMessageKind(field):
			maskSensitive(value.Message(), placeholder)
		default:
		}
		return true
	})
}

// digest identifies a declared value without being derivable into a secret:
// sensitive and write-only values are masked before hashing, so only whether
// they are set affects it.
func digest(messages ...proto.Message) string {
	hash := sha256.New()
	for _, message := range messages {
		masked := proto.Clone(message)
		maskSensitive(masked.ProtoReflect(), "set")
		encoded, err := proto.MarshalOptions{Deterministic: true}.Marshal(masked)
		if err != nil {
			// A generated message always marshals; fall back to a fixed digest.
			encoded = nil
		}
		fmt.Fprintf(hash, "%d:", len(encoded))
		hash.Write(encoded)
	}
	return hex.EncodeToString(hash.Sum(nil))
}
