package api

import (
	"net/http"
)

type Response struct {
	Succeed bool        `json:"succeed"`
	Message string      `json:"message"`
	Data    interface{} `json:"data"`
}

func GetUserIdInCookie(r *http.Request) (string, error) {
	userIdCookie, err := r.Cookie("user_id")

	if err != nil {
		return "", err
	}

	return userIdCookie.Value, err
}
