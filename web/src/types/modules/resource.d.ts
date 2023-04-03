type ResourceId = number;

interface Resource {
  id: ResourceId;

  createdTs: TimeStamp;
  updatedTs: TimeStamp;

  filename: string;
  externalLink: string;
  type: string;
  size: string;
  publicId: string;

  linkedMemoAmount: number;
}

interface ResourceCreate {
  filename: string;
  externalLink: string;
  type: string;
}

interface ResourcePatch {
  id: ResourceId;
  filename?: string;
  resetPublicId?: boolean;
}

interface ResourceFind {
  offset?: number;
  limit?: number;
}
