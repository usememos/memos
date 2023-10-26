package cmd

import (
	"context"
	"fmt"
	"strings"

	"github.com/pkg/errors"
	"github.com/spf13/cobra"

	_profile "github.com/usememos/memos/server/profile"
	"github.com/usememos/memos/store"
	"github.com/usememos/memos/store/db"
)

var (
	copydbCmdFlagFrom = "from"
	copydbCmd         = &cobra.Command{
		Use:   "copydb", // `copydb` is a shortened for 'copy database'
		Short: "Copy data between db drivers",
		Run: func(cmd *cobra.Command, _ []string) {
			s, err := cmd.Flags().GetString(copydbCmdFlagFrom)
			if err != nil {
				println("fail to get from driver DSN")
				println(err)
				return
			}
			ss := strings.Split(s, "://")
			if len(ss) != 2 {
				println("fail to parse from driver DSN, should be like 'sqlite://memos_prod.db' or 'mysql://user:pass@tcp(host)/memos'")
				return
			}

			fromProfile := &_profile.Profile{Driver: ss[0], DSN: ss[1]}

			err = copydb(fromProfile, profile)
			if err != nil {
				fmt.Printf("fail to copydb: %s\n", err)
				return
			}

			println("done")
		},
	}
)

func init() {
	copydbCmd.Flags().String(copydbCmdFlagFrom, "sqlite://memos_prod.db", "From driver DSN")

	rootCmd.AddCommand(copydbCmd)
}

func copydb(fromProfile, toProfile *_profile.Profile) error {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	toDriver, err := db.NewDBDriver(toProfile)
	if err != nil {
		return errors.Wrap(err, "fail to create `to` driver")
	}

	if err := toDriver.Migrate(ctx); err != nil {
		return errors.Wrap(err, "fail to migrate db")
	}

	fromDriver, err := db.NewDBDriver(fromProfile)
	if err != nil {
		return errors.Wrap(err, "fail to create `from` driver")
	}

	// Register here if any table is added
	copyMap := map[string]func(context.Context, store.Driver, store.Driver) error{
		"activity":       copyActivity,
		"idp":            copyIdp,
		"memo":           copyMemo,
		"memo_organizer": copyMemoOrganizer,
		"memo_relation":  copyMemoRelation,
		"resource":       copyResource,
		"storage":        copyStorage,
		"system_setting": copySystemSettings,
		"tag":            copyTag,
		"user":           copyUser,
		"user_setting":   copyUserSettings,
	}

	toDb := toDriver.GetDB()
	for table := range copyMap {
		println("Checking " + table + "...")
		var cnt int
		err := toDb.QueryRowContext(ctx, "SELECT COUNT(*) FROM "+table).Scan(&cnt)
		if err != nil {
			return errors.Wrapf(err, "fail to check '%s'", table)
		}
		if cnt > 0 {
			return errors.Errorf("table '%s' is not empty", table)
		}
	}

	for _, f := range copyMap {
		err = f(ctx, fromDriver, toDriver)
		if err != nil {
			return errors.Wrap(err, "fail to copy data")
		}
	}

	return nil
}

func copyActivity(ctx context.Context, fromDriver, toDriver store.Driver) error {
	println("Copying Activity...")
	list, err := fromDriver.ListActivities(ctx, &store.FindActivity{})
	if err != nil {
		return err
	}

	fmt.Printf("\tTotal %d records\n", len(list))
	for _, item := range list {
		_, err := toDriver.CreateActivity(ctx, &store.Activity{
			ID:        item.ID,
			CreatorID: item.CreatorID,
			CreatedTs: item.CreatedTs,
			Level:     item.Level,
			Type:      item.Type,
			Payload:   item.Payload,
		})
		if err != nil {
			return err
		}
	}

	println("\tDONE")
	return nil
}

func copyIdp(ctx context.Context, fromDriver, toDriver store.Driver) error {
	println("Copying IdentityProvider...")
	list, err := fromDriver.ListIdentityProviders(ctx, &store.FindIdentityProvider{})
	if err != nil {
		return err
	}

	fmt.Printf("\tTotal %d records\n", len(list))
	for _, item := range list {
		_, err := toDriver.CreateIdentityProvider(ctx, &store.IdentityProvider{
			ID:               item.ID,
			Name:             item.Name,
			Type:             item.Type,
			IdentifierFilter: item.IdentifierFilter,
			Config:           item.Config,
		})
		if err != nil {
			return err
		}
	}

	println("\tDONE")
	return nil
}

func copyMemo(ctx context.Context, fromDriver, toDriver store.Driver) error {
	println("Copying Memo...")
	list, err := fromDriver.ListMemos(ctx, &store.FindMemo{})
	if err != nil {
		return err
	}

	fmt.Printf("\tTotal %d records\n", len(list))
	for _, item := range list {
		_, err := toDriver.CreateMemo(ctx, &store.Memo{
			ID:         item.ID,
			CreatorID:  item.CreatorID,
			CreatedTs:  item.CreatedTs,
			UpdatedTs:  item.UpdatedTs,
			RowStatus:  item.RowStatus,
			Content:    item.Content,
			Visibility: item.Visibility,
		})
		if err != nil {
			return err
		}
	}

	println("\tDONE")
	return nil
}

func copyMemoOrganizer(ctx context.Context, fromDriver, toDriver store.Driver) error {
	println("Copying MemoOrganizer...")
	list, err := fromDriver.ListMemoOrganizer(ctx, &store.FindMemoOrganizer{})
	if err != nil {
		return err
	}

	fmt.Printf("\tTotal %d records\n", len(list))
	for _, item := range list {
		_, err := toDriver.UpsertMemoOrganizer(ctx, &store.MemoOrganizer{
			MemoID: item.MemoID,
			UserID: item.UserID,
			Pinned: item.Pinned,
		})
		if err != nil {
			return err
		}
	}
	println("\tDONE")
	return nil
}

func copyMemoRelation(ctx context.Context, fromDriver, toDriver store.Driver) error {
	println("Copying MemoRelation...")
	list, err := fromDriver.ListMemoRelations(ctx, &store.FindMemoRelation{})
	if err != nil {
		return err
	}

	fmt.Printf("\tTotal %d records\n", len(list))
	for _, item := range list {
		_, err := toDriver.UpsertMemoRelation(ctx, &store.MemoRelation{
			MemoID:        item.MemoID,
			RelatedMemoID: item.RelatedMemoID,
			Type:          item.Type,
		})
		if err != nil {
			return err
		}
	}

	println("\tDONE")
	return nil
}

func copyResource(ctx context.Context, fromDriver, toDriver store.Driver) error {
	println("Copying Resource...")
	list, err := fromDriver.ListResources(ctx, &store.FindResource{GetBlob: true})
	if err != nil {
		return err
	}

	fmt.Printf("\tTotal %d records\n", len(list))
	for _, item := range list {
		_, err := toDriver.CreateResource(ctx, &store.Resource{
			ID:           item.ID,
			CreatorID:    item.CreatorID,
			CreatedTs:    item.CreatedTs,
			UpdatedTs:    item.UpdatedTs,
			Filename:     item.Filename,
			Blob:         item.Blob,
			ExternalLink: item.ExternalLink,
			Type:         item.Type,
			Size:         item.Size,
			InternalPath: item.InternalPath,
			MemoID:       item.MemoID,
		})
		if err != nil {
			return err
		}
	}

	println("\tDONE")
	return nil
}

func copyStorage(ctx context.Context, fromDriver, toDriver store.Driver) error {
	println("Copying Storage...")
	list, err := fromDriver.ListStorages(ctx, &store.FindStorage{})
	if err != nil {
		return err
	}

	fmt.Printf("\tTotal %d records\n", len(list))
	for _, item := range list {
		_, err := toDriver.CreateStorage(ctx, &store.Storage{
			ID:     item.ID,
			Name:   item.Name,
			Type:   item.Type,
			Config: item.Config,
		})
		if err != nil {
			return err
		}
	}

	println("\tDONE")
	return nil
}

func copySystemSettings(ctx context.Context, fromDriver, toDriver store.Driver) error {
	println("Copying SystemSettings...")
	list, err := fromDriver.ListSystemSettings(ctx, &store.FindSystemSetting{})
	if err != nil {
		return err
	}

	fmt.Printf("\tTotal %d records\n", len(list))
	for _, item := range list {
		_, err := toDriver.UpsertSystemSetting(ctx, &store.SystemSetting{
			Name:        item.Name,
			Value:       item.Value,
			Description: item.Description,
		})
		if err != nil {
			return err
		}
	}

	println("\tDONE")
	return nil
}

func copyTag(ctx context.Context, fromDriver, toDriver store.Driver) error {
	println("Copying Tag...")
	list, err := fromDriver.ListTags(ctx, &store.FindTag{})
	if err != nil {
		return err
	}

	fmt.Printf("\tTotal %d records\n", len(list))
	for _, item := range list {
		_, err := toDriver.UpsertTag(ctx, &store.Tag{
			Name:      item.Name,
			CreatorID: item.CreatorID,
		})
		if err != nil {
			return err
		}
	}

	println("\tDONE")
	return nil
}

func copyUser(ctx context.Context, fromDriver, toDriver store.Driver) error {
	println("Copying User...")
	list, err := fromDriver.ListUsers(ctx, &store.FindUser{})
	if err != nil {
		return err
	}

	fmt.Printf("\tTotal %d records\n", len(list))
	for _, item := range list {
		_, err := toDriver.CreateUser(ctx, &store.User{
			ID:           item.ID,
			CreatedTs:    item.CreatedTs,
			UpdatedTs:    item.UpdatedTs,
			RowStatus:    item.RowStatus,
			Username:     item.Username,
			Role:         item.Role,
			Email:        item.Email,
			Nickname:     item.Nickname,
			PasswordHash: item.PasswordHash,
			AvatarURL:    item.AvatarURL,
		})
		if err != nil {
			return err
		}
	}

	println("\tDONE")
	return nil
}

func copyUserSettings(ctx context.Context, fromDriver, toDriver store.Driver) error {
	println("Copying UserSettings...")
	list, err := fromDriver.ListUserSettings(ctx, &store.FindUserSetting{})
	if err != nil {
		return err
	}

	fmt.Printf("\tTotal %d records\n", len(list))
	for _, item := range list {
		_, err := toDriver.UpsertUserSetting(ctx, &store.UserSetting{
			Key:    item.Key,
			Value:  item.Value,
			UserID: item.UserID,
		})
		if err != nil {
			return err
		}
	}

	println("\tDONE")
	return nil
}
