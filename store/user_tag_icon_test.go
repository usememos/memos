package store

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	storepb "github.com/usememos/memos/proto/gen/store"
)

func TestValidateUserTagIcon(t *testing.T) {
	// No icon means the tag falls back to a leading emoji in its name, then the hash mark.
	require.NoError(t, ValidateUserTagIcon(nil))
	require.Error(t, ValidateUserTagIcon(&storepb.UserTagMetadata_Icon{}))
	for _, emoji := range []string{"📗", "👩🏽‍🌾", "🇸🇬", "❤️", "1️⃣"} {
		require.NoError(t, ValidateUserTagIcon(&storepb.UserTagMetadata_Icon{Value: &storepb.UserTagMetadata_Icon_Emoji{Emoji: emoji}}), emoji)
	}
	for _, emoji := range []string{"", "book", "📗📗", " 📗", "🏻", "\xff"} {
		require.Error(t, ValidateUserTagIcon(&storepb.UserTagMetadata_Icon{Value: &storepb.UserTagMetadata_Icon_Emoji{Emoji: emoji}}), emoji)
	}
	for _, name := range []string{"leaf", "book-open", "notebook-pen", "future-icon"} {
		require.NoError(t, ValidateUserTagIcon(&storepb.UserTagMetadata_Icon{Value: &storepb.UserTagMetadata_Icon_Lucide{Lucide: name}}), name)
	}
	for _, name := range []string{"", "LeafIcon", "book_open", "-leaf", "book--open", "<svg>", "📗", strings.Repeat("a", 129)} {
		require.Error(t, ValidateUserTagIcon(&storepb.UserTagMetadata_Icon{Value: &storepb.UserTagMetadata_Icon_Lucide{Lucide: name}}), name)
	}
}
