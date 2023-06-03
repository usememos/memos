package server

import (
	"encoding/json"
	"net/http"

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
}
