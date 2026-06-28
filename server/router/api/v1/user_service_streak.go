package v1

import (
	"context"
	"sort"
	"time"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

// StreakStats represents streak statistics for a user.
type StreakStats struct {
	CurrentStreak  int32
	LongestStreak  int32
	LastActiveDate string
}

// CalculateUserStreak computes the current and longest streak for a user.
// A "check-in" is defined as having at least one NORMAL memo on a given day.
// The day boundary is determined by the user's timezone offset.
//
// Parameters:
//   - ctx: context for the operation
//   - store: store interface for data access
//   - userID: the user's ID
//   - timezoneOffsetMinutes: offset from UTC in minutes (e.g., UTC+8 = 480, UTC-5 = -300)
//
// Returns:
//   - StreakStats containing current streak, longest streak, and last active date
func (s *APIV1Service) CalculateUserStreak(ctx context.Context, userID int32, timezoneOffsetMinutes int32) (*StreakStats, error) {
	// Query all NORMAL memos for this user
	normalStatus := store.Normal
	memoFind := &store.FindMemo{
		CreatorID:       &userID,
		RowStatus:       &normalStatus,
		ExcludeComments: true,
		ExcludeContent:  true,
	}

	// Get all memos in batches
	var allMemos []*store.Memo
	limit := 1000
	offset := 0
	memoFind.Limit = &limit
	memoFind.Offset = &offset

	for {
		memos, err := s.Store.ListMemos(ctx, memoFind)
		if err != nil {
			return nil, errors.Wrap(err, "failed to list memos for streak calculation")
		}
		if len(memos) == 0 {
			break
		}
		allMemos = append(allMemos, memos...)
		offset += limit
	}

	// If no memos, return zero stats
	if len(allMemos) == 0 {
		return &StreakStats{
			CurrentStreak:  0,
			LongestStreak:  0,
			LastActiveDate: "",
		}, nil
	}

	// Convert timestamps to local dates and deduplicate
	activeDatesMap := make(map[string]bool)
	timezoneOffset := time.Duration(timezoneOffsetMinutes) * time.Minute

	for _, memo := range allMemos {
		// Convert Unix timestamp to UTC time, then apply timezone offset
		utcTime := time.Unix(memo.CreatedTs, 0).UTC()
		localTime := utcTime.Add(timezoneOffset)
		dateStr := localTime.Format("2006-01-02")
		activeDatesMap[dateStr] = true
	}

	// Convert map to sorted slice (descending order - newest first)
	activeDates := make([]string, 0, len(activeDatesMap))
	for date := range activeDatesMap {
		activeDates = append(activeDates, date)
	}
	sort.Slice(activeDates, func(i, j int) bool {
		return activeDates[i] > activeDates[j] // Descending
	})

	// Calculate current streak and longest streak
	currentStreak := calculateCurrentStreak(activeDates, timezoneOffsetMinutes)
	longestStreak := calculateLongestStreak(activeDates)

	lastActiveDate := ""
	if len(activeDates) > 0 {
		lastActiveDate = activeDates[0] // Most recent date
	}

	return &StreakStats{
		CurrentStreak:  int32(currentStreak),
		LongestStreak:  int32(longestStreak),
		LastActiveDate: lastActiveDate,
	}, nil
}

// calculateCurrentStreak computes the current consecutive streak.
// The streak starts from today (or yesterday if no activity today) and counts backward.
func calculateCurrentStreak(sortedDates []string, timezoneOffsetMinutes int32) int {
	if len(sortedDates) == 0 {
		return 0
	}

	// Get today's date in user's timezone
	timezoneOffset := time.Duration(timezoneOffsetMinutes) * time.Minute
	now := time.Now().UTC().Add(timezoneOffset)
	today := now.Format("2006-01-02")

	// Parse today's date for comparison
	todayDate, err := time.Parse("2006-01-02", today)
	if err != nil {
		return 0
	}

	// Start from today or yesterday
	mostRecentDate := sortedDates[0]
	mostRecent, err := time.Parse("2006-01-02", mostRecentDate)
	if err != nil {
		return 0
	}

	// Calculate days difference between today and most recent activity
	daysDiff := int(todayDate.Sub(mostRecent).Hours() / 24)

	// If the most recent activity is more than 1 day ago, streak is broken
	if daysDiff > 1 {
		return 0
	}

	// Start counting from the most recent date
	var currentDate time.Time
	if daysDiff == 0 {
		// Activity today, start from today
		currentDate = todayDate
	} else if daysDiff == 1 {
		// No activity today, but activity yesterday - start from yesterday
		currentDate = todayDate.AddDate(0, 0, -1)
	}

	streak := 0
	for _, dateStr := range sortedDates {
		date, err := time.Parse("2006-01-02", dateStr)
		if err != nil {
			continue
		}

		expectedDate := currentDate.AddDate(0, 0, -streak)
		if date.Equal(expectedDate) {
			streak++
		} else if date.Before(expectedDate) {
			// Gap detected, stop counting
			break
		}
	}

	return streak
}

// calculateLongestStreak finds the longest consecutive sequence of dates.
func calculateLongestStreak(sortedDates []string) int {
	if len(sortedDates) == 0 {
		return 0
	}

	maxStreak := 1
	currentStreakCount := 1

	for i := 1; i < len(sortedDates); i++ {
		currentDate, err1 := time.Parse("2006-01-02", sortedDates[i])
		prevDate, err2 := time.Parse("2006-01-02", sortedDates[i-1])

		if err1 != nil || err2 != nil {
			continue
		}

		// Check if dates are consecutive (descending order, so prev should be 1 day after current)
		daysDiff := int(prevDate.Sub(currentDate).Hours() / 24)

		if daysDiff == 1 {
			// Consecutive days
			currentStreakCount++
			if currentStreakCount > maxStreak {
				maxStreak = currentStreakCount
			}
		} else {
			// Break in streak
			currentStreakCount = 1
		}
	}

	return maxStreak
}
