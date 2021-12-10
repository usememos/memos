package api

import (
	"net/http"
)

type Response struct {
	Succeed bool        `json:"succeed"`
	Message string      `json:"message"`
	Data    interface{} `json:"data"`
}

func GetUserIdInSession(r *http.Request) (string, error) {
	session, _ := SessionStore.Get(r, "session")

	userId, ok := session.Values["user_id"].(string)

	if !ok {
		return "", http.ErrNoCookie
	}

	return userId, nil
}
