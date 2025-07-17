package memopayload

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

func TestDueDateDetection(t *testing.T) {
	tests := []struct {
		name        string
		content     string
		wantDueDate bool
	}{
		{
			name:        "memo with due date",
			content:     "This is a memo with due date @due(2025-01-15)",
			wantDueDate: true,
		},
		{
			name:        "memo with due date at beginning",
			content:     "@due(2025-12-31) This memo has a due date at the beginning",
			wantDueDate: true,
		},
		{
			name:        "memo with due date in middle",
			content:     "Meeting prep @due(2025-01-15) for the quarterly review",
			wantDueDate: true,
		},
		{
			name:        "memo with task and due date",
			content:     "- [ ] Complete project @due(2025-01-10)",
			wantDueDate: true,
		},
		{
			name:        "memo with multiple due dates",
			content:     "Task 1 @due(2025-01-10) and Task 2 @due(2025-01-15)",
			wantDueDate: true,
		},
		{
			name:        "memo without due date",
			content:     "This is a regular memo without any due date",
			wantDueDate: false,
		},
		{
			name:        "memo with malformed due date",
			content:     "This has a malformed @due(not-a-date) pattern",
			wantDueDate: false,
		},
		{
			name:        "memo with partial due date pattern",
			content:     "This mentions @due but not complete pattern",
			wantDueDate: false,
		},
		{
			name:        "memo with due date in code block",
			content:     "```\n@due(2025-01-15)\n```",
			wantDueDate: true, // Should still detect even in code blocks
		},
		{
			name:        "empty memo",
			content:     "",
			wantDueDate: false,
		},
		{
			name:        "memo with invalid date format",
			content:     "Invalid date @due(25-01-15)",
			wantDueDate: false,
		},
		{
			name:        "memo with valid date formats",
			content:     "Valid dates @due(2025-01-15) and @due(2025-12-31)",
			wantDueDate: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			memo := &store.Memo{
				Content: tt.content,
			}

			err := RebuildMemoPayload(memo)
			require.NoError(t, err)
			require.NotNil(t, memo.Payload)
			require.NotNil(t, memo.Payload.Property)

			require.Equal(t, tt.wantDueDate, memo.Payload.Property.HasDueDate,
				"Expected HasDueDate to be %v for content: %s", tt.wantDueDate, tt.content)
		})
	}
}

func TestDueDateDetectionWithOtherProperties(t *testing.T) {
	memo := &store.Memo{
		Content: "Check out https://example.com and complete task @due(2025-01-15)\n\n- [ ] incomplete task",
	}

	err := RebuildMemoPayload(memo)
	require.NoError(t, err)
	require.NotNil(t, memo.Payload)
	require.NotNil(t, memo.Payload.Property)

	// Should detect due date along with other properties
	require.True(t, memo.Payload.Property.HasDueDate)
	require.True(t, memo.Payload.Property.HasLink)
	require.True(t, memo.Payload.Property.HasTaskList)
	require.True(t, memo.Payload.Property.HasIncompleteTasks)
}
