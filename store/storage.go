package store

import (
	"context"
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
