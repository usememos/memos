package api

import (
	"encoding/json"
	"memos/api/e"
	"memos/store"
	"net/http"

	"github.com/gorilla/mux"
)

func handleCreateMemoByWH(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	openId := vars["openId"]

	type CreateMemoDataBody struct {
		Content string `json:"content"`
	}

	createMemo := CreateMemoDataBody{}
	err := json.NewDecoder(r.Body).Decode(&createMemo)

	if err != nil {
		e.ErrorHandler(w, "REQUEST_BODY_ERROR", "Bad request")
		return
	}

	user, err := store.GetUserByOpenId(openId)

	if err != nil {
		e.ErrorHandler(w, "DATABASE_ERROR", err.Error())
		return
	}

	memo, err := store.CreateNewMemo(createMemo.Content, user.Id)

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

func RegisterWebHooksRoutes(r *mux.Router) {
	memoRouter := r.PathPrefix("/api/whs").Subrouter()

	memoRouter.Use(JSONResponseMiddleWare)

	memoRouter.HandleFunc("/memo/{openId}", handleCreateMemoByWH).Methods("POST")
}
