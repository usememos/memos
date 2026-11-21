package api

import (
	"strings"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/types/known/fieldmaskpb"

	apipb "github.com/usememos/memos/proto/gen/api"
)

// applyInstanceSettingUpdateMask returns a copy of current with the fields
// named by paths taken from patch. A path is relative to InstanceSetting and
// must lie within the oneof branch for key, such as
// "general_setting.disallow_user_registration" for GENERAL. A path whose first
// segment is not an InstanceSetting field is relative to that branch instead,
// so "disallow_user_registration" names the same field. A path naming a
// message replaces that whole message; a field unset in patch is cleared.
// The "name" path is ignored: the name identifies the setting and cannot
// change, and the REST gateway adds it when it derives a mask from the body.
func applyInstanceSettingUpdateMask(key string, current, patch *apipb.InstanceSetting, paths []string) (*apipb.InstanceSetting, error) {
	descriptor := current.ProtoReflect().Descriptor()
	fields := descriptor.Fields()
	branch := instanceSettingBranchName(key)
	if fields.ByName(branch) == nil {
		return nil, errors.Errorf("instance setting %s does not support update_mask", key)
	}
	if patchBranch := patch.ProtoReflect().WhichOneof(descriptor.Oneofs().ByName("value")); patchBranch != nil && patchBranch.Name() != branch {
		return nil, errors.Errorf("instance setting %s cannot be updated with %s", key, patchBranch.Name())
	}

	merged := proto.CloneOf(current)
	branchFields := map[string]bool{}
	wholeBranch := false
	for _, path := range paths {
		if path == "name" {
			continue
		}
		if first, _, _ := strings.Cut(path, "."); fields.ByName(protoreflect.Name(first)) == nil {
			path = string(branch) + "." + path
		}
		if path != string(branch) && !strings.HasPrefix(path, string(branch)+".") {
			return nil, errors.Errorf("update_mask path %q must be %q or start with %q", path, branch, branch+".")
		}
		if _, err := fieldmaskpb.New(patch, path); err != nil {
			return nil, errors.Errorf("invalid update_mask path %q", path)
		}
		copyMaskedField(merged.ProtoReflect(), patch.ProtoReflect(), strings.Split(path, "."))
		if _, rest, ok := strings.Cut(path, "."); ok {
			field, _, _ := strings.Cut(rest, ".")
			branchFields[field] = true
		} else {
			wholeBranch = true
		}
	}
	if ai := merged.GetAiSetting(); ai != nil && ai.Transcription == nil && (wholeBranch || branchFields["transcription"]) {
		// Without a mask an omitted transcription means "keep the stored
		// config", and the update restores it. A masked, unset transcription
		// is a request to clear it, so store an empty config, which disables
		// transcription just as an unset one does.
		ai.Transcription = &apipb.InstanceSetting_TranscriptionConfig{}
	}
	if storage := merged.GetStorageSetting(); storage != nil {
		if err := applyLegacyStorageUpdateMask(storage, branchFields); err != nil {
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
	if maskedFields["storages"] || maskedFields["default_storage_id"] {
		return errors.New("update_mask cannot combine storage_type or s3_config with storages or default_storage_id")
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
