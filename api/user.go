package api

import (
	"encoding/json"
	"memos/common/error"
	"memos/store"
	"net/http"

	"github.com/gorilla/mux"
)

func handleGetMyUserInfo(w http.ResponseWriter, r *http.Request) {
	userId, _ := GetUserIdInCookie(r)

	user, err := store.GetUserById(userId)

	if err != nil {
		error.ErrorHandler(w, "DATABASE_ERROR")
		return
	}

	json.NewEncoder(w).Encode(user)
}

type UpdateUser struct {
	Username   string `json:"username"`
	Password   string `json:"password"`
	GithubName string `json:"githubName"`
	WxOpenId   string `json:"wxOpenId"`
}

func handleUpdateMyUserInfo(w http.ResponseWriter, r *http.Request) {
	userId, _ := GetUserIdInCookie(r)

	user, err := store.GetUserById(userId)

	if err != nil {
		error.ErrorHandler(w, "DATABASE_ERROR")
		return
	}

	var updateUser UpdateUser
	err = json.NewDecoder(r.Body).Decode(&updateUser)

	if err != nil {
		error.ErrorHandler(w, "REQUEST_BODY_ERROR")
		return
	}

	json.NewEncoder(w).Encode(user)
}

func RegisterUserRoutes(r *mux.Router) {
	userRouter := r.PathPrefix("/api/user").Subrouter()

	userRouter.Use(AuthCheckerMiddleWare)

	userRouter.HandleFunc("/me", handleGetMyUserInfo).Methods("GET")
	userRouter.HandleFunc("/me", handleUpdateMyUserInfo).Methods("PATCH")
}
