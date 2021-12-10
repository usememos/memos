package api

import (
	"memos/api/e"
	"net/http"
)

func AuthCheckerMiddleWare(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		session, _ := SessionStore.Get(r, "session")

		if userId, ok := session.Values["user_id"].(string); !ok || userId == "" {
			e.ErrorHandler(w, "NOT_AUTH", "Need authorize")
			return
		}

		next.ServeHTTP(w, r)
	})
}

func CorsMiddleWare(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		next.ServeHTTP(w, r)
	})
}
