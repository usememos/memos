package api

import (
	"encoding/json"
	"memos/api/e"
	"memos/store"
	"net/http"

	"github.com/gorilla/mux"
)

func handleUserSignUp(w http.ResponseWriter, r *http.Request) {
	type UserSignUpDataBody struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}

	userSignup := UserSignUpDataBody{}
	err := json.NewDecoder(r.Body).Decode(&userSignup)

	if err != nil {
		e.ErrorHandler(w, "REQUEST_BODY_ERROR", "Bad request")
		return
	}

	usernameUsable, _ := store.CheckUsernameUsable(userSignup.Username)
	if !usernameUsable {
		json.NewEncoder(w).Encode(Response{
			Succeed: false,
			Message: "Username is existed",
			Data:    nil,
		})
		return
	}

	user, err := store.CreateNewUser(userSignup.Username, userSignup.Password)

	if err != nil {
		e.ErrorHandler(w, "DATABASE_ERROR", err.Error())
		return
	}

	session, _ := SessionStore.Get(r, "session")

	session.Values["user_id"] = user.Id
	session.Save(r, w)

	json.NewEncoder(w).Encode(Response{
		Succeed: true,
		Message: "",
		Data:    user,
	})
}

func handleUserSignIn(w http.ResponseWriter, r *http.Request) {
	type UserSigninDataBody struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}

	userSignin := UserSigninDataBody{}
	err := json.NewDecoder(r.Body).Decode(&userSignin)

	if err != nil {
		e.ErrorHandler(w, "REQUEST_BODY_ERROR", "Bad request")
		return
	}

	user, err := store.GetUserByUsernameAndPassword(userSignin.Username, userSignin.Password)

	if err != nil {
		json.NewEncoder(w).Encode(Response{
			Succeed: false,
			Message: "Username and password not allowed",
			Data:    nil,
		})
		return
	}

	session, _ := SessionStore.Get(r, "session")

	session.Values["user_id"] = user.Id
	session.Save(r, w)

	json.NewEncoder(w).Encode(Response{
		Succeed: true,
		Message: "",
		Data:    user,
	})
}

func handleUserSignOut(w http.ResponseWriter, r *http.Request) {
	session, _ := SessionStore.Get(r, "session")

	session.Values["user_id"] = ""
	session.Save(r, w)

	json.NewEncoder(w).Encode(Response{
		Succeed: true,
		Message: "",
		Data:    nil,
	})
}

func RegisterAuthRoutes(r *mux.Router) {
	authRouter := r.PathPrefix("/api/auth").Subrouter()

	authRouter.Use(JSONResponseMiddleWare)

	authRouter.HandleFunc("/signup", handleUserSignUp).Methods("POST")
	authRouter.HandleFunc("/signin", handleUserSignIn).Methods("POST")
	authRouter.HandleFunc("/signout", handleUserSignOut).Methods("POST")
}
