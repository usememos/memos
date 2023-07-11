package server

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	echosse "github.com/CorrectRoadH/echo-sse"
	"github.com/PullRequestInc/go-gpt3"
	"github.com/labstack/echo/v4"
	"github.com/usememos/memos/api"
	"github.com/usememos/memos/common"
	"github.com/usememos/memos/plugin/openai"
)

func (s *Server) registerOpenAIRoutes(g *echo.Group) {
	g.POST("/openai/chat-completion", func(c echo.Context) error {
		ctx := c.Request().Context()
		openAIConfigSetting, err := s.Store.FindSystemSetting(ctx, &api.SystemSettingFind{
			Name: api.SystemSettingOpenAIConfigName,
		})
		if err != nil && common.ErrorCode(err) != common.NotFound {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find openai key").SetInternal(err)
		}

		openAIConfig := api.OpenAIConfig{}
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

		return c.JSON(http.StatusOK, composeResponse(result))
	})

	g.POST("/openai/chat-streaming", func(c echo.Context) error {

		messages := []gpt3.ChatCompletionRequestMessage{}
		if err := json.NewDecoder(c.Request().Body).Decode(&messages); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post chat completion request").SetInternal(err)
		}
		if len(messages) == 0 {
			return echo.NewHTTPError(http.StatusBadRequest, "No messages provided")
		}

		sse := echosse.NewSSEClint(c)

		ctx := c.Request().Context()
		openAIConfigSetting, err := s.Store.FindSystemSetting(ctx, &api.SystemSettingFind{
			Name: api.SystemSettingOpenAIConfigName,
		})
		if err != nil && common.ErrorCode(err) != common.NotFound {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find openai key").SetInternal(err)
		}

		openAIConfig := api.OpenAIConfig{}
		if openAIConfigSetting != nil {
			err = json.Unmarshal([]byte(openAIConfigSetting.Value), &openAIConfig)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to unmarshal openai system setting value").SetInternal(err)
			}
		}
		if openAIConfig.Key == "" {
			return echo.NewHTTPError(http.StatusBadRequest, "OpenAI API key not set")
		}

		client := gpt3.NewClient(openAIConfig.Key)

		err = client.ChatCompletionStream(ctx, gpt3.ChatCompletionRequest{
			Model:    gpt3.GPT3Dot5Turbo,
			Messages: messages,
			Stream:   true,
		},
			func(resp *gpt3.ChatCompletionStreamResponse) {
				sse.SendEvent(resp.Choices[0].Delta.Content)
				//to delay 0.5 s
				time.Sleep(50 * time.Millisecond)
			})

		if err != nil {
			log.Fatalln(err)
		}

		return nil
	})

	g.GET("/openai/enabled", func(c echo.Context) error {
		ctx := c.Request().Context()
		openAIConfigSetting, err := s.Store.FindSystemSetting(ctx, &api.SystemSettingFind{
			Name: api.SystemSettingOpenAIConfigName,
		})
		if err != nil && common.ErrorCode(err) != common.NotFound {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find openai key").SetInternal(err)
		}

		openAIConfig := api.OpenAIConfig{}
		if openAIConfigSetting != nil {
			err = json.Unmarshal([]byte(openAIConfigSetting.Value), &openAIConfig)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to unmarshal openai system setting value").SetInternal(err)
			}
		}
		if openAIConfig.Key == "" {
			return echo.NewHTTPError(http.StatusBadRequest, "OpenAI API key not set")
		}

		return c.JSON(http.StatusOK, composeResponse(openAIConfig.Key != ""))
	})
}
