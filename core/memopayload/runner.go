// Package memopayload computes the content-derived part of a memo payload and
// keeps stored payloads current when that computation changes.
package memopayload

import (
	"context"
	"log/slog"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/proto"

	"github.com/usememos/memos/markdown"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// Version identifies the content-derived part of a memo payload, the tags and
// property that RebuildMemoPayload takes from the Markdown extractor. Bump it
// whenever that output changes for existing content, so the server rebuilds
// every memo's payload once after upgrading.
//
// 1: Property.has_inline_image.
const Version = 1

// batchSize is how many memos the rebuild loads at a time.
const batchSize = 100

// Runner rebuilds stored memo payloads.
type Runner struct {
	Store           *store.Store
	MarkdownService markdown.Service
}

// NewRunner returns a Runner over the store.
func NewRunner(store *store.Store, markdownService markdown.Service) *Runner {
	return &Runner{
		Store:           store,
		MarkdownService: markdownService,
	}
}

// Backfill rebuilds every memo's content-derived payload once per Version.
// The version is recorded only after a pass in which every memo was written,
// so an interrupted or failed pass runs again on the next start. Rebuilding is
// idempotent, and each write is guarded against concurrent edits, so it is
// safe to run while the server takes traffic.
func (r *Runner) Backfill(ctx context.Context) error {
	basicSetting, err := r.Store.GetInstanceBasicSetting(ctx)
	if err != nil {
		return errors.Wrap(err, "failed to get instance basic setting")
	}
	if basicSetting.PayloadVersion >= Version {
		return nil
	}
	slog.Info("rebuilding memo payloads",
		slog.Int("fromVersion", int(basicSetting.PayloadVersion)),
		slog.Int("toVersion", Version))
	if err := r.RunOnce(ctx); err != nil {
		return err
	}

	// Re-read: the cache hands out a shared value, and the setting may have
	// changed during the pass.
	basicSetting, err = r.Store.GetInstanceBasicSetting(ctx)
	if err != nil {
		return errors.Wrap(err, "failed to get instance basic setting")
	}
	updated := proto.CloneOf(basicSetting)
	updated.PayloadVersion = Version
	if _, err := r.Store.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key:   storepb.InstanceSettingKey_BASIC,
		Value: &storepb.InstanceSetting_BasicSetting{BasicSetting: updated},
	}); err != nil {
		return errors.Wrap(err, "failed to record memo payload version")
	}
	return nil
}

// RunOnce rebuilds the content-derived payload of every memo. It collects the
// memo IDs first, so memos created or deleted during the pass cannot shift the
// pages and skip a memo. Content that fails to parse is logged and skipped,
// since a retry cannot fix it; a failed write fails the pass after every memo
// has been tried.
func (r *Runner) RunOnce(ctx context.Context) error {
	ids, err := r.listMemoIDs(ctx)
	if err != nil {
		return err
	}

	refreshed, skipped, failed := 0, 0, 0
	for start := 0; start < len(ids); start += batchSize {
		if err := ctx.Err(); err != nil {
			return err
		}
		end := min(start+batchSize, len(ids))
		memos, err := r.Store.ListMemos(ctx, &store.FindMemo{IDList: ids[start:end]})
		if err != nil {
			return errors.Wrap(err, "failed to list memos")
		}
		for _, memo := range memos {
			data, err := r.MarkdownService.ExtractAll([]byte(memo.Content))
			if err != nil {
				slog.Warn("skipping memo payload rebuild", slog.Int("memoID", int(memo.ID)), slog.String("error", err.Error()))
				skipped++
				continue
			}
			if err := r.Store.RefreshMemoDerivedPayload(ctx, &store.RefreshMemoDerivedPayload{
				ID:       memo.ID,
				Content:  memo.Content,
				Tags:     data.Tags,
				Property: data.Property,
			}); err != nil {
				if ctx.Err() != nil {
					return ctx.Err()
				}
				slog.Error("failed to rebuild memo payload", slog.Int("memoID", int(memo.ID)), slog.String("error", err.Error()))
				failed++
				continue
			}
			refreshed++
		}
	}

	slog.Info("rebuilt memo payloads",
		slog.Int("refreshed", refreshed), slog.Int("skipped", skipped), slog.Int("failed", failed))
	if failed > 0 {
		return errors.Errorf("failed to rebuild %d memo payloads", failed)
	}
	return nil
}

func (r *Runner) listMemoIDs(ctx context.Context) ([]int32, error) {
	ids := []int32{}
	for offset := 0; ; offset += batchSize {
		limit, pageOffset := batchSize, offset
		memos, err := r.Store.ListMemos(ctx, &store.FindMemo{
			ExcludeContent: true,
			OrderByTimeAsc: true,
			Limit:          &limit,
			Offset:         &pageOffset,
		})
		if err != nil {
			return nil, errors.Wrap(err, "failed to list memo IDs")
		}
		for _, memo := range memos {
			ids = append(ids, memo.ID)
		}
		if len(memos) < batchSize {
			return ids, nil
		}
	}
}

// RebuildMemoPayload sets the memo's tags and property from its content.
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
