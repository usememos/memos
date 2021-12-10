package store

import (
	"memos/common"
	"strings"
)

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

type MemoPatch struct {
	Content   *string
	DeletedAt *string
}

func UpdateMemo(id string, memoPatch *MemoPatch) (Memo, error) {
	memo, _ := GetMemoById(id)
	set, args := []string{}, []interface{}{}

	if v := memoPatch.Content; v != nil {
		memo.Content = *v
		set, args = append(set, "content=?"), append(args, *v)
	}
	if v := memoPatch.DeletedAt; v != nil {
		memo.DeletedAt = *v
		set, args = append(set, "deleted_at=?"), append(args, *v)
	}
	set, args = append(set, "updated_at=?"), append(args, common.GetNowDateTimeStr())
	args = append(args, id)

	sqlQuery := `UPDATE memos SET ` + strings.Join(set, ",") + ` WHERE id=?`
	_, err := DB.Exec(sqlQuery, args...)

	return memo, err
}

func DeleteMemo(memoId string) (error, error) {
	query := `DELETE FROM memos WHERE id=?`
	_, err := DB.Exec(query, memoId)

	return nil, err
}

func GetMemoById(id string) (Memo, error) {
	query := `SELECT id, content, deleted_at, created_at, updated_at FROM memos WHERE id=?`
	memo := Memo{}
	err := DB.QueryRow(query, id).Scan(&memo.Id, &memo.Content, &memo.DeletedAt, &memo.CreatedAt, &memo.UpdatedAt)
	return memo, err
}

func GetMemosByUserId(userId string, onlyDeleted bool) ([]Memo, error) {
	sqlQuery := `SELECT id, content, deleted_at, created_at, updated_at FROM memos WHERE user_id=?`

	if onlyDeleted {
		sqlQuery = sqlQuery + ` AND deleted_at!=""`
	} else {
		sqlQuery = sqlQuery + ` AND deleted_at=""`
	}

	rows, _ := DB.Query(sqlQuery, userId)
	defer rows.Close()

	memos := []Memo{}

	for rows.Next() {
		memo := Memo{}
		rows.Scan(&memo.Id, &memo.Content, &memo.DeletedAt, &memo.CreatedAt, &memo.UpdatedAt)

		memos = append(memos, memo)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return memos, nil
}
