package api

type StorageType string

const (
	StorageS3 StorageType = "S3"
)

type StorageConfig struct {
	S3Config *StorageS3Config `json:"s3Config"`
}

type StorageS3Config struct {
	EndPoint  string `json:"endPoint"`
	Region    string `json:"region"`
	AccessKey string `json:"accessKey"`
	SecretKey string `json:"secretKey"`
	Bucket    string `json:"bucket"`
	URLPrefix string `json:"urlPrefix"`
}

type Storage struct {
	ID     int            `json:"id"`
	Name   string         `json:"name"`
	Type   StorageType    `json:"type"`
	Config *StorageConfig `json:"config"`
}

type StorageCreate struct {
	Name   string         `json:"name"`
	Type   StorageType    `json:"type"`
	Config *StorageConfig `json:"config"`
}

type StoragePatch struct {
	ID     int            `json:"id"`
	Type   StorageType    `json:"type"`
	Name   *string        `json:"name"`
	Config *StorageConfig `json:"config"`
}

type StorageFind struct {
	ID *int `json:"id"`
}

type StorageDelete struct {
	ID int `json:"id"`
}
