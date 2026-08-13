package v1

import (
	"context"
	"strings"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	markdownparser "github.com/usememos/memos/internal/markdown/parser"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/server/runner/memopayload"
	"github.com/usememos/memos/store"
)

// renameMemoTagBatchSize bounds how many memos are loaded per processing
// batch so renaming stays memory-bounded for users with thousands of memos.
const renameMemoTagBatchSize = 100

// RenameMemoTag renames a tag across all memos owned by the authenticated
// user, including archived memos and comments. It returns the number of
// memos that were changed.
func (s *APIV1Service) RenameMemoTag(ctx context.Context, request *v1pb.RenameMemoTagRequest) (*v1pb.RenameMemoTagResponse, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	oldTag, err := validateMemoTagName(request.GetOldTag(), "old_tag")
	if err != nil {
		return nil, err
	}
	newTag, err := validateMemoTagName(request.GetNewTag(), "new_tag")
	if err != nil {
		return nil, err
	}
	if oldTag == newTag {
		return nil, status.Errorf(codes.InvalidArgument, "old_tag and new_tag must be different")
	}

	contentLengthLimit, err := s.getContentLengthLimit(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get content length limit")
	}

	updatedCount := int32(0)
	offset := 0
	for {
		if err := ctx.Err(); err != nil {
			return nil, status.FromContextError(err).Err()
		}

		limit := renameMemoTagBatchSize
		currentOffset := offset
		// Order the scan by stable columns (created_ts, id) that this rename
		// never modifies, so offset pagination cannot skip rows as matching
		// memos are updated.
		memos, err := s.Store.ListMemos(ctx, &store.FindMemo{
			CreatorID: &user.ID,
			Limit:     &limit,
			Offset:    &currentOffset,
		})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to list memos: %v", err)
		}
		if len(memos) == 0 {
			break
		}

		for _, memo := range memos {
			if err := ctx.Err(); err != nil {
				return nil, status.FromContextError(err).Err()
			}

			newContent, err := s.MarkdownService.RenameTag([]byte(memo.Content), oldTag, newTag)
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to rename tag in memo %q: %v", memo.UID, err)
			}
			if newContent == memo.Content {
				continue
			}
			if len(newContent) > contentLengthLimit {
				return nil, status.Errorf(codes.InvalidArgument,
					"renaming tag in memo %q would exceed the content length limit (%d characters)", memo.UID, contentLengthLimit)
			}

			memo.Content = newContent
			if err := memopayload.RebuildMemoPayload(ctx, memo, s.MarkdownService); err != nil {
				return nil, status.Errorf(codes.Internal, "failed to rebuild memo payload: %v", err)
			}
			if err := s.Store.UpdateMemo(ctx, &store.UpdateMemo{
				ID:      memo.ID,
				Content: &memo.Content,
				Payload: memo.Payload,
			}); err != nil {
				return nil, status.Errorf(codes.Internal, "failed to update memo: %v", err)
			}
			updatedCount++
		}

		offset += len(memos)
		if len(memos) < limit {
			break
		}
	}

	return &v1pb.RenameMemoTagResponse{UpdatedMemoCount: updatedCount}, nil
}

// validateMemoTagName validates a tag name provided without the leading '#'.
func validateMemoTagName(name, field string) (string, error) {
	if name == "" {
		return "", status.Errorf(codes.InvalidArgument, "%s must not be empty", field)
	}
	if name != strings.TrimSpace(name) {
		return "", status.Errorf(codes.InvalidArgument, "%s must not contain leading or trailing whitespace", field)
	}
	if strings.HasPrefix(name, "#") {
		return "", status.Errorf(codes.InvalidArgument, "%s must not start with '#'", field)
	}
	source := []byte("#" + name)
	matches := markdownparser.FindTagMatches(source)
	if len(matches) != 1 || matches[0].Start != 0 || matches[0].End != len(source) || string(matches[0].Value) != name {
		return "", status.Errorf(codes.InvalidArgument, "%s is not a valid tag name", field)
	}
	return name, nil
}
