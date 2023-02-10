package api

type StorageSetting struct {
	ID        int    `json:"id"`
	CreatorID int    `json:"creatorId"`
	CreatedTs int64  `json:"createdTs"`
	Name      string `json:"name"`
	EndPoint  string `json:"endPoint"`
	AccessKey string `json:"accessKey"`
	SecretKey string `json:"secretKey"`
	Bucket    string `json:"bucket"`
}

type StorageSettingCreate struct {
	CreatorID int    `json:"creatorId"`
	Name      string `json:"name"`
	EndPoint  string `json:"endPoint"`
	AccessKey string `json:"accessKey"`
	SecretKey string `json:"secretKey"`
	Bucket    string `json:"bucket"`
}

type StorageSettingPatch struct {
	ID        int     `json:"id"`
	Name      *string `json:"name"`
	EndPoint  *string `json:"endPoint"`
	AccessKey *string `json:"accessKey"`
	SecretKey *string `json:"secretKey"`
	Bucket    *string `json:"bucket"`
}

type StorageSettingFind struct {
	CreatorID *int `json:"creatorId"`
}

type StorageSettingDelete struct {
	ID int `json:"id"`
}
