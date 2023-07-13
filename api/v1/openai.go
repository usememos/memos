package v1

import (
	"encoding/json"
	"net/http"
	"time"

	echosse "github.com/CorrectRoadH/echo-sse"
	"github.com/PullRequestInc/go-gpt3"
	"github.com/labstack/echo/v4"
	"github.com/usememos/memos/plugin/openai"
	"github.com/usememos/memos/store"
)

func (s *APIV1Service) registerOpenAIRoutes(g *echo.Group) {
	g.POST("/openai/chat-completion", func(c echo.Context) error {
		ctx := c.Request().Context()
		openAIConfigSetting, err := s.Store.GetSystemSetting(ctx, &store.FindSystemSetting{
			Name: SystemSettingOpenAIConfigName.String(),
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find openai key").SetInternal(err)
		}

		openAIConfig := OpenAIConfig{}
		if openAIConfigSetting != nil {
			err = json.Unmarshal([]byte(openAIConfigSetting.Value), &openAIConfig)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to unmarshal openai system setting value").SetInternal(err)
			}
		}
		if openAIConfig.Key == "" {
			return echo.NewHTTPError(http.StatusBadRequest, "OpenAI API key not set")
		}

		messages := []openai.ChatCompletionMessage{}
		if err := json.NewDecoder(c.Request().Body).Decode(&messages); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post chat completion request").SetInternal(err)
		}
		if len(messages) == 0 {
			return echo.NewHTTPError(http.StatusBadRequest, "No messages provided")
		}

		result, err := openai.PostChatCompletion(messages, openAIConfig.Key, openAIConfig.Host)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to post chat completion").SetInternal(err)
		}

		return c.JSON(http.StatusOK, result)
	})

	g.POST("/openai/chat-streaming", func(c echo.Context) error {
		messages := []gpt3.ChatCompletionRequestMessage{}
		if err := json.NewDecoder(c.Request().Body).Decode(&messages); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post chat completion request").SetInternal(err)
		}
		if len(messages) == 0 {
			return echo.NewHTTPError(http.StatusBadRequest, "No messages provided")
		}

		ctx := c.Request().Context()
		openAIConfigSetting, err := s.Store.GetSystemSetting(ctx, &store.FindSystemSetting{
			Name: SystemSettingOpenAIConfigName.String(),
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find openai key").SetInternal(err)
		}

		openAIConfig := OpenAIConfig{}
		if openAIConfigSetting != nil {
			err = json.Unmarshal([]byte(openAIConfigSetting.Value), &openAIConfig)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to unmarshal openai system setting value").SetInternal(err)
			}
		}
		if openAIConfig.Key == "" {
			return echo.NewHTTPError(http.StatusBadRequest, "OpenAI API key not set")
		}

		sse := echosse.NewSSEClint(c)

		// to do these things in server may not elegant.
		// But move it to openai plugin will break the simple. Because it is a streaming. We must use a channel to do it.
		// And we can think it is a forward proxy. So it in here is not a bad idea.
		client := gpt3.NewClient(openAIConfig.Key)
		err = client.ChatCompletionStream(ctx, gpt3.ChatCompletionRequest{
			Model:    gpt3.GPT3Dot5Turbo,
			Messages: messages,
			Stream:   true,
		},
			func(resp *gpt3.ChatCompletionStreamResponse) {
				// _ is for to pass the golangci-lint check
				_ = sse.SendEvent(resp.Choices[0].Delta.Content)

				// to delay 0.5 s
				time.Sleep(50 * time.Millisecond)
				// the delay is a very good way to make the chatbot more comfortable
				// otherwise the chatbot will reply too fast. Believe me it is not good.🤔
			})

		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to chat with OpenAI").SetInternal(err)
		}

		return nil
	})

	g.GET("/openai/enabled", func(c echo.Context) error {
		ctx := c.Request().Context()
		openAIConfigSetting, err := s.Store.GetSystemSetting(ctx, &store.FindSystemSetting{
			Name: SystemSettingOpenAIConfigName.String(),
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find openai key").SetInternal(err)
		}

		openAIConfig := OpenAIConfig{}
		if openAIConfigSetting != nil {
			err = json.Unmarshal([]byte(openAIConfigSetting.Value), &openAIConfig)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to unmarshal openai system setting value").SetInternal(err)
			}
		}
		if openAIConfig.Key == "" {
			return echo.NewHTTPError(http.StatusBadRequest, "OpenAI API key not set")
		}

		return c.JSON(http.StatusOK, openAIConfig.Key != "")
	})
}
