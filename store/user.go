package store

import (
	"context"
	stderrors "errors"
	"strconv"
	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/util"
)

// ErrUserHasSpaceMembership blocks account deletion until its Space lifecycle
// has been resolved explicitly.
var ErrUserHasSpaceMembership = stderrors.New("user still has space memberships")

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
	ID     *int32
	IDList []int32

	UsernameList []string

	RowStatus *RowStatus
	Username  *string
	Role      *Role
	Email     *string
	Nickname  *string
	Search    *string

	// Domain specific fields
	Filters []string

	// The maximum number of users to return.
	Limit *int
	// The offset of the returned users.
	Offset *int
}

type DeleteUser struct {
	ID int32
}

func userCacheKey(userID int32) string {
	return strconv.Itoa(int(userID))
}

// normalizeUserEmail canonicalizes the address on a user about to be written.
// The API layer validates first; this is the store's own guard so that seed
// data, tests, and any future caller cannot bypass the canonical form.
func normalizeUserEmail(email string) (string, error) {
	normalized, err := util.NormalizeEmail(email)
	if err != nil {
		return "", errors.Wrap(err, "invalid email")
	}
	return normalized, nil
}

func (s *Store) CreateUser(ctx context.Context, create *User) (*User, error) {
	email, err := normalizeUserEmail(create.Email)
	if err != nil {
		return nil, err
	}
	create.Email = email
	user, err := s.driver.CreateUser(ctx, create)
	if err != nil {
		if uniqueErr := classifyUserUniqueViolation(err); uniqueErr != nil {
			return nil, uniqueErr
		}
		return nil, err
	}

	s.userCache.Set(ctx, userCacheKey(user.ID), user)
	return user, nil
}

// CreateUserIfNoUsers creates a user only when the instance has no users.
// The in-process lock prevents concurrent first-user setup requests from
// creating multiple admins in the same server process.
func (s *Store) CreateUserIfNoUsers(ctx context.Context, create *User) (*User, bool, error) {
	s.userCreateMu.Lock()
	defer s.userCreateMu.Unlock()

	limitOne := 1
	users, err := s.driver.ListUsers(ctx, &FindUser{Limit: &limitOne})
	if err != nil {
		return nil, false, err
	}
	if len(users) > 0 {
		return nil, false, nil
	}

	email, err := normalizeUserEmail(create.Email)
	if err != nil {
		return nil, false, err
	}
	create.Email = email
	user, err := s.driver.CreateUser(ctx, create)
	if err != nil {
		if uniqueErr := classifyUserUniqueViolation(err); uniqueErr != nil {
			return nil, false, uniqueErr
		}
		return nil, false, err
	}
	s.userCache.Set(ctx, userCacheKey(user.ID), user)
	return user, true, nil
}

func (s *Store) UpdateUser(ctx context.Context, update *UpdateUser) (*User, error) {
	if update.Email != nil {
		email, err := normalizeUserEmail(*update.Email)
		if err != nil {
			return nil, err
		}
		update.Email = &email
	}
	user, err := s.driver.UpdateUser(ctx, update)
	if err != nil {
		if uniqueErr := classifyUserUniqueViolation(err); uniqueErr != nil {
			return nil, uniqueErr
		}
		return nil, err
	}

	s.userCache.Set(ctx, userCacheKey(user.ID), user)
	return user, nil
}

func (s *Store) ListUsers(ctx context.Context, find *FindUser) ([]*User, error) {
	if find.Email != nil {
		// Lookups compare against the canonical stored form. "No address" is
		// stored as NULL and never matches, so an empty lookup returns nothing
		// rather than every user without an address.
		email := strings.ToLower(strings.TrimSpace(*find.Email))
		if email == "" {
			return []*User{}, nil
		}
		find.Email = &email
	}
	list, err := s.driver.ListUsers(ctx, find)
	if err != nil {
		return nil, err
	}

	for _, user := range list {
		s.userCache.Set(ctx, userCacheKey(user.ID), user)
	}
	return list, nil
}

func (s *Store) GetUser(ctx context.Context, find *FindUser) (*User, error) {
	if find.ID != nil {
		if cache, ok := s.userCache.Get(ctx, userCacheKey(*find.ID)); ok {
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
	s.userCache.Set(ctx, userCacheKey(user.ID), user)
	return user, nil
}

// DeleteUser removes a user and returns cache invalidation state. Deleting an
// already-missing user is idempotent and returns an empty result.
func (s *Store) DeleteUser(ctx context.Context, delete *DeleteUser) (*DeleteUserResult, error) {
	result, err := s.driver.DeleteUser(ctx, delete)
	if err != nil {
		return nil, err
	}
	if result == nil {
		return nil, errors.New("unexpected nil delete user result")
	}
	s.deleteUserCache(ctx, delete.ID, result)
	return result, nil
}
