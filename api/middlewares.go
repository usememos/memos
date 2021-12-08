package api

import (
	"memos/common/error"
	"net/http"
)

func AuthCheckerMiddleWare(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userId, err := GetUserIdInCookie(r)

		if err != nil || userId == "" {
			error.ErrorHandler(w, "NOT_AUTH")
			return
		}

		next.ServeHTTP(w, r)
	})
}
