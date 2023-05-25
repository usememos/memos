package server

import (
	"context"
	"fmt"
	"strconv"

	"github.com/usememos/memos/api"
	"github.com/usememos/memos/plugin/telegram"
	"github.com/usememos/memos/store"
)

type telegramHandler struct {
	store *store.Store
}

func NewTelegramHandler(store *store.Store) *telegramHandler {
	return &telegramHandler{store: store}
}

func (t *telegramHandler) RobotToken(ctx context.Context) string {
	return t.store.GetSystemSettingValueOrDefault(&ctx, api.SystemSettingTelegramRobotTokenName, "")
}

func (t *telegramHandler) MessageHandle(ctx context.Context, message telegram.Message) error {
	if message.Text == "" {
		return fmt.Errorf("Empty telegram message")
	}

	var creatorId int
	userSettingList, err := t.store.FindUserSettingList(ctx, &api.UserSettingFind{
		Key: api.UserSettingTelegramUseridKey,
	})
	if err != nil {
		return fmt.Errorf("Fail to find memo user: %s", err)
	}
	for _, userSetting := range userSettingList {
		if userSetting.Value == strconv.Itoa(message.From.Id) {
			creatorId = userSetting.UserID
		}
	}

	if creatorId == 0 {
		return fmt.Errorf("Please set your telegram userid %d in UserSetting of Memos", message.From.Id)
	}

	memoCreate := api.CreateMemoRequest{
		Content:    message.Text,
		CreatorID:  creatorId,
		Visibility: api.Private,
	}

	memoMessage, err := t.store.CreateMemo(ctx, convertCreateMemoRequestToMemoMessage(&memoCreate))
	if err != nil {
		return fmt.Errorf("failed to CreateMemo: %s", err)
	}

	if err := createMemoCreateActivity(ctx, t.store, memoMessage); err != nil {
		return fmt.Errorf("failed to createMemoCreateActivity: %s", err)
	}

	return nil
}
