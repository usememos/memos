package store

import (
	"context"
	"time"
)

// DreamingPhase represents the current phase of a dreaming pipeline run.
type DreamingPhase string

const (
	DreamingPhaseLight     DreamingPhase = "light"
	DreamingPhaseDeep      DreamingPhase = "deep"
	DreamingPhaseREM       DreamingPhase = "rem"
	DreamingPhaseForgetting DreamingPhase = "forgetting"
)

// DreamingRunType represents the type of dreaming run.
type DreamingRunType string

const (
	DreamingRunTypeMicro  DreamingRunType = "micro"
	DreamingRunTypeMajor  DreamingRunType = "major"
	DreamingRunTypeManual DreamingRunType = "manual"
)

// DreamingRunStatus represents the status of a dreaming run.
type DreamingRunStatus string

const (
	DreamingRunStatusRunning   DreamingRunStatus = "running"
	DreamingRunStatusCompleted DreamingRunStatus = "completed"
	DreamingRunStatusFailed    DreamingRunStatus = "failed"
	DreamingRunStatusCancelled DreamingRunStatus = "cancelled"
)

// DreamingRun represents a single execution of the dreaming pipeline.
type DreamingRun struct {
	ID           string
	RunType      DreamingRunType
	Status       DreamingRunStatus
	StartedAt    int64
	FinishedAt   int64
	LockHolder   string
	ErrorMessage string
	StatsJSON    string
	Phase        DreamingPhase
}

// FindDreamingRun is the find payload for dreaming runs.
type FindDreamingRun struct {
	ID       *string
	RunType  *DreamingRunType
	Status   *DreamingRunStatus
	LockHolder *string
}

// UpdateDreamingRun is the update payload for dreaming runs.
type UpdateDreamingRun struct {
	ID          string
	Status      *DreamingRunStatus
	FinishedAt  *int64
	LockHolder  *string
	ErrorMessage *string
	StatsJSON   *string
	Phase       *DreamingPhase
}

// SpindleTag represents the tagging strength from spindle tagging phase.
type SpindleTag string

const (
	SpindleTagNone   SpindleTag = "none"
	SpindleTagWeak   SpindleTag = "weak"
	SpindleTagStrong SpindleTag = "strong"
)

// DreamingQueueItemStatus represents the status of a replay queue item.
type DreamingQueueItemStatus string

const (
	DreamingQueueItemStatusQueued     DreamingQueueItemStatus = "queued"
	DreamingQueueItemStatusProcessing DreamingQueueItemStatus = "processing"
	DreamingQueueItemStatusDone       DreamingQueueItemStatus = "done"
	DreamingQueueItemStatusEvicted    DreamingQueueItemStatus = "evicted"
)

// DreamingReplayQueueItem represents an item in the hippocampal replay buffer.
type DreamingReplayQueueItem struct {
	ID                       string
	ChunkID                  string
	SessionKey               string
	ActivationScore          float64
	NoveltyScore             float64
	RehearsalCount           int
	FirstQueuedAt            int64
	LastReplayedAt           int64
	QueueReason              string
	Status                   DreamingQueueItemStatus
	SpindleTag               SpindleTag
	DreamingCandidateScore   float64
	CandidateKindHint        string
}

// FindDreamingReplayQueueItem is the find payload for replay queue items.
type FindDreamingReplayQueueItem struct {
	ID         *string
	ChunkID    *string
	SessionKey *string
	Status     *DreamingQueueItemStatus
	SpindleTag *SpindleTag
	Limit      *int
}

// UpdateDreamingReplayQueueItem is the update payload for replay queue items.
type UpdateDreamingReplayQueueItem struct {
	ID                     string
	Status                 *DreamingQueueItemStatus
	SpindleTag             *SpindleTag
	DreamingCandidateScore *float64
	CandidateKindHint      *string
	LastReplayedAt         *int64
	RehearsalCount         *int
}

// MemoryClass represents the class of a dreaming insight.
type MemoryClass string

const (
	MemoryClassConsolidated MemoryClass = "consolidated"
	MemoryClassAssociative MemoryClass = "associative"
)

// InsightStatus represents the lifecycle status of an insight.
type InsightStatus string

const (
	InsightStatusActive   InsightStatus = "active"
	InsightStatusArchived InsightStatus = "archived"
	InsightStatusMerged   InsightStatus = "merged"
)

// DreamingInsight represents a distilled insight from the dreaming pipeline.
type DreamingInsight struct {
	ID                 string
	Summary            string
	Kind               string
	Phase              DreamingPhase
	MemoryClass        MemoryClass
	Status             InsightStatus
	Confidence         float64
	SalienceScore      float64
	RetrievalPriority  float64
	DecayFactor        float64
	SupportCount       int
	CreatedAt          int64
	UpdatedAt          int64
	LastReinforcedAt   int64
	MergedInto         string
	CreatorID          int32
}

// FindDreamingInsight is the find payload for dreaming insights.
type FindDreamingInsight struct {
	ID           *string
	MemoryClass  *MemoryClass
	Status       *InsightStatus
	Kind         *string
	Phase        *DreamingPhase
	RetrievalPriorityGreaterThan *float64
	Limit        *int
	Offset       *int
}

// UpdateDreamingInsight is the update payload for dreaming insights.
type UpdateDreamingInsight struct {
	ID                string
	Status            *InsightStatus
	Confidence        *float64
	SalienceScore     *float64
	RetrievalPriority *float64
	DecayFactor       *float64
	SupportCount      *int
	LastReinforcedAt  *int64
	MergedInto        *string
}

// EvidenceRole represents the role of evidence in supporting an insight.
type EvidenceRole string

const (
	EvidenceRolePrimary     EvidenceRole = "primary"
	EvidenceRoleSupporting  EvidenceRole = "supporting"
	EvidenceRoleConflicting EvidenceRole = "conflicting"
)

// DreamingInsightEvidence links insights to their source chunks.
type DreamingInsightEvidence struct {
	ID           string
	InsightID    string
	ChunkID      string
	SessionKey   string
	Relevance    float64
	EvidenceRole EvidenceRole
	CreatedAt    int64
}

// FindDreamingInsightEvidence is the find payload for insight evidence.
type FindDreamingInsightEvidence struct {
	InsightID *string
	ChunkID   *string
}

// DreamingInsightEmbedding stores vector embeddings for insights.
type DreamingInsightEmbedding struct {
	InsightID string
	Embedding []byte
	CreatedAt int64
}

// FindDreamingInsightEmbedding is the find payload for insight embeddings.
type FindDreamingInsightEmbedding struct {
	InsightID *string
}

// UpsertDreamingInsightEmbedding is the upsert payload for insight embeddings.
type UpsertDreamingInsightEmbedding struct {
	InsightID string
	Embedding []byte
}

// DeleteDreamingRun is the delete payload for dreaming runs.
type DeleteDreamingRun struct {
	ID string
}

// DeleteDreamingReplayQueueItem is the delete payload for replay queue items.
type DeleteDreamingReplayQueueItem struct {
	ID string
}

// DeleteDreamingInsight is the delete payload for dreaming insights.
type DeleteDreamingInsight struct {
	ID string
}

// GetCurrentTimestamp returns the current Unix timestamp in seconds.
func GetCurrentTimestamp() int64 {
	return time.Now().Unix()
}

// DreamingRun Store methods
func (s *Store) CreateDreamingRun(ctx context.Context, create *DreamingRun) (*DreamingRun, error) {
	return s.driver.CreateDreamingRun(ctx, create)
}
func (s *Store) ListDreamingRuns(ctx context.Context, find *FindDreamingRun) ([]*DreamingRun, error) {
	return s.driver.ListDreamingRuns(ctx, find)
}
func (s *Store) UpdateDreamingRun(ctx context.Context, update *UpdateDreamingRun) error {
	return s.driver.UpdateDreamingRun(ctx, update)
}
func (s *Store) DeleteDreamingRun(ctx context.Context, delete *DeleteDreamingRun) error {
	return s.driver.DeleteDreamingRun(ctx, delete)
}

// DreamingReplayQueueItem Store methods
func (s *Store) CreateDreamingReplayQueueItem(ctx context.Context, create *DreamingReplayQueueItem) (*DreamingReplayQueueItem, error) {
	return s.driver.CreateDreamingReplayQueueItem(ctx, create)
}
func (s *Store) ListDreamingReplayQueueItems(ctx context.Context, find *FindDreamingReplayQueueItem) ([]*DreamingReplayQueueItem, error) {
	return s.driver.ListDreamingReplayQueueItems(ctx, find)
}
func (s *Store) UpdateDreamingReplayQueueItem(ctx context.Context, update *UpdateDreamingReplayQueueItem) error {
	return s.driver.UpdateDreamingReplayQueueItem(ctx, update)
}
func (s *Store) DeleteDreamingReplayQueueItem(ctx context.Context, delete *DeleteDreamingReplayQueueItem) error {
	return s.driver.DeleteDreamingReplayQueueItem(ctx, delete)
}

// DreamingInsight Store methods
func (s *Store) CreateDreamingInsight(ctx context.Context, create *DreamingInsight) (*DreamingInsight, error) {
	return s.driver.CreateDreamingInsight(ctx, create)
}
func (s *Store) ListDreamingInsights(ctx context.Context, find *FindDreamingInsight) ([]*DreamingInsight, error) {
	return s.driver.ListDreamingInsights(ctx, find)
}
func (s *Store) UpdateDreamingInsight(ctx context.Context, update *UpdateDreamingInsight) error {
	return s.driver.UpdateDreamingInsight(ctx, update)
}
func (s *Store) DeleteDreamingInsight(ctx context.Context, delete *DeleteDreamingInsight) error {
	return s.driver.DeleteDreamingInsight(ctx, delete)
}

// DreamingInsightEvidence Store methods
func (s *Store) CreateDreamingInsightEvidence(ctx context.Context, create *DreamingInsightEvidence) (*DreamingInsightEvidence, error) {
	return s.driver.CreateDreamingInsightEvidence(ctx, create)
}
func (s *Store) ListDreamingInsightEvidences(ctx context.Context, find *FindDreamingInsightEvidence) ([]*DreamingInsightEvidence, error) {
	return s.driver.ListDreamingInsightEvidences(ctx, find)
}

// DreamingInsightEmbedding Store methods
func (s *Store) UpsertDreamingInsightEmbedding(ctx context.Context, upsert *UpsertDreamingInsightEmbedding) error {
	return s.driver.UpsertDreamingInsightEmbedding(ctx, upsert)
}
func (s *Store) ListDreamingInsightEmbeddings(ctx context.Context, find *FindDreamingInsightEmbedding) ([]*DreamingInsightEmbedding, error) {
	return s.driver.ListDreamingInsightEmbeddings(ctx, find)
}
