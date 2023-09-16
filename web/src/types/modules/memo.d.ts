type MemoId = number;

type Visibility = "PUBLIC" | "PROTECTED" | "PRIVATE";

interface Memo {
  id: MemoId;

  creatorUsername: string;
  createdTs: number;
  updatedTs: number;
  rowStatus: RowStatus;

  displayTs: number;
  content: string;
  visibility: Visibility;
  pinned: boolean;

  creatorName: string;
  resourceList: any[];
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
  createdTs?: number;
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
