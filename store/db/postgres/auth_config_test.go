package postgres

import (
	"testing"

	"github.com/lib/pq"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"
)

func TestIsRetryableAuthenticationMutationError(t *testing.T) {
	db := &DB{}
	require.True(t, db.IsRetryableAuthenticationMutationError(errors.Wrap(&pq.Error{Code: "40001"}, "commit failed")))
	require.True(t, db.IsRetryableAuthenticationMutationError(&pq.Error{Code: "40P01"}))
	require.False(t, db.IsRetryableAuthenticationMutationError(&pq.Error{Code: "23505"}))
}
