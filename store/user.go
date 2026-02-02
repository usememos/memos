package store

import (
	"context"
)

// Role is the type of a role.
type Role string

const (
	// RoleAdmin is the ADMIN role.
	RoleAdmin Role = "ADMIN"
	// RoleUser is the USER role.
	RoleUser Role = "USER"
)

func (e Role) String() string {
	switch e {
	case RoleAdmin:
		return "ADMIN"
	default:
		return "USER"
	}
}

const (
	SystemBotID int32 = 0
)

var (
	SystemBot = &User{
		ID:       SystemBotID,
		Username: "system_bot",
		Role:     RoleAdmin,
		Email:    "",
		Nickname: "Bot",
	}
)

type User struct {
	ID int32

	// Standard fields
	RowStatus RowStatus
	CreatedTs int64
	UpdatedTs int64

	// Domain specific fields
	Username     string
	Role         Role
	Email        string
	Nickname     string
	PasswordHash string
	AvatarURL    string
	Description  string
}

type UpdateUser struct {
	ID int32

	UpdatedTs    *int64
	RowStatus    *RowStatus
	Username     *string
	Role         *Role
	Email        *string
	Nickname     *string
	Password     *string
	AvatarURL    *string
	PasswordHash *string
	Description  *string
}

type FindUser struct {
	ID        *int32
	RowStatus *RowStatus
	Username  *string
	Role      *Role
	Email     *string
	Nickname  *string

	// Domain specific fields
	Filters []string

	// The maximum number of users to return.
	Limit *int
}

type DeleteUser struct {
	ID int32
}

func (s *Store) CreateUser(ctx context.Context, create *User) (*User, error) {
	user, err := s.driver.CreateUser(ctx, create)
	if err != nil {
		return nil, err
	}

	s.userCache.Set(ctx, string(user.ID), user)
	return user, nil
}

func (s *Store) UpdateUser(ctx context.Context, update *UpdateUser) (*User, error) {
	user, err := s.driver.UpdateUser(ctx, update)
	if err != nil {
		return nil, err
	}

	s.userCache.Set(ctx, string(user.ID), user)
	return user, nil
}

func (s *Store) ListUsers(ctx context.Context, find *FindUser) ([]*User, error) {
	list, err := s.driver.ListUsers(ctx, find)
	if err != nil {
		return nil, err
	}

	for _, user := range list {
		s.userCache.Set(ctx, string(user.ID), user)
	}
	return list, nil
}

func (s *Store) GetUser(ctx context.Context, find *FindUser) (*User, error) {
	if find.ID != nil {
		if *find.ID == SystemBotID {
			return SystemBot, nil
		}
		if cache, ok := s.userCache.Get(ctx, string(*find.ID)); ok {
			user, ok := cache.(*User)
			if ok {
				return user, nil
			}
		}
	}

	list, err := s.ListUsers(ctx, find)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, nil
	}

	user := list[0]
	s.userCache.Set(ctx, string(user.ID), user)
	return user, nil
}

func (s *Store) DeleteUser(ctx context.Context, delete *DeleteUser) error {
	err := s.driver.DeleteUser(ctx, delete)
	if err != nil {
		return err
	}
	s.userCache.Delete(ctx, string(delete.ID))
	return nil
}
