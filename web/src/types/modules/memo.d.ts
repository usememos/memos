type MemoId = number;

type Visibility = "PUBLIC" | "PROTECTED" | "PRIVATE";

interface Memo {
  id: MemoId;

  creatorId: UserId;
  creator: User;
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
}

interface MemoPatch {
  id: MemoId;
  createdTs?: TimeStamp;
  rowStatus?: RowStatus;
  content?: string;
  visibility?: Visibility;
}

interface MemoFind {
  creatorId?: UserId;
  rowStatus?: RowStatus;
  visibility?: Visibility;
}
