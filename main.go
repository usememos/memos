package main

import (
	"memos/api"
	"memos/store"
	"net/http"

	"github.com/gorilla/mux"
)

func main() {
	store.InitDBConn()

	r := mux.NewRouter().StrictSlash(true)

	api.RegisterUserRoutes(r)
	api.RegisterAuthRoutes(r)

	http.ListenAndServe("localhost:8080", r)
}
