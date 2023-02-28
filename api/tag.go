package api

type Tag struct {
	Name      string
	CreatorID int
}

type TagUpsert struct {
	Name      string
	CreatorID int `json:"-"`
}

type TagFind struct {
	CreatorID int
}

type TagDelete struct {
	Name      string `json:"name"`
	CreatorID int
}
