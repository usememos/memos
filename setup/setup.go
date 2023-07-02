package setup

import (
	"context"
	"errors"
	"fmt"

	"golang.org/x/crypto/bcrypt"

	"github.com/usememos/memos/api"
	"github.com/usememos/memos/common"
	"github.com/usememos/memos/store"
)

func Execute(ctx context.Context, store *store.Store, hostUsername, hostPassword string) error {
	s := setupService{store: store}
	return s.Setup(ctx, hostUsername, hostPassword)
}

type setupService struct {
	store *store.Store
}

func (s setupService) Setup(ctx context.Context, hostUsername, hostPassword string) error {
	if err := s.makeSureHostUserNotExists(ctx); err != nil {
		return err
	}

	if err := s.createUser(ctx, hostUsername, hostPassword); err != nil {
		return fmt.Errorf("create user: %w", err)
	}
	return nil
}

func (s setupService) makeSureHostUserNotExists(ctx context.Context) error {
	hostUserType := api.Host
	existedHostUsers, err := s.store.FindUserList(ctx, &api.UserFind{
		Role: &hostUserType,
	})
	if err != nil {
		return fmt.Errorf("find user list: %w", err)
	}

	if len(existedHostUsers) != 0 {
		return errors.New("host user already exists")
	}

	return nil
}

func (s setupService) createUser(ctx context.Context, hostUsername, hostPassword string) error {
	userCreate := &store.User{
		Username: hostUsername,
		// The new signup user should be normal user by default.
		Role:     store.Host,
		Nickname: hostUsername,
		OpenID:   common.GenUUID(),
	}

	if len(userCreate.Username) < 3 {
		return fmt.Errorf("username is too short, minimum length is 3")
	}
	if len(userCreate.Username) > 32 {
		return fmt.Errorf("username is too long, maximum length is 32")
	}
	if len(hostPassword) < 3 {
		return fmt.Errorf("password is too short, minimum length is 3")
	}
	if len(hostPassword) > 512 {
		return fmt.Errorf("password is too long, maximum length is 512")
	}
	if len(userCreate.Nickname) > 64 {
		return fmt.Errorf("nickname is too long, maximum length is 64")
	}
	if userCreate.Email != "" {
		if len(userCreate.Email) > 256 {
			return fmt.Errorf("email is too long, maximum length is 256")
		}
		if !common.ValidateEmail(userCreate.Email) {
			return fmt.Errorf("invalid email format")
		}
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(hostPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	userCreate.PasswordHash = string(passwordHash)
	if _, err := s.store.CreateUserV1(ctx, userCreate); err != nil {
		return fmt.Errorf("failed to create user: %w", err)
	}

	return nil
}
