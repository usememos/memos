package mcp

import (
	"context"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

// checkMemoAccess returns an error if the caller cannot read the memo.
// userID == 0 means anonymous.
func checkMemoAccess(memo *store.Memo, userID int32) error {
	if memo.RowStatus == store.Archived && memo.CreatorID != userID {
		return errors.New("permission denied")
	}

	switch memo.Visibility {
	case store.Protected:
		if userID == 0 {
			return errors.New("permission denied")
		}
	case store.Private:
		if memo.CreatorID != userID {
			return errors.New("permission denied")
		}
	default:
		// store.Public and any unknown visibility: allow.
	}
	return nil
}

func checkMemoOwnership(memo *store.Memo, userID int32) error {
	if memo.CreatorID != userID {
		return errors.New("permission denied")
	}
	return nil
}

func hasMemoOwnership(memo *store.Memo, userID int32) bool {
	return memo.CreatorID == userID
}

// applyVisibilityFilter restricts find to memos the caller may see.
func applyVisibilityFilter(find *store.FindMemo, userID int32, rowStatus *store.RowStatus) {
	if rowStatus != nil && *rowStatus == store.Archived {
		if userID == 0 {
			impossibleCreatorID := int32(-1)
			find.CreatorID = &impossibleCreatorID
			return
		}
		find.CreatorID = &userID
		return
	}
	if userID == 0 {
		find.VisibilityList = []store.Visibility{store.Public}
		return
	}
	find.Filters = append(find.Filters, "creator_id == "+itoa32(userID)+` || visibility in ["PUBLIC", "PROTECTED"]`)
}

func (s *MCPService) checkAttachmentAccess(ctx context.Context, attachment *store.Attachment, userID int32) error {
	if attachment.CreatorID == userID {
		return nil
	}
	if attachment.MemoID == nil {
		return errors.New("permission denied")
	}

	memo, err := s.store.GetMemo(ctx, &store.FindMemo{ID: attachment.MemoID})
	if err != nil {
		return errors.Wrap(err, "failed to get linked memo")
	}
	if memo == nil {
		return errors.New("linked memo not found")
	}
	return checkMemoAccess(memo, userID)
}

func (s *MCPService) isAllowedOrigin(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true
	}

	originURL, err := url.Parse(origin)
	if err != nil || originURL.Scheme == "" || originURL.Host == "" {
		return false
	}

	if sameOriginHost(originURL.Host, r.Host) {
		return true
	}

	if s.profile.InstanceURL == "" {
		return false
	}

	instanceURL, err := url.Parse(s.profile.InstanceURL)
	if err != nil || instanceURL.Scheme == "" || instanceURL.Host == "" {
		return false
	}

	return strings.EqualFold(originURL.Scheme, instanceURL.Scheme) && sameOriginHost(originURL.Host, instanceURL.Host)
}

func sameOriginHost(a, b string) bool {
	return strings.EqualFold(a, b)
}

func itoa32(v int32) string {
	return strconv.FormatInt(int64(v), 10)
}
