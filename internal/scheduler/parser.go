package scheduler

import (
	"strconv"
	"strings"
	"time"

	"github.com/pkg/errors"
)

// Schedule represents a parsed cron expression.
type Schedule struct {
	seconds  fieldMatcher // 0-59 (optional, for 6-field format)
	minutes  fieldMatcher // 0-59
	hours    fieldMatcher // 0-23
	days     fieldMatcher // 1-31
	months   fieldMatcher // 1-12
	weekdays fieldMatcher // 0-7 (0 and 7 are Sunday)
	hasSecs  bool
}

// fieldMatcher determines if a field value matches.
type fieldMatcher interface {
	matches(value int) bool
}

// ParseCronExpression parses a cron expression and returns a Schedule.
// Supports both 5-field (minute hour day month weekday) and 6-field (second minute hour day month weekday) formats.
func ParseCronExpression(expr string) (*Schedule, error) {
	if expr == "" {
		return nil, errors.New("empty cron expression")
	}

	fields := strings.Fields(expr)
	if len(fields) != 5 && len(fields) != 6 {
		return nil, errors.Errorf("invalid cron expression: expected 5 or 6 fields, got %d", len(fields))
	}

	s := &Schedule{
		hasSecs: len(fields) == 6,
	}

	var err error
	offset := 0

	// Parse seconds (if 6-field format)
	if s.hasSecs {
		s.seconds, err = parseField(fields[0], 0, 59)
		if err != nil {
			return nil, errors.Wrap(err, "invalid seconds field")
		}
		offset = 1
	} else {
		s.seconds = &exactMatcher{value: 0} // Default to 0 seconds
	}

	// Parse minutes
	s.minutes, err = parseField(fields[offset], 0, 59)
	if err != nil {
		return nil, errors.Wrap(err, "invalid minutes field")
	}

	// Parse hours
	s.hours, err = parseField(fields[offset+1], 0, 23)
	if err != nil {
		return nil, errors.Wrap(err, "invalid hours field")
	}

	// Parse days
	s.days, err = parseField(fields[offset+2], 1, 31)
	if err != nil {
		return nil, errors.Wrap(err, "invalid days field")
	}

	// Parse months
	s.months, err = parseField(fields[offset+3], 1, 12)
	if err != nil {
		return nil, errors.Wrap(err, "invalid months field")
	}

	// Parse weekdays (0-7, where both 0 and 7 represent Sunday)
	s.weekdays, err = parseField(fields[offset+4], 0, 7)
	if err != nil {
		return nil, errors.Wrap(err, "invalid weekdays field")
	}

	return s, nil
}

// Next returns the next time the schedule should run after the given time.
func (s *Schedule) Next(from time.Time) time.Time {
	// Start from the next second/minute
	if s.hasSecs {
		from = from.Add(1 * time.Second).Truncate(time.Second)
	} else {
		from = from.Add(1 * time.Minute).Truncate(time.Minute)
	}

	// Cap search at 4 years to prevent infinite loops
	maxTime := from.AddDate(4, 0, 0)

	for from.Before(maxTime) {
		if s.matches(from) {
			return from
		}

		// Advance to next potential match
		if s.hasSecs {
			from = from.Add(1 * time.Second)
		} else {
			from = from.Add(1 * time.Minute)
		}
	}

	// Should never reach here with valid cron expressions
	return time.Time{}
}

// matches checks if the given time matches the schedule.
func (s *Schedule) matches(t time.Time) bool {
	return s.seconds.matches(t.Second()) &&
		s.minutes.matches(t.Minute()) &&
		s.hours.matches(t.Hour()) &&
		s.months.matches(int(t.Month())) &&
		(s.days.matches(t.Day()) || s.weekdays.matches(int(t.Weekday())))
}

// parseField parses a single cron field (supports *, ranges, lists, steps).
func parseField(field string, min, max int) (fieldMatcher, error) {
	// Wildcard
	if field == "*" {
		return &wildcardMatcher{}, nil
	}

	// Step values (*/N)
	if strings.HasPrefix(field, "*/") {
		step, err := strconv.Atoi(field[2:])
		if err != nil || step < 1 || step > max {
			return nil, errors.Errorf("invalid step value: %s", field)
		}
		return &stepMatcher{step: step, min: min, max: max}, nil
	}

	// List (1,2,3)
	if strings.Contains(field, ",") {
		parts := strings.Split(field, ",")
		values := make([]int, 0, len(parts))
		for _, p := range parts {
			val, err := strconv.Atoi(strings.TrimSpace(p))
			if err != nil || val < min || val > max {
				return nil, errors.Errorf("invalid list value: %s", p)
			}
			values = append(values, val)
		}
		return &listMatcher{values: values}, nil
	}

	// Range (1-5)
	if strings.Contains(field, "-") {
		parts := strings.Split(field, "-")
		if len(parts) != 2 {
			return nil, errors.Errorf("invalid range: %s", field)
		}
		start, err1 := strconv.Atoi(strings.TrimSpace(parts[0]))
		end, err2 := strconv.Atoi(strings.TrimSpace(parts[1]))
		if err1 != nil || err2 != nil || start < min || end > max || start > end {
			return nil, errors.Errorf("invalid range: %s", field)
		}
		return &rangeMatcher{start: start, end: end}, nil
	}

	// Exact value
	val, err := strconv.Atoi(field)
	if err != nil || val < min || val > max {
		return nil, errors.Errorf("invalid value: %s (must be between %d and %d)", field, min, max)
	}
	return &exactMatcher{value: val}, nil
}

// wildcardMatcher matches any value.
type wildcardMatcher struct{}

func (*wildcardMatcher) matches(_ int) bool {
	return true
}

// exactMatcher matches a specific value.
type exactMatcher struct {
	value int
}

func (m *exactMatcher) matches(value int) bool {
	return value == m.value
}

// rangeMatcher matches values in a range.
type rangeMatcher struct {
	start, end int
}

func (m *rangeMatcher) matches(value int) bool {
	return value >= m.start && value <= m.end
}

// listMatcher matches any value in a list.
type listMatcher struct {
	values []int
}

func (m *listMatcher) matches(value int) bool {
	for _, v := range m.values {
		if v == value {
			return true
		}
	}
	return false
}

// stepMatcher matches values at regular intervals.
type stepMatcher struct {
	step, min, max int
}

func (m *stepMatcher) matches(value int) bool {
	if value < m.min || value > m.max {
		return false
	}
	return (value-m.min)%m.step == 0
}
