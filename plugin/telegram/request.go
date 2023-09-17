package telegram

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"

	"github.com/pkg/errors"
)

func (b *Bot) postForm(ctx context.Context, apiPath string, formData url.Values, result any) error {
	apiURL, err := b.apiURL(ctx)
	if err != nil {
		return err
	}

	resp, err := http.PostForm(apiURL+apiPath, formData)
	if err != nil {
		return errors.Wrap(err, "fail to http.PostForm")
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return errors.Wrap(err, "fail to ioutil.ReadAll")
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
		return errors.Wrap(err, "fail to json.Unmarshal")
	}

	if !respInfo.Ok {
		return errors.Errorf("api error: [%d]%s", respInfo.ErrorCode, respInfo.Description)
	}

	return nil
}
