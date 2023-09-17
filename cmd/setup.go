package cmd

import (
	"context"
	"fmt"
	"time"

	"github.com/pkg/errors"
	"github.com/spf13/cobra"
	"golang.org/x/crypto/bcrypt"

	"github.com/usememos/memos/common/util"
	"github.com/usememos/memos/store"
	"github.com/usememos/memos/store/db"
)

var (
	setupCmdFlagHostUsername = "host-username"
	setupCmdFlagHostPassword = "host-password"
	setupCmd                 = &cobra.Command{
		Use:   "setup",
		Short: "Make initial setup for memos",
		Run: func(cmd *cobra.Command, _ []string) {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()

			hostUsername, err := cmd.Flags().GetString(setupCmdFlagHostUsername)
			if err != nil {
				fmt.Printf("failed to get owner username, error: %+v\n", err)
				return
			}

			hostPassword, err := cmd.Flags().GetString(setupCmdFlagHostPassword)
			if err != nil {
				fmt.Printf("failed to get owner password, error: %+v\n", err)
				return
			}

			db := db.NewDB(profile)
			if err := db.Open(); err != nil {
				fmt.Printf("failed to open db, error: %+v\n", err)
				return
			}
			if err := db.Migrate(ctx); err != nil {
				fmt.Printf("failed to migrate db, error: %+v\n", err)
				return
			}

			store := store.New(db.DBInstance, profile)
			if err := ExecuteSetup(ctx, store, hostUsername, hostPassword); err != nil {
				fmt.Printf("failed to setup, error: %+v\n", err)
				return
			}
		},
	}
)

func init() {
	setupCmd.Flags().String(setupCmdFlagHostUsername, "", "Owner username")
	setupCmd.Flags().String(setupCmdFlagHostPassword, "", "Owner password")

	rootCmd.AddCommand(setupCmd)
}

func ExecuteSetup(ctx context.Context, store *store.Store, hostUsername, hostPassword string) error {
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
		return errors.Wrap(err, "create user")
	}
	return nil
}

func (s setupService) makeSureHostUserNotExists(ctx context.Context) error {
	hostUserType := store.RoleHost
	existedHostUsers, err := s.store.ListUsers(ctx, &store.FindUser{Role: &hostUserType})
	if err != nil {
		return errors.Wrap(err, "find user list")
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
		Role:     store.RoleHost,
		Nickname: hostUsername,
	}

	if len(userCreate.Username) < 3 {
		return errors.New("username is too short, minimum length is 3")
	}
	if len(userCreate.Username) > 32 {
		return errors.New("username is too long, maximum length is 32")
	}
	if len(hostPassword) < 3 {
		return errors.New("password is too short, minimum length is 3")
	}
	if len(hostPassword) > 512 {
		return errors.New("password is too long, maximum length is 512")
	}
	if len(userCreate.Nickname) > 64 {
		return errors.New("nickname is too long, maximum length is 64")
	}
	if userCreate.Email != "" {
		if len(userCreate.Email) > 256 {
			return errors.New("email is too long, maximum length is 256")
		}
		if !util.ValidateEmail(userCreate.Email) {
			return errors.New("invalid email format")
		}
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(hostPassword), bcrypt.DefaultCost)
	if err != nil {
		return errors.Wrap(err, "failed to hash password")
	}

	userCreate.PasswordHash = string(passwordHash)
	if _, err := s.store.CreateUser(ctx, userCreate); err != nil {
		return errors.Wrap(err, "failed to create user")
	}

	return nil
}
