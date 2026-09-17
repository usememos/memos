package test

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/timestamppb"

	storepb "github.com/usememos/memos/proto/gen/store"
)

func TestUserSettingRefreshTokensPruneExpiredOnAdd(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	expired := &storepb.RefreshTokensUserSetting_RefreshToken{TokenId: "expired", ExpiresAt: timestamppb.New(time.Now().Add(-time.Hour))}
	live := &storepb.RefreshTokensUserSetting_RefreshToken{TokenId: "live", ExpiresAt: timestamppb.New(time.Now().Add(time.Hour))}
	require.NoError(t, ts.AddUserRefreshToken(ctx, user.ID, expired))
	require.NoError(t, ts.AddUserRefreshToken(ctx, user.ID, live))
	require.NoError(t, ts.AddUserRefreshToken(ctx, user.ID, &storepb.RefreshTokensUserSetting_RefreshToken{TokenId: "newest"}))

	tokens, err := ts.GetUserRefreshTokens(ctx, user.ID)
	require.NoError(t, err)
	ids := []string{}
	for _, token := range tokens {
		ids = append(ids, token.TokenId)
	}
	require.Equal(t, []string{"live", "newest"}, ids)
}

func TestUserSettingRemoveRefreshTokensExcept(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	for _, id := range []string{"a", "b", "c"} {
		require.NoError(t, ts.AddUserRefreshToken(ctx, user.ID, &storepb.RefreshTokensUserSetting_RefreshToken{TokenId: id}))
	}

	require.NoError(t, ts.RemoveUserRefreshTokensExcept(ctx, user.ID, "b"))
	tokens, err := ts.GetUserRefreshTokens(ctx, user.ID)
	require.NoError(t, err)
	require.Len(t, tokens, 1)
	require.Equal(t, "b", tokens[0].TokenId)

	require.NoError(t, ts.RemoveUserRefreshTokensExcept(ctx, user.ID, ""))
	tokens, err = ts.GetUserRefreshTokens(ctx, user.ID)
	require.NoError(t, err)
	require.Empty(t, tokens)
}
