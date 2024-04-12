package store

import (
	"context"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/proto"

	storepb "github.com/usememos/memos/proto/gen/store"
)

type Storage struct {
	ID     int32
	Name   string
	Type   string
	Config string
}

type FindStorage struct {
	ID *int32
}

type UpdateStorage struct {
	ID     int32
	Name   *string
	Config *string
}

type DeleteStorage struct {
	ID int32
}

func (s *Store) CreateStorage(ctx context.Context, create *Storage) (*Storage, error) {
	return s.driver.CreateStorage(ctx, create)
}

func (s *Store) ListStorages(ctx context.Context, find *FindStorage) ([]*Storage, error) {
	return s.driver.ListStorages(ctx, find)
}

func (s *Store) GetStorage(ctx context.Context, find *FindStorage) (*Storage, error) {
	list, err := s.ListStorages(ctx, find)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, nil
	}

	return list[0], nil
}

func (s *Store) UpdateStorage(ctx context.Context, update *UpdateStorage) (*Storage, error) {
	return s.driver.UpdateStorage(ctx, update)
}

func (s *Store) DeleteStorage(ctx context.Context, delete *DeleteStorage) error {
	return s.driver.DeleteStorage(ctx, delete)
}

func (s *Store) CreateStorageV1(ctx context.Context, create *storepb.Storage) (*storepb.Storage, error) {
	storageRaw := &Storage{
		Name: create.Name,
		Type: create.Type.String(),
	}

	if create.Type == storepb.Storage_S3 {
		configBytes, err := proto.Marshal(create.Config.GetS3Config())
		if err != nil {
			return nil, errors.Wrap(err, "failed to marshal s3 config")
		}
		storageRaw.Config = string(configBytes)
	}

	storageRaw, err := s.driver.CreateStorage(ctx, storageRaw)
	if err != nil {
		return nil, err
	}
	storage, err := convertStorageFromRaw(storageRaw)
	if err != nil {
		return nil, err
	}
	return storage, nil
}

func (s *Store) ListStoragesV1(ctx context.Context, find *FindStorage) ([]*storepb.Storage, error) {
	list, err := s.driver.ListStorages(ctx, find)
	if err != nil {
		return nil, err
	}

	storages := []*storepb.Storage{}
	for _, storageRaw := range list {
		storage, err := convertStorageFromRaw(storageRaw)
		if err != nil {
			return nil, err
		}
		storages = append(storages, storage)
	}
	return storages, nil
}

func (s *Store) GetStorageV1(ctx context.Context, find *FindStorage) (*storepb.Storage, error) {
	list, err := s.ListStoragesV1(ctx, find)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, nil
	}

	return list[0], nil
}

type UpdateStorageV1 struct {
	ID     int32
	Type   storepb.Storage_Type
	Name   *string
	Config *storepb.StorageConfig
}

func (s *Store) UpdateStorageV1(ctx context.Context, update *UpdateStorageV1) (*storepb.Storage, error) {
	updateRaw := &UpdateStorage{
		ID: update.ID,
	}
	if update.Name != nil {
		updateRaw.Name = update.Name
	}
	if update.Config != nil {
		configRaw, err := convertStorageConfigToRaw(update.Type, update.Config)
		if err != nil {
			return nil, err
		}
		updateRaw.Config = &configRaw
	}
	storageRaw, err := s.driver.UpdateStorage(ctx, updateRaw)
	if err != nil {
		return nil, err
	}
	storage, err := convertStorageFromRaw(storageRaw)
	if err != nil {
		return nil, err
	}
	return storage, nil
}

func convertStorageFromRaw(storageRaw *Storage) (*storepb.Storage, error) {
	storage := &storepb.Storage{
		Id:   storageRaw.ID,
		Name: storageRaw.Name,
		Type: storepb.Storage_Type(storepb.Storage_Type_value[storageRaw.Type]),
	}
	storageConfig, err := convertStorageConfigFromRaw(storage.Type, storageRaw.Config)
	if err != nil {
		return nil, err
	}
	storage.Config = storageConfig
	return storage, nil
}

func convertStorageConfigFromRaw(storageType storepb.Storage_Type, configRaw string) (*storepb.StorageConfig, error) {
	storageConfig := &storepb.StorageConfig{}
	if storageType == storepb.Storage_S3 {
		s3Config := &storepb.S3Config{}
		err := proto.Unmarshal([]byte(configRaw), s3Config)
		if err != nil {
			return nil, err
		}
		storageConfig.StorageConfig = &storepb.StorageConfig_S3Config{S3Config: s3Config}
	}
	return storageConfig, nil
}

func convertStorageConfigToRaw(storageType storepb.Storage_Type, config *storepb.StorageConfig) (string, error) {
	raw := ""
	if storageType == storepb.Storage_S3 {
		bytes, err := proto.Marshal(config.GetS3Config())
		if err != nil {
			return "", err
		}
		raw = string(bytes)
	}
	return raw, nil
}
