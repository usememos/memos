package api

import (
	"encoding/json"
	"memos/api/e"
	"memos/store"
	"net/http"

	"github.com/gorilla/mux"
)

func handleGetMyUserInfo(w http.ResponseWriter, r *http.Request) {
	userId, _ := GetUserIdInSession(r)

	user, err := store.GetUserById(userId)

	if err != nil {
		e.ErrorHandler(w, "DATABASE_ERROR", err.Error())
		return
	}

	json.NewEncoder(w).Encode(Response{
		Succeed: true,
		Message: "",
		Data:    user,
	})
}

func handleUpdateMyUserInfo(w http.ResponseWriter, r *http.Request) {
	userId, _ := GetUserIdInSession(r)

	userPatch := store.UserPatch{}
	err := json.NewDecoder(r.Body).Decode(&userPatch)

	if err != nil {
		e.ErrorHandler(w, "REQUEST_BODY_ERROR", "Bad request")
		return
	}

	user, err := store.UpdateUser(userId, &userPatch)

	if err != nil {
		e.ErrorHandler(w, "DATABASE_ERROR", err.Error())
		return
	}

	json.NewEncoder(w).Encode(Response{
		Succeed: true,
		Message: "",
		Data:    user,
	})
}

type CheckUsername struct {
	Username string
}

func handleCheckUsername(w http.ResponseWriter, r *http.Request) {
	checkUsername := CheckUsername{}
	err := json.NewDecoder(r.Body).Decode(&checkUsername)

	if err != nil {
		e.ErrorHandler(w, "REQUEST_BODY_ERROR", "Bad request")
		return
	}

	usable, err := store.CheckUsernameUsable(checkUsername.Username)

	if err != nil {
		e.ErrorHandler(w, "DATABASE_ERROR", err.Error())
		return
	}

	json.NewEncoder(w).Encode(Response{
		Succeed: true,
		Message: "",
		Data:    usable,
	})
}

type ValidPassword struct {
	Password string
}

func handleValidPassword(w http.ResponseWriter, r *http.Request) {
	userId, _ := GetUserIdInSession(r)
	validPassword := ValidPassword{}
	err := json.NewDecoder(r.Body).Decode(&validPassword)

	if err != nil {
		e.ErrorHandler(w, "REQUEST_BODY_ERROR", "Bad request")
		return
	}

	valid, err := store.CheckPasswordValid(userId, validPassword.Password)

	if err != nil {
		e.ErrorHandler(w, "DATABASE_ERROR", err.Error())
		return
	}

	json.NewEncoder(w).Encode(Response{
		Succeed: true,
		Message: "",
		Data:    valid,
	})
}

func RegisterUserRoutes(r *mux.Router) {
	userRouter := r.PathPrefix("/api/user").Subrouter()

	userRouter.Use(AuthCheckerMiddleWare)

	userRouter.HandleFunc("/me", handleGetMyUserInfo).Methods("GET")
	userRouter.HandleFunc("/me", handleUpdateMyUserInfo).Methods("PATCH")
	userRouter.HandleFunc("/checkusername", handleCheckUsername).Methods("POST")
	userRouter.HandleFunc("/validpassword", handleValidPassword).Methods("POST")
}
