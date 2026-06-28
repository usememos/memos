package v1

import (
	"testing"
	"time"
)

// TestCalculateCurrentStreak tests the current streak calculation logic.
func TestCalculateCurrentStreak(t *testing.T) {
	tests := []struct {
		name                  string
		dates                 []string
		timezoneOffsetMinutes int32
		expectedStreak        int
		description           string
	}{
		{
			name:                  "No dates",
			dates:                 []string{},
			timezoneOffsetMinutes: 0,
			expectedStreak:        0,
			description:           "Empty date list should return 0",
		},
		{
			name:                  "Activity today only",
			dates:                 []string{time.Now().UTC().Format("2006-01-02")},
			timezoneOffsetMinutes: 0,
			expectedStreak:        1,
			description:           "Single day activity today",
		},
		{
			name: "Consecutive 5 days ending today",
			dates: []string{
				time.Now().UTC().Format("2006-01-02"),
				time.Now().UTC().AddDate(0, 0, -1).Format("2006-01-02"),
				time.Now().UTC().AddDate(0, 0, -2).Format("2006-01-02"),
				time.Now().UTC().AddDate(0, 0, -3).Format("2006-01-02"),
				time.Now().UTC().AddDate(0, 0, -4).Format("2006-01-02"),
			},
			timezoneOffsetMinutes: 0,
			expectedStreak:        5,
			description:           "5 consecutive days including today",
		},
		{
			name: "Consecutive 3 days ending yesterday",
			dates: []string{
				time.Now().UTC().AddDate(0, 0, -1).Format("2006-01-02"),
				time.Now().UTC().AddDate(0, 0, -2).Format("2006-01-02"),
				time.Now().UTC().AddDate(0, 0, -3).Format("2006-01-02"),
			},
			timezoneOffsetMinutes: 0,
			expectedStreak:        3,
			description:           "Streak continues if last activity was yesterday",
		},
		{
			name: "Gap in streak - last activity 2 days ago",
			dates: []string{
				time.Now().UTC().AddDate(0, 0, -2).Format("2006-01-02"),
				time.Now().UTC().AddDate(0, 0, -3).Format("2006-01-02"),
				time.Now().UTC().AddDate(0, 0, -4).Format("2006-01-02"),
			},
			timezoneOffsetMinutes: 0,
			expectedStreak:        0,
			description:           "Streak broken if gap is more than 1 day",
		},
		{
			name: "Streak with gap in the middle",
			dates: []string{
				time.Now().UTC().Format("2006-01-02"),
				time.Now().UTC().AddDate(0, 0, -1).Format("2006-01-02"),
				time.Now().UTC().AddDate(0, 0, -2).Format("2006-01-02"),
				// Gap here
				time.Now().UTC().AddDate(0, 0, -5).Format("2006-01-02"),
				time.Now().UTC().AddDate(0, 0, -6).Format("2006-01-02"),
			},
			timezoneOffsetMinutes: 0,
			expectedStreak:        3,
			description:           "Current streak stops at gap",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := calculateCurrentStreak(tt.dates, tt.timezoneOffsetMinutes)
			if result != tt.expectedStreak {
				t.Errorf("%s: expected %d, got %d", tt.description, tt.expectedStreak, result)
			}
		})
	}
}

// TestCalculateLongestStreak tests the longest streak calculation logic.
func TestCalculateLongestStreak(t *testing.T) {
	tests := []struct {
		name           string
		dates          []string
		expectedStreak int
		description    string
	}{
		{
			name:           "No dates",
			dates:          []string{},
			expectedStreak: 0,
			description:    "Empty date list should return 0",
		},
		{
			name:           "Single date",
			dates:          []string{"2026-06-28"},
			expectedStreak: 1,
			description:    "Single date should return 1",
		},
		{
			name: "Consecutive 7 days",
			dates: []string{
				"2026-06-28",
				"2026-06-27",
				"2026-06-26",
				"2026-06-25",
				"2026-06-24",
				"2026-06-23",
				"2026-06-22",
			},
			expectedStreak: 7,
			description:    "7 consecutive days",
		},
		{
			name: "Multiple streaks - longest is 5",
			dates: []string{
				"2026-06-28",
				"2026-06-27",
				"2026-06-26", // Streak of 3
				"2026-06-20",
				"2026-06-19",
				"2026-06-18",
				"2026-06-17",
				"2026-06-16", // Streak of 5 (longest)
				"2026-06-10",
				"2026-06-09", // Streak of 2
			},
			expectedStreak: 5,
			description:    "Multiple separate streaks, returns longest",
		},
		{
			name: "Cross month boundary - May to June",
			dates: []string{
				"2026-06-03",
				"2026-06-02",
				"2026-06-01",
				"2026-05-31",
				"2026-05-30",
				"2026-05-29",
			},
			expectedStreak: 6,
			description:    "Streak crosses month boundary correctly",
		},
		{
			name: "Cross year boundary - Dec to Jan",
			dates: []string{
				"2027-01-03",
				"2027-01-02",
				"2027-01-01",
				"2026-12-31",
				"2026-12-30",
			},
			expectedStreak: 5,
			description:    "Streak crosses year boundary correctly",
		},
		{
			name: "Leap year - Feb 28 to Mar 1, 2024",
			dates: []string{
				"2024-03-02",
				"2024-03-01",
				"2024-02-29", // Leap day
				"2024-02-28",
				"2024-02-27",
			},
			expectedStreak: 5,
			description:    "Leap year handling - includes Feb 29",
		},
		{
			name: "Non-consecutive dates",
			dates: []string{
				"2026-06-28",
				"2026-06-26", // Gap
				"2026-06-24", // Gap
				"2026-06-22", // Gap
			},
			expectedStreak: 1,
			description:    "All dates have gaps, longest streak is 1",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := calculateLongestStreak(tt.dates)
			if result != tt.expectedStreak {
				t.Errorf("%s: expected %d, got %d", tt.description, tt.expectedStreak, result)
			}
		})
	}
}

// TestTimezoneHandling tests that timezone offsets correctly affect day boundaries.
func TestTimezoneHandling(t *testing.T) {
	// Scenario: User in UTC+8 creates a memo at 2026-06-28 01:00 UTC
	// In their timezone (UTC+8), it's 2026-06-28 09:00
	// In UTC, it's still 2026-06-28 01:00
	// Both should count as 2026-06-28 activity

	utcTime := time.Date(2026, 6, 28, 1, 0, 0, 0, time.UTC)

	// UTC timezone (offset 0)
	utcDate := utcTime.Add(0).Format("2006-01-02")
	if utcDate != "2026-06-28" {
		t.Errorf("UTC date should be 2026-06-28, got %s", utcDate)
	}

	// UTC+8 timezone (offset 480 minutes)
	utcPlus8Time := utcTime.Add(480 * time.Minute)
	utcPlus8Date := utcPlus8Time.Format("2006-01-02")
	if utcPlus8Date != "2026-06-28" {
		t.Errorf("UTC+8 date should be 2026-06-28, got %s", utcPlus8Date)
	}

	// Edge case: User in UTC+8 creates memo at 2026-06-27 23:30 UTC
	// In UTC: 2026-06-27 23:30
	// In UTC+8: 2026-06-28 07:30 (next day!)
	edgeTime := time.Date(2026, 6, 27, 23, 30, 0, 0, time.UTC)

	edgeUTC := edgeTime.Format("2006-01-02")
	if edgeUTC != "2026-06-27" {
		t.Errorf("UTC date should be 2026-06-27, got %s", edgeUTC)
	}

	edgePlus8 := edgeTime.Add(480 * time.Minute).Format("2006-01-02")
	if edgePlus8 != "2026-06-28" {
		t.Errorf("UTC+8 date should be 2026-06-28, got %s", edgePlus8)
	}

	t.Log("Timezone handling test passed: Same UTC timestamp maps to different local dates")
}

// TestStreakEdgeCases tests various edge cases for streak calculation.
func TestStreakEdgeCases(t *testing.T) {
	tests := []struct {
		name            string
		dates           []string
		expectedCurrent int
		expectedLongest int
		description     string
	}{
		{
			name: "30-day streak across month",
			dates: func() []string {
				var dates []string
				base := time.Date(2026, 6, 28, 0, 0, 0, 0, time.UTC)
				for i := 0; i < 30; i++ {
					dates = append(dates, base.AddDate(0, 0, -i).Format("2006-01-02"))
				}
				return dates
			}(),
			expectedCurrent: 30,
			expectedLongest: 30,
			description:     "30-day continuous streak",
		},
		{
			name: "365-day streak across year",
			dates: func() []string {
				var dates []string
				base := time.Date(2026, 6, 28, 0, 0, 0, 0, time.UTC)
				for i := 0; i < 365; i++ {
					dates = append(dates, base.AddDate(0, 0, -i).Format("2006-01-02"))
				}
				return dates
			}(),
			expectedCurrent: 365,
			expectedLongest: 365,
			description:     "Full year streak",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			currentStreak := calculateCurrentStreak(tt.dates, 0)
			longestStreak := calculateLongestStreak(tt.dates)

			if currentStreak != tt.expectedCurrent {
				t.Errorf("%s - Current: expected %d, got %d", tt.description, tt.expectedCurrent, currentStreak)
			}
			if longestStreak != tt.expectedLongest {
				t.Errorf("%s - Longest: expected %d, got %d", tt.description, tt.expectedLongest, longestStreak)
			}
		})
	}
}
