package api

import (
	"encoding/json"
	"memos/common/error"
	"memos/store"
	"net/http"

	"github.com/gorilla/mux"
)

func handleGetMyMemos(w http.ResponseWriter, r *http.Request) {
	userId, _ := GetUserIdInCookie(r)

	memos, err := store.GetMemosByUserId(userId)

	if err != nil {
		error.ErrorHandler(w, "DATABASE_ERROR")
		return
	}

	json.NewEncoder(w).Encode(memos)
}

type CreateMemo struct {
	Content string `json:"content"`
}

func handleCreateMemo(w http.ResponseWriter, r *http.Request) {
	userId, _ := GetUserIdInCookie(r)

	var createMemo CreateMemo
	err := json.NewDecoder(r.Body).Decode(&createMemo)

	if err != nil {
		error.ErrorHandler(w, "")
		return
	}

	memo, err := store.CreateNewMemo(createMemo.Content, userId)

	if err != nil {
		error.ErrorHandler(w, "")
		return
	}

	json.NewEncoder(w).Encode(memo)
}

func handleUpdateMemo(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	memoId := vars["id"]

	userId, _ := GetUserIdInCookie(r)

	var createMemo CreateMemo
	err := json.NewDecoder(r.Body).Decode(&createMemo)

	if err != nil {
		error.ErrorHandler(w, "")
		return
	}

	memo, err := store.UpdateMemo(memoId, createMemo.Content, userId)

	if err != nil {
		error.ErrorHandler(w, "")
		return
	}

	json.NewEncoder(w).Encode(memo)
}

func RegisterMemoRoutes(r *mux.Router) {
	memoRouter := r.PathPrefix("/api/memo").Subrouter()

	memoRouter.Use(AuthCheckerMiddleWare)

	memoRouter.HandleFunc("/all", handleGetMyMemos).Methods("GET")
	memoRouter.HandleFunc("/", handleCreateMemo).Methods("PUT")
	memoRouter.HandleFunc("/{id}", handleUpdateMemo).Methods("PATCH")
}
