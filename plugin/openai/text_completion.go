package openai

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
)

type TextCompletionChoice struct {
	Text string `json:"text"`
}

type TextCompletionResponse struct {
	Error   interface{}            `json:"error"`
	Model   string                 `json:"model"`
	Choices []TextCompletionChoice `json:"choices"`
}

func PostTextCompletion(prompt string, apiKey string, apiHost string) (string, error) {
	if apiHost == "" {
		apiHost = "https://api.openai.com"
	}
	url, err := url.JoinPath(apiHost, "/v1/chat/completions")
	if err != nil {
		return "", err
	}

	values := map[string]interface{}{
		"model":       "gpt-3.5-turbo",
		"prompt":      prompt,
		"temperature": 0.5,
		"max_tokens":  100,
		"n":           1,
		"stop":        ".",
	}
	jsonValue, err := json.Marshal(values)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonValue))
	if err != nil {
		return "", err
	}

	// Set the API key in the request header
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	// Send the request to OpenAI's API
	client := http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	// Read the response body
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	textCompletionResponse := TextCompletionResponse{}
	err = json.Unmarshal(responseBody, &textCompletionResponse)
	if err != nil {
		return "", err
	}
	if textCompletionResponse.Error != nil {
		errorBytes, err := json.Marshal(textCompletionResponse.Error)
		if err != nil {
			return "", err
		}
		return "", errors.New(string(errorBytes))
	}
	if len(textCompletionResponse.Choices) == 0 {
		return "", nil
	}
	return textCompletionResponse.Choices[0].Text, nil
}
