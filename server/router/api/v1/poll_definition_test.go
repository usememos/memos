package v1

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestFindPollDefinitionInContentParsesYAML(t *testing.T) {
	content := "Some memo text.\n\n```poll\n" +
		"id: 4339e913-84b2-4136-84d6-af9e5fada086\n" +
		"question: What day\n" +
		"type: single\n" +
		"options:\n" +
		"  - Monday\n" +
		"  - Friday\n" +
		"```\n\nTrailing text."

	def := findPollDefinitionInContent(content, "4339e913-84b2-4136-84d6-af9e5fada086")
	require.NotNil(t, def)
	require.Equal(t, "4339e913-84b2-4136-84d6-af9e5fada086", def.ID)
	require.Equal(t, "What day", def.Question)
	require.Equal(t, "single", def.Type)
	require.Equal(t, []string{"Monday", "Friday"}, def.Options)
}

func TestFindPollDefinitionInContentDefaultsToSingleChoice(t *testing.T) {
	content := "```poll\n" +
		"id: 11111111-1111-1111-1111-111111111111\n" +
		"question: Q\n" +
		"options:\n" +
		"  - A\n" +
		"  - B\n" +
		"```"

	def := findPollDefinitionInContent(content, "11111111-1111-1111-1111-111111111111")
	require.NotNil(t, def)
	require.Equal(t, "single", def.Type, "an absent/unrecognized type must default to single-choice")
}

func TestFindPollDefinitionInContentMultipleChoice(t *testing.T) {
	content := "```poll\n" +
		"id: 22222222-2222-2222-2222-222222222222\n" +
		"question: Q\n" +
		"type: multiple\n" +
		"options:\n" +
		"  - A\n" +
		"  - B\n" +
		"```"

	def := findPollDefinitionInContent(content, "22222222-2222-2222-2222-222222222222")
	require.NotNil(t, def)
	require.Equal(t, "multiple", def.Type)
}

func TestFindPollDefinitionInContentRejectsUIDMismatch(t *testing.T) {
	content := "```poll\n" +
		"id: 33333333-3333-3333-3333-333333333333\n" +
		"question: Q\n" +
		"options:\n" +
		"  - A\n" +
		"  - B\n" +
		"```"

	def := findPollDefinitionInContent(content, "44444444-4444-4444-4444-444444444444")
	require.Nil(t, def, "a UID with no matching block in this memo's content must not resolve")
}

func TestFindPollDefinitionInContentRejectsFewerThanTwoOptions(t *testing.T) {
	content := "```poll\n" +
		"id: 55555555-5555-5555-5555-555555555555\n" +
		"question: Q\n" +
		"options:\n" +
		"  - OnlyOne\n" +
		"```"

	def := findPollDefinitionInContent(content, "55555555-5555-5555-5555-555555555555")
	require.Nil(t, def)
}

func TestFindPollDefinitionInContentRejectsMalformedYAML(t *testing.T) {
	content := "```poll\n" +
		"id: 66666666-6666-6666-6666-666666666666\n" +
		"question: [unterminated\n" +
		"options:\n" +
		"  - A\n" +
		"  - B\n" +
		"```"

	def := findPollDefinitionInContent(content, "66666666-6666-6666-6666-666666666666")
	require.Nil(t, def)
}

func TestFindPollDefinitionInContentRejectsInvalidUID(t *testing.T) {
	require.Nil(t, findPollDefinitionInContent("```poll\nid: not-a-uuid\n```", "not-a-uuid"))
}

// TestPollDefinitionHashIgnoresIncidentalYAMLFormatting confirms the hash is
// computed from the normalized struct, not the raw YAML text, so two blocks
// that are semantically identical but formatted differently (key order,
// quoting, flow vs block sequence style) hash the same.
func TestPollDefinitionHashIgnoresIncidentalYAMLFormatting(t *testing.T) {
	blockStyle := "```poll\n" +
		"id: 77777777-7777-7777-7777-777777777777\n" +
		"question: Q\n" +
		"type: single\n" +
		"options:\n" +
		"  - A\n" +
		"  - B\n" +
		"```"
	flowStyle := "```poll\n" +
		"type: single\n" +
		"id: 77777777-7777-7777-7777-777777777777\n" +
		"options: [\"A\", \"B\"]\n" +
		"question: Q different wording entirely\n" +
		"```"

	defA := findPollDefinitionInContent(blockStyle, "77777777-7777-7777-7777-777777777777")
	defB := findPollDefinitionInContent(flowStyle, "77777777-7777-7777-7777-777777777777")
	require.NotNil(t, defA)
	require.NotNil(t, defB)
	require.Equal(t, pollDefinitionHash(defA), pollDefinitionHash(defB),
		"key order, quoting/flow style, and the (deliberately unhashed) question text must not affect the hash")
}

// TestPollDefinitionHashRejectsConcatenationCollision guards the NUL-byte
// separator between hashed options: without it, ["ab","c"] and ["a","bc"]
// would hash identically because "ab"+"c" == "a"+"bc" as plain concatenation.
// A collision here would let an edited option set silently keep votes that
// EnsurePollBinding should instead detect as stale and clear.
func TestPollDefinitionHashRejectsConcatenationCollision(t *testing.T) {
	defA := &pollDefinition{ID: "id", Question: "q", Type: "single", Options: []string{"ab", "c"}}
	defB := &pollDefinition{ID: "id", Question: "q", Type: "single", Options: []string{"a", "bc"}}
	require.NotEqual(t, pollDefinitionHash(defA), pollDefinitionHash(defB))
}

// TestPollDefinitionHashRejectsNULByteSmuggling guards against an option
// string itself containing the NUL separator byte, which would otherwise let
// two different option counts/boundaries hash identically to a definition
// using literal NUL characters to fake a different split.
func TestPollDefinitionHashRejectsNULByteSmuggling(t *testing.T) {
	defA := &pollDefinition{ID: "id", Question: "q", Type: "single", Options: []string{"a", "b"}}
	defB := &pollDefinition{ID: "id", Question: "q", Type: "single", Options: []string{"a\x00b"}}
	require.NotEqual(t, pollDefinitionHash(defA), pollDefinitionHash(defB))
}
