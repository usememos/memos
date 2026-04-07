package sqlite

import (
	"context"
	"fmt"
	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

func (d *DB) CreateDreamingRun(ctx context.Context, create *store.DreamingRun) (*store.DreamingRun, error) {
	query := `
		INSERT INTO dreaming_runs (id, run_type, status, started_at, finished_at, lock_holder, error_message, stats_json, phase)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		`
	_, err := d.db.ExecContext(ctx, query,
		create.ID, create.RunType, create.Status, create.StartedAt,
		create.FinishedAt, create.LockHolder, create.ErrorMessage,
		create.StatsJSON, create.Phase,
	)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create dreaming run")
	}
	return create, nil
}

func (d *DB) ListDreamingRuns(ctx context.Context, find *store.FindDreamingRun) ([]*store.DreamingRun, error) {
	query := `SELECT id, run_type, status, started_at, finished_at, lock_holder, error_message, stats_json, phase FROM dreaming_runs WHERE 1=1`
	args := []any{}

	if find.ID != nil {
		query += " AND id = ?"
		args = append(args, *find.ID)
	}
	if find.RunType != nil {
		query += " AND run_type = ?"
		args = append(args, *find.RunType)
	}
	if find.Status != nil {
		query += " AND status = ?"
		args = append(args, *find.Status)
	}
	if find.LockHolder != nil {
		query += " AND lock_holder = ?"
		args = append(args, *find.LockHolder)
	}

	query += " ORDER BY started_at DESC"
	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to list dreaming runs")
	}
	defer rows.Close()

	var runs []*store.DreamingRun
	for rows.Next() {
		run := &store.DreamingRun{}
		if err := rows.Scan(
			&run.ID, &run.RunType, &run.Status, &run.StartedAt, &run.FinishedAt,
			&run.LockHolder, &run.ErrorMessage, &run.StatsJSON, &run.Phase,
		); err != nil {
			return nil, errors.Wrap(err, "failed to scan dreaming run")
		}
		runs = append(runs, run)
	}
	return runs, nil
}

func (d *DB) UpdateDreamingRun(ctx context.Context, update *store.UpdateDreamingRun) error {
	set := []string{}
	args := []any{}

	if update.Status != nil {
		set = append(set, "status = ?")
		args = append(args, *update.Status)
	}
	if update.FinishedAt != nil {
		set = append(set, "finished_at = ?")
		args = append(args, *update.FinishedAt)
	}
	if update.LockHolder != nil {
		set = append(set, "lock_holder = ?")
		args = append(args, *update.LockHolder)
	}
	if update.ErrorMessage != nil {
		set = append(set, "error_message = ?")
		args = append(args, *update.ErrorMessage)
	}
	if update.StatsJSON != nil {
		set = append(set, "stats_json = ?")
		args = append(args, *update.StatsJSON)
	}
	if update.Phase != nil {
		set = append(set, "phase = ?")
		args = append(args, *update.Phase)
	}
	if len(set) == 0 {
		return nil
	}

	args = append(args, update.ID)
	query := fmt.Sprintf("UPDATE dreaming_runs SET %s WHERE id = ?", strings.Join(set, ", "))
	_, err := d.db.ExecContext(ctx, query, args...)
	return errors.Wrap(err, "failed to update dreaming run")
}

func (d *DB) DeleteDreamingRun(ctx context.Context, delete *store.DeleteDreamingRun) error {
	_, err := d.db.ExecContext(ctx, "DELETE FROM dreaming_runs WHERE id = ?", delete.ID)
	return errors.Wrap(err, "failed to delete dreaming run")
}

func (d *DB) CreateDreamingReplayQueueItem(ctx context.Context, create *store.DreamingReplayQueueItem) (*store.DreamingReplayQueueItem, error) {
	query := `
		INSERT INTO dreaming_replay_queue (id, chunk_id, session_key, activation_score, novelty_score, rehearsal_count, first_queued_at, last_replayed_at, queue_reason, status, spindle_tag, dreaming_candidate_score, candidate_kind_hint)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	_, err := d.db.ExecContext(ctx, query,
		create.ID, create.ChunkID, create.SessionKey, create.ActivationScore,
		create.NoveltyScore, create.RehearsalCount, create.FirstQueuedAt,
		create.LastReplayedAt, create.QueueReason, create.Status,
		create.SpindleTag, create.DreamingCandidateScore, create.CandidateKindHint,
	)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create replay queue item")
	}
	return create, nil
}

func (d *DB) ListDreamingReplayQueueItems(ctx context.Context, find *store.FindDreamingReplayQueueItem) ([]*store.DreamingReplayQueueItem, error) {
	query := `SELECT id, chunk_id, session_key, activation_score, novelty_score, rehearsal_count, first_queued_at, last_replayed_at, queue_reason, status, spindle_tag, dreaming_candidate_score, candidate_kind_hint FROM dreaming_replay_queue WHERE 1=1`
	args := []any{}

	if find.ID != nil {
		query += " AND id = ?"
		args = append(args, *find.ID)
	}
	if find.ChunkID != nil {
		query += " AND chunk_id = ?"
		args = append(args, *find.ChunkID)
	}
	if find.SessionKey != nil {
		query += " AND session_key = ?"
		args = append(args, *find.SessionKey)
	}
	if find.Status != nil {
		query += " AND status = ?"
		args = append(args, *find.Status)
	}
	if find.SpindleTag != nil {
		query += " AND spindle_tag = ?"
		args = append(args, *find.SpindleTag)
	}

	query += " ORDER BY dreaming_candidate_score DESC"
	if find.Limit != nil {
		query += fmt.Sprintf(" LIMIT %d", *find.Limit)
	}

	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to list replay queue items")
	}
	defer rows.Close()

	var items []*store.DreamingReplayQueueItem
	for rows.Next() {
		item := &store.DreamingReplayQueueItem{}
		if err := rows.Scan(
			&item.ID, &item.ChunkID, &item.SessionKey, &item.ActivationScore,
			&item.NoveltyScore, &item.RehearsalCount, &item.FirstQueuedAt,
			&item.LastReplayedAt, &item.QueueReason, &item.Status,
			&item.SpindleTag, &item.DreamingCandidateScore, &item.CandidateKindHint,
		); err != nil {
			return nil, errors.Wrap(err, "failed to scan replay queue item")
		}
		items = append(items, item)
	}
	return items, nil
}

func (d *DB) UpdateDreamingReplayQueueItem(ctx context.Context, update *store.UpdateDreamingReplayQueueItem) error {
	set := []string{}
	args := []any{}

	if update.Status != nil {
		set = append(set, "status = ?")
		args = append(args, *update.Status)
	}
	if update.SpindleTag != nil {
		set = append(set, "spindle_tag = ?")
		args = append(args, *update.SpindleTag)
	}
	if update.DreamingCandidateScore != nil {
		set = append(set, "dreaming_candidate_score = ?")
		args = append(args, *update.DreamingCandidateScore)
	}
	if update.CandidateKindHint != nil {
		set = append(set, "candidate_kind_hint = ?")
		args = append(args, *update.CandidateKindHint)
	}
	if update.LastReplayedAt != nil {
		set = append(set, "last_replayed_at = ?")
		args = append(args, *update.LastReplayedAt)
	}
	if update.RehearsalCount != nil {
		set = append(set, "rehearsal_count = ?")
		args = append(args, *update.RehearsalCount)
	}
	if len(set) == 0 {
		return nil
	}

	args = append(args, update.ID)
	query := fmt.Sprintf("UPDATE dreaming_replay_queue SET %s WHERE id = ?", strings.Join(set, ", "))
	_, err := d.db.ExecContext(ctx, query, args...)
	return errors.Wrap(err, "failed to update replay queue item")
}

func (d *DB) DeleteDreamingReplayQueueItem(ctx context.Context, delete *store.DeleteDreamingReplayQueueItem) error {
	_, err := d.db.ExecContext(ctx, "DELETE FROM dreaming_replay_queue WHERE id = ?", delete.ID)
	return errors.Wrap(err, "failed to delete replay queue item")
}

func (d *DB) CreateDreamingInsight(ctx context.Context, create *store.DreamingInsight) (*store.DreamingInsight, error) {
	query := `
		INSERT INTO dreaming_insights (id, summary, kind, phase, memory_class, status, confidence, salience_score, retrieval_priority, decay_factor, support_count, created_at, updated_at, last_reinforced_at, merged_into, creator_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	_, err := d.db.ExecContext(ctx, query,
		create.ID, create.Summary, create.Kind, create.Phase, create.MemoryClass,
		create.Status, create.Confidence, create.SalienceScore, create.RetrievalPriority,
		create.DecayFactor, create.SupportCount, create.CreatedAt, create.UpdatedAt,
		create.LastReinforcedAt, create.MergedInto, create.CreatorID,
	)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create dreaming insight")
	}
	return create, nil
}

func (d *DB) ListDreamingInsights(ctx context.Context, find *store.FindDreamingInsight) ([]*store.DreamingInsight, error) {
	query := `SELECT id, summary, kind, phase, memory_class, status, confidence, salience_score, retrieval_priority, decay_factor, support_count, created_at, updated_at, last_reinforced_at, merged_into, creator_id FROM dreaming_insights WHERE 1=1`
	args := []any{}

	if find.ID != nil {
		query += " AND id = ?"
		args = append(args, *find.ID)
	}
	if find.MemoryClass != nil {
		query += " AND memory_class = ?"
		args = append(args, *find.MemoryClass)
	}
	if find.Status != nil {
		query += " AND status = ?"
		args = append(args, *find.Status)
	}
	if find.Kind != nil {
		query += " AND kind = ?"
		args = append(args, *find.Kind)
	}
	if find.Phase != nil {
		query += " AND phase = ?"
		args = append(args, *find.Phase)
	}
	if find.RetrievalPriorityGreaterThan != nil {
		query += " AND retrieval_priority > ?"
		args = append(args, *find.RetrievalPriorityGreaterThan)
	}

	query += " ORDER BY retrieval_priority DESC"
	if find.Limit != nil {
		query += fmt.Sprintf(" LIMIT %d", *find.Limit)
		if find.Offset != nil {
			query += fmt.Sprintf(" OFFSET %d", *find.Offset)
		}
	}

	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to list dreaming insights")
	}
	defer rows.Close()

	var insights []*store.DreamingInsight
	for rows.Next() {
		insight := &store.DreamingInsight{}
		if err := rows.Scan(
			&insight.ID, &insight.Summary, &insight.Kind, &insight.Phase,
			&insight.MemoryClass, &insight.Status, &insight.Confidence,
			&insight.SalienceScore, &insight.RetrievalPriority, &insight.DecayFactor,
			&insight.SupportCount, &insight.CreatedAt, &insight.UpdatedAt,
			&insight.LastReinforcedAt, &insight.MergedInto, &insight.CreatorID,
		); err != nil {
			return nil, errors.Wrap(err, "failed to scan dreaming insight")
		}
		insights = append(insights, insight)
	}
	return insights, nil
}

func (d *DB) UpdateDreamingInsight(ctx context.Context, update *store.UpdateDreamingInsight) error {
	set := []string{}
	args := []any{}

	if update.Status != nil {
		set = append(set, "status = ?")
		args = append(args, *update.Status)
	}
	if update.Confidence != nil {
		set = append(set, "confidence = ?")
		args = append(args, *update.Confidence)
	}
	if update.SalienceScore != nil {
		set = append(set, "salience_score = ?")
		args = append(args, *update.SalienceScore)
	}
	if update.RetrievalPriority != nil {
		set = append(set, "retrieval_priority = ?")
		args = append(args, *update.RetrievalPriority)
	}
	if update.DecayFactor != nil {
		set = append(set, "decay_factor = ?")
		args = append(args, *update.DecayFactor)
	}
	if update.SupportCount != nil {
		set = append(set, "support_count = ?")
		args = append(args, *update.SupportCount)
	}
	if update.LastReinforcedAt != nil {
		set = append(set, "last_reinforced_at = ?")
		args = append(args, *update.LastReinforcedAt)
	}
	if update.MergedInto != nil {
		set = append(set, "merged_into = ?")
		args = append(args, *update.MergedInto)
	}
	if len(set) == 0 {
		return nil
	}

	set = append(set, "updated_at = ?")
	args = append(args, store.GetCurrentTimestamp())
	args = append(args, update.ID)
	query := fmt.Sprintf("UPDATE dreaming_insights SET %s WHERE id = ?", strings.Join(set, ", "))
	_, err := d.db.ExecContext(ctx, query, args...)
	return errors.Wrap(err, "failed to update dreaming insight")
}

func (d *DB) DeleteDreamingInsight(ctx context.Context, delete *store.DeleteDreamingInsight) error {
	_, err := d.db.ExecContext(ctx, "DELETE FROM dreaming_insights WHERE id = ?", delete.ID)
	return errors.Wrap(err, "failed to delete dreaming insight")
}

func (d *DB) CreateDreamingInsightEvidence(ctx context.Context, create *store.DreamingInsightEvidence) (*store.DreamingInsightEvidence, error) {
	query := `
		INSERT INTO dreaming_insight_evidence (id, insight_id, chunk_id, session_key, relevance, evidence_role, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)`
	_, err := d.db.ExecContext(ctx, query,
		create.ID, create.InsightID, create.ChunkID, create.SessionKey,
		create.Relevance, create.EvidenceRole, create.CreatedAt,
	)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create insight evidence")
	}
	return create, nil
}

func (d *DB) ListDreamingInsightEvidences(ctx context.Context, find *store.FindDreamingInsightEvidence) ([]*store.DreamingInsightEvidence, error) {
	query := `SELECT id, insight_id, chunk_id, session_key, relevance, evidence_role, created_at FROM dreaming_insight_evidence WHERE 1=1`
	args := []any{}

	if find.InsightID != nil {
		query += " AND insight_id = ?"
		args = append(args, *find.InsightID)
	}
	if find.ChunkID != nil {
		query += " AND chunk_id = ?"
		args = append(args, *find.ChunkID)
	}

	query += " ORDER BY relevance DESC"
	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to list insight evidences")
	}
	defer rows.Close()

	var evidences []*store.DreamingInsightEvidence
	for rows.Next() {
		ev := &store.DreamingInsightEvidence{}
		if err := rows.Scan(&ev.ID, &ev.InsightID, &ev.ChunkID, &ev.SessionKey, &ev.Relevance, &ev.EvidenceRole, &ev.CreatedAt); err != nil {
			return nil, errors.Wrap(err, "failed to scan insight evidence")
		}
		evidences = append(evidences, ev)
	}
	return evidences, nil
}

func (d *DB) UpsertDreamingInsightEmbedding(ctx context.Context, upsert *store.UpsertDreamingInsightEmbedding) error {
	_, err := d.db.ExecContext(ctx,
		"INSERT OR REPLACE INTO dreaming_insight_embeddings (insight_id, embedding, created_at) VALUES (?, ?, ?)",
		upsert.InsightID, upsert.Embedding, store.GetCurrentTimestamp(),
	)
	return errors.Wrap(err, "failed to upsert insight embedding")
}

func (d *DB) ListDreamingInsightEmbeddings(ctx context.Context, find *store.FindDreamingInsightEmbedding) ([]*store.DreamingInsightEmbedding, error) {
	query := "SELECT insight_id, embedding, created_at FROM dreaming_insight_embeddings WHERE 1=1"
	args := []any{}

	if find.InsightID != nil {
		query += " AND insight_id = ?"
		args = append(args, *find.InsightID)
	}

	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to list insight embeddings")
	}
	defer rows.Close()

	var embeddings []*store.DreamingInsightEmbedding
	for rows.Next() {
		emb := &store.DreamingInsightEmbedding{}
		if err := rows.Scan(&emb.InsightID, &emb.Embedding, &emb.CreatedAt); err != nil {
			return nil, errors.Wrap(err, "failed to scan insight embedding")
		}
		embeddings = append(embeddings, emb)
	}
	return embeddings, nil
}
