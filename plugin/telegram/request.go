package telegram

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
)

var ErrNoToken = errors.New("token is empty")

func (r *Robot) postForm(ctx context.Context, apiPath string, formData url.Values, result any) error {
	token := r.handler.RobotToken(ctx)
	if token == "" {
		return ErrNoToken
	}

	uri := "https://api.telegram.org/bot" + token + apiPath
	resp, err := http.PostForm(uri, formData)
	if err != nil {
		return fmt.Errorf("fail to http.PostForm: %", err)
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("fail to ioutil.ReadAll: %", err)
	}

	var respInfo struct {
		Ok          bool   `json:"ok"`
		ErrorCode   int    `json:"error_code"`
		Description string `json:"description"`
		Result      any    `json:"result"`
	}

	respInfo.Result = result

	err = json.Unmarshal(body, &respInfo)
	if err != nil {
		return fmt.Errorf("fail to json.Unmarshal: %", err)
	}

	if !respInfo.Ok {
		return fmt.Errorf("api error: [%d]%s", respInfo.ErrorCode, respInfo.Description)
	}

	return nil
}
