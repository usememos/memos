package v1

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/pkg/errors"

	"github.com/usememos/memos/core/memopayload"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/provider/ai"
	"github.com/usememos/memos/provider/ai/chat"
	chatgemini "github.com/usememos/memos/provider/ai/chat/gemini"
	chatopenai "github.com/usememos/memos/provider/ai/chat/openai"
	"github.com/usememos/memos/store"
)

const (
	// assistantReviewQueueSize bounds queued reviews. Bursts beyond this are
	// dropped rather than delaying memo creation or growing without limit.
	assistantReviewQueueSize = 64
	// assistantReviewWorkers bounds concurrent provider calls.
	assistantReviewWorkers = 2
	// assistantReviewTimeout bounds one end-to-end review.
	assistantReviewTimeout = 3 * time.Minute
	// maxAssistantContextChars bounds the background memos sent to the model.
	maxAssistantContextChars = 8000
	// maxAssistantMemoChars bounds a single memo inside the prompt.
	maxAssistantMemoChars = 2000
	// assistantResponseMaxTokens bounds the model response length.
	assistantResponseMaxTokens = 1200

	// defaultAssistantPrompt is used when an assistant has no custom prompt.
	defaultAssistantPrompt = `You are a thoughtful reading partner for someone's personal notes.
Read the new note and reply in the same language the note is written in.
Offer one concrete observation about the note, then one open question that helps the author think further.
Be concise: at most 120 words, plain prose, no headings and no bullet lists.`
)

// assistantReviewDispatcher owns the lazily started review worker pool.
type assistantReviewDispatcher struct {
	once  sync.Once
	queue chan assistantReviewJob
}

// assistantReviewJob identifies a memo awaiting review. Only the ID travels
// through the queue so the worker always reads the current row.
type assistantReviewJob struct {
	memoID int32
}

// dispatchAssistantReviewBestEffort queues an automatic review for a new memo.
// It never blocks memo creation and never returns an error to the caller.
func (s *APIV1Service) dispatchAssistantReviewBestEffort(ctx context.Context, memo *store.Memo) {
	if memo == nil {
		return
	}
	aiSetting, err := s.Store.GetInstanceAISetting(ctx)
	if err != nil {
		slog.Warn("Failed to read AI setting for assistant review", slog.Any("err", err))
		return
	}
	// Route here as well as in the worker so an instance with the feature off,
	// or a memo no assistant handles, costs nothing beyond this cached read.
	if routeAssistantForTags(aiSetting.GetAssistants(), memo.Payload.GetTags()) == nil {
		return
	}

	s.assistantReview.once.Do(s.startAssistantReviewWorkers)
	select {
	case s.assistantReview.queue <- assistantReviewJob{memoID: memo.ID}:
	default:
		slog.Warn("AI assistant review queue is full; skipping memo",
			slog.Int64("memo_id", int64(memo.ID)))
	}
}

func (s *APIV1Service) startAssistantReviewWorkers() {
	s.assistantReview.queue = make(chan assistantReviewJob, assistantReviewQueueSize)
	for range assistantReviewWorkers {
		go func() {
			for job := range s.assistantReview.queue {
				s.runAssistantReview(job)
			}
		}()
	}
}

func (s *APIV1Service) runAssistantReview(job assistantReviewJob) {
	// The originating request context is already canceled by now, so the review
	// runs on its own deadline.
	ctx, cancel := context.WithTimeout(context.Background(), assistantReviewTimeout)
	defer cancel()

	if err := s.reviewMemoWithAssistant(ctx, job.memoID); err != nil {
		slog.Warn("Failed to run AI assistant review",
			slog.Int64("memo_id", int64(job.memoID)), slog.Any("err", err))
	}
}

func (s *APIV1Service) reviewMemoWithAssistant(ctx context.Context, memoID int32) error {
	memo, err := s.Store.GetMemo(ctx, &store.FindMemo{ID: &memoID})
	if err != nil {
		return errors.Wrap(err, "failed to load memo")
	}
	// The memo may have been deleted or archived while queued.
	if memo == nil || memo.RowStatus != store.Normal {
		return nil
	}

	aiSetting, err := s.Store.GetInstanceAISetting(ctx)
	if err != nil {
		return errors.Wrap(err, "failed to read AI setting")
	}
	route := routeAssistantForTags(aiSetting.GetAssistants(), memo.Payload.GetTags())
	if route == nil {
		return nil
	}
	assistant := route.assistant

	provider, err := resolveAssistantProvider(aiSetting, assistant)
	if err != nil {
		return err
	}
	model, err := resolveAssistantModel(assistant, provider.Type)
	if err != nil {
		return err
	}
	botUser, err := s.resolveAssistantBotUser(ctx, assistant)
	if err != nil {
		return err
	}
	// A bot must never review its own output, which would loop forever.
	if memo.CreatorID == botUser.ID {
		return nil
	}

	contextMemos, err := s.loadAssistantContextMemos(ctx, memo, assistant, route.matchedTag)
	if err != nil {
		return errors.Wrap(err, "failed to load context memos")
	}

	completer, err := newAssistantCompleter(provider)
	if err != nil {
		return err
	}
	prompt := assistant.GetPrompt()
	if strings.TrimSpace(prompt) == "" {
		prompt = defaultAssistantPrompt
	}
	response, err := completer.Complete(ctx, chat.Request{
		Model:        model,
		Instructions: prompt,
		Input:        buildAssistantInput(memo, contextMemos),
		MaxTokens:    assistantResponseMaxTokens,
	})
	if err != nil {
		return errors.Wrap(err, "failed to generate assistant review")
	}
	text := strings.TrimSpace(response.Text)
	if text == "" {
		return errors.New("assistant review response was empty")
	}

	return s.createAssistantComment(ctx, botUser, memo, text)
}

func resolveAssistantProvider(
	setting *storepb.InstanceAISetting,
	assistant *storepb.AIAssistantConfig,
) (ai.ProviderConfig, error) {
	providers := make([]ai.ProviderConfig, 0, len(setting.GetProviders()))
	for _, provider := range setting.GetProviders() {
		if provider == nil {
			continue
		}
		providers = append(providers, convertAIProviderConfigFromStore(provider))
	}
	provider, err := ai.FindProvider(providers, assistant.GetProviderId())
	if err != nil {
		return ai.ProviderConfig{}, errors.Wrapf(err, "assistant %q provider is not configured", assistant.GetTitle())
	}
	return *provider, nil
}

func resolveAssistantModel(assistant *storepb.AIAssistantConfig, providerType ai.ProviderType) (string, error) {
	if model := strings.TrimSpace(assistant.GetModel()); model != "" {
		return model, nil
	}
	return ai.DefaultChatModel(providerType)
}

func newAssistantCompleter(provider ai.ProviderConfig) (chat.Completer, error) {
	options := chat.ApplyOptions(nil)
	switch provider.Type {
	case ai.ProviderOpenAI:
		return chatopenai.New(provider, options)
	case ai.ProviderGemini:
		return chatgemini.New(provider, options)
	default:
		return nil, errors.Wrapf(ai.ErrChatNotSupported, "provider type %q", provider.Type)
	}
}

// resolveAssistantBotUser returns the account that authors this assistant's
// comments, provisioning it if the stored reference has gone stale.
func (s *APIV1Service) resolveAssistantBotUser(
	ctx context.Context,
	assistant *storepb.AIAssistantConfig,
) (*store.User, error) {
	if botUserID := assistant.GetBotUserId(); botUserID > 0 {
		botUser, err := s.Store.GetUser(ctx, &store.FindUser{ID: &botUserID})
		if err != nil {
			return nil, errors.Wrap(err, "failed to load assistant bot account")
		}
		if botUser != nil && botUser.RowStatus == store.Normal {
			return botUser, nil
		}
	}

	// The account was removed or was never provisioned (for example, the
	// assistant was enabled by an older build). Recreate it on demand.
	if err := s.ensureAssistantBotUser(ctx, assistant); err != nil {
		return nil, err
	}
	botUserID := assistant.GetBotUserId()
	botUser, err := s.Store.GetUser(ctx, &store.FindUser{ID: &botUserID})
	if err != nil {
		return nil, errors.Wrap(err, "failed to load assistant bot account")
	}
	if botUser == nil {
		return nil, errors.Errorf("assistant %q has no bot account", assistant.GetTitle())
	}
	return botUser, nil
}

// loadAssistantContextMemos returns the author's background memos for the
// configured scope, excluding the memo under review.
func (s *APIV1Service) loadAssistantContextMemos(
	ctx context.Context,
	memo *store.Memo,
	assistant *storepb.AIAssistantConfig,
	matchedTag string,
) ([]*store.Memo, error) {
	scope := assistant.GetContextScope()
	if scope == storepb.AIAssistantContextScope_CURRENT_MEMO_ONLY {
		return nil, nil
	}
	limit := int(assistant.GetContextLimit())
	if limit <= 0 {
		return nil, nil
	}

	find := &store.FindMemo{
		CreatorID:       &memo.CreatorID,
		RowStatus:       rowStatusPtr(store.Normal),
		ExcludeComments: true,
		// Fetch one extra row so removing the memo under review still leaves a
		// full page of background.
		Limit: intPtr(limit + 1),
	}
	if scope == storepb.AIAssistantContextScope_SAME_TAG_MEMOS {
		if matchedTag == "" {
			return nil, nil
		}
		find.Filters = []string{fmt.Sprintf("tag in [%q]", matchedTag)}
	}

	memos, err := s.Store.ListMemos(ctx, find)
	if err != nil {
		return nil, err
	}

	contextMemos := make([]*store.Memo, 0, limit)
	for _, candidate := range memos {
		if candidate == nil || candidate.ID == memo.ID {
			continue
		}
		contextMemos = append(contextMemos, candidate)
		if len(contextMemos) == limit {
			break
		}
	}
	return contextMemos, nil
}

// buildAssistantInput renders the user payload sent alongside the assistant's
// system prompt. Structural labels stay in English so they read the same to
// every model; the prompt decides the reply language.
func buildAssistantInput(memo *store.Memo, contextMemos []*store.Memo) string {
	var builder strings.Builder
	builder.WriteString("# New note\n\n")
	builder.WriteString(truncateRunes(memo.Content, maxAssistantMemoChars))

	if len(contextMemos) == 0 {
		return builder.String()
	}

	builder.WriteString("\n\n# Earlier notes for context (most recent first)\n")
	remaining := maxAssistantContextChars
	for index, contextMemo := range contextMemos {
		content := strings.TrimSpace(truncateRunes(contextMemo.Content, maxAssistantMemoChars))
		if content == "" {
			continue
		}
		if len(content) > remaining {
			break
		}
		remaining -= len(content)
		fmt.Fprintf(&builder, "\n%d. %s\n", index+1, content)
	}
	return builder.String()
}

func truncateRunes(value string, limit int) string {
	runes := []rune(value)
	if len(runes) <= limit {
		return value
	}
	return string(runes[:limit]) + "…"
}

// createAssistantComment stores the review as a comment authored by the bot.
func (s *APIV1Service) createAssistantComment(
	ctx context.Context,
	botUser *store.User,
	relatedMemo *store.Memo,
	content string,
) error {
	uid, err := ValidateAndGenerateUID("")
	if err != nil {
		return errors.Wrap(err, "failed to generate comment UID")
	}
	comment := &store.Memo{
		UID:       uid,
		CreatorID: botUser.ID,
		Content:   content,
		// Inherit placement so a review is never more visible than its memo.
		Visibility: relatedMemo.Visibility,
		SpaceID:    relatedMemo.SpaceID,
	}
	if err := memopayload.RebuildMemoPayload(ctx, comment, s.MarkdownService); err != nil {
		return errors.Wrap(err, "failed to build comment payload")
	}
	// Drop any tag the model happened to write. Indexing them would let an
	// assistant invent entries in the author's tag list.
	comment.Payload.Tags = nil

	if err := s.createMemoWithMutation(ctx, botUser, comment, &relatedMemo.ID, nil, nil, nil); err != nil {
		return errors.Wrap(err, "failed to create assistant comment")
	}
	s.SSEHub.publishMemoChanged()
	return nil
}

func rowStatusPtr(status store.RowStatus) *store.RowStatus {
	return &status
}

func intPtr(value int) *int {
	return &value
}
