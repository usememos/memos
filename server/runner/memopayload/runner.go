package memopayload

import (
	"context"
	"log/slog"

	"github.com/pkg/errors"

	"github.com/usememos/memos/plugin/markdown"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

type Runner struct {
	Store           *store.Store
	MarkdownService markdown.Service
}

func NewRunner(store *store.Store, markdownService markdown.Service) *Runner {
	return &Runner{
		Store:           store,
		MarkdownService: markdownService,
	}
}

// RunOnce rebuilds the payload of all memos.
func (r *Runner) RunOnce(ctx context.Context) {
	// Process memos in batches to avoid loading all memos into memory at once
	const batchSize = 100
	offset := 0
	processed := 0

	for {
		limit := batchSize
		memos, err := r.Store.ListMemos(ctx, &store.FindMemo{
			Limit:  &limit,
			Offset: &offset,
		})
		if err != nil {
			slog.Error("failed to list memos", "err", err)
			return
		}

		// Break if no more memos
		if len(memos) == 0 {
			break
		}

		// Process batch
		batchSuccessCount := 0
		for _, memo := range memos {
			if err := RebuildMemoPayload(memo, r.MarkdownService); err != nil {
				slog.Error("failed to rebuild memo payload", "err", err, "memoID", memo.ID)
				continue
			}
			if err := r.Store.UpdateMemo(ctx, &store.UpdateMemo{
				ID:      memo.ID,
				Payload: memo.Payload,
			}); err != nil {
				slog.Error("failed to update memo", "err", err, "memoID", memo.ID)
				continue
			}
			batchSuccessCount++
		}

		processed += len(memos)
		slog.Info("Processed memo batch", "batchSize", len(memos), "successCount", batchSuccessCount, "totalProcessed", processed)

		// Move to next batch
		offset += len(memos)
	}
}

func RebuildMemoPayload(memo *store.Memo, markdownService markdown.Service) error {
	if memo.Payload == nil {
		memo.Payload = &storepb.MemoPayload{}
	}

	// Use goldmark service to extract all metadata in a single pass (more efficient)
	data, err := markdownService.ExtractAll([]byte(memo.Content))
	if err != nil {
		return errors.Wrap(err, "failed to extract markdown metadata")
	}

	memo.Payload.Tags = data.Tags
	memo.Payload.Property = data.Property
	return nil
}
