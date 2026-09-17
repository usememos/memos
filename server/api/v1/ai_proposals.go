package v1

import (
	"encoding/json"
	"strings"

	"github.com/pkg/errors"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
)

const (
	// proposalFence is the fenced code block language the model must use to
	// propose a note change. A prompt-level protocol is used instead of the
	// provider's structured-output mode because OpenRouter normalizes and can
	// silently ignore response_format, so a 200 would not prove compliance.
	proposalFence = "memo-proposal"

	// maxChatProposalsPerTurn bounds how many note changes one reply may propose.
	maxChatProposalsPerTurn = 8

	// maxChatProposalContentLength bounds a single proposed note body.
	maxChatProposalContentLength = 200_000
)

// parsedProposal is one note change the model proposed.
type parsedProposal struct {
	Action  v1pb.ChatProposalAction
	Content string
	Target  string
}

// proposalEnvelope is the JSON body inside a proposal fence.
type proposalEnvelope struct {
	Action  string `json:"action"`
	Target  string `json:"target"`
	Content string `json:"content"`
}

// parseChatProposals extracts proposal blocks from a model reply and returns
// the reply with those blocks removed, so the visible text does not repeat what
// the proposal cards already show.
//
// A malformed block is left in the text rather than dropped: the user then sees
// exactly what the model produced instead of silently losing a proposed note.
func parseChatProposals(text string) (string, []*parsedProposal) {
	var (
		proposals []*parsedProposal
		remaining strings.Builder
	)

	lines := strings.Split(text, "\n")
	for index := 0; index < len(lines); index++ {
		line := lines[index]
		if !isProposalFenceOpen(line) {
			remaining.WriteString(line)
			remaining.WriteString("\n")
			continue
		}

		// Find the closing fence.
		closing := -1
		for scan := index + 1; scan < len(lines); scan++ {
			if strings.HasPrefix(strings.TrimSpace(lines[scan]), "```") {
				closing = scan
				break
			}
		}
		if closing == -1 {
			// Unterminated block: keep it visible rather than guessing.
			remaining.WriteString(line)
			remaining.WriteString("\n")
			continue
		}

		body := strings.Join(lines[index+1:closing], "\n")
		proposal, err := decodeProposal(body)
		if err != nil || len(proposals) >= maxChatProposalsPerTurn {
			remaining.WriteString(line)
			remaining.WriteString("\n")
			remaining.WriteString(body)
			remaining.WriteString("\n```\n")
		} else {
			proposals = append(proposals, proposal)
		}
		index = closing
	}

	return strings.TrimSpace(remaining.String()), proposals
}

// isProposalFenceOpen reports whether a line opens a proposal block. An info
// string may follow the language tag, so only the first token is compared.
func isProposalFenceOpen(line string) bool {
	trimmed := strings.TrimSpace(line)
	if !strings.HasPrefix(trimmed, "```") {
		return false
	}
	info := strings.TrimSpace(strings.TrimPrefix(trimmed, "```"))
	if info == "" {
		return false
	}
	language := strings.Fields(info)[0]
	return strings.EqualFold(language, proposalFence)
}

// decodeProposal validates one proposal block. Content is required: a proposal
// that would create an empty note is a model mistake, not an instruction.
func decodeProposal(body string) (*parsedProposal, error) {
	body = strings.TrimSpace(body)
	if body == "" {
		return nil, errors.New("empty proposal")
	}

	var envelope proposalEnvelope
	if err := json.Unmarshal([]byte(body), &envelope); err != nil {
		return nil, errors.Wrap(err, "proposal is not valid JSON")
	}

	content := strings.TrimSpace(envelope.Content)
	if content == "" {
		return nil, errors.New("proposal content is required")
	}
	if len(content) > maxChatProposalContentLength {
		return nil, errors.New("proposal content is too long")
	}

	action := v1pb.ChatProposalAction_CHAT_PROPOSAL_ACTION_CREATE
	target := ""
	switch strings.ToLower(strings.TrimSpace(envelope.Action)) {
	case "create":
		action = v1pb.ChatProposalAction_CHAT_PROPOSAL_ACTION_CREATE
	case "update":
		action = v1pb.ChatProposalAction_CHAT_PROPOSAL_ACTION_UPDATE
		target = strings.TrimSpace(envelope.Target)
		if target == "" {
			// An update without a target cannot be applied, so it is not a
			// usable proposal.
			return nil, errors.New("update proposal requires a target")
		}
	default:
		return nil, errors.Errorf("unsupported proposal action %q", envelope.Action)
	}

	return &parsedProposal{Action: action, Content: content, Target: target}, nil
}

// buildChatSystemPrompt assembles the system message: the assistant's role, the
// proposal protocol, and the selected note context.
func buildChatSystemPrompt(contextPrompt string) string {
	var builder strings.Builder
	builder.WriteString("You are the assistant inside Memos, a note-taking app. ")
	builder.WriteString("Answer using the user's notes when they are provided.\n\n")

	builder.WriteString("You can propose creating or changing a note. Propose a change only when the user asks for one. ")
	builder.WriteString("A proposal is a fenced code block tagged " + proposalFence + " containing JSON:\n")
	builder.WriteString("```" + proposalFence + "\n")
	builder.WriteString(`{"action":"create","content":"# Title\n\nBody with #tags"}` + "\n")
	builder.WriteString("```\n")
	builder.WriteString("To change an existing note, use its id from the notes below:\n")
	builder.WriteString("```" + proposalFence + "\n")
	builder.WriteString(`{"action":"update","target":"memos/<uid>","content":"the note's full new content"}` + "\n")
	builder.WriteString("```\n")
	builder.WriteString("An update replaces the whole note, so include the unchanged parts too. ")
	builder.WriteString("Tags come from #hashtags in the content.\n")
	builder.WriteString("Never claim you have saved, created, or changed a note: the user confirms every proposal first. ")
	builder.WriteString("The user will see the proposal and decide.\n")

	if contextPrompt != "" {
		builder.WriteString("\n")
		builder.WriteString(contextPrompt)
	} else {
		builder.WriteString("\nThe user selected no notes, so you have no access to their notes in this turn. ")
		builder.WriteString("If the question needs them, say so and ask the user to select notes.\n")
	}
	return builder.String()
}
