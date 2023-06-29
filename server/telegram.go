package server

import (
	"context"
	"encoding/json"
	"fmt"
	"path"
	"strconv"

	"github.com/pkg/errors"
	"github.com/usememos/memos/api"
	apiv1 "github.com/usememos/memos/api/v1"
	"github.com/usememos/memos/common"
	"github.com/usememos/memos/plugin/telegram"
	"github.com/usememos/memos/store"
)

type telegramHandler struct {
	store *store.Store
}

func newTelegramHandler(store *store.Store) *telegramHandler {
	return &telegramHandler{store: store}
}

func (t *telegramHandler) BotToken(ctx context.Context) string {
	return t.store.GetSystemSettingValueOrDefault(&ctx, api.SystemSettingTelegramBotTokenName, "")
}

const (
	workingMessage = "Working on send your memo..."
	successMessage = "Success"
)

func (t *telegramHandler) MessageHandle(ctx context.Context, bot *telegram.Bot, message telegram.Message, blobs map[string][]byte) error {
	reply, err := bot.SendReplyMessage(ctx, message.Chat.ID, message.MessageID, workingMessage)
	if err != nil {
		return fmt.Errorf("fail to SendReplyMessage: %s", err)
	}

	var creatorID int
	userSettingList, err := t.store.ListUserSettings(ctx, &store.FindUserSetting{
		Key: apiv1.UserSettingTelegramUserIDKey.String(),
	})
	if err != nil {
		return errors.Wrap(err, "Failed to find userSettingList")
	}
	for _, userSetting := range userSettingList {
		var value string
		if err := json.Unmarshal([]byte(userSetting.Value), &value); err != nil {
			continue
		}

		if value == strconv.Itoa(message.From.ID) {
			creatorID = userSetting.UserID
		}
	}

	if creatorID == 0 {
		_, err := bot.EditMessage(ctx, message.Chat.ID, reply.MessageID, fmt.Sprintf("Please set your telegram userid %d in UserSetting of Memos", message.From.ID), nil)
		return err
	}

	// create memo
	memoCreate := api.CreateMemoRequest{
		CreatorID:  creatorID,
		Visibility: api.Private,
	}

	if message.Text != nil {
		memoCreate.Content = *message.Text
	}
	if blobs != nil && message.Caption != nil {
		memoCreate.Content = *message.Caption
	}

	memoMessage, err := t.store.CreateMemo(ctx, convertCreateMemoRequestToMemoMessage(&memoCreate))
	if err != nil {
		_, err := bot.EditMessage(ctx, message.Chat.ID, reply.MessageID, fmt.Sprintf("failed to CreateMemo: %s", err), nil)
		return err
	}

	if err := createMemoCreateActivity(ctx, t.store, memoMessage); err != nil {
		_, err := bot.EditMessage(ctx, message.Chat.ID, reply.MessageID, fmt.Sprintf("failed to createMemoCreateActivity: %s", err), nil)
		return err
	}

	// create resources
	for filename, blob := range blobs {
		// TODO support more
		mime := "application/octet-stream"
		switch path.Ext(filename) {
		case ".jpg":
			mime = "image/jpeg"
		case ".png":
			mime = "image/png"
		}
		resourceCreate := api.ResourceCreate{
			CreatorID: creatorID,
			Filename:  filename,
			Type:      mime,
			Size:      int64(len(blob)),
			Blob:      blob,
			PublicID:  common.GenUUID(),
		}
		resource, err := t.store.CreateResource(ctx, &resourceCreate)
		if err != nil {
			_, err := bot.EditMessage(ctx, message.Chat.ID, reply.MessageID, fmt.Sprintf("failed to CreateResource: %s", err), nil)
			return err
		}
		if err := createResourceCreateActivity(ctx, t.store, resource); err != nil {
			_, err := bot.EditMessage(ctx, message.Chat.ID, reply.MessageID, fmt.Sprintf("failed to createResourceCreateActivity: %s", err), nil)
			return err
		}

		_, err = t.store.UpsertMemoResource(ctx, &api.MemoResourceUpsert{
			MemoID:     memoMessage.ID,
			ResourceID: resource.ID,
		})
		if err != nil {
			_, err := bot.EditMessage(ctx, message.Chat.ID, reply.MessageID, fmt.Sprintf("failed to UpsertMemoResource: %s", err), nil)
			return err
		}
	}

	keyboard := generateKeyboardForMemoID(memoMessage.ID)
	_, err = bot.EditMessage(ctx, message.Chat.ID, reply.MessageID, fmt.Sprintf("Saved as %s Memo %d", memoMessage.Visibility, memoMessage.ID), keyboard)
	return err
}

func (t *telegramHandler) CallbackQueryHandle(ctx context.Context, bot *telegram.Bot, callbackQuery telegram.CallbackQuery) error {
	var memoID int
	var visibility store.Visibility
	n, err := fmt.Sscanf(callbackQuery.Data, "%s %d", &visibility, &memoID)
	if err != nil || n != 2 {
		return bot.AnswerCallbackQuery(ctx, callbackQuery.ID, fmt.Sprintf("fail to parse callbackQuery.Data %s", callbackQuery.Data))
	}

	update := store.UpdateMemoMessage{
		ID:         memoID,
		Visibility: &visibility,
	}
	err = t.store.UpdateMemo(ctx, &update)
	if err != nil {
		return bot.AnswerCallbackQuery(ctx, callbackQuery.ID, fmt.Sprintf("fail to call UpdateMemo %s", err))
	}

	keyboard := generateKeyboardForMemoID(memoID)
	_, err = bot.EditMessage(ctx, callbackQuery.Message.Chat.ID, callbackQuery.Message.MessageID, fmt.Sprintf("Saved as %s Memo %d", visibility, memoID), keyboard)
	if err != nil {
		return bot.AnswerCallbackQuery(ctx, callbackQuery.ID, fmt.Sprintf("fail to EditMessage %s", err))
	}

	return bot.AnswerCallbackQuery(ctx, callbackQuery.ID, fmt.Sprintf("Success change Memo %d to %s", memoID, visibility))
}

func generateKeyboardForMemoID(id int) [][]telegram.InlineKeyboardButton {
	allVisibility := []store.Visibility{
		store.Public,
		store.Protected,
		store.Private,
	}

	buttons := make([]telegram.InlineKeyboardButton, 0, len(allVisibility))
	for _, v := range allVisibility {
		button := telegram.InlineKeyboardButton{
			Text:         v.String(),
			CallbackData: fmt.Sprintf("%s %d", v, id),
		}
		buttons = append(buttons, button)
	}

	return [][]telegram.InlineKeyboardButton{buttons}
}
