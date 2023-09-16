type ResourceId = number;

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
