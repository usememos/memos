package mcp

import (
	"testing"

	"github.com/stretchr/testify/require"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

// TestRowStatusToProtoDraft pins the MCP parallel converter so a DRAFT memo is
// reported as State_DRAFT and never silently surfaces as NORMAL (E12, leak
// regression).
//
// Without the Draft case a draft falls through to State_NORMAL and would be
// advertised as a normal memo to MCP clients.
func TestRowStatusToProtoDraft(t *testing.T) {
	t.Parallel()

	require.Equal(t, v1pb.State_DRAFT, rowStatusToProto(store.Draft))

	// Existing mappings must stay intact.
	require.Equal(t, v1pb.State_ARCHIVED, rowStatusToProto(store.Archived))
	require.Equal(t, v1pb.State_NORMAL, rowStatusToProto(store.Normal))
}

// TestParseRowStatusDraft pins that the MCP state filter understands DRAFT.
//
// Creator-only DRAFT querying must be expressible via MCP, so parseRowStatus
// accepts "DRAFT" (without it, drafts are simply unreachable via MCP).
func TestParseRowStatusDraft(t *testing.T) {
	t.Parallel()

	rs, err := parseRowStatus("DRAFT")
	require.NoError(t, err)
	require.Equal(t, store.Draft, rs)
}
