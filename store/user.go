package store

import (
	"database/sql"
	"fmt"
	"memos/utils"
	"strings"
)

type User struct {
	Id         string `json:"id"`
	Username   string `json:"username"`
	Password   string `json:"password"`
	OpenId     string `json:"openId"`
	GithubName string `json:"githubName"`
	CreatedAt  string `json:"createdAt"`
	UpdatedAt  string `json:"updatedAt"`
}

func CreateNewUser(username string, password string, githubName string) (User, error) {
	nowDateTimeStr := utils.GetNowDateTimeStr()
	newUser := User{
		Id:         utils.GenUUID(),
		Username:   username,
		Password:   password,
		OpenId:     utils.GenUUID(),
		GithubName: githubName,
		CreatedAt:  nowDateTimeStr,
		UpdatedAt:  nowDateTimeStr,
	}

	query := `INSERT INTO users (id, username, password, open_id, github_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
	_, err := DB.Exec(query, newUser.Id, newUser.Username, newUser.Password, newUser.OpenId, newUser.GithubName, newUser.CreatedAt, newUser.UpdatedAt)

	return newUser, err
}

type UserPatch struct {
	Username   *string
	Password   *string
	GithubName *string
}

func UpdateUser(id string, userPatch *UserPatch) (User, error) {
	user, _ := GetUserById(id)
	set, args := []string{}, []interface{}{}

	if v := userPatch.Username; v != nil {
		user.Username = *v
		set, args = append(set, "username=?"), append(args, *v)
	}
	if v := userPatch.Password; v != nil {
		user.Password = *v
		set, args = append(set, "password=?"), append(args, *v)
	}
	if v := userPatch.GithubName; v != nil {
		user.GithubName = *v
		set, args = append(set, "github_name=?"), append(args, *v)
	}
	set, args = append(set, "updated_at=?"), append(args, utils.GetNowDateTimeStr())
	args = append(args, id)

	sqlQuery := `UPDATE users SET ` + strings.Join(set, ",") + ` WHERE id=?`
	_, err := DB.Exec(sqlQuery, args...)

	return user, err
}

func UpdateUserOpenId(userId string) (string, error) {
	openId := utils.GenUUID()

	query := `UPDATE users SET open_id=? WHERE id=?`
	_, err := DB.Exec(query, openId, userId)

	return openId, err
}

func GetUserById(id string) (User, error) {
	query := `SELECT id, username, password, open_id, github_name, created_at, updated_at FROM users WHERE id=?`
	user := User{}
	err := DB.QueryRow(query, id).Scan(&user.Id, &user.Username, &user.Password, &user.OpenId, &user.GithubName, &user.CreatedAt, &user.UpdatedAt)
	return user, err
}

func GetUserByUsernameAndPassword(username string, password string) (User, error) {
	query := `SELECT id, username, password, open_id, github_name, created_at, updated_at FROM users WHERE username=? AND password=?`
	user := User{}
	err := DB.QueryRow(query, username, password).Scan(&user.Id, &user.Username, &user.Password, &user.OpenId, &user.GithubName, &user.CreatedAt, &user.UpdatedAt)
	return user, err
}

func GetUserByGithubName(githubName string) (User, error) {
	query := `SELECT id, username, password, open_id, github_name, created_at, updated_at FROM users WHERE github_name=?`
	user := User{}
	err := DB.QueryRow(query, githubName).Scan(&user.Id, &user.Username, &user.Password, &user.OpenId, &user.GithubName, &user.CreatedAt, &user.UpdatedAt)
	return user, err
}

func CheckUsernameUsable(username string) (bool, error) {
	query := `SELECT * FROM users WHERE username=?`
	query = fmt.Sprintf("SELECT COUNT(*) FROM (%s)", query)

	var count uint
	err := DB.QueryRow(query, username).Scan(&count)
	if err != nil && err != sql.ErrNoRows {
		return false, FormatDBError(err)
	}

	if count > 0 {
		return false, nil
	} else {
		return true, nil
	}
}

func CheckGithubNameUsable(githubName string) (bool, error) {
	query := `SELECT * FROM users WHERE github_name=?`
	query = fmt.Sprintf("SELECT COUNT(*) FROM (%s)", query)

	var count uint
	err := DB.QueryRow(query, githubName).Scan(&count)
	if err != nil && err != sql.ErrNoRows {
		return false, FormatDBError(err)
	}

	if count > 0 {
		return false, nil
	} else {
		return true, nil
	}
}

func CheckPasswordValid(id string, password string) (bool, error) {
	query := `SELECT * FROM users WHERE id=? AND password=?`
	query = fmt.Sprintf("SELECT COUNT(*) FROM (%s)", query)

	var count uint
	err := DB.QueryRow(query, id, password).Scan(&count)
	if err != nil && err != sql.ErrNoRows {
		return false, FormatDBError(err)
	}

	if count > 0 {
		return true, nil
	} else {
		return false, nil
	}
}
