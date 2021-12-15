package store

import (
	"memos/utils"
	"strings"
)

type Query struct {
	Id          string `json:"id"`
	UserId      string `json:"userId"`
	Title       string `json:"title"`
	Querystring string `json:"querystring"`
	PinnedAt    string `json:"pinnedAt"`
	CreatedAt   string `json:"createdAt"`
	UpdatedAt   string `json:"updatedAt"`
}

func CreateNewQuery(title string, querystring string, userId string) (Query, error) {
	nowDateTimeStr := utils.GetNowDateTimeStr()
	newQuery := Query{
		Id:          utils.GenUUID(),
		Title:       title,
		Querystring: querystring,
		UserId:      userId,
		PinnedAt:    "",
		CreatedAt:   nowDateTimeStr,
		UpdatedAt:   nowDateTimeStr,
	}

	sqlQuery := `INSERT INTO queries (id, title, querystring, user_id, pinned_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
	_, err := DB.Exec(sqlQuery, newQuery.Id, newQuery.Title, newQuery.Querystring, newQuery.UserId, newQuery.PinnedAt, newQuery.CreatedAt, newQuery.UpdatedAt)

	return newQuery, FormatDBError(err)
}

type QueryPatch struct {
	Title       *string
	Querystring *string
	PinnedAt    *string
}

func UpdateQuery(id string, queryPatch *QueryPatch) (Query, error) {
	query, _ := GetQueryById(id)
	set, args := []string{}, []interface{}{}

	if v := queryPatch.Title; v != nil {
		query.Title = *v
		set, args = append(set, "title=?"), append(args, *v)
	}
	if v := queryPatch.Querystring; v != nil {
		query.Querystring = *v
		set, args = append(set, "querystring=?"), append(args, *v)
	}
	if v := queryPatch.PinnedAt; v != nil {
		query.PinnedAt = *v
		set, args = append(set, "pinned_at=?"), append(args, *v)
	}
	set, args = append(set, "updated_at=?"), append(args, utils.GetNowDateTimeStr())
	args = append(args, id)

	sqlQuery := `UPDATE queries SET ` + strings.Join(set, ",") + ` WHERE id=?`
	_, err := DB.Exec(sqlQuery, args...)

	return query, FormatDBError(err)
}

func DeleteQuery(queryId string) error {
	query := `DELETE FROM queries WHERE id=?`
	_, err := DB.Exec(query, queryId)
	return FormatDBError(err)
}

func GetQueryById(queryId string) (Query, error) {
	sqlQuery := `SELECT id, title, querystring, pinned_at, created_at, updated_at FROM queries WHERE id=?`
	query := Query{}
	err := DB.QueryRow(sqlQuery, queryId).Scan(&query.Id, &query.Title, &query.Querystring, &query.PinnedAt, &query.CreatedAt, &query.UpdatedAt)
	return query, FormatDBError(err)
}

func GetQueriesByUserId(userId string) ([]Query, error) {
	query := `SELECT id, title, querystring, pinned_at, created_at, updated_at FROM queries WHERE user_id=?`

	rows, _ := DB.Query(query, userId)
	defer rows.Close()

	queries := []Query{}

	for rows.Next() {
		query := Query{}
		rows.Scan(&query.Id, &query.Title, &query.Querystring, &query.PinnedAt, &query.CreatedAt, &query.UpdatedAt)

		queries = append(queries, query)
	}

	if err := rows.Err(); err != nil {
		return nil, FormatDBError(err)
	}

	return queries, nil
}
