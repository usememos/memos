package store

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/pkg/errors"
)

// PollVote is a single user's selection of one option within a poll.
//
// Poll definitions (question, options, single/multiple-choice) are not
// stored server-side: they live inline in the memo's Markdown content as a
// fenced ```poll block, keyed by a client-generated poll UID. Only the
// votes themselves - the actual state that must stay consistent across
// concurrent voters - are persisted here, keyed by that UID.
type PollVote struct {
	ID          int32
	CreatedTs   int64
	PollUID     string
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

// ListPollVotes returns all votes cast for the given poll UID, ordered by
// insertion order.
func (s *Store) ListPollVotes(ctx context.Context, pollUID string) ([]*PollVote, error) {
	db := s.driver.GetDB()
	rows, err := db.QueryContext(ctx, s.pollRebind(`
		SELECT id, created_ts, poll_uid, option_index, voter_id
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
		if err := rows.Scan(&vote.ID, &vote.CreatedTs, &vote.PollUID, &vote.OptionIndex, &vote.VoterID); err != nil {
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
func (s *Store) SetPollVotes(ctx context.Context, pollUID string, voterID int32, optionIndexes []int32) ([]*PollVote, error) {
	if pollUID == "" {
		return nil, errors.New("poll uid is required")
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

	if err := setPollVotesTx(ctx, tx, s.pollRebind, pollUID, voterID, optionIndexes); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, errors.Wrap(err, "failed to commit poll vote transaction")
	}

	return s.ListPollVotes(ctx, pollUID)
}

func setPollVotesTx(ctx context.Context, tx *sql.Tx, rebind func(string) string, pollUID string, voterID int32, optionIndexes []int32) error {
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
			INSERT INTO poll_vote (poll_uid, option_index, voter_id)
			VALUES (?, ?, ?)
		`), pollUID, optionIndex, voterID); err != nil {
			return errors.Wrap(err, "failed to insert poll vote")
		}
	}
	return nil
}
