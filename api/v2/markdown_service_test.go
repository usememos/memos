package v2

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/plugin/gomark/ast"
	apiv2pb "github.com/usememos/memos/proto/gen/api/v2"
)

func TestConvertFromASTNodes(t *testing.T) {
	tests := []struct {
		name     string
		rawNodes []ast.Node
		want     []*apiv2pb.Node
	}{
		{
			name: "empty",
			want: []*apiv2pb.Node{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := convertFromASTNodes(tt.rawNodes)
			require.Equal(t, tt.want, got)
		})
	}
}
