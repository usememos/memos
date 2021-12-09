package e

import (
	"encoding/json"
	"net/http"
)

type ServerError struct {
	Code    int
	Message string
}

type ErrorResponse struct {
	Succeed    bool        `json:"succeed"`
	Message    string      `json:"message"`
	StatusCode int         `json:"statusCode"`
	Data       interface{} `json:"data"`
}

func getServerError(err string) ServerError {
	code, exists := Codes[err]

	println(err)

	if !exists {
		err = "BAD_REQUEST"
		code = 40000
	}

	return ServerError{
		Code:    code,
		Message: err,
	}
}

func ErrorHandler(w http.ResponseWriter, err string, message string) {
	serverError := getServerError(err)

	res := ErrorResponse{
		Succeed:    false,
		Message:    message,
		StatusCode: serverError.Code,
		Data:       nil,
	}

	statusCode := int(serverError.Code / 100)

	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(res)
}
