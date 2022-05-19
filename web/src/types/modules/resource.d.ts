type ResourceId = number;

interface Resource {
  id: string;

  createdTs: TimeStamp;
  updatedTs: TimeStamp;

  filename: string;
  type: string;
  size: string;
}
