package scheduler

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestScheduleNextCalendarDays(t *testing.T) {
	tests := []struct {
		name string
		expr string
		from string
		want string
	}{
		{"weekly", "0 0 * * 0", "2025-01-01T10:00:00Z", "2025-01-05T00:00:00Z"},
		{"monthly", "0 0 1 * *", "2025-01-02T00:00:00Z", "2025-02-01T00:00:00Z"},
		{"weekdays skip weekend", "0 9 * * 1-5", "2025-01-03T09:00:00Z", "2025-01-06T09:00:00Z"},
		{"day step with weekday", "0 0 */2 * 3", "2025-01-01T00:00:00Z", "2025-01-15T00:00:00Z"},
		{"weekday step with day", "0 0 13 * */2", "2025-01-01T00:00:00Z", "2025-02-13T00:00:00Z"},
		{"both day steps", "0 0 */2 * */2", "2025-01-01T00:00:00Z", "2025-01-05T00:00:00Z"},
		{"restricted fields match day", "0 0 15 * 1", "2025-01-13T00:00:00Z", "2025-01-15T00:00:00Z"},
		{"restricted fields match weekday", "0 0 15 * 1", "2025-01-15T00:00:00Z", "2025-01-20T00:00:00Z"},
		{"explicit full range uses OR", "0 0 1-31 * 1", "2025-01-01T00:00:00Z", "2025-01-02T00:00:00Z"},
		{"Sunday zero with restricted day", "0 0 31 * 0", "2025-01-04T00:00:00Z", "2025-01-05T00:00:00Z"},
		{"Sunday seven with restricted day", "0 0 31 * 7", "2025-01-04T00:00:00Z", "2025-01-05T00:00:00Z"},
		{"Sunday seven with wildcard day", "0 0 * * 7", "2025-01-06T00:00:00Z", "2025-01-12T00:00:00Z"},
		{"Sunday seven in list", "0 0 31 * 1,7", "2025-01-04T00:00:00Z", "2025-01-05T00:00:00Z"},
		{"Sunday seven in range", "0 0 31 * 5-7", "2025-01-04T00:00:00Z", "2025-01-05T00:00:00Z"},
		{"Sunday aliases do not repeat", "0 0 * * 0,7", "2025-01-05T00:00:00Z", "2025-01-12T00:00:00Z"},
	}

	for _, format := range []struct {
		name   string
		prefix string
	}{
		{"five fields", ""},
		{"six fields", "0 "},
	} {
		t.Run(format.name, func(t *testing.T) {
			for _, tt := range tests {
				t.Run(tt.name, func(t *testing.T) {
					from, err := time.Parse(time.RFC3339, tt.from)
					require.NoError(t, err)
					want, err := time.Parse(time.RFC3339, tt.want)
					require.NoError(t, err)
					schedule, err := ParseCronExpression(format.prefix + tt.expr)
					require.NoError(t, err)

					next := schedule.Next(from)

					require.Equal(t, want, next)
				})
			}
		})
	}
}
