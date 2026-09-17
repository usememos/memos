package v1

import (
	"context"
	"strings"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/usememos/memos/store"
)

const (
	// DefaultChatContextBudgetTokens caps injected note content when the chat
	// config does not set a budget. It is deliberately conservative: the token
	// estimate is a character-ratio heuristic, not real tokenization, so a
	// generous margin keeps a wrong estimate from becoming a provider error.
	DefaultChatContextBudgetTokens = 32000

	// charsPerToken approximates how many characters make one token. It is a
	// heuristic; see DefaultChatContextBudgetTokens for why that is acceptable.
	charsPerToken = 4

	// maxChatContextMemos bounds how many notes are injected in one turn. A
	// selection can be within budget and still be thousands of tiny notes, which
	// would produce an unusable prompt and an enormous request.
	maxChatContextMemos = 500

	// maxChatFilterLength bounds the accepted CEL filter text.
	maxChatFilterLength = 4096
)

// chatContext is the note content selected for one chat turn, with the receipt
// describing what was included.
type chatContext struct {
	// prompt is the rendered note content injected into the system message.
	prompt string
	// memoCount is how many notes were injected.
	memoCount int64
	// totalChars is the character count of the injected content.
	totalChars int64
	// estimatedTokens is totalChars converted through charsPerToken.
	estimatedTokens int64
	// budgetTokens is the budget the selection was measured against.
	budgetTokens int64
}

// estimateChatContext resolves a filter to its token cost without building a
// prompt, so the Hub can refuse an over-budget selection before sending.
func (s *APIV1Service) estimateChatContext(ctx context.Context, filterText string, budgetTokens int64) (*chatContext, error) {
	accessScope, currentUser, err := s.resolveMemoAccessScope(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "%v", err)
	}
	if currentUser == nil {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	selected, err := s.resolveChatContextMemos(ctx, filterText, accessScope, currentUser)
	if err != nil {
		return nil, err
	}

	var totalChars int64
	for _, memo := range selected {
		totalChars += int64(len(memo.Content))
	}
	return &chatContext{
		memoCount:       int64(len(selected)),
		totalChars:      totalChars,
		estimatedTokens: estimateTokens(totalChars),
		budgetTokens:    budgetTokens,
	}, nil
}

// resolveChatContextMemos runs the selection filter under the caller's memo
// access scope. Reusing the scope and the filter validator from ListMemos means
// the model can never read a note the caller could not already read.
func (s *APIV1Service) resolveChatContextMemos(
	ctx context.Context,
	filterText string,
	accessScope *store.MemoAccessScope,
	currentUser *store.User,
) ([]*store.Memo, error) {
	filterText = strings.TrimSpace(filterText)
	if filterText == "" {
		// An empty filter selects nothing. Defaulting to "all notes" would make
		// an accidental empty selection upload the user's whole corpus.
		return nil, nil
	}
	if len(filterText) > maxChatFilterLength {
		return nil, status.Errorf(codes.InvalidArgument, "filter is too long; maximum length is %d characters", maxChatFilterLength)
	}
	if err := s.validateMemoFilterForUser(ctx, filterText, currentUser); err != nil {
		return nil, err
	}

	state := store.Normal
	// Fetch one more than the cap so an oversized selection is detected rather
	// than silently truncated: a receipt that quietly dropped notes would
	// misreport what the model actually read.
	limit := maxChatContextMemos + 1
	memoFind := &store.FindMemo{
		// Comments are not notes; including them would bury real content.
		ExcludeComments: true,
		RowStatus:       &state,
		Access:          accessScope,
		Filters:         []string{filterText},
		Limit:           &limit,
	}
	memos, err := s.Store.ListMemos(ctx, memoFind)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to resolve chat context: %v", err)
	}
	if len(memos) > maxChatContextMemos {
		return nil, status.Errorf(
			codes.FailedPrecondition,
			"selection matches more than %d notes; narrow the selection",
			maxChatContextMemos,
		)
	}
	return memos, nil
}

// estimateTokens converts a character count into an approximate token count.
func estimateTokens(chars int64) int64 {
	if chars <= 0 {
		return 0
	}
	return (chars + charsPerToken - 1) / charsPerToken
}

// buildChatContextPrompt renders the selected notes into the prompt section the
// model reads. Notes are delimited so the model can tell them apart.
func buildChatContextPrompt(memos []*store.Memo) string {
	if len(memos) == 0 {
		return ""
	}
	var builder strings.Builder
	builder.WriteString("The user's notes follow. Treat them as the only source of truth about the user's own notes.\n")
	for _, memo := range memos {
		builder.WriteString("\n--- note ---\n")
		if memo.UID != "" {
			builder.WriteString("id: memos/")
			builder.WriteString(memo.UID)
			builder.WriteString("\n")
		}
		builder.WriteString(strings.TrimSpace(memo.Content))
		builder.WriteString("\n")
	}
	builder.WriteString("\n--- end of notes ---\n")
	return builder.String()
}

// overBudgetError explains a refused selection in terms the user can act on.
func overBudgetError(selection *chatContext) error {
	return status.Errorf(
		codes.FailedPrecondition,
		"selection is too large: %d note(s), about %d tokens, over the %d token budget; narrow the selection",
		selection.memoCount, selection.estimatedTokens, selection.budgetTokens,
	)
}
