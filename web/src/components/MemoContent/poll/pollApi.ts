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

const request = async (pollId: string, init?: RequestInit): Promise<PollVotesResponse> => {
  const headers = await buildHeaders();
  const response = await fetch(`/api/v1/polls/${encodeURIComponent(pollId)}/votes`, {
    ...init,
    credentials: "include",
    headers: { ...headers, ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    throw new Error(`Poll request failed with status ${response.status}`);
  }
  return (await response.json()) as PollVotesResponse;
};

export const getPollVotes = (pollId: string): Promise<PollVotesResponse> => request(pollId);

export const setPollVotes = (pollId: string, optionIndexes: number[]): Promise<PollVotesResponse> =>
  request(pollId, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ optionIndexes }),
  });
