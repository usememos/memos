type MemoId = number;

type Visibility = "PUBLIC" | "PROTECTED" | "PRIVATE";

interface Memo {
  id: MemoId;

  creatorId: UserId;
  createdTs: TimeStamp;
  updatedTs: TimeStamp;
  rowStatus: RowStatus;

  content: string;
  visibility: Visibility;
  pinned: boolean;
}

interface MemoCreate {
  content: string;
  visibility?: Visibility;
  createdTs?: TimeStamp;
}

interface MemoPatch {
  id: MemoId;
  content?: string;
  rowStatus?: RowStatus;
  visibility?: Visibility;
}

interface MemoFind {
  creatorId?: UserId;
  rowStatus?: RowStatus;
  visibility?: Visibility;
}
