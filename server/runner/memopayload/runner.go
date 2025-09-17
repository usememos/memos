package memopayload

import (
	"context"
	"log/slog"
	"slices"

	"github.com/pkg/errors"
	"github.com/usememos/gomark"
	"github.com/usememos/gomark/ast"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

type Runner struct {
	Store *store.Store
}

func NewRunner(store *store.Store) *Runner {
	return &Runner{
		Store: store,
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
			if err := RebuildMemoPayload(memo); err != nil {
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

func RebuildMemoPayload(memo *store.Memo) error {
	doc, err := gomark.Parse(memo.Content)
	if err != nil {
		return errors.Wrap(err, "failed to parse content")
	}

	if memo.Payload == nil {
		memo.Payload = &storepb.MemoPayload{}
	}
	tags := []string{}
	property := &storepb.MemoPayload_Property{}
	TraverseASTDocument(doc, func(node ast.Node) {
		switch n := node.(type) {
		case *ast.Tag:
			tag := n.Content
			if !slices.Contains(tags, tag) {
				tags = append(tags, tag)
			}
		case *ast.Link, *ast.AutoLink:
			property.HasLink = true
		case *ast.TaskListItem:
			property.HasTaskList = true
			if !n.Complete {
				property.HasIncompleteTasks = true
			}
		case *ast.CodeBlock:
			property.HasCode = true
		case *ast.EmbeddedContent:
			// TODO: validate references.
			property.References = append(property.References, n.ResourceName)
		}
	})
	memo.Payload.Tags = tags
	memo.Payload.Property = property
	return nil
}

func TraverseASTDocument(doc *ast.Document, fn func(ast.Node)) {
	if doc == nil {
		return
	}
	traverseASTNodes(doc.Children, fn)
}

func traverseASTNodes(nodes []ast.Node, fn func(ast.Node)) {
	for _, node := range nodes {
		fn(node)
		switch n := node.(type) {
		case *ast.Paragraph:
			traverseASTNodes(n.Children, fn)
		case *ast.Heading:
			traverseASTNodes(n.Children, fn)
		case *ast.Blockquote:
			traverseASTNodes(n.Children, fn)
		case *ast.List:
			traverseASTNodes(n.Children, fn)
		case *ast.OrderedListItem:
			traverseASTNodes(n.Children, fn)
		case *ast.UnorderedListItem:
			traverseASTNodes(n.Children, fn)
		case *ast.TaskListItem:
			traverseASTNodes(n.Children, fn)
		case *ast.Bold:
			traverseASTNodes(n.Children, fn)
		}
	}
}
