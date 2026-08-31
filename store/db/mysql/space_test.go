package mysql

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

type failingMySQLSpaceSummaryRow struct {
	err error
}

func (row failingMySQLSpaceSummaryRow) Scan(...any) error {
	return row.err
}

func TestScanMySQLSpaceSummaryWrapsErrors(t *testing.T) {
	cause := errors.New("scan failed")
	err := scanMySQLSpaceSummary(failingMySQLSpaceSummaryRow{err: cause}, &store.Space{})

	require.ErrorIs(t, err, cause)
	require.ErrorContains(t, err, "failed to populate MySQL space summary")
}
