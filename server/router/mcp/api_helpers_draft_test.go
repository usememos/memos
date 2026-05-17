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
// RED today: rowStatusToProto has no store.Draft case, so a draft maps to
// State_NORMAL via the default arm -- a DRAFT memo would be advertised as a
// normal memo to MCP clients.
func TestRowStatusToProtoDraft(t *testing.T) {
	t.Parallel()

	require.Equal(t, v1pb.State_DRAFT, rowStatusToProto(store.Draft))

	// Existing mappings must stay intact.
	require.Equal(t, v1pb.State_ARCHIVED, rowStatusToProto(store.Archived))
	require.Equal(t, v1pb.State_NORMAL, rowStatusToProto(store.Normal))
}

// TestParseRowStatusDraft pins that the MCP state filter understands DRAFT.
//
// RED today: parseRowStatus only accepts NORMAL/ARCHIVED and rejects "DRAFT"
// with an error, so an MCP client can never query its own drafts. (This is the
// inverse of a leak: without this, drafts are simply unreachable via MCP, but
// the contract requires creator-only DRAFT querying to be expressible.)
func TestParseRowStatusDraft(t *testing.T) {
	t.Parallel()

	rs, err := parseRowStatus("DRAFT")
	require.NoError(t, err)
	require.Equal(t, store.Draft, rs)
}
