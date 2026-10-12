package test

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	apipb "github.com/usememos/memos/proto/gen/api"
)

func TestCreatePersonalAccessTokenExpiration(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "pat-expiration")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)
	parent := "users/" + user.Username

	t.Run("zero days never expires", func(t *testing.T) {
		response, err := ts.Service.CreatePersonalAccessToken(userCtx, &apipb.CreatePersonalAccessTokenRequest{
			Parent:      parent,
			Description: "non-expiring token",
		})
		require.NoError(t, err)
		require.True(t, strings.HasPrefix(response.Token, "memos_pat_"))
		require.Nil(t, response.PersonalAccessToken.ExpireTime)

		listed, err := ts.Service.ListPersonalAccessTokens(userCtx, &apipb.ListPersonalAccessTokensRequest{Parent: parent})
		require.NoError(t, err)
		require.Len(t, listed.PersonalAccessTokens, 1)
		require.Nil(t, listed.PersonalAccessTokens[0].ExpireTime)
	})

	t.Run("positive days sets expiration", func(t *testing.T) {
		before := time.Now().Add(29 * 24 * time.Hour)
		response, err := ts.Service.CreatePersonalAccessToken(userCtx, &apipb.CreatePersonalAccessTokenRequest{
			Parent:        parent,
			Description:   "expiring token",
			ExpiresInDays: 30,
		})
		require.NoError(t, err)
		require.NotNil(t, response.PersonalAccessToken.ExpireTime)
		require.True(t, response.PersonalAccessToken.ExpireTime.AsTime().After(before))
		require.True(t, response.PersonalAccessToken.ExpireTime.AsTime().Before(time.Now().Add(31*24*time.Hour)))
	})
}
