package importer

import (
	"context"
	"errors"
	"log/slog"

	"github.com/usememos/memos/store"
)

type ImportResult struct {
	Memos     []store.Memo
	Resources []store.Resource

	// Maps resource name to memo indices in[ImportResult.Memos].
	FileMemos map[string][]int
}

// stateless converter
type memoConverter func(context.Context, []byte) (*ImportResult, error)

var converters = []struct {
	name string
	fn   memoConverter
}{
	{"takeout", takeoutConverter},
}

type Importer struct {
	store *store.Store
}

func New(store *store.Store) *Importer {
	return &Importer{
		store: store,
	}
}

func (imp *Importer) Convert(ctx context.Context, content []byte) (*ImportResult, error) {
	for _, converter := range converters {
		slog.DebugContext(ctx, "importing notes", "converter", converter.name)

		res, err := converter.fn(ctx, content)
		if err != nil {
			slog.ErrorContext(ctx, "import failed", "converter", converter.name, "err", err)
			continue
		}

		return res, nil
	}

	return nil, errors.New("no converter found")
}
