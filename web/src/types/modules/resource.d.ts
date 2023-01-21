type ResourceId = number;

interface Resource {
  id: ResourceId;

  createdTs: TimeStamp;
  updatedTs: TimeStamp;

  filename: string;
  externalLink: string;
  type: string;
  size: string;

  linkedMemoAmount: number;
}

interface ResourceCreate {
  filename: string;
  externalLink: string;
}

interface ResourcePatch {
  id: ResourceId;
  filename?: string;
}
