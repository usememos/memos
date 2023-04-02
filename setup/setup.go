package setup

import (
	"context"
	"errors"
	"fmt"

	"golang.org/x/crypto/bcrypt"

	"github.com/usememos/memos/api"
	"github.com/usememos/memos/common"
)

func Execute(
	ctx context.Context,
	store store,
	hostUsername, hostPassword string,
) error {
	s := setupService{store: store}
	return s.Setup(ctx, hostUsername, hostPassword)
}

type store interface {
	FindUserList(ctx context.Context, find *api.UserFind) ([]*api.User, error)
	CreateUser(ctx context.Context, create *api.UserCreate) (*api.User, error)
}

type setupService struct {
	store store
}

func (s setupService) Setup(
	ctx context.Context,
	hostUsername, hostPassword string,
) error {
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

func (s setupService) createUser(
	ctx context.Context,
	hostUsername, hostPassword string,
) error {
	userCreate := &api.UserCreate{
		Username: hostUsername,
		// The new signup user should be normal user by default.
		Role:     api.Host,
		Nickname: hostUsername,
		Password: hostPassword,
		OpenID:   common.GenUUID(),
	}

	if err := userCreate.Validate(); err != nil {
		return fmt.Errorf("validate: %w", err)
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(hostPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}

	userCreate.PasswordHash = string(passwordHash)
	if _, err := s.store.CreateUser(ctx, userCreate); err != nil {
		return fmt.Errorf("create user: %w", err)
	}

	return nil
}
