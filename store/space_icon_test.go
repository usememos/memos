package store

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	storepb "github.com/usememos/memos/proto/gen/store"
)

func TestValidateSpaceIcon(t *testing.T) {
	require.NoError(t, ValidateSpaceIcon(nil))
	require.Error(t, ValidateSpaceIcon(&storepb.SpacePayload_Icon{}))
	for _, emoji := range []string{"🌱", "👩🏽‍🌾", "🇸🇬", "❤️", "1️⃣"} {
		require.NoError(t, ValidateSpaceIcon(&storepb.SpacePayload_Icon{Value: &storepb.SpacePayload_Icon_Emoji{Emoji: emoji}}), emoji)
	}
	for _, emoji := range []string{"", "leaf", "🌱🌱", " 🌱", "🏻", "\xff"} {
		require.Error(t, ValidateSpaceIcon(&storepb.SpacePayload_Icon{Value: &storepb.SpacePayload_Icon_Emoji{Emoji: emoji}}), emoji)
	}
	for _, name := range []string{"leaf", "book-open", "house-plus", "circle-1", "future-icon"} {
		require.NoError(t, ValidateSpaceIcon(&storepb.SpacePayload_Icon{Value: &storepb.SpacePayload_Icon_Lucide{Lucide: name}}), name)
	}
	for _, name := range []string{"", "LeafIcon", "book_open", "-leaf", "leaf-", "book--open", "<svg>", "🌱", strings.Repeat("a", 129)} {
		require.Error(t, ValidateSpaceIcon(&storepb.SpacePayload_Icon{Value: &storepb.SpacePayload_Icon_Lucide{Lucide: name}}), name)
	}
}
