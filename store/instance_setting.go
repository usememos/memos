package store

import (
	"cmp"
	"context"
	"slices"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/encoding/protojson"

	storepb "github.com/usememos/memos/proto/gen/store"
)

type InstanceSetting struct {
	Name        string
	Value       string
	Description string
}

type FindInstanceSetting struct {
	Name string
}

type DeleteInstanceSetting struct {
	Name string
}

func (s *Store) UpsertInstanceSetting(ctx context.Context, upsert *storepb.InstanceSetting) (*storepb.InstanceSetting, error) {
	instanceSettingRaw := &InstanceSetting{
		Name: upsert.Key.String(),
	}
	var valueBytes []byte
	var err error
	if upsert.Key == storepb.InstanceSettingKey_BASIC {
		valueBytes, err = protojson.Marshal(upsert.GetBasicSetting())
	} else if upsert.Key == storepb.InstanceSettingKey_GENERAL {
		valueBytes, err = protojson.Marshal(upsert.GetGeneralSetting())
	} else if upsert.Key == storepb.InstanceSettingKey_STORAGE {
		valueBytes, err = protojson.Marshal(upsert.GetStorageSetting())
	} else if upsert.Key == storepb.InstanceSettingKey_MEMO_RELATED {
		valueBytes, err = protojson.Marshal(upsert.GetMemoRelatedSetting())
	} else if upsert.Key == storepb.InstanceSettingKey_TAGS {
		valueBytes, err = protojson.Marshal(upsert.GetTagsSetting())
	} else if upsert.Key == storepb.InstanceSettingKey_NOTIFICATION {
		valueBytes, err = protojson.Marshal(upsert.GetNotificationSetting())
	} else if upsert.Key == storepb.InstanceSettingKey_AI {
		valueBytes, err = protojson.Marshal(upsert.GetAiSetting())
	} else {
		return nil, errors.Errorf("unsupported instance setting key: %v", upsert.Key)
	}
	if err != nil {
		return nil, errors.Wrap(err, "failed to marshal instance setting value")
	}
	valueString := string(valueBytes)
	instanceSettingRaw.Value = valueString
	instanceSettingRaw, err = s.driver.UpsertInstanceSetting(ctx, instanceSettingRaw)
	if err != nil {
		return nil, errors.Wrap(err, "Failed to upsert instance setting")
	}
	instanceSetting, err := convertInstanceSettingFromRaw(instanceSettingRaw)
	if err != nil {
		return nil, errors.Wrap(err, "Failed to convert instance setting")
	}
	s.cacheInstanceSetting(ctx, instanceSetting)
	return instanceSetting, nil
}

func (s *Store) ListInstanceSettings(ctx context.Context, find *FindInstanceSetting) ([]*storepb.InstanceSetting, error) {
	stored, err := s.listStoredInstanceSettings(ctx, find)
	if err != nil {
		return nil, err
	}
	if find.Name != "" {
		key, ok := storepb.InstanceSettingKey_value[find.Name]
		if ok {
			if configured := s.getDeploymentInstanceSetting(storepb.InstanceSettingKey(key)); configured != nil {
				return []*storepb.InstanceSetting{configured}, nil
			}
		}
		return stored, nil
	}

	byKey := make(map[storepb.InstanceSettingKey]*storepb.InstanceSetting, len(stored))
	for _, setting := range stored {
		byKey[setting.Key] = setting
	}
	s.deploymentConfigMu.RLock()
	for key, setting := range s.deploymentConfig.instanceSettings {
		byKey[key] = cloneInstanceSetting(setting)
	}
	s.deploymentConfigMu.RUnlock()
	settings := make([]*storepb.InstanceSetting, 0, len(byKey))
	for _, setting := range byKey {
		settings = append(settings, setting)
	}
	slices.SortFunc(settings, func(a, b *storepb.InstanceSetting) int { return cmp.Compare(a.Key, b.Key) })
	return settings, nil
}

func (s *Store) listStoredInstanceSettings(ctx context.Context, find *FindInstanceSetting) ([]*storepb.InstanceSetting, error) {
	list, err := s.driver.ListInstanceSettings(ctx, find)
	if err != nil {
		return nil, err
	}

	instanceSettings := []*storepb.InstanceSetting{}
	for _, instanceSettingRaw := range list {
		instanceSetting, err := convertInstanceSettingFromRaw(instanceSettingRaw)
		if err != nil {
			return nil, errors.Wrap(err, "Failed to convert instance setting")
		}
		if instanceSetting == nil {
			continue
		}
		s.cacheInstanceSetting(ctx, instanceSetting)
		instanceSettings = append(instanceSettings, instanceSetting)
	}
	return instanceSettings, nil
}

func (s *Store) getRawInstanceSetting(ctx context.Context, name string) (*storepb.InstanceSetting, error) {
	list, err := s.listStoredInstanceSettings(ctx, &FindInstanceSetting{Name: name})
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, nil
	}
	if len(list) > 1 {
		return nil, errors.Errorf("found multiple stored instance settings with key %s", name)
	}
	return list[0], nil
}

// GetStoredInstanceSetting returns a database-backed setting without deployment shadowing.
func (s *Store) GetStoredInstanceSetting(ctx context.Context, find *FindInstanceSetting) (*storepb.InstanceSetting, error) {
	return s.getRawInstanceSetting(ctx, find.Name)
}

func (s *Store) GetInstanceSetting(ctx context.Context, find *FindInstanceSetting) (*storepb.InstanceSetting, error) {
	if key, ok := storepb.InstanceSettingKey_value[find.Name]; ok {
		if setting := s.getDeploymentInstanceSetting(storepb.InstanceSettingKey(key)); setting != nil {
			return setting, nil
		}
	}
	if cache, ok := s.instanceSettingCache.Get(ctx, find.Name); ok {
		instanceSetting, ok := cache.(*storepb.InstanceSetting)
		if ok {
			return instanceSetting, nil
		}
	}

	list, err := s.ListInstanceSettings(ctx, find)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, nil
	}
	if len(list) > 1 {
		return nil, errors.Errorf("found multiple instance settings with key %s", find.Name)
	}
	return list[0], nil
}

func (s *Store) cacheInstanceSetting(ctx context.Context, setting *storepb.InstanceSetting) {
	if setting == nil || s.IsInstanceSettingDeploymentConfigured(setting.Key) {
		return
	}
	s.instanceSettingCache.Set(ctx, setting.Key.String(), setting)
}

func (s *Store) GetInstanceBasicSetting(ctx context.Context) (*storepb.InstanceBasicSetting, error) {
	instanceSetting, err := s.GetInstanceSetting(ctx, &FindInstanceSetting{
		Name: storepb.InstanceSettingKey_BASIC.String(),
	})
	if err != nil {
		return nil, errors.Wrap(err, "failed to get instance basic setting")
	}

	instanceBasicSetting := &storepb.InstanceBasicSetting{}
	if instanceSetting != nil {
		instanceBasicSetting = instanceSetting.GetBasicSetting()
	}
	s.cacheInstanceSetting(ctx, &storepb.InstanceSetting{
		Key:   storepb.InstanceSettingKey_BASIC,
		Value: &storepb.InstanceSetting_BasicSetting{BasicSetting: instanceBasicSetting},
	})
	return instanceBasicSetting, nil
}

func (s *Store) GetInstanceGeneralSetting(ctx context.Context) (*storepb.InstanceGeneralSetting, error) {
	instanceSetting, err := s.GetInstanceSetting(ctx, &FindInstanceSetting{
		Name: storepb.InstanceSettingKey_GENERAL.String(),
	})
	if err != nil {
		return nil, errors.Wrap(err, "failed to get instance general setting")
	}

	instanceGeneralSetting := &storepb.InstanceGeneralSetting{}
	if instanceSetting != nil {
		instanceGeneralSetting = instanceSetting.GetGeneralSetting()
	}
	s.cacheInstanceSetting(ctx, &storepb.InstanceSetting{
		Key:   storepb.InstanceSettingKey_GENERAL,
		Value: &storepb.InstanceSetting_GeneralSetting{GeneralSetting: instanceGeneralSetting},
	})
	return instanceGeneralSetting, nil
}

// DefaultContentLengthLimit is the default limit of content length in bytes. 8KB.
const DefaultContentLengthLimit = 8 * 1024

// DefaultReactions is the default reactions for memo related setting.
var DefaultReactions = []string{"👍", "👎", "❤️", "🎉", "😄", "😕", "😢", "😡"}

func (s *Store) GetInstanceMemoRelatedSetting(ctx context.Context) (*storepb.InstanceMemoRelatedSetting, error) {
	instanceSetting, err := s.GetInstanceSetting(ctx, &FindInstanceSetting{
		Name: storepb.InstanceSettingKey_MEMO_RELATED.String(),
	})
	if err != nil {
		return nil, errors.Wrap(err, "failed to get instance general setting")
	}

	instanceMemoRelatedSetting := &storepb.InstanceMemoRelatedSetting{}
	if instanceSetting != nil {
		instanceMemoRelatedSetting = instanceSetting.GetMemoRelatedSetting()
	}
	if instanceMemoRelatedSetting.ContentLengthLimit < DefaultContentLengthLimit {
		instanceMemoRelatedSetting.ContentLengthLimit = DefaultContentLengthLimit
	}
	if len(instanceMemoRelatedSetting.Reactions) == 0 {
		instanceMemoRelatedSetting.Reactions = append(instanceMemoRelatedSetting.Reactions, DefaultReactions...)
	}
	s.cacheInstanceSetting(ctx, &storepb.InstanceSetting{
		Key:   storepb.InstanceSettingKey_MEMO_RELATED,
		Value: &storepb.InstanceSetting_MemoRelatedSetting{MemoRelatedSetting: instanceMemoRelatedSetting},
	})
	return instanceMemoRelatedSetting, nil
}

func (s *Store) GetInstanceTagsSetting(ctx context.Context) (*storepb.InstanceTagsSetting, error) {
	instanceSetting, err := s.GetInstanceSetting(ctx, &FindInstanceSetting{
		Name: storepb.InstanceSettingKey_TAGS.String(),
	})
	if err != nil {
		return nil, errors.Wrap(err, "failed to get instance tags setting")
	}

	instanceTagsSetting := &storepb.InstanceTagsSetting{}
	if instanceSetting != nil {
		instanceTagsSetting = instanceSetting.GetTagsSetting()
	}
	if instanceTagsSetting.Tags == nil {
		instanceTagsSetting.Tags = map[string]*storepb.InstanceTagMetadata{}
	}
	s.cacheInstanceSetting(ctx, &storepb.InstanceSetting{
		Key:   storepb.InstanceSettingKey_TAGS,
		Value: &storepb.InstanceSetting_TagsSetting{TagsSetting: instanceTagsSetting},
	})
	return instanceTagsSetting, nil
}

func (s *Store) GetInstanceNotificationSetting(ctx context.Context) (*storepb.InstanceNotificationSetting, error) {
	instanceSetting, err := s.GetInstanceSetting(ctx, &FindInstanceSetting{
		Name: storepb.InstanceSettingKey_NOTIFICATION.String(),
	})
	if err != nil {
		return nil, errors.Wrap(err, "failed to get instance notification setting")
	}

	instanceNotificationSetting := &storepb.InstanceNotificationSetting{}
	if instanceSetting != nil {
		instanceNotificationSetting = instanceSetting.GetNotificationSetting()
	}
	if instanceNotificationSetting.Email == nil {
		instanceNotificationSetting.Email = &storepb.InstanceNotificationSetting_EmailSetting{}
	}
	s.cacheInstanceSetting(ctx, &storepb.InstanceSetting{
		Key:   storepb.InstanceSettingKey_NOTIFICATION,
		Value: &storepb.InstanceSetting_NotificationSetting{NotificationSetting: instanceNotificationSetting},
	})
	return instanceNotificationSetting, nil
}

// GetInstanceAISetting gets the AI provider settings for the instance.
func (s *Store) GetInstanceAISetting(ctx context.Context) (*storepb.InstanceAISetting, error) {
	instanceSetting, err := s.GetInstanceSetting(ctx, &FindInstanceSetting{
		Name: storepb.InstanceSettingKey_AI.String(),
	})
	if err != nil {
		return nil, errors.Wrap(err, "failed to get instance AI setting")
	}

	instanceAISetting := &storepb.InstanceAISetting{}
	if instanceSetting != nil {
		instanceAISetting = instanceSetting.GetAiSetting()
	}
	s.cacheInstanceSetting(ctx, &storepb.InstanceSetting{
		Key:   storepb.InstanceSettingKey_AI,
		Value: &storepb.InstanceSetting_AiSetting{AiSetting: instanceAISetting},
	})
	return instanceAISetting, nil
}

const (
	defaultInstanceStorageType       = storepb.InstanceStorageSetting_LOCAL
	defaultInstanceUploadSizeLimitMb = 30
	defaultInstanceFilepathTemplate  = "assets/{timestamp}_{uuid}_{filename}"
)

func (s *Store) GetInstanceStorageSetting(ctx context.Context) (*storepb.InstanceStorageSetting, error) {
	instanceSetting, err := s.GetInstanceSetting(ctx, &FindInstanceSetting{
		Name: storepb.InstanceSettingKey_STORAGE.String(),
	})
	if err != nil {
		return nil, errors.Wrap(err, "failed to get instance storage setting")
	}

	instanceStorageSetting := &storepb.InstanceStorageSetting{}
	if instanceSetting != nil {
		instanceStorageSetting = instanceSetting.GetStorageSetting()
	}
	if instanceStorageSetting.StorageType == storepb.InstanceStorageSetting_STORAGE_TYPE_UNSPECIFIED {
		instanceStorageSetting.StorageType = defaultInstanceStorageType
	}
	if instanceStorageSetting.UploadSizeLimitMb == 0 {
		instanceStorageSetting.UploadSizeLimitMb = defaultInstanceUploadSizeLimitMb
	}
	if instanceStorageSetting.FilepathTemplate == "" {
		instanceStorageSetting.FilepathTemplate = defaultInstanceFilepathTemplate
	}
	s.cacheInstanceSetting(ctx, &storepb.InstanceSetting{
		Key:   storepb.InstanceSettingKey_STORAGE,
		Value: &storepb.InstanceSetting_StorageSetting{StorageSetting: instanceStorageSetting},
	})
	return instanceStorageSetting, nil
}

func convertInstanceSettingFromRaw(instanceSettingRaw *InstanceSetting) (*storepb.InstanceSetting, error) {
	instanceSetting := &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey(storepb.InstanceSettingKey_value[instanceSettingRaw.Name]),
	}
	switch instanceSettingRaw.Name {
	case storepb.InstanceSettingKey_BASIC.String():
		basicSetting := &storepb.InstanceBasicSetting{}
		if err := protojsonUnmarshaler.Unmarshal([]byte(instanceSettingRaw.Value), basicSetting); err != nil {
			return nil, err
		}
		instanceSetting.Value = &storepb.InstanceSetting_BasicSetting{BasicSetting: basicSetting}
	case storepb.InstanceSettingKey_GENERAL.String():
		generalSetting := &storepb.InstanceGeneralSetting{}
		if err := protojsonUnmarshaler.Unmarshal([]byte(instanceSettingRaw.Value), generalSetting); err != nil {
			return nil, err
		}
		instanceSetting.Value = &storepb.InstanceSetting_GeneralSetting{GeneralSetting: generalSetting}
	case storepb.InstanceSettingKey_STORAGE.String():
		storageSetting := &storepb.InstanceStorageSetting{}
		if err := protojsonUnmarshaler.Unmarshal([]byte(instanceSettingRaw.Value), storageSetting); err != nil {
			return nil, err
		}
		instanceSetting.Value = &storepb.InstanceSetting_StorageSetting{StorageSetting: storageSetting}
	case storepb.InstanceSettingKey_MEMO_RELATED.String():
		memoRelatedSetting := &storepb.InstanceMemoRelatedSetting{}
		if err := protojsonUnmarshaler.Unmarshal([]byte(instanceSettingRaw.Value), memoRelatedSetting); err != nil {
			return nil, err
		}
		instanceSetting.Value = &storepb.InstanceSetting_MemoRelatedSetting{MemoRelatedSetting: memoRelatedSetting}
	case storepb.InstanceSettingKey_TAGS.String():
		tagsSetting := &storepb.InstanceTagsSetting{}
		if err := protojsonUnmarshaler.Unmarshal([]byte(instanceSettingRaw.Value), tagsSetting); err != nil {
			return nil, err
		}
		instanceSetting.Value = &storepb.InstanceSetting_TagsSetting{TagsSetting: tagsSetting}
	case storepb.InstanceSettingKey_NOTIFICATION.String():
		notificationSetting := &storepb.InstanceNotificationSetting{}
		if err := protojsonUnmarshaler.Unmarshal([]byte(instanceSettingRaw.Value), notificationSetting); err != nil {
			return nil, err
		}
		instanceSetting.Value = &storepb.InstanceSetting_NotificationSetting{NotificationSetting: notificationSetting}
	case storepb.InstanceSettingKey_AI.String():
		aiSetting := &storepb.InstanceAISetting{}
		if err := protojsonUnmarshaler.Unmarshal([]byte(instanceSettingRaw.Value), aiSetting); err != nil {
			return nil, err
		}
		instanceSetting.Value = &storepb.InstanceSetting_AiSetting{AiSetting: aiSetting}
	default:
		// Skip unsupported instance setting key.
		return nil, nil
	}
	return instanceSetting, nil
}
