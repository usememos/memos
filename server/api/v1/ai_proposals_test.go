package v1

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

func TestParseChatProposals(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name          string
		reply         string
		wantText      string
		wantProposals int
	}{
		{
			name:          "plain reply has no proposals",
			reply:         "Here is a summary of your notes.",
			wantText:      "Here is a summary of your notes.",
			wantProposals: 0,
		},
		{
			name: "create proposal is extracted",
			reply: "Sure, drafting that now.\n\n```memo-proposal\n" +
				`{"action":"create","content":"# Trip plan\n\nPack bags #travel"}` + "\n```\n",
			wantText:      "Sure, drafting that now.",
			wantProposals: 1,
		},
		{
			name: "update proposal is extracted with target",
			reply: "I can restructure that note.\n\n```memo-proposal\n" +
				`{"action":"update","target":"memos/abc123","content":"new body"}` + "\n```",
			wantText:      "I can restructure that note.",
			wantProposals: 1,
		},
		{
			name: "two proposals are both extracted",
			reply: "```memo-proposal\n" + `{"action":"create","content":"one"}` + "\n```\n" +
				"middle text\n" +
				"```memo-proposal\n" + `{"action":"create","content":"two"}` + "\n```",
			wantText:      "middle text",
			wantProposals: 2,
		},
		{
			name:          "malformed JSON stays visible",
			reply:         "```memo-proposal\nnot json at all\n```",
			wantText:      "```memo-proposal\nnot json at all\n```",
			wantProposals: 0,
		},
		{
			name:          "unterminated fence stays visible",
			reply:         "```memo-proposal\n" + `{"action":"create","content":"x"}`,
			wantText:      "```memo-proposal\n" + `{"action":"create","content":"x"}`,
			wantProposals: 0,
		},
		{
			name:          "update without target is rejected",
			reply:         "```memo-proposal\n" + `{"action":"update","content":"x"}` + "\n```",
			wantText:      "```memo-proposal\n" + `{"action":"update","content":"x"}` + "\n```",
			wantProposals: 0,
		},
		{
			name:          "empty content is rejected",
			reply:         "```memo-proposal\n" + `{"action":"create","content":"   "}` + "\n```",
			wantText:      "```memo-proposal\n" + `{"action":"create","content":"   "}` + "\n```",
			wantProposals: 0,
		},
		{
			name:          "unsupported action is rejected",
			reply:         "```memo-proposal\n" + `{"action":"delete","target":"memos/x","content":"y"}` + "\n```",
			wantText:      "```memo-proposal\n" + `{"action":"delete","target":"memos/x","content":"y"}` + "\n```",
			wantProposals: 0,
		},
		{
			name:          "plain code block is not a proposal",
			reply:         "```go\nfmt.Println(\"hi\")\n```",
			wantText:      "```go\nfmt.Println(\"hi\")\n```",
			wantProposals: 0,
		},
		{
			name:          "language tag is case insensitive",
			reply:         "```MEMO-PROPOSAL\n" + `{"action":"create","content":"body"}` + "\n```",
			wantText:      "",
			wantProposals: 1,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()

			text, proposals := parseChatProposals(testCase.reply)
			require.Equal(t, testCase.wantText, text)
			require.Len(t, proposals, testCase.wantProposals)
		})
	}
}

func TestParseChatProposalsMapsActions(t *testing.T) {
	t.Parallel()

	_, proposals := parseChatProposals("```memo-proposal\n" +
		`{"action":"create","content":"a"}` + "\n```\n" +
		"```memo-proposal\n" + `{"action":"update","target":"memos/xyz","content":"b"}` + "\n```")
	require.Len(t, proposals, 2)

	require.Equal(t, v1pb.ChatProposalAction_CHAT_PROPOSAL_ACTION_CREATE, proposals[0].Action)
	require.Equal(t, "a", proposals[0].Content)
	require.Empty(t, proposals[0].Target)

	require.Equal(t, v1pb.ChatProposalAction_CHAT_PROPOSAL_ACTION_UPDATE, proposals[1].Action)
	require.Equal(t, "b", proposals[1].Content)
	require.Equal(t, "memos/xyz", proposals[1].Target)
}

func TestParseChatProposalsCapsProposalCount(t *testing.T) {
	t.Parallel()

	var builder strings.Builder
	for index := 0; index < maxChatProposalsPerTurn+3; index++ {
		builder.WriteString("```memo-proposal\n")
		builder.WriteString(`{"action":"create","content":"note"}`)
		builder.WriteString("\n```\n")
	}

	_, proposals := parseChatProposals(builder.String())
	require.Len(t, proposals, maxChatProposalsPerTurn, "proposals beyond the cap must not be accepted")
}

func TestEstimateTokens(t *testing.T) {
	t.Parallel()

	require.Equal(t, int64(0), estimateTokens(0))
	require.Equal(t, int64(0), estimateTokens(-10))
	// Rounds up so a partial token is never undercounted.
	require.Equal(t, int64(1), estimateTokens(1))
	require.Equal(t, int64(1), estimateTokens(4))
	require.Equal(t, int64(2), estimateTokens(5))
	require.Equal(t, int64(25), estimateTokens(100))
}

func TestBuildChatContextPromptDelimitsNotes(t *testing.T) {
	t.Parallel()

	prompt := buildChatContextPrompt(nil)
	require.Empty(t, prompt)

	prompt = buildChatContextPrompt([]*store.Memo{
		{UID: "one", Content: "first body"},
		{UID: "two", Content: "second body"},
	})
	require.Contains(t, prompt, "id: memos/one")
	require.Contains(t, prompt, "first body")
	require.Contains(t, prompt, "id: memos/two")
	require.Contains(t, prompt, "second body")
}

func TestBuildChatSystemPromptStatesProposalProtocol(t *testing.T) {
	t.Parallel()

	withContext := buildChatSystemPrompt("NOTES-HERE")
	require.Contains(t, withContext, proposalFence)
	require.Contains(t, withContext, "NOTES-HERE")
	// The model must not claim a write happened, since the user confirms first.
	require.Contains(t, withContext, "Never claim you have saved")

	withoutContext := buildChatSystemPrompt("")
	require.Contains(t, withoutContext, "no access to their notes")
	require.NotContains(t, withoutContext, "NOTES-HERE")
}
