package llm

import "context"

// Provider describes text-generation capabilities for note assistance.
type Provider interface {
	GenerateSummary(ctx context.Context, content string) (string, error)
	ExtractTags(ctx context.Context, content string) ([]string, error)
	DeriveRelations(ctx context.Context, currentMemo string, candidateMemos []string) ([]RelationSuggestion, error)
}

// RelationSuggestion describes a related memo candidate returned by a model.
type RelationSuggestion struct {
	CandidateIndex int
	Score          float64
	Reason         string
}
