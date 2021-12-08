package error

import (
	"encoding/json"
	"net/http"
)

type ServerError struct {
	Code    int
	Message string
}

type ErrorResponse struct {
	StatusCode    int         `json:"statusCode"`
	StatusMessage string      `json:"statusMessage"`
	Succeed       bool        `json:"succeed"`
	Data          interface{} `json:"data"`
}

func getServerError(err string) ServerError {
	code, exists := Codes[err]

	if !exists {
		err = "Bad Request"
		code = 40000
	}

	return ServerError{
		Code:    code,
		Message: err,
	}
}

func ErrorHandler(w http.ResponseWriter, err string) {
	serverError := getServerError(err)

	res := ErrorResponse{
		StatusCode:    serverError.Code,
		StatusMessage: serverError.Message,
		Succeed:       false,
		Data:          nil,
	}

	statusCode := int(serverError.Code / 100)

	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(res)
}
