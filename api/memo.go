package api

import (
	"encoding/json"
	"memos/api/e"
	"memos/store"
	"net/http"

	"github.com/gorilla/mux"
)

func handleGetMyMemos(w http.ResponseWriter, r *http.Request) {
	userId, _ := GetUserIdInSession(r)
	urlParams := r.URL.Query()
	deleted := urlParams.Get("deleted")
	onlyDeletedFlag := deleted == "true"

	memos, err := store.GetMemosByUserId(userId, onlyDeletedFlag)

	if err != nil {
		e.ErrorHandler(w, "DATABASE_ERROR", err.Error())
		return
	}

	json.NewEncoder(w).Encode(Response{
		Succeed: true,
		Message: "",
		Data:    memos,
	})
}

func handleCreateMemo(w http.ResponseWriter, r *http.Request) {
	userId, _ := GetUserIdInSession(r)

	type CreateMemoDataBody struct {
		Content string `json:"content"`
	}

	createMemo := CreateMemoDataBody{}
	err := json.NewDecoder(r.Body).Decode(&createMemo)

	if err != nil {
		e.ErrorHandler(w, "REQUEST_BODY_ERROR", "Bad request")
		return
	}

	memo, err := store.CreateNewMemo(createMemo.Content, userId)

	if err != nil {
		e.ErrorHandler(w, "DATABASE_ERROR", err.Error())
		return
	}

	json.NewEncoder(w).Encode(Response{
		Succeed: true,
		Message: "",
		Data:    memo,
	})
}

func handleUpdateMemo(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	memoId := vars["id"]

	memoPatch := store.MemoPatch{}
	err := json.NewDecoder(r.Body).Decode(&memoPatch)

	if err != nil {
		e.ErrorHandler(w, "REQUEST_BODY_ERROR", "Bad request")
		return
	}

	memo, err := store.UpdateMemo(memoId, &memoPatch)

	if err != nil {
		e.ErrorHandler(w, "DATABASE_ERROR", err.Error())
		return
	}

	json.NewEncoder(w).Encode(Response{
		Succeed: true,
		Message: "",
		Data:    memo,
	})
}

func handleDeleteMemo(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	memoId := vars["id"]

	err := store.DeleteMemo(memoId)

	if err != nil {
		e.ErrorHandler(w, "DATABASE_ERROR", err.Error())
		return
	}

	json.NewEncoder(w).Encode(Response{
		Succeed: true,
		Message: "",
		Data:    nil,
	})
}

func RegisterMemoRoutes(r *mux.Router) {
	memoRouter := r.PathPrefix("/api/memo").Subrouter()

	memoRouter.Use(JSONResponseMiddleWare)
	memoRouter.Use(AuthCheckerMiddleWare)

	memoRouter.HandleFunc("/all", handleGetMyMemos).Methods("GET")
	memoRouter.HandleFunc("/", handleCreateMemo).Methods("PUT")
	memoRouter.HandleFunc("/{id}", handleUpdateMemo).Methods("PATCH")
	memoRouter.HandleFunc("/{id}", handleDeleteMemo).Methods("DELETE")
}
