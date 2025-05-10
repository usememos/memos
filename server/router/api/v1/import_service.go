package v1

import (
	"context"
	"encoding/binary"
	"fmt"
	"log/slog"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/lithammer/shortuuid/v4"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/server/runner/memopayload"
	"github.com/usememos/memos/store"
)

func (s *APIV1Service) ImportMemos(ctx context.Context, req *v1pb.ImportMemosRequest) (*v1pb.ImportResult, error) {
	size := binary.Size(req.Content)
	if lim := s.uploadSizeLimit(ctx); size > lim {
		return nil, status.Errorf(codes.InvalidArgument, "file size exceeds the limit")
	}

	u, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}

	result, err := s.importer.Convert(ctx, req.Content)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to importe content: %v", err)
	}

	for i := range result.Memos {
		memo := &result.Memos[i]
		memo.UID = shortuuid.New()
		memo.CreatorID = u.ID

		err := s.importMemo(ctx, memo)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to import memo %s: %v", memo.UID, err)
		}
	}

	for _, res := range result.Resources {
		res.UID = shortuuid.New()
		res.CreatorID = u.ID

		refs := result.FileMemos[res.Filename]
		if len(refs) == 0 {
			err = s.importResource(ctx, nil, &res)
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to import resource %s: %v", res.Filename, err)
			}
			continue
		}

		for _, ref := range refs {
			res := res // Copy to create new resource for each ref.

			err = s.importResource(ctx, &result.Memos[ref].ID, &res)
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to import resource %s: %v", res.Filename, err)
			}
		}
	}

	return &v1pb.ImportResult{}, nil
}

func (s *APIV1Service) importResource(ctx context.Context, memoID *int32, res *store.Resource) error {
	if memoID != nil {
		res.MemoID = memoID
	}

	if err := SaveResourceBlob(ctx, s.Store, res); err != nil {
		return fmt.Errorf("save resource blob: %w", err)
	}

	created, err := s.Store.CreateResource(ctx, res)
	if err != nil {
		return fmt.Errorf("create resource: %v", err)
	}

	*res = *created

	return nil
}

func (s *APIV1Service) importMemo(ctx context.Context, memo *store.Memo) error {
	err := memopayload.RebuildMemoPayload(memo)
	if err != nil {
		return fmt.Errorf("rebuild memo payload: %w", err)
	}

	created, err := s.Store.CreateMemo(ctx, memo)
	if err != nil {
		return err
	}

	*memo = *created // Override memo.ID.

	msg, err := s.convertMemoFromStore(ctx, memo)
	if err != nil {
		return fmt.Errorf("convert memo: %w", err)
	}

	// Try to dispatch webhook when memo is created.
	if err := s.DispatchMemoCreatedWebhook(ctx, msg); err != nil {
		slog.WarnContext(ctx, "Failed to dispatch memo created webhook", "err", err)
	}

	return nil
}
