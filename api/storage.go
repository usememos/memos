package api

type Storage struct {
	ID        int    `json:"id"`
	Name      string `json:"name"`
	EndPoint  string `json:"endPoint"`
	Region    string `json:"region"`
	AccessKey string `json:"accessKey"`
	SecretKey string `json:"secretKey"`
	Bucket    string `json:"bucket"`
	URLPrefix string `json:"urlPrefix"`
}

type StorageCreate struct {
	Name      string `json:"name"`
	EndPoint  string `json:"endPoint"`
	Region    string `json:"region"`
	AccessKey string `json:"accessKey"`
	SecretKey string `json:"secretKey"`
	Bucket    string `json:"bucket"`
	URLPrefix string `json:"urlPrefix"`
}

type StoragePatch struct {
	ID        int     `json:"id"`
	Name      *string `json:"name"`
	EndPoint  *string `json:"endPoint"`
	Region    *string `json:"region"`
	AccessKey *string `json:"accessKey"`
	SecretKey *string `json:"secretKey"`
	Bucket    *string `json:"bucket"`
	URLPrefix *string `json:"urlPrefix"`
}

type StorageFind struct {
	ID   *int    `json:"id"`
	Name *string `json:"name"`
}

type StorageDelete struct {
	ID int `json:"id"`
}
