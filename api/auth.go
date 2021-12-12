package api

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"memos/api/e"
	"memos/common"
	"memos/config"
	"memos/store"
	"net/http"

	"github.com/gorilla/mux"
)

type UserSignUp struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func handleUserSignUp(w http.ResponseWriter, r *http.Request) {
	userSignup := UserSignUp{}
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

	user, err := store.CreateNewUser(userSignup.Username, userSignup.Password, "", "")

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

type UserSignin struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func handleUserSignIn(w http.ResponseWriter, r *http.Request) {
	userSignin := UserSignin{}
	err := json.NewDecoder(r.Body).Decode(&userSignin)

	if err != nil {
		e.ErrorHandler(w, "REQUEST_BODY_ERROR", "Bad request")
		return
	}

	user, err := store.GetUserByUsernameAndPassword(userSignin.Username, userSignin.Password)

	if err != nil {
		if err == sql.ErrNoRows {
			json.NewEncoder(w).Encode(Response{
				Succeed: false,
				Message: "Username and password not allowed",
				Data:    nil,
			})
		} else {
			e.ErrorHandler(w, "DATABASE_ERROR", err.Error())
		}

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

func handleGithubAuthCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")

	requestBody := map[string]string{
		"client_id":     config.GITHUB_CLIENTID,
		"client_secret": config.GITHUB_SECRET,
		"code":          code,
	}

	requestJSON, _ := json.Marshal(requestBody)

	// POST request to get access_token
	req, err := http.NewRequest(
		"POST",
		"https://github.com/login/oauth/access_token",
		bytes.NewBuffer(requestJSON),
	)

	if err != nil {
		e.ErrorHandler(w, "REQUEST_BODY_ERROR", "Error in request github api")
		return
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		e.ErrorHandler(w, "REQUEST_BODY_ERROR", "Error in request github api")
		return
	}

	// Response body converted to stringified JSON
	respBody, _ := ioutil.ReadAll(resp.Body)

	// Represents the response received from Github
	type GithubAccessTokenResponse struct {
		AccessToken string `json:"access_token"`
		TokenType   string `json:"token_type"`
		Scope       string `json:"scope"`
	}

	ghResp := GithubAccessTokenResponse{}
	json.Unmarshal(respBody, &ghResp)

	githubAccessToken := ghResp.AccessToken

	// Get request to a set URL
	req, err = http.NewRequest(
		"GET",
		"https://api.github.com/user",
		nil,
	)
	if err != nil {
		e.ErrorHandler(w, "REQUEST_BODY_ERROR", "Error in request github api")
		return
	}

	authorizationHeaderValue := fmt.Sprintf("token %s", githubAccessToken)
	req.Header.Set("Authorization", authorizationHeaderValue)

	resp, err = http.DefaultClient.Do(req)

	if err != nil {
		e.ErrorHandler(w, "REQUEST_BODY_ERROR", "Error in request github api")
		return
	}

	respBody, _ = ioutil.ReadAll(resp.Body)

	githubData := string(respBody)

	type GithubUser struct {
		Login string `json:"login"`
		Name  string `json:"name"`
	}

	githubUser := GithubUser{}
	json.Unmarshal([]byte(githubData), &githubUser)

	session, _ := SessionStore.Get(r, "session")
	userId := fmt.Sprintf("%v", session.Values["user_id"])

	if userId != "" {
		githubNameUsable, err := store.CheckGithubNameUsable(githubUser.Login)

		if err != nil {
			e.ErrorHandler(w, "DATABASE_ERROR", "Error in CheckGithubNameUsable")
			return
		}

		if !githubNameUsable {
			e.ErrorHandler(w, "DATABASE_ERROR", "Error in CheckGithubNameUsable")
			return
		}

		userPatch := store.UserPatch{
			GithubName: &githubUser.Login,
		}

		store.UpdateUser(userId, &userPatch)
	}

	user, err := store.GetUserByGithubName(githubUser.Login)

	if err == sql.ErrNoRows {
		username := githubUser.Name
		usernameUsable, _ := store.CheckUsernameUsable(username)
		for !usernameUsable {
			username = githubUser.Name + common.GenUUID()
			usernameUsable, _ = store.CheckUsernameUsable(username)
		}
		user, _ = store.CreateNewUser(username, username, githubUser.Login, "")
	}

	session.Values["user_id"] = user.Id
	session.Save(r, w)

	http.Redirect(w, r, "/", http.StatusTemporaryRedirect)
}

func RegisterAuthRoutes(r *mux.Router) {
	authRouter := r.PathPrefix("/api/auth").Subrouter()

	authRouter.HandleFunc("/signup", handleUserSignUp).Methods("POST")
	authRouter.HandleFunc("/signin", handleUserSignIn).Methods("POST")
	authRouter.HandleFunc("/signout", handleUserSignOut).Methods("POST")
	authRouter.HandleFunc("/github", handleGithubAuthCallback).Methods("GET")
}
