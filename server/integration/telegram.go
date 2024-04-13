package integration

import (
	"context"
	"fmt"
	"path/filepath"
	"slices"
	"strconv"
	"time"
	"unicode/utf16"

	"github.com/lithammer/shortuuid/v4"
	"github.com/pkg/errors"
	"github.com/yourselfhosted/gomark/ast"
	"github.com/yourselfhosted/gomark/parser"
	"github.com/yourselfhosted/gomark/parser/tokenizer"

	"github.com/usememos/memos/plugin/telegram"
	"github.com/usememos/memos/plugin/webhook"
	storepb "github.com/usememos/memos/proto/gen/store"
	apiv2 "github.com/usememos/memos/server/route/api/v2"
	"github.com/usememos/memos/store"
)

type TelegramHandler struct {
	store *store.Store
}

func NewTelegramHandler(store *store.Store) *TelegramHandler {
	return &TelegramHandler{store: store}
}

func (t *TelegramHandler) BotToken(ctx context.Context) string {
	if workspaceSetting, err := t.store.GetWorkspaceSettingV1(ctx, &store.FindWorkspaceSetting{
		Name: storepb.WorkspaceSettingKey_WORKSPACE_SETTING_TELEGRAM_INTEGRATION.String(),
	}); err == nil && workspaceSetting != nil {
		return workspaceSetting.GetTelegramIntegrationSetting().BotToken
	}
	return ""
}

const (
	workingMessage = "Working on sending your memo..."
	successMessage = "Success"
)

func (t *TelegramHandler) MessageHandle(ctx context.Context, bot *telegram.Bot, message telegram.Message, attachments []telegram.Attachment) error {
	reply, err := bot.SendReplyMessage(ctx, message.Chat.ID, message.MessageID, workingMessage)
	if err != nil {
		return errors.Wrap(err, "Failed to SendReplyMessage")
	}

	messageSenderID := strconv.FormatInt(message.From.ID, 10)
	var creatorID int32
	userSettingList, err := t.store.ListUserSettings(ctx, &store.FindUserSetting{
		Key: storepb.UserSettingKey_USER_SETTING_TELEGRAM_USER_ID,
	})
	if err != nil {
		return errors.Wrap(err, "Failed to find userSettingList")
	}
	for _, userSetting := range userSettingList {
		if userSetting.GetTelegramUserId() == messageSenderID {
			creatorID = userSetting.UserId
		}
	}

	// If creatorID is not found, ask the user to set the telegram userid in UserSetting of memos.
	if creatorID == 0 {
		_, err := bot.EditMessage(ctx, message.Chat.ID, reply.MessageID, fmt.Sprintf("Please set your telegram userid %d in UserSetting of memos", message.From.ID), nil)
		return err
	}

	create := &store.Memo{
		UID:        shortuuid.New(),
		CreatorID:  creatorID,
		Visibility: store.Private,
	}
	if message.Text != nil {
		create.Content = convertToMarkdown(*message.Text, message.Entities)
	}
	if message.Caption != nil {
		create.Content = convertToMarkdown(*message.Caption, message.CaptionEntities)
	}
	if message.ForwardFromChat != nil {
		create.Content += fmt.Sprintf("\n\n[Message link](%s)", message.GetMessageLink())
	}
	memoMessage, err := t.store.CreateMemo(ctx, create)
	if err != nil {
		_, err := bot.EditMessage(ctx, message.Chat.ID, reply.MessageID, fmt.Sprintf("Failed to CreateMemo: %s", err), nil)
		return err
	}

	// Dynamically upsert tags from memo content.
	nodes, err := parser.Parse(tokenizer.Tokenize(create.Content))
	if err != nil {
		return errors.Wrap(err, "Failed to parse content")
	}
	tags := []string{}
	apiv2.TraverseASTNodes(nodes, func(node ast.Node) {
		if tagNode, ok := node.(*ast.Tag); ok {
			tag := tagNode.Content
			if !slices.Contains(tags, tag) {
				tags = append(tags, tag)
			}
		}
	})
	for _, tag := range tags {
		_, err := t.store.UpsertTag(ctx, &store.Tag{
			Name:      tag,
			CreatorID: creatorID,
		})
		if err != nil {
			return errors.Wrap(err, "Failed to upsert tag")
		}
	}

	// Create memo related resources.
	for _, attachment := range attachments {
		// Fill the common field of create
		create := store.Resource{
			UID:       shortuuid.New(),
			CreatorID: creatorID,
			Filename:  filepath.Base(attachment.FileName),
			Type:      attachment.GetMimeType(),
			Size:      attachment.FileSize,
			MemoID:    &memoMessage.ID,
			Blob:      attachment.Data,
		}

		err := apiv2.SaveResourceBlob(ctx, t.store, &create)
		if err != nil {
			_, err := bot.EditMessage(ctx, message.Chat.ID, reply.MessageID, fmt.Sprintf("Failed to SaveResourceBlob: %s", err), nil)
			return err
		}

		_, err = t.store.CreateResource(ctx, &create)
		if err != nil {
			_, err := bot.EditMessage(ctx, message.Chat.ID, reply.MessageID, fmt.Sprintf("Failed to CreateResource: %s", err), nil)
			return err
		}
	}

	keyboard := generateKeyboardForMemoID(memoMessage.ID)
	_, err = bot.EditMessage(ctx, message.Chat.ID, reply.MessageID, fmt.Sprintf("Saved as %s Memo %d", memoMessage.Visibility, memoMessage.ID), keyboard)
	_ = t.dispatchMemoRelatedWebhook(ctx, *memoMessage, "memos.memo.created")
	return err
}

func (t *TelegramHandler) CallbackQueryHandle(ctx context.Context, bot *telegram.Bot, callbackQuery telegram.CallbackQuery) error {
	var memoID int32
	var visibility store.Visibility
	n, err := fmt.Sscanf(callbackQuery.Data, "%s %d", &visibility, &memoID)
	if err != nil || n != 2 {
		return bot.AnswerCallbackQuery(ctx, callbackQuery.ID, fmt.Sprintf("Failed to parse callbackQuery.Data %s", callbackQuery.Data))
	}

	memo, err := t.store.GetMemo(ctx, &store.FindMemo{
		ID: &memoID,
	})
	if err != nil {
		return bot.AnswerCallbackQuery(ctx, callbackQuery.ID, fmt.Sprintf("Failed to call FindMemo %s", err))
	}
	if memo == nil {
		_, err = bot.EditMessage(ctx, callbackQuery.Message.Chat.ID, callbackQuery.Message.MessageID, fmt.Sprintf("Memo %d not found", memoID), nil)
		if err != nil {
			return bot.AnswerCallbackQuery(ctx, callbackQuery.ID, fmt.Sprintf("Failed to EditMessage %s", err))
		}
		return bot.AnswerCallbackQuery(ctx, callbackQuery.ID, fmt.Sprintf("Memo %d not found, possibly deleted elsewhere", memoID))
	}

	workspaceMemoRelatedSetting, err := t.store.GetWorkspaceMemoRelatedSetting(ctx)
	if err != nil {
		return bot.AnswerCallbackQuery(ctx, callbackQuery.ID, fmt.Sprintf("Failed to get workspace setting %s", err))
	}
	if workspaceMemoRelatedSetting.DisallowPublicVisible && visibility == store.Public {
		return bot.AnswerCallbackQuery(ctx, callbackQuery.ID, fmt.Sprintf("Failed to changing Memo %d to %s\n(workspace disallowed public memo)", memoID, visibility))
	}

	update := store.UpdateMemo{
		ID:         memoID,
		Visibility: &visibility,
	}
	err = t.store.UpdateMemo(ctx, &update)
	if err != nil {
		return bot.AnswerCallbackQuery(ctx, callbackQuery.ID, fmt.Sprintf("Failed to call UpdateMemo %s", err))
	}

	keyboard := generateKeyboardForMemoID(memoID)
	_, err = bot.EditMessage(ctx, callbackQuery.Message.Chat.ID, callbackQuery.Message.MessageID, fmt.Sprintf("Saved as %s Memo %d", visibility, memoID), keyboard)
	if err != nil {
		return bot.AnswerCallbackQuery(ctx, callbackQuery.ID, fmt.Sprintf("Failed to EditMessage %s", err))
	}

	err = bot.AnswerCallbackQuery(ctx, callbackQuery.ID, fmt.Sprintf("Success changing Memo %d to %s", memoID, visibility))

	memo, webhookErr := t.store.GetMemo(ctx, &store.FindMemo{
		ID: &memoID,
	})
	if webhookErr == nil {
		_ = t.dispatchMemoRelatedWebhook(ctx, *memo, "memos.memo.updated")
	}
	return err
}

func generateKeyboardForMemoID(id int32) [][]telegram.InlineKeyboardButton {
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

func convertToMarkdown(text string, messageEntities []telegram.MessageEntity) string {
	insertions := make(map[int]string)

	for _, e := range messageEntities {
		var before, after string

		// this is supported by the current markdown
		switch e.Type {
		case telegram.Bold:
			before = "**"
			after = "**"
		case telegram.Italic:
			before = "*"
			after = "*"
		case telegram.Strikethrough:
			before = "~~"
			after = "~~"
		case telegram.Code:
			before = "`"
			after = "`"
		case telegram.Pre:
			before = "```" + e.Language
			after = "```"
		case telegram.TextLink:
			before = "["
			after = fmt.Sprintf(`](%s)`, e.URL)
		case telegram.Spoiler:
			before = "||"
			after = "||"
		}

		if before != "" {
			insertions[e.Offset] += before
			insertions[e.Offset+e.Length] = after + insertions[e.Offset+e.Length]
		}
	}

	input := []rune(text)
	var output []rune
	utf16pos := 0

	for i := 0; i < len(input); i++ {
		output = append(output, []rune(insertions[utf16pos])...)
		output = append(output, input[i])
		utf16pos += len(utf16.Encode([]rune{input[i]}))
	}
	output = append(output, []rune(insertions[utf16pos])...)

	return string(output)
}

func (t *TelegramHandler) dispatchMemoRelatedWebhook(ctx context.Context, memo store.Memo, activityType string) error {
	webhooks, err := t.store.ListWebhooks(ctx, &store.FindWebhook{
		CreatorID: &memo.CreatorID,
	})
	if err != nil {
		return err
	}
	for _, hook := range webhooks {
		payload := t.convertMemoToWebhookPayload(ctx, memo)
		payload.ActivityType = activityType
		payload.URL = hook.Url
		err := webhook.Post(*payload)
		if err != nil {
			return errors.Wrap(err, "failed to post webhook")
		}
	}
	return nil
}

func (t *TelegramHandler) convertMemoToWebhookPayload(ctx context.Context, memo store.Memo) (payload *webhook.WebhookPayload) {
	payload = &webhook.WebhookPayload{
		CreatorID: memo.CreatorID,
		CreatedTs: time.Now().Unix(),
		Memo: &webhook.Memo{
			ID:           memo.ID,
			CreatorID:    memo.CreatorID,
			CreatedTs:    memo.CreatedTs,
			UpdatedTs:    memo.UpdatedTs,
			Content:      memo.Content,
			Visibility:   memo.Visibility.String(),
			Pinned:       memo.Pinned,
			ResourceList: make([]*webhook.Resource, 0),
			RelationList: make([]*webhook.MemoRelation, 0),
		},
	}

	resourceList, err := t.store.ListResources(ctx, &store.FindResource{
		MemoID: &memo.ID,
	})

	if err != nil {
		return payload
	}
	for _, resource := range resourceList {
		payload.Memo.ResourceList = append(payload.Memo.ResourceList, &webhook.Resource{
			ID:           resource.ID,
			CreatorID:    resource.CreatorID,
			CreatedTs:    resource.CreatedTs,
			UpdatedTs:    resource.UpdatedTs,
			Filename:     resource.Filename,
			Type:         resource.Type,
			Size:         resource.Size,
			InternalPath: resource.InternalPath,
			ExternalLink: resource.ExternalLink,
		})
	}

	relationList, err := t.store.ListMemoRelations(ctx, &store.FindMemoRelation{
		MemoID: &memo.ID,
	})

	if err != nil {
		return payload
	}

	for _, relation := range relationList {
		payload.Memo.RelationList = append(payload.Memo.RelationList, &webhook.MemoRelation{
			MemoID:        relation.MemoID,
			RelatedMemoID: relation.RelatedMemoID,
			Type:          string(relation.Type),
		})
	}
	return payload
}
