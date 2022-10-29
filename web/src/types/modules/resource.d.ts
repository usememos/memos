type ResourceId = number;

interface Resource {
  id: ResourceId;

  createdTs: TimeStamp;
  updatedTs: TimeStamp;

  filename: string;
  type: string;
  size: string;

  linkedMemoAmount: number;
}

interface ResourcePatch {
  id: ResourceId;
  filename?: string;
}
