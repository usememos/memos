export const MEMO_COMMENTS_ANCHOR_ID = "memo-comments";
export const LEGACY_MEMO_COMMENTS_ANCHOR_ID = "comments";

/** Keep memo headings from claiming the current or legacy comment-section fragments. */
export const RESERVED_MEMO_COMMENTS_ANCHOR_IDS = [MEMO_COMMENTS_ANCHOR_ID, LEGACY_MEMO_COMMENTS_ANCHOR_ID] as const;
