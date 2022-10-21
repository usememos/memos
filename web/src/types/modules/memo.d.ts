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
  displayTs: TimeStamp;

  creator: User;
  resourceList: Resource[];
}

interface MemoCreate {
  content: string;
  resourceIdList: ResourceId[];
  visibility?: Visibility;
}

interface MemoPatch {
  id: MemoId;
  createdTs?: TimeStamp;
  rowStatus?: RowStatus;
  content?: string;
  resourceIdList?: ResourceId[];
  visibility?: Visibility;
}

interface MemoFind {
  creatorId?: UserId;
  rowStatus?: RowStatus;
  visibility?: Visibility;
}
