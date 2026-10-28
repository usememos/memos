package store

import (
	"context"
	"database/sql"
	stderrors "errors"
	"math/rand/v2"
	"time"

	"github.com/pkg/errors"
)

// serializableMaxAttempts bounds how many times runSerializable runs a
// transaction that conflicted with a concurrent one.
const serializableMaxAttempts = 5

// errTransactionConflict is returned by a transaction body that found a
// concurrent writer had changed what it read, so the body runs again.
var errTransactionConflict = stderrors.New("transaction conflicted with a concurrent write")

// runSerializable runs fn in one serializable transaction and commits it when
// fn returns nil. When the database reports a serialization or locking
// conflict, or fn returns errTransactionConflict, the transaction is rolled
// back and fn runs again, up to serializableMaxAttempts times, so fn must
// derive everything it writes from what it reads inside tx.
func (s *Store) runSerializable(ctx context.Context, fn func(tx *sql.Tx) error) error {
	var err error
	for attempt := range serializableMaxAttempts {
		err = s.runSerializableOnce(ctx, fn)
		retryable := errors.Is(err, errTransactionConflict) || s.driver.IsRetryableTransactionError(err)
		if err == nil || !retryable {
			return err
		}
		// Jitter keeps transactions that conflicted once from retrying in lockstep
		// and conflicting again.
		backoff := time.Duration(attempt+1)*10*time.Millisecond + rand.N(10*time.Millisecond)
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(backoff):
		}
	}
	return errors.Wrap(err, "serializable transaction failed after retries")
}

func (s *Store) runSerializableOnce(ctx context.Context, fn func(tx *sql.Tx) error) error {
	tx, err := s.driver.GetDB().BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return errors.Wrap(err, "failed to begin serializable transaction")
	}
	defer func() {
		_ = tx.Rollback()
	}()
	if err := fn(tx); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return errors.Wrap(err, "failed to commit serializable transaction")
	}
	return nil
}
