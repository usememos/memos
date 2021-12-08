package store

import "memos/common"

type Memo struct {
	Id        string `json:"id"`
	Content   string `json:"content"`
	UserId    string `json:"userId"`
	DeletedAt string `json:"deletedAt"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

func CreateNewMemo(content string, userId string) (Memo, error) {
	nowDateTimeStr := common.GetNowDateTimeStr()
	newMemo := Memo{
		Id:        common.GenUUID(),
		Content:   content,
		UserId:    userId,
		DeletedAt: "",
		CreatedAt: nowDateTimeStr,
		UpdatedAt: nowDateTimeStr,
	}

	query := `INSERT INTO memos (id, content, user_id, deleted_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
	_, err := DB.Exec(query, newMemo.Id, newMemo.Content, newMemo.UserId, newMemo.DeletedAt, newMemo.CreatedAt, newMemo.UpdatedAt)

	return newMemo, err
}

func UpdateMemo(id string, content string, deletedAt string) (Memo, error) {
	nowDateTimeStr := common.GetNowDateTimeStr()
	memo, _ := GetMemoById(id)

	if content != "" {
		memo.Content = content
	}
	if deletedAt != "" {
		memo.DeletedAt = deletedAt
	}

	memo.UpdatedAt = nowDateTimeStr

	query := `UPDATE memos SET (content, deleted_at, updated_at) VALUES (?, ?, ?)`
	_, err := DB.Exec(query, memo.Content, memo.DeletedAt, memo.UpdatedAt)

	return memo, err
}

func GetMemoById(id string) (Memo, error) {
	query := `SELECT id, content, user_id, deleted_at, created_at, updated_at FROM memos WHERE id=?`
	var memo Memo
	err := DB.QueryRow(query, id).Scan(&memo.Id, &memo.Content, &memo.UserId, &memo.DeletedAt, &memo.CreatedAt, &memo.UpdatedAt)
	return memo, err
}

func GetMemosByUserId(userId string) ([]Memo, error) {
	query := `SELECT id, content, user_id, deleted_at, created_at, updated_at FROM memos WHERE user_id=?`

	rows, err := DB.Query(query, userId)

	var memos []Memo

	for rows.Next() {
		var memo Memo
		err = rows.Scan(&memo.Id, &memo.Content, &memo.UserId, &memo.DeletedAt, &memo.CreatedAt, &memo.UpdatedAt)

		memos = append(memos, memo)
	}

	return memos, err
}
