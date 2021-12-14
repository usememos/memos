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

	api.RegisterAuthRoutes(r)
	api.RegisterUserRoutes(r)
	api.RegisterMemoRoutes(r)
	api.RegisterQueryRoutes(r)
	api.RegisterResourceRoutes(r)

	webServe := api.SPAHandler{
		StaticPath: "./web/dist",
		IndexPath:  "index.html",
	}

	r.PathPrefix("/").Handler(webServe)

	http.ListenAndServe(":8080", r)
}
