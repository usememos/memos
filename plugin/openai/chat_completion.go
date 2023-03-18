package openai

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
)

type ChatCompletionMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatCompletionChoice struct {
	Message *ChatCompletionMessage `json:"message"`
}

type ChatCompletionResponse struct {
	Error   interface{}            `json:"error"`
	Model   string                 `json:"model"`
	Choices []ChatCompletionChoice `json:"choices"`
}

func PostChatCompletion(messages []ChatCompletionMessage, apiKey string, apiHost string) (string, error) {
	if apiHost == "" {
		apiHost = "https://api.openai.com"
	}
	url, err := url.JoinPath(apiHost, "/v1/chat/completions")
	if err != nil {
		return "", err
	}

	values := map[string]interface{}{
		"model":             "gpt-3.5-turbo",
		"messages":          messages,
		"max_tokens":        2000,
		"temperature":       0,
		"frequency_penalty": 0.0,
		"presence_penalty":  0.0,
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

	chatCompletionResponse := ChatCompletionResponse{}
	err = json.Unmarshal(responseBody, &chatCompletionResponse)
	if err != nil {
		return "", err
	}
	if chatCompletionResponse.Error != nil {
		errorBytes, err := json.Marshal(chatCompletionResponse.Error)
		if err != nil {
			return "", err
		}
		return "", errors.New(string(errorBytes))
	}
	if len(chatCompletionResponse.Choices) == 0 {
		return "", nil
	}
	return chatCompletionResponse.Choices[0].Message.Content, nil
}
