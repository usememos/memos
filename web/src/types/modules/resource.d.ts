type ResourceId = number;

interface Resource {
  id: ResourceId;

  createdTs: number;
  updatedTs: number;

  filename: string;
  externalLink: string;
  type: string;
  size: string;
}

interface ResourceCreate {
  filename: string;
  externalLink: string;
  type: string;
}

interface ResourcePatch {
  id: ResourceId;
  filename?: string;
}

interface ResourceFind {
  offset?: number;
  limit?: number;
}
