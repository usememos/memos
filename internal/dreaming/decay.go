package dreaming

import (
	"math"
	"time"

	"github.com/usememos/memos/store"
)

// DecayConfig holds decay-related configuration.
type DecayConfig struct {
	HalfLifeDays         int     // Days for salience to decay to 50%
	ReinforcementBoost   float64 // Multiplier when insight is retrieved
	ArchiveThreshold     float64 // Below this salience, archive the insight
	MaxDecayFactor       float64 // Minimum decay factor floor (0.01)
}

// DefaultDecayConfig returns the default decay configuration.
func DefaultDecayConfig() DecayConfig {
	return DecayConfig{
		HalfLifeDays:       30,
		ReinforcementBoost: 1.2,
		ArchiveThreshold:   0.1,
		MaxDecayFactor:     0.01,
	}
}

// CalculateDecayFactor computes the decay factor based on time since last reinforcement.
// Formula: decay(t) = 0.5 ^ (days_since_last_reinforced / half_life)
func CalculateDecayFactor(lastReinforcedTs int64, halfLifeDays int) float64 {
	if lastReinforcedTs == 0 {
		// Never reinforced, use a default age (e.g., created_at or now)
		lastReinforcedTs = time.Now().Unix()
	}

	daysSince := float64(time.Now().Unix()-lastReinforcedTs) / (24 * 60 * 60)
	if daysSince < 0 {
		daysSince = 0
	}

	halfLife := float64(halfLifeDays)
	if halfLife <= 0 {
		halfLife = 30
	}

	decay := math.Pow(0.5, daysSince/halfLife)
	return math.Round(decay*1000) / 1000
}

// ApplyDecayToInsight updates the salience score and decay factor for an insight.
// This implements the continuous forgetting mechanism from the design doc.
func ApplyDecayToInsight(insight *store.DreamingInsight, cfg DecayConfig) {
	if insight == nil {
		return
	}

	// Calculate new decay factor
	newDecayFactor := CalculateDecayFactor(insight.LastReinforcedAt, cfg.HalfLifeDays)

	// Apply floor
	if newDecayFactor < cfg.MaxDecayFactor {
		newDecayFactor = cfg.MaxDecayFactor
	}

	// Calculate new salience: effective_salience = base_salience * decay(time_since_last_reinforced)
	// For simplicity, salience_score itself represents the effective salience
	// and decay_factor tracks the multiplicative decay
	insight.DecayFactor = newDecayFactor

	// Determine if insight should be archived
	if insight.SalienceScore*newDecayFactor < cfg.ArchiveThreshold {
		status := store.InsightStatusArchived
		insight.Status = status
	}
}

// ReinforceInsight updates an insight when it is retrieved/used.
// This prevents decay and can boost salience.
func ReinforceInsight(insight *store.DreamingInsight, cfg DecayConfig) {
	if insight == nil {
		return
	}

	// Update last reinforced timestamp
	insight.LastReinforcedAt = time.Now().Unix()

	// Apply reinforcement boost to salience
	newSalience := insight.SalienceScore * cfg.ReinforcementBoost
	if newSalience > 1.0 {
		newSalience = 1.0
	}
	insight.SalienceScore = math.Round(newSalience*100) / 100

	// Reset decay factor since it was just reinforced
	insight.DecayFactor = 1.0

	// Increase support count
	insight.SupportCount++
}

// ComputeEffectiveSalience returns the effective (decayed) salience of an insight.
func ComputeEffectiveSalience(insight *store.DreamingInsight) float64 {
	if insight == nil {
		return 0.0
	}
	effective := insight.SalienceScore * insight.DecayFactor
	return math.Round(effective*100) / 100
}

// ShouldArchive returns true if the insight's effective salience is below the archive threshold.
func ShouldArchive(insight *store.DreamingInsight, cfg DecayConfig) bool {
	effective := ComputeEffectiveSalience(insight)
	return effective < cfg.ArchiveThreshold
}

// UpdateRetrievalPriority recalculates the retrieval priority based on
// salience, recency, and confidence.
func UpdateRetrievalPriority(insight *store.DreamingInsight) float64 {
	if insight == nil {
		return 0.0
	}

	// recency factor: more recent = higher priority
	recencyDays := float64(time.Now().Unix()-insight.CreatedAt) / (24 * 60 * 60)
	recencyFactor := math.Max(0, 1.0-(recencyDays/90.0)) // decays to 0 over 90 days

	// confidence factor
	confidenceFactor := insight.Confidence

	// effective salience
	effectiveSalience := ComputeEffectiveSalience(insight)

	// Combine: priority = salience * recency * confidence
	priority := effectiveSalience * recencyFactor * confidenceFactor

	return math.Round(math.Min(priority, 1.0)*100) / 100
}
