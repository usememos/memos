package mysql

import (
	"testing"

	mysqldriver "github.com/go-sql-driver/mysql"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"
)

func TestIsRetryableAuthenticationMutationError(t *testing.T) {
	db := &DB{}
	require.True(t, db.IsRetryableAuthenticationMutationError(errors.Wrap(&mysqldriver.MySQLError{Number: 1213}, "commit failed")))
	require.True(t, db.IsRetryableAuthenticationMutationError(&mysqldriver.MySQLError{Number: 1205}))
	require.False(t, db.IsRetryableAuthenticationMutationError(&mysqldriver.MySQLError{Number: 1062}))
}
