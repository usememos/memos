package memoproperty

import (
	"context"
	"log/slog"
	"slices"
	"time"

	"github.com/pkg/errors"
	"github.com/usememos/gomark/ast"
	"github.com/usememos/gomark/parser"
	"github.com/usememos/gomark/parser/tokenizer"

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

// Schedule runner every 12 hours.
const runnerInterval = time.Hour * 12

func (r *Runner) Run(ctx context.Context) {
	ticker := time.NewTicker(runnerInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			r.RunOnce(ctx)
		case <-ctx.Done():
			return
		}
	}
}

func (r *Runner) RunOnce(ctx context.Context) {
	emptyPayload := "{}"
	memos, err := r.Store.ListMemos(ctx, &store.FindMemo{
		PayloadFind: &store.FindMemoPayload{
			Raw: &emptyPayload,
		},
	})
	if err != nil {
		slog.Error("failed to list memos", "err", err)
		return
	}

	for _, memo := range memos {
		property, err := GetMemoPropertyFromContent(memo.Content)
		if err != nil {
			slog.Error("failed to get memo property", "err", err)
			continue
		}
		memo.Payload.Property = property
		if err := r.Store.UpdateMemo(ctx, &store.UpdateMemo{
			ID:      memo.ID,
			Payload: memo.Payload,
		}); err != nil {
			slog.Error("failed to update memo", "err", err)
		}
	}
}

func GetMemoPropertyFromContent(content string) (*storepb.MemoPayload_Property, error) {
	nodes, err := parser.Parse(tokenizer.Tokenize(content))
	if err != nil {
		return nil, errors.Wrap(err, "failed to parse content")
	}

	property := &storepb.MemoPayload_Property{}
	TraverseASTNodes(nodes, func(node ast.Node) {
		switch n := node.(type) {
		case *ast.Tag:
			tag := n.Content
			if !slices.Contains(property.Tags, tag) {
				property.Tags = append(property.Tags, tag)
			}
		case *ast.Link, *ast.AutoLink:
			property.HasLink = true
		case *ast.TaskListItem:
			property.HasTaskList = true
			if !n.Complete {
				property.HasIncompleteTasks = true
			}
		case *ast.Code, *ast.CodeBlock:
			property.HasCode = true
		}
	})
	return property, nil
}

func TraverseASTNodes(nodes []ast.Node, fn func(ast.Node)) {
	for _, node := range nodes {
		fn(node)
		switch n := node.(type) {
		case *ast.Paragraph:
			TraverseASTNodes(n.Children, fn)
		case *ast.Heading:
			TraverseASTNodes(n.Children, fn)
		case *ast.Blockquote:
			TraverseASTNodes(n.Children, fn)
		case *ast.List:
			TraverseASTNodes(n.Children, fn)
		case *ast.OrderedListItem:
			TraverseASTNodes(n.Children, fn)
		case *ast.UnorderedListItem:
			TraverseASTNodes(n.Children, fn)
		case *ast.TaskListItem:
			TraverseASTNodes(n.Children, fn)
		case *ast.Bold:
			TraverseASTNodes(n.Children, fn)
		}
	}
}
