package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

func TestPollVoteStore(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	user1, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	user2, err := createTestingUserWithRole(ctx, ts, "poll-voter-2", store.RoleUser)
	require.NoError(t, err)

	pollUID := "poll-uid-1"

	// No votes yet.
	votes, err := ts.ListPollVotes(ctx, pollUID)
	require.NoError(t, err)
	require.Empty(t, votes)

	// user1 casts a single-choice vote for option 0.
	votes, err = ts.SetPollVotes(ctx, pollUID, user1.ID, []int32{0})
	require.NoError(t, err)
	require.Len(t, votes, 1)
	require.Equal(t, int32(0), votes[0].OptionIndex)
	require.Equal(t, user1.ID, votes[0].VoterID)

	// user2 casts a multi-choice vote for options 1 and 2.
	votes, err = ts.SetPollVotes(ctx, pollUID, user2.ID, []int32{1, 2})
	require.NoError(t, err)
	require.Len(t, votes, 3)

	// user1 changes their single-choice vote to option 1 - replaces, not appends.
	votes, err = ts.SetPollVotes(ctx, pollUID, user1.ID, []int32{1})
	require.NoError(t, err)
	require.Len(t, votes, 3)
	optionCounts := map[int32]int{}
	for _, vote := range votes {
		optionCounts[vote.OptionIndex]++
	}
	require.Equal(t, 0, optionCounts[0])
	require.Equal(t, 2, optionCounts[1])
	require.Equal(t, 1, optionCounts[2])

	// Clearing a ballot removes only that voter's rows.
	votes, err = ts.SetPollVotes(ctx, pollUID, user2.ID, []int32{})
	require.NoError(t, err)
	require.Len(t, votes, 1)
	require.Equal(t, user1.ID, votes[0].VoterID)

	// A different poll UID is entirely independent.
	otherVotes, err := ts.ListPollVotes(ctx, "poll-uid-2")
	require.NoError(t, err)
	require.Empty(t, otherVotes)
}

func TestPollVoteStoreDeduplicatesOptionIndexes(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	votes, err := ts.SetPollVotes(ctx, "poll-uid-dup", user.ID, []int32{0, 0, 1})
	require.NoError(t, err)
	require.Len(t, votes, 2)
}
