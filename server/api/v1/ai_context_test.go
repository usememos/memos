package v1

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	filterpkg "github.com/usememos/memos/filter"
)

// TestChatTagFilterSyntax documents the CEL forms the AI Hub builds for its
// context selector. The Hub joins per-tag membership tests, so these must
// compile and render.
func TestChatTagFilterSyntax(t *testing.T) {
	t.Parallel()

	engine, err := filterpkg.DefaultEngine()
	require.NoError(t, err)

	for _, expression := range []string{
		`"journal" in tags`,
		`"journal" in tags || "work" in tags`,
		`"a/b" in tags && "c" in tags`,
		`tag in ["journal", "work"]`,
		`sets.intersects(tags, ["journal", "work"])`,
	} {
		t.Run(expression, func(t *testing.T) {
			t.Parallel()

			program, err := engine.Compile(context.Background(), expression)
			require.NoError(t, err, "expression must compile")
			_, err = program.Render(filterpkg.RenderOptions{Dialect: filterpkg.DialectSQLite})
			require.NoError(t, err, "expression must render")
		})
	}
}
