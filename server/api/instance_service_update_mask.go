package api

import (
	"net/http"
	"net/url"
	"strings"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/types/known/fieldmaskpb"

	apipb "github.com/usememos/memos/proto/gen/api"
)

// omitEmptyInstanceSettingMask lets the REST gateway keep the mask it derives
// from the JSON body when the explicit query parameter has no value.
func omitEmptyInstanceSettingMask(r *http.Request) {
	query, err := url.ParseQuery(r.URL.RawQuery)
	if err != nil {
		return // Let the gateway report the malformed query.
	}
	for _, key := range []string{"updateMask", "update_mask"} {
		if values := query[key]; len(values) == 1 && values[0] == "" {
			query.Del(key)
			r.URL.RawQuery = query.Encode()
		}
	}
}

// instanceSettingMask holds validated, fully qualified proto field paths.
type instanceSettingMask struct {
	paths        []string
	branchFields map[string]bool
	wholeBranch  bool
}

func parseInstanceSettingMask(key string, patch *apipb.InstanceSetting, paths []string) (*instanceSettingMask, error) {
	desc := patch.ProtoReflect().Descriptor()
	branch := desc.Fields().ByName(instanceSettingBranchName(key))
	if branch == nil {
		return nil, errors.Errorf("instance setting %s does not support update_mask", key)
	}
	if supplied := patch.ProtoReflect().WhichOneof(desc.Oneofs().ByName("value")); supplied != nil && supplied != branch {
		return nil, errors.Errorf("instance setting %s cannot be updated with %s", key, supplied.Name())
	}

	canonical := &fieldmaskpb.FieldMask{}
	for _, path := range paths {
		if path == "name" {
			continue
		}
		parts := strings.Split(path, ".")
		fields := desc.Fields()
		if field := maskField(fields, parts[0]); field == nil {
			parts = append([]string{string(branch.Name())}, parts...)
		} else if field != branch {
			return nil, errors.Errorf("update_mask path %q must be within %s", path, branch.Name())
		}
		for index, part := range parts {
			field := maskField(fields, part)
			if field == nil {
				return nil, errors.Errorf("invalid update_mask path %q", path)
			}
			parts[index] = string(field.Name())
			if index < len(parts)-1 {
				if field.Message() == nil || field.IsList() || field.IsMap() {
					return nil, errors.Errorf("invalid update_mask path %q", path)
				}
				fields = field.Message().Fields()
			}
		}
		canonical.Paths = append(canonical.Paths, strings.Join(parts, "."))
	}
	canonical.Normalize()
	mask := &instanceSettingMask{paths: canonical.Paths, branchFields: make(map[string]bool)}
	for _, path := range canonical.Paths {
		if _, rest, ok := strings.Cut(path, "."); ok {
			field, _, _ := strings.Cut(rest, ".")
			mask.branchFields[field] = true
		} else {
			mask.wholeBranch = true
		}
	}
	return mask, nil
}

func maskField(fields protoreflect.FieldDescriptors, name string) protoreflect.FieldDescriptor {
	if field := fields.ByName(protoreflect.Name(name)); field != nil {
		return field
	}
	return fields.ByJSONName(name)
}

func (m *instanceSettingMask) replacesStorage() bool {
	return m.wholeBranch || (m.branchFields["storages"] && m.branchFields["default_storage_id"] && m.branchFields["filepath_template"])
}

func (m *instanceSettingMask) apply(current, patch *apipb.InstanceSetting) (*apipb.InstanceSetting, error) {
	merged := proto.CloneOf(current)
	for _, path := range m.paths {
		copyMaskedField(merged.ProtoReflect(), patch.ProtoReflect(), strings.Split(path, "."))
	}
	if ai := merged.GetAiSetting(); ai != nil && ai.Transcription == nil && (m.wholeBranch || m.branchFields["transcription"]) {
		// Without a mask an omitted transcription means "keep the stored
		// config", and the update restores it. A masked, unset transcription
		// is a request to clear it, so store an empty config, which disables
		// transcription just as an unset one does.
		ai.Transcription = &apipb.InstanceSetting_TranscriptionConfig{}
	}
	if storage := merged.GetStorageSetting(); storage != nil {
		if err := applyLegacyStorageUpdateMask(storage, m.branchFields); err != nil {
			return nil, err
		}
	}
	return merged, nil
}

// applyLegacyStorageUpdateMask makes a masked edit of the legacy storage
// fields read as a legacy request. The merged setting carries the stored
// storages and default_storage_id, which take precedence over storage_type
// and s3_config, so the edit would otherwise be silently overwritten. A legacy
// request omits both; the store keeps every stored storage either way.
func applyLegacyStorageUpdateMask(storage *apipb.InstanceSetting_StorageSetting, maskedFields map[string]bool) error {
	legacy := maskedFields["storage_type"] || maskedFields["s3_config"]
	if !legacy {
		return nil
	}
	if maskedFields["storages"] && maskedFields["default_storage_id"] {
		// GET returns legacy projections alongside the canonical registry.
		// Recompute those projections from the registry supplied by the client.
		storage.StorageType = apipb.InstanceSetting_StorageSetting_STORAGE_TYPE_UNSPECIFIED
		storage.S3Config = nil
		return nil
	}
	if maskedFields["storages"] || maskedFields["default_storage_id"] {
		return errors.New("a storage mask with legacy fields must include both storages and default_storage_id or neither")
	}
	storage.Storages = nil
	storage.DefaultStorageId = ""
	return nil
}

// instanceSettingBranchName names the InstanceSetting oneof field holding the
// value for key, such as "usage_limits_setting" for USAGE_LIMITS.
func instanceSettingBranchName(key string) protoreflect.Name {
	return protoreflect.Name(strings.ToLower(key) + "_setting")
}

// copyMaskedField copies the field at path from src to dst, creating parent
// messages in dst as needed. path must already be valid for the message type.
func copyMaskedField(dst, src protoreflect.Message, path []string) {
	field := dst.Descriptor().Fields().ByName(protoreflect.Name(path[0]))
	if len(path) > 1 {
		copyMaskedField(dst.Mutable(field).Message(), src.Get(field).Message(), path[1:])
		return
	}
	if src.Has(field) {
		dst.Set(field, src.Get(field))
	} else {
		dst.Clear(field)
	}
}
