package api

import (
	"encoding/json"
	"memos/api/e"
	"memos/store"
	"net/http"

	"github.com/gorilla/mux"
)

func handleGetMyQueries(w http.ResponseWriter, r *http.Request) {
	userId, _ := GetUserIdInSession(r)

	queries, err := store.GetQueriesByUserId(userId)

	if err != nil {
		e.ErrorHandler(w, "DATABASE_ERROR", err.Error())
		return
	}

	json.NewEncoder(w).Encode(Response{
		Succeed: true,
		Message: "",
		Data:    queries,
	})
}

type QueryPut struct {
	Title       string `json:"title"`
	Querystring string `json:"querystring"`
}

func handleCreateQuery(w http.ResponseWriter, r *http.Request) {
	userId, _ := GetUserIdInSession(r)

	queryPut := QueryPut{}
	err := json.NewDecoder(r.Body).Decode(&queryPut)

	if err != nil {
		e.ErrorHandler(w, "REQUEST_BODY_ERROR", "Bad request")
		return
	}

	query, err := store.CreateNewQuery(queryPut.Title, queryPut.Querystring, userId)

	if err != nil {
		e.ErrorHandler(w, "DATABASE_ERROR", err.Error())
		return
	}

	json.NewEncoder(w).Encode(Response{
		Succeed: true,
		Message: "",
		Data:    query,
	})
}

func handleUpdateQuery(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	queryId := vars["id"]

	queryPatch := store.QueryPatch{}
	err := json.NewDecoder(r.Body).Decode(&queryPatch)

	if err != nil {
		e.ErrorHandler(w, "REQUEST_BODY_ERROR", "Bad request")
		return
	}

	query, err := store.UpdateQuery(queryId, &queryPatch)

	if err != nil {
		e.ErrorHandler(w, "DATABASE_ERROR", err.Error())
		return
	}

	json.NewEncoder(w).Encode(Response{
		Succeed: true,
		Message: "",
		Data:    query,
	})
}

func handleDeleteQuery(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	queryId := vars["id"]

	_, err := store.DeleteQuery(queryId)

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

func RegisterQueryRoutes(r *mux.Router) {
	queryRouter := r.PathPrefix("/api/query").Subrouter()

	queryRouter.Use(AuthCheckerMiddleWare)

	queryRouter.HandleFunc("/all", handleGetMyQueries).Methods("GET")
	queryRouter.HandleFunc("/", handleCreateQuery).Methods("PUT")
	queryRouter.HandleFunc("/{id}", handleUpdateQuery).Methods("PATCH")
	queryRouter.HandleFunc("/{id}", handleDeleteQuery).Methods("DELETE")
}
