type StorageId = number;

type StorageType = "S3";

interface StorageS3Config {
  endPoint: string;
  region: string;
  accessKey: string;
  secretKey: string;
  path: string;
  bucket: string;
  urlPrefix: string;
}

interface StorageConfig {
  s3Config: StorageS3Config;
}

// Note: Storage is a reserved word in TypeScript. So we use ObjectStorage instead.
interface ObjectStorage {
  id: StorageId;
  name: string;
  type: StorageType;
  config: StorageConfig;
}

interface StorageCreate {
  name: string;
  type: StorageType;
  config: StorageConfig;
}

interface StoragePatch {
  id: StorageId;
  name: string;
  type: StorageType;
  config: StorageConfig;
}
