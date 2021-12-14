package api

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"memos/api/e"
	"memos/store"
	"net/http"

	"github.com/gorilla/mux"
)

func handleGetMyResources(w http.ResponseWriter, r *http.Request) {
	userId, _ := GetUserIdInSession(r)

	resources, err := store.GetResourcesByUserId(userId)

	if err != nil {
		e.ErrorHandler(w, "DATABASE_ERROR", err.Error())
		return
	}

	json.NewEncoder(w).Encode(Response{
		Succeed: true,
		Message: "",
		Data:    resources,
	})
}

func handleUploadResource(w http.ResponseWriter, r *http.Request) {
	userId, _ := GetUserIdInSession(r)

	r.ParseMultipartForm(10 << 20)

	file, handler, err := r.FormFile("file")

	if err != nil {
		e.ErrorHandler(w, "REQUEST_BODY_ERROR", "Bad request")
		return
	}

	defer file.Close()

	filename := handler.Filename
	filetype := handler.Header.Get("Content-Type")
	size := handler.Size

	fileBytes, err := ioutil.ReadAll(file)

	if err != nil {
		e.ErrorHandler(w, "UPLOAD_FILE_ERROR", "Read file error")
		fmt.Println(err)
	}

	resource, err := store.CreateResource(userId, filename, fileBytes, filetype, size)

	if err != nil {
		e.ErrorHandler(w, "DATABASE_ERROR", err.Error())
		return
	}

	json.NewEncoder(w).Encode(Response{
		Succeed: true,
		Message: "Upload file succeed",
		Data:    resource,
	})
}

func handleDeleteResource(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	resourceId := vars["id"]

	err := store.DeleteResourceById(resourceId)

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

func handleGetResource(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	resourceId := vars["id"]
	filename := vars["filename"]

	resource, err := store.GetResourceByIdAndFilename(resourceId, filename)

	if err != nil {
		e.ErrorHandler(w, "DATABASE_ERROR", err.Error())
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Write(resource.Blob)
}

func RegisterResourceRoutes(r *mux.Router) {
	resourceRouter := r.PathPrefix("/").Subrouter()

	resourceRouter.Use(AuthCheckerMiddleWare)

	resourceRouter.HandleFunc("/api/resource/all", handleGetMyResources).Methods("GET")
	resourceRouter.HandleFunc("/api/resource/", handleUploadResource).Methods("PUT")
	resourceRouter.HandleFunc("/api/resource/{id}", handleDeleteResource).Methods("DELETE")
	resourceRouter.HandleFunc("/r/{id}/{filename}", handleGetResource).Methods("GET")
}
