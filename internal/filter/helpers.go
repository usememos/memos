package filter

import (
	"context"
	"fmt"
)

// AppendConditions compiles the provided filters and appends the resulting SQL fragments and args.
func AppendConditions(ctx context.Context, engine *Engine, filters []string, dialect DialectName, where *[]string, args *[]any) error {
	for _, filterStr := range filters {
		stmt, err := engine.CompileToStatement(ctx, filterStr, RenderOptions{
			Dialect:           dialect,
			PlaceholderOffset: len(*args),
		})
		if err != nil {
			return err
		}
		if stmt.SQL == "" {
			continue
		}
		*where = append(*where, fmt.Sprintf("(%s)", stmt.SQL))
		*args = append(*args, stmt.Args...)
	}
	return nil
}
