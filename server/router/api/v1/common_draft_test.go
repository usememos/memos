package v1

import (
	"testing"

	"github.com/stretchr/testify/require"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

// TestConvertStateDraftRoundTrip pins the DRAFT lifecycle value through both
// API converters (E12). The default arm must still map unknown -> Normal /
// STATE_UNSPECIFIED; an explicit DRAFT must round-trip both directions.
//
// RED today: convertStateToStore has no State_DRAFT case (default -> Normal),
// and convertStateFromStore has no store.Draft case (default ->
// STATE_UNSPECIFIED). A regression here is a silent leak.
func TestConvertStateDraftRoundTrip(t *testing.T) {
	t.Parallel()

	t.Run("convertStateToStore maps DRAFT", func(t *testing.T) {
		t.Parallel()
		require.Equal(t, store.Draft, convertStateToStore(v1pb.State_DRAFT))
	})

	t.Run("convertStateFromStore maps Draft", func(t *testing.T) {
		t.Parallel()
		require.Equal(t, v1pb.State_DRAFT, convertStateFromStore(store.Draft))
	})

	t.Run("DRAFT survives a full round-trip", func(t *testing.T) {
		t.Parallel()
		require.Equal(t, v1pb.State_DRAFT, convertStateFromStore(convertStateToStore(v1pb.State_DRAFT)))
		require.Equal(t, store.Draft, convertStateToStore(convertStateFromStore(store.Draft)))
	})

	// Edge E12 / E1: the default arm must keep mapping unknown -> Normal so an
	// unmapped or unspecified state never accidentally becomes a draft.
	t.Run("default arm still maps unknown to Normal", func(t *testing.T) {
		t.Parallel()
		require.Equal(t, store.Normal, convertStateToStore(v1pb.State_STATE_UNSPECIFIED))
		require.Equal(t, store.Normal, convertStateToStore(v1pb.State(999)))
		require.Equal(t, v1pb.State_NORMAL, convertStateFromStore(store.Normal))
		require.Equal(t, v1pb.State_ARCHIVED, convertStateFromStore(store.Archived))
	})
}
