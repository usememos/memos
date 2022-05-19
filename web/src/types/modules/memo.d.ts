type MemoId = number;

interface Memo {
  id: MemoId;

  creatorId: UserId;
  createdTs: TimeStamp;
  updatedTs: TimeStamp;
  rowStatus: RowStatus;

  content: string;
  pinned: boolean;
}

interface MemoCreate {
  content: string;
  createdTs?: TimeStamp;
}

interface MemoPatch {
  id: MemoId;
  content?: string;
  rowStatus?: RowStatus;
}
