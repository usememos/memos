package api

import (
	"context"
	"slices"
	"strings"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/usememos/memos/internal/ratelimit"
	"github.com/usememos/memos/markdown/parser"
	apipb "github.com/usememos/memos/proto/gen/api"
	"github.com/usememos/memos/provider/ai"
)

// SuggestTags recommends existing or new tags for a memo draft.
func (s *APIService) SuggestTags(ctx context.Context, req *apipb.SuggestTagsRequest) (*apipb.SuggestTagsResponse, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	if strings.TrimSpace(req.Content) == "" || len(req.Content) > 64*1024 {
		return nil, status.Errorf(codes.InvalidArgument, "provide a nonempty draft of at most 64 KiB")
	}
	if len(req.CandidateTags) > 64 {
		return nil, status.Errorf(codes.InvalidArgument, "provide at most 64 candidate tags")
	}
	setting, err := s.Store.GetInstanceAISetting(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get AI settings")
	}
	cfg := setting.GetTextGeneration()
	if cfg.GetProviderId() == "" || cfg.GetModel() == "" {
		return nil, status.Errorf(codes.FailedPrecondition, "text generation is not configured")
	}
	provider, err := s.resolveAIProvider(setting, cfg.ProviderId)
	if err != nil {
		return nil, err
	}
	existing, err := s.MarkdownService.ExtractTags([]byte(req.Content))
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid Markdown draft")
	}
	// A candidate the tag grammar rejects is dropped rather than refused, so one
	// odd tag in a caller's vocabulary does not cost them every suggestion.
	candidates := make([]string, 0, len(req.CandidateTags))
	for _, tag := range req.CandidateTags {
		if validSuggestionTag(tag) && !slices.Contains(existing, tag) && !slices.Contains(candidates, tag) {
			candidates = append(candidates, tag)
		}
	}
	// Charged last, so only a request that reaches the provider spends the budget.
	if err := s.throttleAndCharge(ratelimit.ScopeSuggestTagsUser, userKey(user.ID), 1); err != nil {
		return nil, err
	}
	tags, err := ai.SuggestTags(ctx, provider, cfg.Model, req.Content, candidates)
	if err != nil {
		if ctx.Err() != nil {
			return nil, status.FromContextError(ctx.Err()).Err()
		}
		// The caller gets a fixed message and a reason; the cause goes to the log.
		failure := ai.ClassifyFailure(err)
		logAIFailure("suggest_tags", provider, cfg.Model, failure)
		return nil, newAIFailureError("failed to suggest tags: ", failure)
	}
	tags = slices.DeleteFunc(tags, func(tag string) bool {
		return !validSuggestionTag(tag) || slices.Contains(existing, tag)
	})
	return &apipb.SuggestTagsResponse{Tags: tags}, nil
}

func validSuggestionTag(tag string) bool {
	if len(tag) == 0 || len(tag) > 256 {
		return false
	}
	source := []byte("#" + tag)
	matches := parser.FindTagMatches(source)
	return len(matches) == 1 && matches[0].Start == 0 && matches[0].End == len(source) && string(matches[0].Value) == tag
}
