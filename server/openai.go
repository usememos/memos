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

		completionRequest := api.OpenAICompletionRequest{}
		if err := json.NewDecoder(c.Request().Body).Decode(&completionRequest); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post chat completion request").SetInternal(err)
		}
		if completionRequest.Prompt == "" {
			return echo.NewHTTPError(http.StatusBadRequest, "Prompt is required")
		}

		result, err := openai.PostChatCompletion(completionRequest.Prompt, openAIConfig.Key, openAIConfig.Host)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to post chat completion").SetInternal(err)
		}

		return c.JSON(http.StatusOK, composeResponse(result))
	})

	g.POST("/openai/text-completion", func(c echo.Context) error {
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

		textCompletion := api.OpenAICompletionRequest{}
		if err := json.NewDecoder(c.Request().Body).Decode(&textCompletion); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post text completion request").SetInternal(err)
		}
		if textCompletion.Prompt == "" {
			return echo.NewHTTPError(http.StatusBadRequest, "Prompt is required")
		}

		result, err := openai.PostTextCompletion(textCompletion.Prompt, openAIConfig.Key, openAIConfig.Host)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to post text completion").SetInternal(err)
		}

		return c.JSON(http.StatusOK, composeResponse(result))
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
