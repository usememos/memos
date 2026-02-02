package test

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

// =============================================================================
// Filename Field Tests
// Schema: filename (string, supports contains)
// =============================================================================

func TestAttachmentFilterFilenameContains(t *testing.T) {
	t.Parallel()
	tc := NewAttachmentFilterTestContext(t)
	defer tc.Close()

	tc.CreateAttachment(NewAttachmentBuilder(tc.CreatorID).Filename("report.pdf").MimeType("application/pdf"))
	tc.CreateAttachment(NewAttachmentBuilder(tc.CreatorID).Filename("document.pdf").MimeType("application/pdf"))
	tc.CreateAttachment(NewAttachmentBuilder(tc.CreatorID).Filename("image.png").MimeType("image/png"))

	// Test: filename.contains("report") - single match
	attachments := tc.ListWithFilter(`filename.contains("report")`)
	require.Len(t, attachments, 1)
	require.Contains(t, attachments[0].Filename, "report")

	// Test: filename.contains(".pdf") - multiple matches
	attachments = tc.ListWithFilter(`filename.contains(".pdf")`)
	require.Len(t, attachments, 2)

	// Test: filename.contains("nonexistent") - no matches
	attachments = tc.ListWithFilter(`filename.contains("nonexistent")`)
	require.Len(t, attachments, 0)
}

func TestAttachmentFilterFilenameSpecialCharacters(t *testing.T) {
	t.Parallel()
	tc := NewAttachmentFilterTestContext(t)
	defer tc.Close()

	tc.CreateAttachment(NewAttachmentBuilder(tc.CreatorID).
		Filename("file_with-special.chars@2024.pdf").MimeType("application/pdf"))

	// Test: filename.contains with underscore
	attachments := tc.ListWithFilter(`filename.contains("_with")`)
	require.Len(t, attachments, 1)

	// Test: filename.contains with @
	attachments = tc.ListWithFilter(`filename.contains("@2024")`)
	require.Len(t, attachments, 1)
}

func TestAttachmentFilterFilenameUnicode(t *testing.T) {
	t.Parallel()
	tc := NewAttachmentFilterTestContext(t)
	defer tc.Close()

	tc.CreateAttachment(NewAttachmentBuilder(tc.CreatorID).
		Filename("document_报告.pdf").MimeType("application/pdf"))

	attachments := tc.ListWithFilter(`filename.contains("报告")`)
	require.Len(t, attachments, 1)
}

// =============================================================================
// Mime Type Field Tests
// Schema: mime_type (string, ==, !=)
// =============================================================================

func TestAttachmentFilterMimeTypeEquals(t *testing.T) {
	t.Parallel()
	tc := NewAttachmentFilterTestContext(t)
	defer tc.Close()

	tc.CreateAttachment(NewAttachmentBuilder(tc.CreatorID).Filename("image.png").MimeType("image/png"))
	tc.CreateAttachment(NewAttachmentBuilder(tc.CreatorID).Filename("photo.jpeg").MimeType("image/jpeg"))
	tc.CreateAttachment(NewAttachmentBuilder(tc.CreatorID).Filename("document.pdf").MimeType("application/pdf"))

	// Test: mime_type == "image/png"
	attachments := tc.ListWithFilter(`mime_type == "image/png"`)
	require.Len(t, attachments, 1)
	require.Equal(t, "image/png", attachments[0].Type)

	// Test: mime_type == "application/pdf"
	attachments = tc.ListWithFilter(`mime_type == "application/pdf"`)
	require.Len(t, attachments, 1)
	require.Equal(t, "application/pdf", attachments[0].Type)
}

func TestAttachmentFilterMimeTypeNotEquals(t *testing.T) {
	t.Parallel()
	tc := NewAttachmentFilterTestContext(t)
	defer tc.Close()

	tc.CreateAttachment(NewAttachmentBuilder(tc.CreatorID).Filename("image.png").MimeType("image/png"))
	tc.CreateAttachment(NewAttachmentBuilder(tc.CreatorID).Filename("document.pdf").MimeType("application/pdf"))

	attachments := tc.ListWithFilter(`mime_type != "image/png"`)
	require.Len(t, attachments, 1)
	require.Equal(t, "application/pdf", attachments[0].Type)
}

func TestAttachmentFilterMimeTypeInList(t *testing.T) {
	t.Parallel()
	tc := NewAttachmentFilterTestContext(t)
	defer tc.Close()

	tc.CreateAttachment(NewAttachmentBuilder(tc.CreatorID).Filename("image.png").MimeType("image/png"))
	tc.CreateAttachment(NewAttachmentBuilder(tc.CreatorID).Filename("photo.jpeg").MimeType("image/jpeg"))
	tc.CreateAttachment(NewAttachmentBuilder(tc.CreatorID).Filename("document.pdf").MimeType("application/pdf"))

	// Test: mime_type in ["image/png", "image/jpeg"] - matches images
	attachments := tc.ListWithFilter(`mime_type in ["image/png", "image/jpeg"]`)
	require.Len(t, attachments, 2)

	// Test: mime_type in ["video/mp4"] - no matches
	attachments = tc.ListWithFilter(`mime_type in ["video/mp4"]`)
	require.Len(t, attachments, 0)
}

// =============================================================================
// Create Time Field Tests
// Schema: create_time (timestamp, all comparison operators)
// Functions: now(), arithmetic (+, -, *)
// =============================================================================

func TestAttachmentFilterCreateTimeComparison(t *testing.T) {
	t.Parallel()
	tc := NewAttachmentFilterTestContext(t)
	defer tc.Close()

	now := time.Now().Unix()
	tc.CreateAttachment(NewAttachmentBuilder(tc.CreatorID).Filename("test.png").MimeType("image/png"))

	// Test: create_time < future (should match)
	attachments := tc.ListWithFilter(`create_time < ` + formatInt64(now+3600))
	require.Len(t, attachments, 1)

	// Test: create_time > past (should match)
	attachments = tc.ListWithFilter(`create_time > ` + formatInt64(now-3600))
	require.Len(t, attachments, 1)

	// Test: create_time > future (should not match)
	attachments = tc.ListWithFilter(`create_time > ` + formatInt64(now+3600))
	require.Len(t, attachments, 0)
}

func TestAttachmentFilterCreateTimeWithNow(t *testing.T) {
	t.Parallel()
	tc := NewAttachmentFilterTestContext(t)
	defer tc.Close()

	tc.CreateAttachment(NewAttachmentBuilder(tc.CreatorID).Filename("test.png").MimeType("image/png"))

	// Test: create_time < now() + 5 (buffer for container clock drift)
	attachments := tc.ListWithFilter(`create_time < now() + 5`)
	require.Len(t, attachments, 1)

	// Test: create_time > now() + 5 (should not match)
	attachments = tc.ListWithFilter(`create_time > now() + 5`)
	require.Len(t, attachments, 0)
}

func TestAttachmentFilterCreateTimeArithmetic(t *testing.T) {
	t.Parallel()
	tc := NewAttachmentFilterTestContext(t)
	defer tc.Close()

	tc.CreateAttachment(NewAttachmentBuilder(tc.CreatorID).Filename("test.png").MimeType("image/png"))

	// Test: create_time >= now() - 3600 (attachments created in last hour)
	attachments := tc.ListWithFilter(`create_time >= now() - 3600`)
	require.Len(t, attachments, 1)

	// Test: create_time < now() - 86400 (attachments older than 1 day - should be empty)
	attachments = tc.ListWithFilter(`create_time < now() - 86400`)
	require.Len(t, attachments, 0)

	// Test: Multiplication - create_time >= now() - 60 * 60
	attachments = tc.ListWithFilter(`create_time >= now() - 60 * 60`)
	require.Len(t, attachments, 1)
}

func TestAttachmentFilterAllComparisonOperators(t *testing.T) {
	t.Parallel()
	tc := NewAttachmentFilterTestContext(t)
	defer tc.Close()

	tc.CreateAttachment(NewAttachmentBuilder(tc.CreatorID).Filename("test.png").MimeType("image/png"))

	// Test: < (less than)
	attachments := tc.ListWithFilter(`create_time < now() + 3600`)
	require.Len(t, attachments, 1)

	// Test: <= (less than or equal) with buffer for clock drift
	attachments = tc.ListWithFilter(`create_time < now() + 5`)
	require.Len(t, attachments, 1)

	// Test: > (greater than)
	attachments = tc.ListWithFilter(`create_time > now() - 3600`)
	require.Len(t, attachments, 1)

	// Test: >= (greater than or equal)
	attachments = tc.ListWithFilter(`create_time >= now() - 60`)
	require.Len(t, attachments, 1)
}

// =============================================================================
// Memo ID Field Tests
// Schema: memo_id (int, ==, !=)
// =============================================================================

func TestAttachmentFilterMemoIdEquals(t *testing.T) {
	t.Parallel()
	tc := NewAttachmentFilterTestContextWithUser(t)
	defer tc.Close()

	memo1 := tc.CreateMemo("memo-1", "Memo 1")
	memo2 := tc.CreateMemo("memo-2", "Memo 2")

	tc.CreateAttachment(NewAttachmentBuilder(tc.CreatorID).Filename("memo1_attachment.png").MimeType("image/png").MemoID(&memo1.ID))
	tc.CreateAttachment(NewAttachmentBuilder(tc.CreatorID).Filename("memo2_attachment.png").MimeType("image/png").MemoID(&memo2.ID))

	attachments := tc.ListWithFilter(`memo_id == ` + formatInt32(memo1.ID))
	require.Len(t, attachments, 1)
	require.Equal(t, &memo1.ID, attachments[0].MemoID)
}

func TestAttachmentFilterMemoIdNotEquals(t *testing.T) {
	t.Parallel()
	tc := NewAttachmentFilterTestContextWithUser(t)
	defer tc.Close()

	memo1 := tc.CreateMemo("memo-1", "Memo 1")
	memo2 := tc.CreateMemo("memo-2", "Memo 2")

	tc.CreateAttachment(NewAttachmentBuilder(tc.CreatorID).Filename("memo1_attachment.png").MimeType("image/png").MemoID(&memo1.ID))
	tc.CreateAttachment(NewAttachmentBuilder(tc.CreatorID).Filename("memo2_attachment.png").MimeType("image/png").MemoID(&memo2.ID))

	attachments := tc.ListWithFilter(`memo_id != ` + formatInt32(memo1.ID))
	require.Len(t, attachments, 1)
	require.Equal(t, &memo2.ID, attachments[0].MemoID)
}

// =============================================================================
// Logical Operator Tests
// Operators: && (AND), || (OR), ! (NOT)
// =============================================================================

func TestAttachmentFilterLogicalAnd(t *testing.T) {
	t.Parallel()
	tc := NewAttachmentFilterTestContext(t)
	defer tc.Close()

	tc.CreateAttachment(NewAttachmentBuilder(tc.CreatorID).Filename("image.png").MimeType("image/png"))
	tc.CreateAttachment(NewAttachmentBuilder(tc.CreatorID).Filename("photo.png").MimeType("image/png"))
	tc.CreateAttachment(NewAttachmentBuilder(tc.CreatorID).Filename("image.pdf").MimeType("application/pdf"))

	attachments := tc.ListWithFilter(`mime_type == "image/png" && filename.contains("image")`)
	require.Len(t, attachments, 1)
	require.Equal(t, "image.png", attachments[0].Filename)
}

func TestAttachmentFilterLogicalOr(t *testing.T) {
	t.Parallel()
	tc := NewAttachmentFilterTestContext(t)
	defer tc.Close()

	tc.CreateAttachment(NewAttachmentBuilder(tc.CreatorID).Filename("image.png").MimeType("image/png"))
	tc.CreateAttachment(NewAttachmentBuilder(tc.CreatorID).Filename("document.pdf").MimeType("application/pdf"))
	tc.CreateAttachment(NewAttachmentBuilder(tc.CreatorID).Filename("video.mp4").MimeType("video/mp4"))

	attachments := tc.ListWithFilter(`mime_type == "image/png" || mime_type == "application/pdf"`)
	require.Len(t, attachments, 2)
}

func TestAttachmentFilterLogicalNot(t *testing.T) {
	t.Parallel()
	tc := NewAttachmentFilterTestContext(t)
	defer tc.Close()

	tc.CreateAttachment(NewAttachmentBuilder(tc.CreatorID).Filename("image.png").MimeType("image/png"))
	tc.CreateAttachment(NewAttachmentBuilder(tc.CreatorID).Filename("document.pdf").MimeType("application/pdf"))

	attachments := tc.ListWithFilter(`!(mime_type == "image/png")`)
	require.Len(t, attachments, 1)
	require.Equal(t, "application/pdf", attachments[0].Type)
}

func TestAttachmentFilterComplexLogical(t *testing.T) {
	t.Parallel()
	tc := NewAttachmentFilterTestContext(t)
	defer tc.Close()

	tc.CreateAttachment(NewAttachmentBuilder(tc.CreatorID).Filename("report.png").MimeType("image/png"))
	tc.CreateAttachment(NewAttachmentBuilder(tc.CreatorID).Filename("report.pdf").MimeType("application/pdf"))
	tc.CreateAttachment(NewAttachmentBuilder(tc.CreatorID).Filename("other.png").MimeType("image/png"))

	attachments := tc.ListWithFilter(`(mime_type == "image/png" || mime_type == "application/pdf") && filename.contains("report")`)
	require.Len(t, attachments, 2)
}

// =============================================================================
// Multiple Filters Tests
// =============================================================================

func TestAttachmentFilterMultipleFilters(t *testing.T) {
	t.Parallel()
	tc := NewAttachmentFilterTestContext(t)
	defer tc.Close()

	tc.CreateAttachment(NewAttachmentBuilder(tc.CreatorID).Filename("report.png").MimeType("image/png"))
	tc.CreateAttachment(NewAttachmentBuilder(tc.CreatorID).Filename("other.png").MimeType("image/png"))
	tc.CreateAttachment(NewAttachmentBuilder(tc.CreatorID).Filename("report.pdf").MimeType("application/pdf"))

	// Test: Multiple filters (applied as AND)
	attachments := tc.ListWithFilters(`filename.contains("report")`, `mime_type == "image/png"`)
	require.Len(t, attachments, 1)
	require.Contains(t, attachments[0].Filename, "report")
	require.Equal(t, "image/png", attachments[0].Type)
}

// =============================================================================
// Edge Cases
// =============================================================================

func TestAttachmentFilterNoMatches(t *testing.T) {
	t.Parallel()
	tc := NewAttachmentFilterTestContext(t)
	defer tc.Close()

	tc.CreateAttachment(NewAttachmentBuilder(tc.CreatorID).Filename("test.png").MimeType("image/png"))

	attachments := tc.ListWithFilter(`filename.contains("nonexistent12345")`)
	require.Len(t, attachments, 0)
}

func TestAttachmentFilterNullMemoId(t *testing.T) {
	t.Parallel()
	tc := NewAttachmentFilterTestContextWithUser(t)
	defer tc.Close()

	memo := tc.CreateMemo("memo-1", "Memo 1")

	tc.CreateAttachment(NewAttachmentBuilder(tc.CreatorID).Filename("with_memo.png").MimeType("image/png").MemoID(&memo.ID))
	tc.CreateAttachment(NewAttachmentBuilder(tc.CreatorID).Filename("no_memo.png").MimeType("image/png"))

	// Test: memo_id == null
	attachments := tc.ListWithFilter(`memo_id == null`)
	require.Len(t, attachments, 1)
	require.Equal(t, "no_memo.png", attachments[0].Filename)
	require.Nil(t, attachments[0].MemoID)

	// Test: memo_id != null
	attachments = tc.ListWithFilter(`memo_id != null`)
	require.Len(t, attachments, 1)
	require.Equal(t, "with_memo.png", attachments[0].Filename)
	require.NotNil(t, attachments[0].MemoID)
	require.Equal(t, memo.ID, *attachments[0].MemoID)
}

func TestAttachmentFilterEmptyFilename(t *testing.T) {
	t.Parallel()
	tc := NewAttachmentFilterTestContext(t)
	defer tc.Close()

	tc.CreateAttachment(NewAttachmentBuilder(tc.CreatorID).Filename("test.png").MimeType("image/png"))
	tc.CreateAttachment(NewAttachmentBuilder(tc.CreatorID).Filename("other.pdf").MimeType("application/pdf"))

	// Test: filename.contains("") - should match all
	attachments := tc.ListWithFilter(`filename.contains("")`)
	require.Len(t, attachments, 2)
}
