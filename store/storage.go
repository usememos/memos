package store

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"strings"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/proto"

	"github.com/usememos/memos/internal/storage"
	storepb "github.com/usememos/memos/proto/gen/store"
)

const (
	databaseStorageID = "database"
	localStorageID    = "local"
)

// NormalizeInstanceStorageSetting populates the named storage model from legacy
// fields and keeps the legacy fields synchronized for older clients.
func NormalizeInstanceStorageSetting(setting *storepb.InstanceStorageSetting) {
	if setting == nil {
		return
	}

	normalized := make([]*storepb.Storage, 0, len(setting.Storages)+1)
	seenIDs := map[string]bool{}
	for _, storage := range setting.Storages {
		if storage == nil {
			continue
		}
		normalizeStorage(storage)
		if storage.Id == "" || seenIDs[storage.Id] {
			continue
		}
		seenIDs[storage.Id] = true
		normalized = append(normalized, storage)
	}
	setting.Storages = normalized
	if setting.S3Config != nil {
		legacyS3Storage := &storepb.Storage{
			Type:   storepb.StorageType_STORAGE_TYPE_S3,
			Config: &storepb.Storage_S3Config{S3Config: setting.S3Config},
		}
		// Equivalence is checked before normalizeStorage so the ID hash is only
		// computed when the legacy config actually needs to be registered.
		if findEquivalentStorage(setting.Storages, legacyS3Storage) == nil {
			normalizeStorage(legacyS3Storage)
			if legacyS3Storage.Id != "" {
				setting.Storages = append(setting.Storages, legacyS3Storage)
			}
		}
	}

	if setting.DefaultStorageId == "" {
		legacyStorage := storageFromLegacySetting(setting)
		if legacyStorage != nil {
			if existing := findEquivalentStorage(setting.Storages, legacyStorage); existing != nil {
				setting.DefaultStorageId = existing.Id
			} else {
				setting.Storages = append(setting.Storages, legacyStorage)
				setting.DefaultStorageId = legacyStorage.Id
			}
		}
	}

	if FindStorage(setting, setting.DefaultStorageId) == nil {
		fallback := builtinStorage(storepb.StorageType_STORAGE_TYPE_LOCAL)
		if len(setting.Storages) > 0 {
			fallback = setting.Storages[0]
		} else {
			setting.Storages = append(setting.Storages, fallback)
		}
		setting.DefaultStorageId = fallback.Id
	}
	moveDefaultStorageFirst(setting)

	synchronizeLegacyStorageFields(setting)
}

// PrepareInstanceStorageSettingUpdate preserves storages still referenced by
// existing attachments and assigns a new identity when a physical namespace changes.
func PrepareInstanceStorageSettingUpdate(incoming, existing *storepb.InstanceStorageSetting) error {
	if incoming == nil {
		return errors.New("storage setting is required")
	}

	legacyRequest := len(incoming.Storages) == 0
	if !legacyRequest {
		if err := validateInstanceStorages(incoming); err != nil {
			return err
		}
	}
	// Normalization guarantees every invariant validateInstanceStorages checks,
	// so only the raw canonical request above needs explicit validation.
	NormalizeInstanceStorageSetting(incoming)
	if existing == nil {
		return nil
	}
	NormalizeInstanceStorageSetting(existing)

	existingByID := make(map[string]*storepb.Storage, len(existing.Storages))
	for _, storage := range existing.Storages {
		existingByID[storage.Id] = storage
	}

	if legacyRequest {
		incomingDefault := GetDefaultStorage(incoming)
		if matching := findEquivalentStorage(existing.Storages, incomingDefault); matching != nil {
			incomingDefault.Id = matching.Id
			if incomingDefault.Name == defaultStorageName(incomingDefault) {
				incomingDefault.Name = matching.Name
			}
			incoming.DefaultStorageId = matching.Id
		}
	}

	for _, storage := range incoming.Storages {
		previous := existingByID[storage.Id]
		if previous != nil && !StorageNamespaceEqual(previous, storage) {
			oldID := storage.Id
			storage.Id = storageID(storage)
			if incoming.DefaultStorageId == oldID {
				incoming.DefaultStorageId = storage.Id
			}
			previous = nil
		}

		if storage.GetS3Config() != nil && storage.GetS3Config().AccessKeySecret == "" {
			if previous != nil && previous.GetS3Config() != nil {
				storage.GetS3Config().AccessKeySecret = previous.GetS3Config().AccessKeySecret
			} else if candidate := findStorageCredentialSource(existing.Storages, storage.GetS3Config().AccessKeyId); candidate != nil {
				storage.GetS3Config().AccessKeySecret = candidate.GetS3Config().AccessKeySecret
			}
		}
	}

	incomingIDs := make(map[string]bool, len(incoming.Storages))
	for _, storage := range incoming.Storages {
		incomingIDs[storage.Id] = true
	}
	for _, storage := range existing.Storages {
		if !incomingIDs[storage.Id] {
			incoming.Storages = append(incoming.Storages, proto.Clone(storage).(*storepb.Storage))
		}
	}

	NormalizeInstanceStorageSetting(incoming)
	return nil
}

// ResolveStorageDriver resolves the configured storage referenced by an attachment
// and returns its driver. legacyS3Config supports attachments written before
// storage IDs were introduced.
func ResolveStorageDriver(
	ctx context.Context,
	setting *storepb.InstanceStorageSetting,
	storageID string,
	legacyS3Config *storepb.StorageS3Config,
) (storage.Driver, error) {
	if storageID != "" {
		configuredStorage := FindStorage(setting, storageID)
		if configuredStorage == nil {
			return nil, errors.Errorf("storage %q is not configured", storageID)
		}
		return storage.NewDriver(ctx, configuredStorage)
	}

	if legacyS3Config != nil {
		// Prefer the configured storage addressing the same namespace so legacy
		// attachments pick up rotated credentials and transport options.
		legacyStorage := &storepb.Storage{
			Type:   storepb.StorageType_STORAGE_TYPE_S3,
			Config: &storepb.Storage_S3Config{S3Config: legacyS3Config},
		}
		if configuredStorage := findEquivalentStorage(setting.GetStorages(), legacyStorage); configuredStorage != nil {
			return storage.NewDriver(ctx, configuredStorage)
		}
		return storage.NewDriver(ctx, legacyStorage)
	}

	if setting.GetS3Config() != nil {
		return storage.NewDriver(ctx, &storepb.Storage{
			Type:   storepb.StorageType_STORAGE_TYPE_S3,
			Config: &storepb.Storage_S3Config{S3Config: setting.GetS3Config()},
		})
	}
	return nil, errors.New("attachment storage is not configured")
}

// FindStorage returns the configured storage with the given stable identifier.
func FindStorage(setting *storepb.InstanceStorageSetting, storageID string) *storepb.Storage {
	if setting == nil || storageID == "" {
		return nil
	}
	for _, storage := range setting.Storages {
		if storage != nil && storage.Id == storageID {
			return storage
		}
	}
	return nil
}

// GetDefaultStorage returns the storage used for new attachments.
func GetDefaultStorage(setting *storepb.InstanceStorageSetting) *storepb.Storage {
	if setting == nil {
		return nil
	}
	return FindStorage(setting, setting.DefaultStorageId)
}

// StorageNamespaceEqual reports whether two configurations address the same
// physical storage namespace. Credentials and transport options are deliberately
// excluded so they can be rotated without changing storage identity.
func StorageNamespaceEqual(a, b *storepb.Storage) bool {
	if a == nil || b == nil || a.Type != b.Type {
		return false
	}
	if a.Type != storepb.StorageType_STORAGE_TYPE_S3 {
		return true
	}
	aConfig, bConfig := a.GetS3Config(), b.GetS3Config()
	if aConfig == nil || bConfig == nil {
		return aConfig == nil && bConfig == nil
	}
	return normalizeEndpoint(aConfig.Endpoint) == normalizeEndpoint(bConfig.Endpoint) &&
		strings.TrimSpace(aConfig.Region) == strings.TrimSpace(bConfig.Region) &&
		strings.TrimSpace(aConfig.Bucket) == strings.TrimSpace(bConfig.Bucket)
}

func storageFromLegacySetting(setting *storepb.InstanceStorageSetting) *storepb.Storage {
	storageType := storepb.StorageType(setting.StorageType)
	if storageType == storepb.StorageType_STORAGE_TYPE_UNSPECIFIED {
		if setting.S3Config != nil {
			storageType = storepb.StorageType_STORAGE_TYPE_S3
		} else {
			storageType = storepb.StorageType_STORAGE_TYPE_LOCAL
		}
	}
	storage := builtinStorage(storageType)
	if storageType == storepb.StorageType_STORAGE_TYPE_S3 {
		storage.Config = &storepb.Storage_S3Config{S3Config: setting.S3Config}
		normalizeStorage(storage)
	}
	return storage
}

func builtinStorage(storageType storepb.StorageType) *storepb.Storage {
	storage := &storepb.Storage{Type: storageType}
	normalizeStorage(storage)
	return storage
}

func normalizeStorage(storage *storepb.Storage) {
	if storage == nil {
		return
	}
	if storage.Type == storepb.StorageType_STORAGE_TYPE_UNSPECIFIED && storage.GetS3Config() != nil {
		storage.Type = storepb.StorageType_STORAGE_TYPE_S3
	}
	if storage.Id == "" {
		storage.Id = storageID(storage)
	}
	if strings.TrimSpace(storage.Name) == "" {
		storage.Name = defaultStorageName(storage)
	}
}

func storageID(storage *storepb.Storage) string {
	if storage == nil {
		return ""
	}
	switch storage.Type {
	case storepb.StorageType_STORAGE_TYPE_DATABASE:
		return databaseStorageID
	case storepb.StorageType_STORAGE_TYPE_LOCAL:
		return localStorageID
	case storepb.StorageType_STORAGE_TYPE_S3:
		config := storage.GetS3Config()
		if config == nil {
			return ""
		}
		namespace := strings.Join([]string{
			normalizeEndpoint(config.Endpoint),
			strings.TrimSpace(config.Region),
			strings.TrimSpace(config.Bucket),
		}, "\x00")
		hash := sha256.Sum256([]byte(namespace))
		return "s3-" + hex.EncodeToString(hash[:])[:16]
	default:
		return ""
	}
}

func defaultStorageName(storage *storepb.Storage) string {
	if storage == nil {
		return ""
	}
	switch storage.Type {
	case storepb.StorageType_STORAGE_TYPE_DATABASE:
		return "Database"
	case storepb.StorageType_STORAGE_TYPE_LOCAL:
		return "Local"
	case storepb.StorageType_STORAGE_TYPE_S3:
		if bucket := strings.TrimSpace(storage.GetS3Config().GetBucket()); bucket != "" {
			return bucket
		}
		return "S3"
	default:
		return "Storage"
	}
}

func findEquivalentStorage(storages []*storepb.Storage, target *storepb.Storage) *storepb.Storage {
	for _, storage := range storages {
		if StorageNamespaceEqual(storage, target) {
			return storage
		}
	}
	return nil
}

func findStorageCredentialSource(storages []*storepb.Storage, accessKeyID string) *storepb.Storage {
	for _, storage := range storages {
		config := storage.GetS3Config()
		if config != nil && config.AccessKeyId == accessKeyID && config.AccessKeySecret != "" {
			return storage
		}
	}
	return nil
}

// moveDefaultStorageFirst keeps the registry ordered by most recent activation.
// This lets clients fall back to the most recently used storage of a given type
// while attachments continue to resolve storages by ID.
func moveDefaultStorageFirst(setting *storepb.InstanceStorageSetting) {
	for i, storage := range setting.Storages {
		if storage.Id != setting.DefaultStorageId || i == 0 {
			continue
		}
		copy(setting.Storages[1:i+1], setting.Storages[:i])
		setting.Storages[0] = storage
		return
	}
}

func synchronizeLegacyStorageFields(setting *storepb.InstanceStorageSetting) {
	storage := GetDefaultStorage(setting)
	if storage == nil {
		return
	}
	setting.StorageType = storepb.InstanceStorageSetting_StorageType(storage.Type)
	if storage.GetS3Config() != nil {
		setting.S3Config = storage.GetS3Config()
		return
	}
	// Keep the most recently configured S3 storage available to legacy
	// attachments that predate both storage IDs and embedded configurations.
	for _, configuredStorage := range setting.Storages {
		if configuredStorage.GetS3Config() != nil {
			setting.S3Config = configuredStorage.GetS3Config()
			return
		}
	}
	setting.S3Config = nil
}

func validateInstanceStorages(setting *storepb.InstanceStorageSetting) error {
	seenIDs := map[string]bool{}
	for _, storage := range setting.Storages {
		if storage == nil || storage.Id == "" {
			return errors.New("storage ID is required")
		}
		if seenIDs[storage.Id] {
			return errors.Errorf("duplicate storage ID %q", storage.Id)
		}
		seenIDs[storage.Id] = true
		if storage.Type == storepb.StorageType_STORAGE_TYPE_UNSPECIFIED {
			return errors.Errorf("storage %q type is required", storage.Id)
		}
		if storage.Type == storepb.StorageType_STORAGE_TYPE_S3 && storage.GetS3Config() == nil {
			return errors.Errorf("storage %q S3 config is required", storage.Id)
		}
	}
	if !seenIDs[setting.DefaultStorageId] {
		return errors.Errorf("default storage %q is not configured", setting.DefaultStorageId)
	}
	return nil
}

func normalizeEndpoint(endpoint string) string {
	return strings.TrimRight(strings.TrimSpace(endpoint), "/")
}
