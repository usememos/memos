package telegram

import (
	"context"
	"fmt"
	"io/ioutil"
	"net/http"
)

// downloadFileId download file with fileID, return the filepath and blob
func (r *Robot) downloadFileId(ctx context.Context, fileId string) (string, []byte, error) {
	file, err := r.GetFile(ctx, fileId)
	if err != nil {
		return "", nil, err
	}
	blob, err := r.downloadFilepath(ctx, file.FilePath)
	if err != nil {
		return "", nil, err
	}

	return file.FilePath, blob, nil
}

// downloadFilepath download file with filepath, you can get filepath by calling GetFile
func (r *Robot) downloadFilepath(ctx context.Context, filePath string) ([]byte, error) {
	token := r.handler.RobotToken(ctx)
	if token == "" {
		return nil, ErrNoToken
	}

	uri := "https://api.telegram.org/file/bot" + token + "/" + filePath
	resp, err := http.Get(uri)
	if err != nil {
		return nil, fmt.Errorf("fail to http.Get: %", err)
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("fail to ioutil.ReadAll: %", err)
	}

	return body, nil
}
