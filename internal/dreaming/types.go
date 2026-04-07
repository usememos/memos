package dreaming

import (
	"context"
	"time"

	"github.com/usememos/memos/store"
)

// Config holds the configuration for the dreaming pipeline.
type Config struct {
	// Micro dreaming interval (default: 2 hours)
	MicroInterval time.Duration
	// Major dreaming interval (default: 24 hours)
	MajorInterval time.Duration
	// Maximum replay queue items to process per micro run
	MicroBatchSize int
	// Maximum replay queue items to process per major run
	MajorBatchSize int
	// Replay queue activation threshold for spindle tagging
	ActivationThreshold float64
	// Spindle tagging LLM threshold (items above this go to LLM tagging)
	SpindleLLMThreshold float64
	// Consolidated insight retrieval priority threshold
	ConsolidatedPriorityThreshold float64
	// Associative insight retrieval priority threshold
	AssociativePriorityThreshold float64
	// Decay half-life in days for salience score
	DecayHalfLifeDays int
	// Reinforcement boost factor when insight is retrieved
	ReinforcementBoost float64
	// Archive threshold (salience below this gets archived)
	ArchiveThreshold float64
}

// DefaultConfig returns the default configuration.
func DefaultConfig() Config {
	return Config{
		MicroInterval:              2 * time.Hour,
		MajorInterval:              24 * time.Hour,
		MicroBatchSize:             50,
		MajorBatchSize:             200,
		ActivationThreshold:        0.3,
		SpindleLLMThreshold:        0.6,
		ConsolidatedPriorityThreshold: 0.5,
		AssociativePriorityThreshold: 0.3,
		DecayHalfLifeDays:          30,
		ReinforcementBoost:         1.2,
		ArchiveThreshold:           0.1,
	}
}

// PipelineInput is the input to the dreaming pipeline.
type PipelineInput struct {
	RunType  store.DreamingRunType
	Chunks   []*ChunkCandidate
	ExistingInsights []*store.DreamingInsight
}

// ChunkCandidate represents a chunk being considered for dreaming.
type ChunkCandidate struct {
	ChunkID    string
	SessionKey string
	Content    string
	CreatedTs  int64
	// Fields populated during scoring
	ActivationScore float64
	NoveltyScore    float64
}

// PipelineOutput is the result of a dreaming pipeline run.
type PipelineOutput struct {
	RunID          string
	RunType        store.DreamingRunType
	Phase          store.DreamingPhase
	Insights       []*store.DreamingInsight
	Evidences      []*store.DreamingInsightEvidence
	QueueUpdated   []*store.DreamingReplayQueueItem
	Stats          PipelineStats
}

// PipelineStats holds statistics from a pipeline run.
type PipelineStats struct {
	ChunksProcessed    int
	QueueItemsAdded    int
	QueueItemsUpdated  int
	InsightsCreated    int
	InsightsUpdated    int
	InsightsArchived   int
	DurationMs        int64
}

// ChunkReader is the interface for reading chunks from storage.
type ChunkReader interface {
	// ListRecentChunks returns chunks created or updated since the given timestamp.
	ListRecentChunks(ctx context.Context, sinceTs int64, limit int) ([]*ChunkCandidate, error)
	// GetChunkContent returns the content of a specific chunk.
	GetChunkContent(ctx context.Context, chunkID string) (string, error)
}

// InsightWriter is the interface for writing dreaming results.
type InsightWriter interface {
	CreateDreamingInsight(ctx context.Context, insight *store.DreamingInsight) (*store.DreamingInsight, error)
	UpdateDreamingInsight(ctx context.Context, update *store.UpdateDreamingInsight) error
	CreateDreamingInsightEvidence(ctx context.Context, evidence *store.DreamingInsightEvidence) (*store.DreamingInsightEvidence, error)
	ListDreamingInsights(ctx context.Context, find *store.FindDreamingInsight) ([]*store.DreamingInsight, error)
}

// QueueManager manages the replay queue.
type QueueManager interface {
	RefreshQueue(ctx context.Context, candidates []*ChunkCandidate) error
	ListCandidates(ctx context.Context, limit int, minActivation float64) ([]*store.DreamingReplayQueueItem, error)
	MarkProcessed(ctx context.Context, itemIDs []string) error
	UpdateSpindleTags(ctx context.Context, items []*store.DreamingReplayQueueItem) error
}
