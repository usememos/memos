package store

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	storepb "github.com/usememos/memos/proto/gen/store"
)

func TestValidateMemoViewIcon(t *testing.T) {
	require.NoError(t, ValidateMemoViewIcon(nil))
	require.Error(t, ValidateMemoViewIcon(&storepb.MemoViewsUserSetting_MemoView_Icon{}))
	for _, emoji := range []string{"🌱", "👩🏽‍🌾", "🇸🇬", "❤️", "1️⃣"} {
		require.NoError(t, ValidateMemoViewIcon(&storepb.MemoViewsUserSetting_MemoView_Icon{
			Value: &storepb.MemoViewsUserSetting_MemoView_Icon_Emoji{Emoji: emoji},
		}), emoji)
	}
	for _, emoji := range []string{"", "leaf", "🌱🌱", " 🌱", "🏻", "\xff"} {
		require.Error(t, ValidateMemoViewIcon(&storepb.MemoViewsUserSetting_MemoView_Icon{
			Value: &storepb.MemoViewsUserSetting_MemoView_Icon_Emoji{Emoji: emoji},
		}), emoji)
	}
	for _, name := range []string{"leaf", "book-open", "circle-1", "future-icon", strings.Repeat("a", 128)} {
		require.NoError(t, ValidateMemoViewIcon(&storepb.MemoViewsUserSetting_MemoView_Icon{
			Value: &storepb.MemoViewsUserSetting_MemoView_Icon_Lucide{Lucide: name},
		}), name)
	}
	for _, name := range []string{"", "LeafIcon", "book_open", "-leaf", "leaf-", "book--open", "<svg>", strings.Repeat("a", 129)} {
		require.Error(t, ValidateMemoViewIcon(&storepb.MemoViewsUserSetting_MemoView_Icon{
			Value: &storepb.MemoViewsUserSetting_MemoView_Icon_Lucide{Lucide: name},
		}), name)
	}
}
