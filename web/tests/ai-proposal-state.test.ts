import { create } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";
import { type HubMessage, retireProposal } from "@/hooks/useAiChat";
import { ChatProposalSchema } from "@/types/proto/api/v1/ai_service_pb";

describe("AI proposal state", () => {
  it("retires proposals by stable identity even when earlier cards were removed", () => {
    const first = { ...create(ChatProposalSchema, { content: "first" }), clientId: "proposal-a" };
    const second = { ...create(ChatProposalSchema, { content: "second" }), clientId: "proposal-b" };
    const message: HubMessage = {
      id: "message-1",
      role: "assistant",
      content: "reply",
      proposals: [first, second],
      contextMemoCount: 0,
      contextEstimatedTokens: 0,
      truncated: false,
    };

    const afterFirst = retireProposal([message], message.id, first.clientId);
    const afterSecond = retireProposal(afterFirst, message.id, second.clientId);

    expect(afterFirst[0].proposals.map((proposal) => proposal.content)).toEqual(["second"]);
    expect(afterSecond[0].proposals).toEqual([]);
  });
});
