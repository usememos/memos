package dreaming

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/pkg/errors"
	"github.com/usememos/memos/store"
)

// Package-level constants to avoid magic numbers.
const (
	defaultCreatorID    = 1
	lightConfidence     = 0.5
	remConfidence       = 0.4
	remSalience         = 0.5
	remRetrievalPrio    = 0.35
	lightRetrievalBoost = 0.8
	deepSalienceBoost   = 1.1
	deepRetrievalBoost  = 1.2
	staleRunTimeout     = 2 * time.Hour
)

// Pipeline orchestrates the full dreaming pipeline.
type Pipeline struct {
	store    *store.Store
	config   Config
	decayCfg DecayConfig
	logger   *slog.Logger
}

// NewPipeline creates a new dreaming pipeline instance.
func NewPipeline(s *store.Store, cfg Config) *Pipeline {
	return &Pipeline{
		store:    s,
		config:   cfg,
		decayCfg: DefaultDecayConfig(),
		logger:   slog.Default(),
	}
}

// Run executes a full dreaming pipeline run.
func (p *Pipeline) Run(ctx context.Context, runType store.DreamingRunType) (*PipelineOutput, error) {
	startTime := time.Now()
	runID := uuid.New().String()

	// Recover any stale runs before starting a new one.
	p.RecoverStaleRuns(ctx)

	// Check for already running runs to prevent concurrent execution.
	runningStatus := store.DreamingRunStatusRunning
	runningRuns, err := p.store.ListDreamingRuns(ctx, &store.FindDreamingRun{
		Status: &runningStatus,
	})
	if err != nil {
		return nil, errors.Wrap(err, "check running runs")
	}
	if len(runningRuns) > 0 {
		p.logger.Info("dreaming: skipping run, another run is already active", "active_run_id", runningRuns[0].ID)
		return &PipelineOutput{RunType: runType, Stats: PipelineStats{}}, nil
	}

	phase := store.DreamingPhaseLight
	if runType == store.DreamingRunTypeMajor {
		phase = store.DreamingPhaseDeep
	}

	run := &store.DreamingRun{
		ID:         runID,
		RunType:    runType,
		Status:     store.DreamingRunStatusRunning,
		StartedAt:  time.Now().Unix(),
		LockHolder: "dreaming-pipeline",
		Phase:      phase,
		StatsJSON:  "{}",
	}

	if _, err := p.store.CreateDreamingRun(ctx, run); err != nil {
		return nil, errors.Wrap(err, "create dreaming run")
	}
	defer p.cleanupRun(ctx, run.ID)

	output := &PipelineOutput{
		RunID:   runID,
		RunType: runType,
		Phase:   phase,
		Stats:   PipelineStats{},
	}

	var runErr error

	// Phase 1: Replay Queue Refresh (always runs).
	p.logger.Info("dreaming: refreshing replay queue", "run_id", runID)
	if err := p.refreshReplayQueue(ctx); err != nil {
		p.logger.Warn("dreaming: replay queue refresh failed", "run_id", runID, "error", err)
	}

	// Phase 2: Spindle Tagging.
	p.logger.Info("dreaming: spindle tagging", "run_id", runID)
	if err := p.runSpindleTagging(ctx); err != nil {
		p.logger.Warn("dreaming: spindle tagging failed", "run_id", runID, "error", err)
	}

	// Phase 3: Light Sleep (always runs).
	p.logger.Info("dreaming: light sleep phase", "run_id", runID)
	lightInsights, lightEvidences, err := p.runLightSleep(ctx)
	if err != nil {
		runErr = errors.Wrap(err, "light sleep")
	} else {
		output.Insights = append(output.Insights, lightInsights...)
		output.Evidences = append(output.Evidences, lightEvidences...)
		output.Stats.InsightsCreated += len(lightInsights)
	}

	// Phase 4: Deep Sleep (only in major runs).
	if runType == store.DreamingRunTypeMajor {
		p.logger.Info("dreaming: deep sleep phase", "run_id", runID)
		deepInsights, deepEvidences, err := p.runDeepSleep(ctx)
		if err != nil {
			runErr = errors.Wrap(err, "deep sleep")
		} else {
			output.Insights = append(output.Insights, deepInsights...)
			output.Evidences = append(output.Evidences, deepEvidences...)
			output.Stats.InsightsCreated += len(deepInsights)
		}

		// Phase 5: REM Sleep (only in major runs).
		p.logger.Info("dreaming: REM sleep phase", "run_id", runID)
		remInsights, remEvidences, err := p.runREMSleep(ctx)
		if err != nil {
			p.logger.Warn("dreaming: REM sleep failed", "run_id", runID, "error", err)
		} else {
			output.Insights = append(output.Insights, remInsights...)
			output.Evidences = append(output.Evidences, remEvidences...)
			output.Stats.InsightsCreated += len(remInsights)
		}
	}

	// Phase 6: Forgetting (always runs).
	p.logger.Info("dreaming: forgetting phase", "run_id", runID)
	archived, err := p.runForgetting(ctx)
	if err != nil {
		p.logger.Warn("dreaming: forgetting phase failed", "run_id", runID, "error", err)
	} else {
		output.Stats.InsightsArchived = archived
	}

	durationMs := time.Since(startTime).Milliseconds()
	output.Stats.DurationMs = durationMs
	statsJSON, _ := json.Marshal(output.Stats)
	statsJSONStr := string(statsJSON)

	status := store.DreamingRunStatusCompleted
	errorMsg := ""
	if runErr != nil {
		status = store.DreamingRunStatusFailed
		errorMsg = runErr.Error()
	}

	finishTs := time.Now().Unix()
	phaseUpdate := store.DreamingPhaseForgetting
	_ = p.store.UpdateDreamingRun(ctx, &store.UpdateDreamingRun{
		ID:           runID,
		Status:       &status,
		FinishedAt:   &finishTs,
		Phase:        &phaseUpdate,
		ErrorMessage: &errorMsg,
		StatsJSON:    &statsJSONStr,
	})

	return output, runErr
}

// RecoverStaleRuns finds and cancels runs that have been running too long.
func (p *Pipeline) RecoverStaleRuns(ctx context.Context) {
	runningStatus := store.DreamingRunStatusRunning
	runs, err := p.store.ListDreamingRuns(ctx, &store.FindDreamingRun{
		Status: &runningStatus,
	})
	if err != nil {
		p.logger.Warn("dreaming: failed to list running runs for recovery", "error", err)
		return
	}

	now := time.Now().Unix()
	staleThreshold := int64(staleRunTimeout.Seconds())
	cancelledStatus := store.DreamingRunStatusCancelled
	errMsg := "run exceeded stale timeout and was automatically cancelled"

	for _, run := range runs {
		if now-run.StartedAt > staleThreshold {
			p.logger.Info("dreaming: recovering stale run", "run_id", run.ID, "started_at", run.StartedAt)
			_ = p.store.UpdateDreamingRun(ctx, &store.UpdateDreamingRun{
				ID:           run.ID,
				Status:       &cancelledStatus,
				FinishedAt:   &now,
				ErrorMessage: &errMsg,
			})
		}
	}
}

// refreshReplayQueue reads recent memos and populates the replay queue with high-value candidates.
func (p *Pipeline) refreshReplayQueue(ctx context.Context) error {
	sinceTs := time.Now().Add(-7 * 24 * time.Hour).Unix()
	limit := p.config.MajorBatchSize

	// Read recent memos as chunk candidates.
	memos, err := p.store.ListMemos(ctx, &store.FindMemo{
		RowStatus:      ptrRowStatus(store.Normal),
		ExcludeContent: false,
		Limit:          &limit,
		// Filter by recent updated_ts using the OrderByTimeAsc + Limit approach.
		OrderByUpdatedTs: true,
	})
	if err != nil {
		return errors.Wrap(err, "list recent memos for replay queue")
	}

	if len(memos) == 0 {
		return nil
	}

	// Read existing insights for novelty calculation.
	existingInsights, err := p.store.ListDreamingInsights(ctx, &store.FindDreamingInsight{
		Status: ptrInsightStatus(store.InsightStatusActive),
		Limit:  intPtr(100),
	})
	if err != nil {
		p.logger.Warn("dreaming: failed to list existing insights for novelty scoring", "error", err)
		existingInsights = nil
	}

	added := 0
	for _, memo := range memos {
		if memo.CreatedTs < sinceTs && memo.UpdatedTs < sinceTs {
			continue
		}

		// Skip already queued items.
		existing, _ := p.store.ListDreamingReplayQueueItems(ctx, &store.FindDreamingReplayQueueItem{
			ChunkID: &memo.UID,
			Status:  ptrDreamingQueueItemStatus(store.DreamingQueueItemStatusQueued),
			Limit:   intPtr(1),
		})
		if len(existing) > 0 {
			continue
		}

		candidate := &ChunkCandidate{
			ChunkID:    memo.UID,
			SessionKey: fmt.Sprintf("user_%d", memo.CreatorID),
			Content:    memo.Content,
			CreatedTs:  memo.CreatedTs,
		}

		activation := CalculateActivationScore(candidate, 0, memo.Pinned, false)
		novelty := CalculateNoveltyScore(candidate, existingInsights)
		candidateScore := CalculateDreamingCandidateScore(activation, novelty)

		if candidateScore < p.config.ActivationThreshold {
			continue
		}

		now := time.Now().Unix()
		item := &store.DreamingReplayQueueItem{
			ID:                     uuid.New().String(),
			ChunkID:                memo.UID,
			SessionKey:             fmt.Sprintf("user_%d", memo.CreatorID),
			ActivationScore:        activation,
			NoveltyScore:           novelty,
			FirstQueuedAt:          now,
			QueueReason:            "recent_memo",
			Status:                 store.DreamingQueueItemStatusQueued,
			DreamingCandidateScore: candidateScore,
		}

		if _, err := p.store.CreateDreamingReplayQueueItem(ctx, item); err != nil {
			p.logger.Warn("dreaming: failed to queue replay item", "chunk_id", memo.UID, "error", err)
			continue
		}
		added++
	}

	if added > 0 {
		p.logger.Info("dreaming: replay queue refreshed", "added", added)
	}

	return nil
}

// runSpindleTagging applies spindle tagging to queued items.
func (p *Pipeline) runSpindleTagging(ctx context.Context) error {
	items, err := p.store.ListDreamingReplayQueueItems(ctx, &store.FindDreamingReplayQueueItem{
		Status:     ptrDreamingQueueItemStatus(store.DreamingQueueItemStatusQueued),
		SpindleTag: ptrSpindleTag(store.SpindleTagNone),
		Limit:      &p.config.MicroBatchSize,
	})
	if err != nil {
		return errors.Wrap(err, "list queued items")
	}

	for _, item := range items {
		candidate := &ChunkCandidate{
			ChunkID:    item.ChunkID,
			SessionKey: item.SessionKey,
			CreatedTs:  item.FirstQueuedAt,
		}

		activation := CalculateActivationScore(candidate, 0, false, false)
		novelty := CalculateNoveltyScore(candidate, nil)
		candidateScore := CalculateDreamingCandidateScore(activation, novelty)

		spindleTag := CalculateSpindleTag(candidateScore)
		kindHint := DetermineCandidateKindHint("")

		_ = p.store.UpdateDreamingReplayQueueItem(ctx, &store.UpdateDreamingReplayQueueItem{
			ID:                     item.ID,
			SpindleTag:             &spindleTag,
			CandidateKindHint:      &kindHint,
			DreamingCandidateScore: &candidateScore,
		})
	}

	return nil
}

// runLightSleep processes high-value candidates into preliminary insights.
func (p *Pipeline) runLightSleep(ctx context.Context) ([]*store.DreamingInsight, []*store.DreamingInsightEvidence, error) {
	items, err := p.store.ListDreamingReplayQueueItems(ctx, &store.FindDreamingReplayQueueItem{
		SpindleTag: ptrSpindleTag(store.SpindleTagStrong),
		Status:     ptrDreamingQueueItemStatus(store.DreamingQueueItemStatusQueued),
		Limit:      &p.config.MicroBatchSize,
	})
	if err != nil {
		return nil, nil, errors.Wrap(err, "list strong-tagged queue items")
	}

	var insights []*store.DreamingInsight
	var evidences []*store.DreamingInsightEvidence

	for _, item := range items {
		// Read the memo content for a meaningful summary.
		summary := fmt.Sprintf("Light insight from chunk %s", item.ChunkID)
		chunkContent := p.getChunkContent(ctx, item.ChunkID)
		if chunkContent != "" {
			// Truncate to first 200 chars for the summary.
			if len(chunkContent) > 200 {
				chunkContent = chunkContent[:200] + "..."
			}
			summary = chunkContent
		}

		insight := p.newInsight(
			store.DreamingPhaseLight,
			store.MemoryClassConsolidated,
			summary,
			item.CandidateKindHint,
			lightConfidence,
			item.DreamingCandidateScore,
			item.DreamingCandidateScore*lightRetrievalBoost,
		)

		if _, err := p.store.CreateDreamingInsight(ctx, insight); err != nil {
			p.logger.Warn("failed to create light insight", "error", err)
			continue
		}
		insights = append(insights, insight)

		if ev := p.createEvidence(ctx, insight.ID, item.ChunkID, item.SessionKey, item.DreamingCandidateScore, store.EvidenceRolePrimary); ev != nil {
			evidences = append(evidences, ev)
		}

		p.markQueueDone(ctx, item.ID)
	}

	return insights, evidences, nil
}

// runDeepSleep consolidates light insights into stable long-term memories.
func (p *Pipeline) runDeepSleep(ctx context.Context) ([]*store.DreamingInsight, []*store.DreamingInsightEvidence, error) {
	lightPhase := store.DreamingPhaseLight
	insights, err := p.store.ListDreamingInsights(ctx, &store.FindDreamingInsight{
		Phase:  &lightPhase,
		Status: ptrInsightStatus(store.InsightStatusActive),
		Limit:  intPtr(p.config.MajorBatchSize),
	})
	if err != nil {
		return nil, nil, errors.Wrap(err, "list light insights for deep sleep")
	}

	var deepInsights []*store.DreamingInsight
	var deepEvidences []*store.DreamingInsightEvidence
	now := time.Now().Unix()

	for _, light := range insights {
		confidence := light.Confidence + 0.2
		if confidence > 1.0 {
			confidence = 1.0
		}

		deepInsight := &store.DreamingInsight{
			ID:                uuid.New().String(),
			Summary:           light.Summary,
			Kind:              light.Kind,
			Phase:             store.DreamingPhaseDeep,
			MemoryClass:       store.MemoryClassConsolidated,
			Status:            store.InsightStatusActive,
			Confidence:        confidence,
			SalienceScore:     light.SalienceScore * deepSalienceBoost,
			RetrievalPriority: UpdateRetrievalPriority(light) * deepRetrievalBoost,
			DecayFactor:       1.0,
			SupportCount:      light.SupportCount + 1,
			CreatedAt:         now,
			UpdatedAt:         now,
			LastReinforcedAt:  now,
			CreatorID:         light.CreatorID,
		}

		if _, err := p.store.CreateDreamingInsight(ctx, deepInsight); err != nil {
			p.logger.Warn("failed to create deep insight", "error", err)
			continue
		}
		deepInsights = append(deepInsights, deepInsight)

		// Archive the original light insight as merged.
		archivedStatus := store.InsightStatusMerged
		mergedInto := deepInsight.ID
		_ = p.store.UpdateDreamingInsight(ctx, &store.UpdateDreamingInsight{
			ID:         light.ID,
			Status:     &archivedStatus,
			MergedInto: &mergedInto,
		})

		// Copy evidence links from the light insight to the deep insight.
		lightEvidences, _ := p.store.ListDreamingInsightEvidences(ctx, &store.FindDreamingInsightEvidence{
			InsightID: &light.ID,
		})
		for _, ev := range lightEvidences {
			newEv := &store.DreamingInsightEvidence{
				ID:           uuid.New().String(),
				InsightID:    deepInsight.ID,
				ChunkID:      ev.ChunkID,
				SessionKey:   ev.SessionKey,
				Relevance:    ev.Relevance,
				EvidenceRole: ev.EvidenceRole,
				CreatedAt:    now,
			}
			if created, err := p.store.CreateDreamingInsightEvidence(ctx, newEv); err == nil {
				deepEvidences = append(deepEvidences, created)
			}
		}
	}

	return deepInsights, deepEvidences, nil
}

// runREMSleep generates associative insights through cross-theme linking.
func (p *Pipeline) runREMSleep(ctx context.Context) ([]*store.DreamingInsight, []*store.DreamingInsightEvidence, error) {
	deepPhase := store.DreamingPhaseDeep
	consolidated := store.MemoryClassConsolidated
	insights, err := p.store.ListDreamingInsights(ctx, &store.FindDreamingInsight{
		Phase:       &deepPhase,
		MemoryClass: &consolidated,
		Status:      ptrInsightStatus(store.InsightStatusActive),
		Limit:       intPtr(50),
	})
	if err != nil {
		return nil, nil, errors.Wrap(err, "list consolidated insights for REM")
	}

	var remInsights []*store.DreamingInsight
	var remEvidences []*store.DreamingInsightEvidence
	now := time.Now().Unix()

	// Group consolidated insights by kind for cross-theme association.
	kindGroups := make(map[string][]*store.DreamingInsight)
	for _, insight := range insights {
		if insight.Kind != "" {
			kindGroups[insight.Kind] = append(kindGroups[insight.Kind], insight)
		}
	}

	for kind, group := range kindGroups {
		if len(group) < 2 {
			continue
		}

		summary := fmt.Sprintf("REM: consolidated pattern across %d %s insights", len(group), kind)

		remInsight := &store.DreamingInsight{
			ID:                uuid.New().String(),
			Summary:           summary,
			Kind:              kind,
			Phase:             store.DreamingPhaseREM,
			MemoryClass:       store.MemoryClassAssociative,
			Status:            store.InsightStatusActive,
			Confidence:        remConfidence,
			SalienceScore:     remSalience,
			RetrievalPriority: remRetrievalPrio,
			DecayFactor:       0.9,
			SupportCount:      len(group),
			CreatedAt:         now,
			UpdatedAt:         now,
			LastReinforcedAt:  now,
			CreatorID:         defaultCreatorID,
		}

		if _, err := p.store.CreateDreamingInsight(ctx, remInsight); err != nil {
			p.logger.Warn("failed to create REM insight", "error", err)
			continue
		}
		remInsights = append(remInsights, remInsight)

		// Link each source consolidated insight as supporting evidence.
		for _, src := range group {
			ev := &store.DreamingInsightEvidence{
				ID:           uuid.New().String(),
				InsightID:    remInsight.ID,
				ChunkID:      src.ID,
				SessionKey:   "",
				Relevance:    0.6,
				EvidenceRole: store.EvidenceRoleSupporting,
				CreatedAt:    now,
			}
			if created, err := p.store.CreateDreamingInsightEvidence(ctx, ev); err == nil {
				remEvidences = append(remEvidences, created)
			}
		}
	}

	return remInsights, remEvidences, nil
}

// runForgetting applies decay to all active insights.
func (p *Pipeline) runForgetting(ctx context.Context) (int, error) {
	active := store.InsightStatusActive
	allInsights, err := p.store.ListDreamingInsights(ctx, &store.FindDreamingInsight{
		Status: &active,
	})
	if err != nil {
		return 0, errors.Wrap(err, "list active insights for forgetting")
	}

	archived := 0
	for _, insight := range allInsights {
		ApplyDecayToInsight(insight, p.decayCfg)
		newPriority := UpdateRetrievalPriority(insight)

		_ = p.store.UpdateDreamingInsight(ctx, &store.UpdateDreamingInsight{
			ID:                insight.ID,
			SalienceScore:     &insight.SalienceScore,
			DecayFactor:       &insight.DecayFactor,
			RetrievalPriority: &newPriority,
			Status:            &insight.Status,
		})

		if insight.Status == store.InsightStatusArchived {
			archived++
		}
	}

	return archived, nil
}

// getChunkContent reads the content of a memo by its UID.
func (p *Pipeline) getChunkContent(ctx context.Context, chunkID string) string {
	memo, err := p.store.GetMemo(ctx, &store.FindMemo{UID: &chunkID})
	if err != nil || memo == nil {
		return ""
	}
	return memo.Content
}

// cleanupRun removes the run record after completion.
func (p *Pipeline) cleanupRun(ctx context.Context, runID string) {
	_ = p.store.DeleteDreamingRun(ctx, &store.DeleteDreamingRun{ID: runID})
}

// newInsight creates a new DreamingInsight with sensible defaults.
func (p *Pipeline) newInsight(phase store.DreamingPhase, mc store.MemoryClass, summary, kind string, confidence, salience, retrievalPrio float64) *store.DreamingInsight {
	now := time.Now().Unix()
	return &store.DreamingInsight{
		ID:                uuid.New().String(),
		Summary:           summary,
		Kind:              kind,
		Phase:             phase,
		MemoryClass:       mc,
		Status:            store.InsightStatusActive,
		Confidence:        confidence,
		SalienceScore:     salience,
		RetrievalPriority: retrievalPrio,
		DecayFactor:       1.0,
		SupportCount:      1,
		CreatedAt:         now,
		UpdatedAt:         now,
		LastReinforcedAt:  now,
		CreatorID:         defaultCreatorID,
	}
}

// createEvidence creates an insight evidence link. Returns nil on error (logs warning).
func (p *Pipeline) createEvidence(ctx context.Context, insightID, chunkID, sessionKey string, relevance float64, role store.EvidenceRole) *store.DreamingInsightEvidence {
	evid := &store.DreamingInsightEvidence{
		ID:           uuid.New().String(),
		InsightID:    insightID,
		ChunkID:      chunkID,
		SessionKey:   sessionKey,
		Relevance:    relevance,
		EvidenceRole: role,
		CreatedAt:    time.Now().Unix(),
	}
	if _, err := p.store.CreateDreamingInsightEvidence(ctx, evid); err != nil {
		p.logger.Warn("failed to create insight evidence", "error", err)
		return nil
	}
	return evid
}

// markQueueDone marks a replay queue item as done.
func (p *Pipeline) markQueueDone(ctx context.Context, itemID string) {
	status := store.DreamingQueueItemStatusDone
	now := time.Now().Unix()
	p.store.UpdateDreamingReplayQueueItem(ctx, &store.UpdateDreamingReplayQueueItem{
		ID:             itemID,
		Status:         &status,
		LastReplayedAt: &now,
	})
}

func ptrDreamingQueueItemStatus(s store.DreamingQueueItemStatus) *store.DreamingQueueItemStatus {
	return &s
}

func ptrSpindleTag(s store.SpindleTag) *store.SpindleTag {
	return &s
}

func ptrInsightStatus(s store.InsightStatus) *store.InsightStatus {
	return &s
}

func ptrRowStatus(s store.RowStatus) *store.RowStatus {
	return &s
}

func intPtr(i int) *int {
	return &i
}
