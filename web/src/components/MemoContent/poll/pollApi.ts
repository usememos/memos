import { getRequestToken } from "@/connect";

export interface PollVoteDTO {
  optionIndex: number;
  voter: string;
}

export interface PollVotesResponse {
  votes: PollVoteDTO[];
  currentVoterName?: string;
}

const buildHeaders = async (): Promise<HeadersInit> => {
  const headers: Record<string, string> = {};
  const token = await getRequestToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

// memoName is a full resource name ("memos/{uid}"), matching the REST route
// registered in server/router/api/v1/poll_handler.go
// (/api/v1/memos/:memoUid/polls/:pollUid/votes) - every poll request is
// scoped to the memo that owns it, so the server can authorize it exactly
// like any other read of that memo (visibility, creator, space membership).
const request = async (memoName: string, pollId: string, init?: RequestInit): Promise<PollVotesResponse> => {
  const headers = await buildHeaders();
  const response = await fetch(`/api/v1/${memoName}/polls/${encodeURIComponent(pollId)}/votes`, {
    ...init,
    credentials: "include",
    headers: { ...headers, ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    throw new Error(`Poll request failed with status ${response.status}`);
  }
  return (await response.json()) as PollVotesResponse;
};

export const getPollVotes = (memoName: string, pollId: string): Promise<PollVotesResponse> => request(memoName, pollId);

export const setPollVotes = (memoName: string, pollId: string, optionIndexes: number[]): Promise<PollVotesResponse> =>
  request(memoName, pollId, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ optionIndexes }),
  });
