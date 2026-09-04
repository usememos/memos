package scheduler

import (
	"testing"
	"time"
)

func TestParseCronExpression(t *testing.T) {
	tests := []struct {
		name    string
		expr    string
		wantErr bool
	}{
		// Standard 5-field format
		{"every minute", "* * * * *", false},
		{"hourly", "0 * * * *", false},
		{"daily midnight", "0 0 * * *", false},
		{"weekly sunday", "0 0 * * 0", false},
		{"monthly", "0 0 1 * *", false},
		{"specific time", "30 14 * * *", false}, // 2:30 PM daily
		{"range", "0 9-17 * * *", false},        // Every hour 9 AM - 5 PM
		{"step", "*/15 * * * *", false},         // Every 15 minutes
		{"list", "0 8,12,18 * * *", false},      // 8 AM, 12 PM, 6 PM

		// 6-field format with seconds
		{"with seconds", "0 * * * * *", false},
		{"every 30 seconds", "*/30 * * * * *", false},

		// Invalid expressions
		{"empty", "", true},
		{"too few fields", "* * *", true},
		{"too many fields", "* * * * * * *", true},
		{"invalid minute", "60 * * * *", true},
		{"invalid hour", "0 24 * * *", true},
		{"invalid day", "0 0 32 * *", true},
		{"invalid month", "0 0 1 13 *", true},
		{"invalid weekday", "0 0 * * 8", true},
		{"garbage", "not a cron expression", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			schedule, err := ParseCronExpression(tt.expr)
			if (err != nil) != tt.wantErr {
				t.Errorf("ParseCronExpression(%q) error = %v, wantErr %v", tt.expr, err, tt.wantErr)
				return
			}
			if !tt.wantErr && schedule == nil {
				t.Errorf("ParseCronExpression(%q) returned nil schedule without error", tt.expr)
			}
		})
	}
}

func TestScheduleNext(t *testing.T) {
	tests := []struct {
		name     string
		expr     string
		from     time.Time
		expected time.Time
	}{
		{
			name:     "every minute from start of hour",
			expr:     "* * * * *",
			from:     time.Date(2025, 1, 1, 10, 0, 0, 0, time.UTC),
			expected: time.Date(2025, 1, 1, 10, 1, 0, 0, time.UTC),
		},
		{
			name:     "hourly at minute 30",
			expr:     "30 * * * *",
			from:     time.Date(2025, 1, 1, 10, 0, 0, 0, time.UTC),
			expected: time.Date(2025, 1, 1, 10, 30, 0, 0, time.UTC),
		},
		{
			name:     "hourly at minute 30 (already past)",
			expr:     "30 * * * *",
			from:     time.Date(2025, 1, 1, 10, 45, 0, 0, time.UTC),
			expected: time.Date(2025, 1, 1, 11, 30, 0, 0, time.UTC),
		},
		{
			name:     "daily at 2 AM",
			expr:     "0 2 * * *",
			from:     time.Date(2025, 1, 1, 10, 0, 0, 0, time.UTC),
			expected: time.Date(2025, 1, 2, 2, 0, 0, 0, time.UTC),
		},
		{
			name:     "every 15 minutes",
			expr:     "*/15 * * * *",
			from:     time.Date(2025, 1, 1, 10, 7, 0, 0, time.UTC),
			expected: time.Date(2025, 1, 1, 10, 15, 0, 0, time.UTC),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			schedule, err := ParseCronExpression(tt.expr)
			if err != nil {
				t.Fatalf("failed to parse expression: %v", err)
			}

			next := schedule.Next(tt.from)
			if !next.Equal(tt.expected) {
				t.Errorf("Next(%v) = %v, expected %v", tt.from, next, tt.expected)
			}
		})
	}
}

func TestScheduleNextWithTimezone(t *testing.T) {
	nyc, _ := time.LoadLocation("America/New_York")

	// Schedule for 9 AM in New York
	schedule, err := ParseCronExpression("0 9 * * *")
	if err != nil {
		t.Fatalf("failed to parse expression: %v", err)
	}

	// Current time: 8 AM in New York
	from := time.Date(2025, 1, 1, 8, 0, 0, 0, nyc)
	next := schedule.Next(from)

	// Should be 9 AM same day in New York
	expected := time.Date(2025, 1, 1, 9, 0, 0, 0, nyc)
	if !next.Equal(expected) {
		t.Errorf("Next(%v) = %v, expected %v", from, next, expected)
	}
}

func TestScheduleWeekdaySevenIsSunday(t *testing.T) {
	// Cron treats both 0 and 7 as Sunday, but time.Weekday never returns 7,
	// so a schedule written with 7 must still fire on Sundays.
	//
	// Combine day-of-month 1 with weekday 7 so the day-of-month clause does not
	// mask the weekday behavior for the (non-first-of-month) days exercised here.
	// 2025-01-05 is a Sunday and 2025-01-06 is a Monday.
	sunday := time.Date(2025, 1, 5, 0, 0, 0, 0, time.UTC)
	monday := time.Date(2025, 1, 6, 0, 0, 0, 0, time.UTC)

	seven, err := ParseCronExpression("0 0 1 * 7")
	if err != nil {
		t.Fatalf("failed to parse expression: %v", err)
	}
	if !seven.matches(sunday) {
		t.Errorf("weekday 7 should match Sunday %v", sunday)
	}
	if seven.matches(monday) {
		t.Errorf("weekday 7 should not match Monday %v", monday)
	}

	// Regression: weekday 0 (the canonical Sunday) keeps working.
	zero, err := ParseCronExpression("0 0 1 * 0")
	if err != nil {
		t.Fatalf("failed to parse expression: %v", err)
	}
	if !zero.matches(sunday) {
		t.Errorf("weekday 0 should match Sunday %v", sunday)
	}

	// End-to-end via the public Next: from a Thursday, the next fire of
	// "0 0 1 * 7" is the upcoming Sunday (Jan 5), earlier than the next 1st.
	from := time.Date(2025, 1, 2, 10, 0, 0, 0, time.UTC)
	if next := seven.Next(from); !next.Equal(sunday) {
		t.Errorf("Next(%v) = %v, expected Sunday %v", from, next, sunday)
	}
}
