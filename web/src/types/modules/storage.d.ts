type StorageId = number;

interface Storage {
  id: StorageId;
  creatorId: UserId;
  createdTs: TimeStamp;
  updatedTs: TimeStamp;
  name: string;
  endPoint: string;
  region: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  urlPrefix: string;
}

interface StorageCreate {
  name: string;
  endPoint: string;
  region: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  urlPrefix: string;
}

interface StoragePatch {
  id: StorageId;
  name: string;
  endPoint: string;
  region: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  urlPrefix: string;
}
