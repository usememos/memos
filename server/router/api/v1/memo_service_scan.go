package v1

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"strconv"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

type memoScanRequest struct {
	Operation string
	CallerID  int32
	PageSize  int
	PageToken string
}

type memoScanToken struct {
	Version int    `json:"v"`
	AfterID int32  `json:"after"`
	MaxID   int32  `json:"max"`
	Binding string `json:"binding"`
}

func (s *APIV1Service) refreshMemosPage(ctx context.Context, userID int32, req *v1pb.RefreshMemoLinkCoversRequest) ([]*store.Memo, string, error) {
	limit := refreshLinkCoversMemosPerPage
	if req.PageSize > 0 && req.PageSize <= 500 {
		limit = int(req.PageSize)
	}
	find := &store.FindMemo{CreatorID: &userID, Filters: []string{"has_link"}}
	// Existing in-flight clients may finish their legacy offset scan.
	if offset, err := strconv.Atoi(req.PageToken); req.PageToken != "" && err == nil {
		if offset < 0 || offset > int(^uint(0)>>1)-500 {
			return nil, "", status.Errorf(codes.InvalidArgument, "invalid page token")
		}
		find.Offset, find.Limit = &offset, &limit
		memos, err := s.Store.ListMemos(ctx, find)
		if err != nil {
			return nil, "", status.Errorf(codes.Internal, "failed to list memos")
		}
		next := ""
		if len(memos) == limit {
			next = strconv.Itoa(offset + limit)
		}
		return memos, next, nil
	}
	return s.scanMemos(ctx, find, memoScanRequest{Operation: "refresh", CallerID: userID, PageSize: limit, PageToken: req.PageToken})
}

func (s *APIV1Service) scanMemos(ctx context.Context, find *store.FindMemo, request memoScanRequest) ([]*store.Memo, string, error) {
	if err := ctx.Err(); err != nil {
		return nil, "", status.FromContextError(err).Err()
	}
	if request.PageSize < 1 || request.PageSize > MaxPageSize {
		return nil, "", status.Errorf(codes.InvalidArgument, "invalid scan page size")
	}
	bindingInput := struct {
		Operation       string
		CallerID        int32
		CreatorID       *int32
		State           *store.RowStatus
		Filters         []string
		ExcludeComments bool
		PageSize        int
	}{request.Operation, request.CallerID, find.CreatorID, find.RowStatus, find.Filters, find.ExcludeComments, request.PageSize}
	bindingBytes, err := json.Marshal(bindingInput)
	if err != nil {
		return nil, "", status.Errorf(codes.Internal, "failed to encode scan scope")
	}
	hash := sha256.Sum256(bindingBytes)
	token := memoScanToken{Version: 1, Binding: hex.EncodeToString(hash[:])}
	query := *find
	query.Offset = nil
	query.AfterID, query.MaxID = nil, nil
	if request.PageToken != "" {
		if len(request.PageToken) > 1024 {
			return nil, "", status.Errorf(codes.InvalidArgument, "invalid scan page token")
		}
		var supplied memoScanToken
		encoded, decodeErr := base64.RawURLEncoding.DecodeString(request.PageToken)
		if decodeErr != nil || json.Unmarshal(encoded, &supplied) != nil ||
			supplied.Version != 1 || supplied.Binding != token.Binding || supplied.AfterID < 0 || supplied.MaxID < supplied.AfterID {
			return nil, "", status.Errorf(codes.InvalidArgument, "invalid scan page token")
		}
		token = supplied
	} else {
		one := 1
		query.Limit, query.OrderByIDAsc = &one, proto.Bool(false)
		query.ExcludeContent = true
		last, err := s.Store.ListMemos(ctx, &query)
		if err != nil {
			return nil, "", status.Errorf(codes.Internal, "failed to find scan boundary")
		}
		if len(last) == 0 {
			return []*store.Memo{}, "", nil
		}
		token.MaxID = last[0].ID
	}
	limitPlusOne := request.PageSize + 1
	query.ExcludeContent = find.ExcludeContent
	query.Limit, query.OrderByIDAsc = &limitPlusOne, proto.Bool(true)
	query.AfterID, query.MaxID = &token.AfterID, &token.MaxID
	memos, err := s.Store.ListMemos(ctx, &query)
	if err != nil {
		return nil, "", status.Errorf(codes.Internal, "failed to scan memos")
	}
	if len(memos) <= request.PageSize {
		return memos, "", nil
	}
	memos = memos[:request.PageSize]
	token.AfterID = memos[len(memos)-1].ID
	encoded, err := json.Marshal(token)
	if err != nil {
		return nil, "", status.Errorf(codes.Internal, "failed to encode scan token")
	}
	return memos, base64.RawURLEncoding.EncodeToString(encoded), nil
}

func (s *APIV1Service) listMemosPage(ctx context.Context, find *store.FindMemo, request *v1pb.ListMemosRequest, callerID int32) ([]*store.Memo, string, error) {
	if find.OrderByIDAsc != nil {
		return s.scanMemos(ctx, find, memoScanRequest{
			Operation: "list", CallerID: callerID, PageSize: normalizePageSize(request.PageSize), PageToken: request.PageToken,
		})
	}
	var limit, offset int
	if request.PageToken != "" {
		var token v1pb.PageToken
		if err := unmarshalPageToken(request.PageToken, &token); err != nil {
			return nil, "", status.Errorf(codes.InvalidArgument, "invalid page token")
		}
		limit, offset = normalizePageSize(token.Limit), max(int(token.Offset), 0)
	} else {
		limit = normalizePageSize(request.PageSize)
	}
	limit = min(limit, MaxPageSize)
	limitPlusOne := limit + 1
	find.Limit, find.Offset = &limitPlusOne, &offset
	memos, err := s.Store.ListMemos(ctx, find)
	if err != nil {
		return nil, "", status.Errorf(codes.Internal, "failed to list memos")
	}
	if len(memos) <= limit {
		return memos, "", nil
	}
	token, err := getPageToken(limit, offset+limit)
	if err != nil {
		return nil, "", status.Errorf(codes.Internal, "failed to encode page token")
	}
	return memos[:limit], token, nil
}
