package postgres

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

type failingPostgresSpaceSummaryRow struct {
	err error
}

func (row failingPostgresSpaceSummaryRow) Scan(...any) error {
	return row.err
}

func TestScanPostgresSpaceSummaryWrapsErrors(t *testing.T) {
	cause := errors.New("scan failed")
	err := scanPostgresSpaceSummary(failingPostgresSpaceSummaryRow{err: cause}, &store.Space{})

	require.ErrorIs(t, err, cause)
	require.ErrorContains(t, err, "failed to populate PostgreSQL space summary")
}
