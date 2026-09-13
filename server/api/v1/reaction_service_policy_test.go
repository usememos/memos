package v1

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/usememos/memos/store"
)

func TestReactionWritePolicy(t *testing.T) {
	policy := reactionWritePolicy(7)
	require.Equal(t, int32(7), policy.ActorUserID)
}

func TestMapReactionMutationError(t *testing.T) {
	tests := []struct {
		name string
		err  error
		code codes.Code
	}{
		{name: "missing memo", err: store.ErrReactionMemoNotFound, code: codes.NotFound},
		{name: "reaction ownership", err: store.ErrReactionPermissionDenied, code: codes.PermissionDenied},
		{name: "space membership", err: store.ErrMemoSpaceMembershipRequired, code: codes.PermissionDenied},
		{name: "private memo", err: store.ErrMemoPermissionDenied, code: codes.PermissionDenied},
		{name: "stale memo snapshot", err: store.ErrMemoMutationConflict, code: codes.FailedPrecondition},
		{name: "invalid space", err: store.ErrMemoSpaceNotWritable, code: codes.FailedPrecondition},
		{name: "unexpected storage failure", err: errors.New("database unavailable"), code: codes.Internal},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			require.Equal(t, test.code, status.Code(mapReactionMutationError(test.err, "mutate reaction")))
		})
	}
}
