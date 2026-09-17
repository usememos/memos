package test

import (
	"context"
	"fmt"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/timestamppb"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// TestSpaceWritesSurviveConcurrentTokenUsageUpdates reproduces the shape of a
// personal-access-token authenticated request: the authenticator records the
// token's last-used time asynchronously on every request, while the request
// handler runs a transaction that reads (the actor's lifecycle state) before it
// writes. On SQLite a DEFERRED transaction that has read cannot upgrade to a
// write once another connection has committed, and fails with SQLITE_BUSY at
// once instead of waiting; the store opens its transactions IMMEDIATE so these
// writes queue behind the busy handler. The other drivers take row locks and
// are unaffected, but the scenario is valid for all of them.
func TestSpaceWritesSurviveConcurrentTokenUsageUpdates(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	owner, err := ts.CreateUser(ctx, &store.User{Username: "space-owner", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	invitee, err := ts.CreateUser(ctx, &store.User{Username: "space-invitee", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	require.NoError(t, ts.AddUserPersonalAccessToken(ctx, owner.ID, &storepb.PersonalAccessTokensUserSetting_PersonalAccessToken{
		TokenId:   "pat-1",
		TokenHash: "pat-hash-1",
	}))

	stop := make(chan struct{})
	var wg sync.WaitGroup
	wg.Go(func() {
		for {
			select {
			case <-stop:
				return
			default:
			}
			// Mirrors Authenticator.recordPATUsage: a detached context and a
			// fresh timestamp so every iteration is a real write.
			if err := ts.UpdatePATLastUsed(context.Background(), owner.ID, "pat-1", timestamppb.Now()); err != nil {
				t.Errorf("update PAT last used: %v", err)
				return
			}
		}
	})

	const iterations = 40
	for i := range iterations {
		space, err := ts.CreateSpace(ctx, &store.Space{UID: fmt.Sprintf("race-%d", i), Title: "Race"}, owner.ID)
		require.NoError(t, err, "create space %d", i)
		_, err = ts.CreateSpaceInvitation(ctx, &store.SpaceInvitation{
			SpaceID: space.ID,
			UserID:  invitee.ID,
			Role:    store.SpaceMemberRoleUser,
		}, owner.ID)
		require.NoError(t, err, "create invitation %d", i)
	}
	close(stop)
	wg.Wait()

	spaces, err := ts.ListSpaces(ctx, &store.FindSpace{MemberUserID: &owner.ID})
	require.NoError(t, err)
	require.Len(t, spaces, iterations)
}
