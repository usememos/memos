package dreaming

import (
	"math"
	"strings"
	"time"

	"github.com/usememos/memos/store"
)

// CalculateActivationScore computes the activation score for a replay queue item.
// Formula from design doc:
// activation_score = 0.35 * recency + 0.25 * retrieval_hits + 0.20 * source_importance + 0.20 * unresolvedness
func CalculateActivationScore(candidate *ChunkCandidate, retrievalHits int, hasHighWeight bool, isUnresolved bool) float64 {
	recencyWeight := 0.35
	hitsWeight := 0.25
	importanceWeight := 0.20
	unresolvedWeight := 0.20

	// recency: normalized, newer chunks get higher scores
	// Assume max age of 30 days for normalization
	recency := calculateRecencyScore(candidate.CreatedTs, 30*24*60*60)

	// retrieval_hits: normalized, capped at 10 hits
	hitsScore := math.Min(float64(retrievalHits)/10.0, 1.0)

	// source_importance: 1.0 if high-weight source, else 0.5
	importanceScore := 0.5
	if hasHighWeight {
		importanceScore = 1.0
	}

	// unresolvedness: 1.0 if contains unresolved items, else 0.0
	unresolvedScore := 0.0
	if isUnresolved {
		unresolvedScore = 1.0
	}

	score := recencyWeight*recency +
		hitsWeight*hitsScore +
		importanceWeight*importanceScore +
		unresolvedWeight*unresolvedScore

	return math.Round(score*100) / 100
}

// calculateRecencyScore returns a normalized recency score between 0 and 1.
func calculateRecencyScore(ts int64, maxAgeSeconds int64) float64 {
	age := time.Now().Unix() - ts
	if age < 0 {
		age = 0
	}
	ageSeconds := float64(age)
	maxAge := float64(maxAgeSeconds)
	if ageSeconds >= maxAge {
		return 0.0
	}
	return 1.0 - (ageSeconds / maxAge)
}

// CalculateNoveltyScore measures how novel a chunk is compared to existing insights.
func CalculateNoveltyScore(candidate *ChunkCandidate, existingInsights []*store.DreamingInsight) float64 {
	if len(existingInsights) == 0 {
		return 1.0
	}

	contentLower := strings.ToLower(candidate.Content)
	maxOverlap := 0.0
	for _, insight := range existingInsights {
		summaryLower := strings.ToLower(insight.Summary)
		overlap := calculateTextOverlap(contentLower, summaryLower)
		if overlap > maxOverlap {
			maxOverlap = overlap
		}
	}
	novelty := 1.0 - maxOverlap
	return math.Round(novelty*100) / 100
}

// calculateTextOverlap is a simple word-overlap based similarity measure.
func calculateTextOverlap(a, b string) float64 {
	wordsA := strings.Fields(a)
	wordsB := strings.Fields(b)
	if len(wordsA) == 0 || len(wordsB) == 0 {
		return 0.0
	}

	setB := make(map[string]bool)
	for _, w := range wordsB {
		setB[w] = true
	}

	overlap := 0
	for _, w := range wordsA {
		if setB[w] {
			overlap++
		}
	}

	// Jaccard-like coefficient
	union := len(wordsA) + len(wordsB) - overlap
	if union == 0 {
		return 0.0
	}
	return float64(overlap) / float64(union)
}

// CalculateDreamingCandidateScore combines activation and novelty into the final candidate score.
// Formula: 0.6 * activation + 0.4 * novelty
func CalculateDreamingCandidateScore(activation, novelty float64) float64 {
	score := 0.6*activation + 0.4*novelty
	return math.Round(score*100) / 100
}

// CalculateSpindleTag returns the spindle tag based on the dreaming candidate score.
func CalculateSpindleTag(score float64) store.SpindleTag {
	if score >= 0.7 {
		return store.SpindleTagStrong
	}
	if score >= 0.4 {
		return store.SpindleTagWeak
	}
	return store.SpindleTagNone
}

// DetermineCandidateKindHint classifies the candidate into a kind using lightweight heuristics.
func DetermineCandidateKindHint(content string) string {
	contentLower := strings.ToLower(content)

	projectKeywords := []string{"working on", "project", "building", "developing", "implementing", "planning to", "going to build"}
	if containsAny(contentLower, projectKeywords) {
		return "project"
	}

	prefKeywords := []string{"prefer", "like", "enjoy", "usually", "always", "never", "favorite"}
	if containsAny(contentLower, prefKeywords) {
		return "preference"
	}

	decKeywords := []string{"decided", "chose", "will do", "going with", "commit to"}
	if containsAny(contentLower, decKeywords) {
		return "decision"
	}

	issueKeywords := []string{"bug", "issue", "problem", "error", "fail", "broken", "doesn't work", "not working"}
	if containsAny(contentLower, issueKeywords) {
		return "issue"
	}

	personKeywords := []string{"talked to", "met with", "spoke to", "team", "colleague"}
	if containsAny(contentLower, personKeywords) {
		return "person"
	}

	patternKeywords := []string{"often", "always", "tend to", "keep", "repeatedly", "habit"}
	if containsAny(contentLower, patternKeywords) {
		return "pattern"
	}

	return "general"
}

// CalculateRetrievalPriority computes the retrieval priority for an insight.
func CalculateRetrievalPriority(basePriority, salienceScore, decayFactor, reinforcementFactor float64) float64 {
	priority := basePriority * salienceScore * decayFactor * reinforcementFactor
	return math.Round(math.Min(priority, 1.0)*100) / 100
}

// containsAny checks if any of the keywords exist in the text.
func containsAny(text string, keywords []string) bool {
	for _, kw := range keywords {
		if strings.Contains(text, kw) {
			return true
		}
	}
	return false
}
