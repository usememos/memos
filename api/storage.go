package api

type Storage struct {
	ID        int    `json:"id"`
	CreatorID int    `json:"creatorId"`
	CreatedTs int64  `json:"createdTs"`
	UpdatedTs int64  `json:"updatedTs"`
	Name      string `json:"name"`
	EndPoint  string `json:"endPoint"`
	AccessKey string `json:"accessKey"`
	SecretKey string `json:"secretKey"`
	Bucket    string `json:"bucket"`
}

type StorageCreate struct {
	CreatorID int    `json:"creatorId"`
	Name      string `json:"name"`
	EndPoint  string `json:"endPoint"`
	AccessKey string `json:"accessKey"`
	SecretKey string `json:"secretKey"`
	Bucket    string `json:"bucket"`
}

type StoragePatch struct {
	ID        int `json:"id"`
	UpdatedTs *int64
	Name      *string `json:"name"`
	EndPoint  *string `json:"endPoint"`
	AccessKey *string `json:"accessKey"`
	SecretKey *string `json:"secretKey"`
	Bucket    *string `json:"bucket"`
}

type StorageFind struct {
	CreatorID *int `json:"creatorId"`
}

type StorageDelete struct {
	ID int `json:"id"`
}
