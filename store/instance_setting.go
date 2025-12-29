package store

import (
	"context"

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
	s.instanceSettingCache.Set(ctx, instanceSetting.Key.String(), instanceSetting)
	return instanceSetting, nil
}

func (s *Store) ListInstanceSettings(ctx context.Context, find *FindInstanceSetting) ([]*storepb.InstanceSetting, error) {
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
		s.instanceSettingCache.Set(ctx, instanceSetting.Key.String(), instanceSetting)
		instanceSettings = append(instanceSettings, instanceSetting)
	}
	return instanceSettings, nil
}

func (s *Store) GetInstanceSetting(ctx context.Context, find *FindInstanceSetting) (*storepb.InstanceSetting, error) {
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
	s.instanceSettingCache.Set(ctx, storepb.InstanceSettingKey_BASIC.String(), &storepb.InstanceSetting{
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
	s.instanceSettingCache.Set(ctx, storepb.InstanceSettingKey_GENERAL.String(), &storepb.InstanceSetting{
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
	s.instanceSettingCache.Set(ctx, storepb.InstanceSettingKey_MEMO_RELATED.String(), &storepb.InstanceSetting{
		Key:   storepb.InstanceSettingKey_MEMO_RELATED,
		Value: &storepb.InstanceSetting_MemoRelatedSetting{MemoRelatedSetting: instanceMemoRelatedSetting},
	})
	return instanceMemoRelatedSetting, nil
}

const (
	defaultInstanceStorageType       = storepb.InstanceStorageSetting_DATABASE
	defaultInstanceUploadSizeLimitMb = 30
	defaultInstanceFilepathTemplate  = "assets/{timestamp}_{filename}"
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
	s.instanceSettingCache.Set(ctx, storepb.InstanceSettingKey_STORAGE.String(), &storepb.InstanceSetting{
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
	default:
		// Skip unsupported instance setting key.
		return nil, nil
	}
	return instanceSetting, nil
}
