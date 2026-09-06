package memopayload

import (
	"context"
	"log/slog"
	"time"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/proto"

	"github.com/usememos/memos/internal/markdown"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

type Runner struct {
	Store           *store.Store
	MarkdownService markdown.Service
	// EnrichMemoLinks, when set, persists link metadata for each memo after
	// the payload rebuild. Injected by the API v1 service to reuse its
	// fetcher and attachment storage wiring.
	EnrichMemoLinks func(ctx context.Context, memo *store.Memo)
	// FilterHasLink restricts payload rebuilding to memos carrying links.
	FilterHasLink bool
}

func NewRunner(store *store.Store, markdownService markdown.Service) *Runner {
	return &Runner{
		Store:           store,
		MarkdownService: markdownService,
	}
}

// RunLoop runs RunOnce immediately, then every interval, until ctx is done.
// ponytail: RunOnce still full-scans memos each pass — fine at self-host scale;
// index pending link payloads if a deployment ever has 100k+ memos.
func (r *Runner) RunLoop(ctx context.Context, interval time.Duration) {
	r.RunOnce(ctx)
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			r.RunOnce(ctx)
		}
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
		find := &store.FindMemo{
			Limit:  &limit,
			Offset: &offset,
		}
		if r.FilterHasLink {
			find.Filters = []string{"has_link"}
		}
		memos, err := r.Store.ListMemos(ctx, find)
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
			if r.FilterHasLink && !memo.Payload.GetProperty().GetHasLink() {
				continue
			}
			previous := proto.Clone(memo.Payload).(*storepb.MemoPayload)
			if err := RebuildMemoPayload(ctx, memo, r.MarkdownService); err != nil {
				slog.Error("failed to rebuild memo payload", "err", err, "memoID", memo.ID)
				continue
			}
			if r.EnrichMemoLinks != nil {
				r.EnrichMemoLinks(ctx, memo)
			}
			if proto.Equal(previous, memo.Payload) {
				batchSuccessCount++
				continue
			}
			if err := r.Store.UpdateMemo(ctx, &store.UpdateMemo{
				ID:              memo.ID,
				Payload:         memo.Payload,
				ExpectedContent: &memo.Content,
				ExpectedPayload: &memo.PayloadRaw,
			}); err != nil {
				if errors.Is(err, store.ErrMemoConcurrentUpdate) {
					continue
				}
				slog.Error("failed to update memo", "err", err, "memoID", memo.ID)
				continue
			}
			batchSuccessCount++
		}

		processed += len(memos)
		slog.Info("Processed memo batch", "batchSize", len(memos), "successCount", batchSuccessCount, "totalProcessed", processed)

		// Rate-limit so a large backfill stays gentle on a live instance.
		// ponytail: fixed 100ms/batch; make configurable if instances grow big.
		select {
		case <-ctx.Done():
			return
		case <-time.After(100 * time.Millisecond):
		}

		// Move to next batch
		offset += len(memos)
	}
}

func RebuildMemoPayload(_ context.Context, memo *store.Memo, markdownService markdown.Service) error {
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
