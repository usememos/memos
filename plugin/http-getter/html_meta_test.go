package getter

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGetHTMLMeta(t *testing.T) {
	tests := []struct {
		urlStr   string
		htmlMeta HTMLMeta
	}{
		{
			urlStr: "https://www.bytebase.com/blog/sql-review-tool-for-devs",
			htmlMeta: HTMLMeta{
				Title:       "The SQL Review Tool for Developers",
				Description: "Reviewing SQL can be somewhat tedious, yet is essential to keep your database fleet reliable. At Bytebase, we are building a developer-first SQL review tool to empower the DevOps system.",
				Image:       "https://www.bytebase.com/static/blog/sql-review-tool-for-devs/dev-fighting-dba.webp",
			},
		},
	}
	for _, test := range tests {
		metadata, err := GetHTMLMeta(test.urlStr)
		require.NoError(t, err)
		require.Equal(t, test.htmlMeta, *metadata)
	}
}
