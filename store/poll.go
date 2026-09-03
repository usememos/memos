package store

import (
	"context"
	"database/sql"
	stderrors "errors"
	"fmt"
	"strings"

	"github.com/pkg/errors"
)

// ErrPollMemoMismatch is returned when a poll UID that was already bound to
// one memo is accessed through a different memo. This blocks copying a
// ```poll block (and its UID) from one memo into another to hijack or share
// votes: the first memo to establish a poll UID owns it permanently.
var ErrPollMemoMismatch = stderrors.New("poll belongs to a different memo")

// Poll binds a client-generated poll UID (embedded in a memo's ```poll
// Markdown block) to the memo that owns it and a hash of its current
// definition (type + options). The question/options themselves are not
// duplicated here - they live in the memo's content - but the binding lets
// the server detect and reject two situations Markdown alone can't prevent:
// the same poll UID appearing in a second memo (a copy/paste), and votes
// surviving silently past an edit that reorders or relabels the options.
type Poll struct {
	ID             int32
	CreatedTs      int64
	UID            string
	MemoID         int32
	DefinitionHash string
}

// PollVote is a single user's selection of one option within a poll.
type PollVote struct {
	ID          int32
	CreatedTs   int64
	PollUID     string
	MemoID      int32
	OptionIndex int32
	VoterID     int32
}

// pollRebind rewrites a query written with "?" placeholders into the
// driver-appropriate form (SQLite/MySQL keep "?"; Postgres uses "$1", "$2", ...).
func (s *Store) pollRebind(query string) string {
	if s.profile.Driver != "postgres" {
		return query
	}
	var sb strings.Builder
	n := 0
	for _, r := range query {
		if r == '?' {
			n++
			sb.WriteString(fmt.Sprintf("$%d", n))
			continue
		}
		sb.WriteRune(r)
	}
	return sb.String()
}

// EnsurePollBinding establishes or validates the (memoID, definitionHash)
// binding for a poll UID, returning the current binding:
//   - No existing binding: creates one bound to memoID/definitionHash.
//   - Existing binding for a different memo: returns ErrPollMemoMismatch.
//     The caller must not read or mutate votes in this case.
//   - Existing binding for the same memo but a different definitionHash
//     (the memo's poll options were edited): clears the poll's existing
//     votes - they no longer correspond to any well-defined option - and
//     rebinds to the new definition. A memo edit is only possible for
//     someone who already has write access to the memo, so this rebind
//     itself never crosses an authorization boundary.
//   - Existing binding matching both memoID and definitionHash: returned
//     unchanged.
func (s *Store) EnsurePollBinding(ctx context.Context, uid string, memoID int32, definitionHash string) (*Poll, error) {
	if uid == "" {
		return nil, errors.New("poll uid is required")
	}
	if memoID <= 0 {
		return nil, errors.New("memo id is required")
	}
	if definitionHash == "" {
		return nil, errors.New("poll definition hash is required")
	}

	db := s.driver.GetDB()
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return nil, errors.Wrap(err, "failed to begin poll binding transaction")
	}
	defer func() { _ = tx.Rollback() }()

	poll, err := getPollTx(ctx, tx, s.pollRebind, uid)
	if err != nil {
		return nil, err
	}

	switch {
	case poll == nil:
		if _, err := tx.ExecContext(ctx, s.pollRebind(`
			INSERT INTO poll (uid, memo_id, definition_hash) VALUES (?, ?, ?)
		`), uid, memoID, definitionHash); err != nil {
			return nil, errors.Wrap(err, "failed to create poll binding")
		}
		poll, err = getPollTx(ctx, tx, s.pollRebind, uid)
		if err != nil {
			return nil, err
		}
	case poll.MemoID != memoID:
		return nil, ErrPollMemoMismatch
	case poll.DefinitionHash != definitionHash:
		if _, err := tx.ExecContext(ctx, s.pollRebind(`DELETE FROM poll_vote WHERE poll_uid = ?`), uid); err != nil {
			return nil, errors.Wrap(err, "failed to clear votes for a changed poll definition")
		}
		if _, err := tx.ExecContext(ctx, s.pollRebind(`UPDATE poll SET definition_hash = ? WHERE uid = ?`), definitionHash, uid); err != nil {
			return nil, errors.Wrap(err, "failed to update poll definition")
		}
		poll.DefinitionHash = definitionHash
	}

	if err := tx.Commit(); err != nil {
		return nil, errors.Wrap(err, "failed to commit poll binding transaction")
	}
	return poll, nil
}

func getPollTx(ctx context.Context, tx *sql.Tx, rebind func(string) string, uid string) (*Poll, error) {
	row := tx.QueryRowContext(ctx, rebind(`
		SELECT id, created_ts, uid, memo_id, definition_hash FROM poll WHERE uid = ?
	`), uid)
	poll := &Poll{}
	if err := row.Scan(&poll.ID, &poll.CreatedTs, &poll.UID, &poll.MemoID, &poll.DefinitionHash); err != nil {
		if stderrors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, errors.Wrap(err, "failed to get poll binding")
	}
	return poll, nil
}

// ListPollVotes returns all votes cast for the given poll UID, ordered by
// insertion order.
func (s *Store) ListPollVotes(ctx context.Context, pollUID string) ([]*PollVote, error) {
	db := s.driver.GetDB()
	rows, err := db.QueryContext(ctx, s.pollRebind(`
		SELECT id, created_ts, poll_uid, memo_id, option_index, voter_id
		FROM poll_vote
		WHERE poll_uid = ?
		ORDER BY id ASC
	`), pollUID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to list poll votes")
	}
	defer rows.Close()

	votes := []*PollVote{}
	for rows.Next() {
		vote := &PollVote{}
		if err := rows.Scan(&vote.ID, &vote.CreatedTs, &vote.PollUID, &vote.MemoID, &vote.OptionIndex, &vote.VoterID); err != nil {
			return nil, errors.Wrap(err, "failed to scan poll vote")
		}
		votes = append(votes, vote)
	}
	if err := rows.Err(); err != nil {
		return nil, errors.Wrap(err, "failed to iterate poll votes")
	}
	return votes, nil
}

// SetPollVotes replaces the full set of option selections that voterID has
// made on the given poll with optionIndexes. Passing an empty slice clears
// the voter's ballot. This mirrors the replace-the-full-set convention used
// elsewhere in this codebase (e.g. SetMemoAttachments): idempotent, and
// correct for both single-choice (one index) and multiple-choice (many
// indexes) polls since the caller decides how many indexes to send.
//
// memoID is stamped onto every inserted row (denormalized from the poll
// binding) purely so memo deletion can clean up poll_vote with the same
// direct memo_id IN (...) pattern used for every other memo-child table
// (see deleteReactionsByMemoIDsTx and friends) - it is not re-validated
// here; callers must have already gone through EnsurePollBinding.
func (s *Store) SetPollVotes(ctx context.Context, pollUID string, memoID int32, voterID int32, optionIndexes []int32) ([]*PollVote, error) {
	if pollUID == "" {
		return nil, errors.New("poll uid is required")
	}
	if memoID <= 0 {
		return nil, errors.New("memo id is required")
	}
	if voterID <= 0 {
		return nil, errors.New("voter id is required")
	}

	db := s.driver.GetDB()
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return nil, errors.Wrap(err, "failed to begin poll vote transaction")
	}
	defer func() { _ = tx.Rollback() }()

	if err := setPollVotesTx(ctx, tx, s.pollRebind, pollUID, memoID, voterID, optionIndexes); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, errors.Wrap(err, "failed to commit poll vote transaction")
	}

	return s.ListPollVotes(ctx, pollUID)
}

func setPollVotesTx(ctx context.Context, tx *sql.Tx, rebind func(string) string, pollUID string, memoID int32, voterID int32, optionIndexes []int32) error {
	if _, err := tx.ExecContext(ctx, rebind(`DELETE FROM poll_vote WHERE poll_uid = ? AND voter_id = ?`), pollUID, voterID); err != nil {
		return errors.Wrap(err, "failed to clear existing poll votes")
	}

	// De-duplicate while preserving order in case the caller sends the same
	// option index twice (the UNIQUE constraint would otherwise reject it).
	seen := make(map[int32]bool, len(optionIndexes))
	for _, optionIndex := range optionIndexes {
		if seen[optionIndex] {
			continue
		}
		seen[optionIndex] = true
		if _, err := tx.ExecContext(ctx, rebind(`
			INSERT INTO poll_vote (poll_uid, memo_id, option_index, voter_id)
			VALUES (?, ?, ?, ?)
		`), pollUID, memoID, optionIndex, voterID); err != nil {
			return errors.Wrap(err, "failed to insert poll vote")
		}
	}
	return nil
}
