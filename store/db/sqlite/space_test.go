package sqlite

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

type failingSQLiteSpaceSummaryRow struct {
	err error
}

func (row failingSQLiteSpaceSummaryRow) Scan(...any) error {
	return row.err
}

func TestScanSQLiteSpaceSummaryWrapsErrors(t *testing.T) {
	cause := errors.New("scan failed")
	err := scanSQLiteSpaceSummary(failingSQLiteSpaceSummaryRow{err: cause}, &store.Space{})

	require.ErrorIs(t, err, cause)
	require.ErrorContains(t, err, "failed to populate SQLite space summary")
}
