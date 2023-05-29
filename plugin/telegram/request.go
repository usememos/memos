package telegram

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
)

func (r *Robot) postForm(ctx context.Context, apiPath string, formData url.Values, result any) error {
	apiURL, err := r.apiURL(ctx)
	if err != nil {
		return err
	}

	resp, err := http.PostForm(apiURL+apiPath, formData)
	if err != nil {
		return fmt.Errorf("fail to http.PostForm: %s", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("fail to ioutil.ReadAll: %s", err)
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
		return fmt.Errorf("fail to json.Unmarshal: %s", err)
	}

	if !respInfo.Ok {
		return fmt.Errorf("api error: [%d]%s", respInfo.ErrorCode, respInfo.Description)
	}

	return nil
}
