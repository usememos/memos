type MemoId = number;

type Visibility = "PUBLIC" | "PROTECTED" | "PRIVATE";

interface Memo {
  id: MemoId;

  creatorUsername: string;
  createdTs: TimeStamp;
  updatedTs: TimeStamp;
  rowStatus: RowStatus;

  displayTs: TimeStamp;
  content: string;
  visibility: Visibility;
  pinned: boolean;

  creatorName: string;
  resourceList: Resource[];
  relationList: MemoRelation[];
}

interface MemoCreate {
  content: string;
  resourceIdList: ResourceId[];
  relationList: MemoRelationUpsert[];
  visibility?: Visibility;
}

interface MemoPatch {
  id: MemoId;
  createdTs?: TimeStamp;
  rowStatus?: RowStatus;
  content?: string;
  resourceIdList?: ResourceId[];
  relationList?: MemoRelationUpsert[];
  visibility?: Visibility;
}

interface MemoFind {
  creatorUsername?: string;
  rowStatus?: RowStatus;
  pinned?: boolean;
  visibility?: Visibility;
  offset?: number;
  limit?: number;
}
