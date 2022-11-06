package api

type MemoResource struct {
	MemoID     int
	ResourceID int
	CreatedTs  int64
	UpdatedTs  int64
}

type MemoResourceUpsert struct {
	MemoID     int
	ResourceID int
	UpdatedTs  *int64
}

type MemoResourceFind struct {
	MemoID     *int
	ResourceID *int
}

type MemoResourceDelete struct {
	MemoID     *int
	ResourceID *int
}
