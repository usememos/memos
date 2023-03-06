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
	g.POST("/opanai/chat-completion", func(c echo.Context) error {
		ctx := c.Request().Context()
		openAIApiKeySetting, err := s.Store.FindSystemSetting(ctx, &api.SystemSettingFind{
			Name: api.SystemSettingOpenAIAPIKeyName,
		})
		if err != nil && common.ErrorCode(err) != common.NotFound {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find openai api key").SetInternal(err)
		}

		openAIApiHostSetting, err := s.Store.FindSystemSetting(ctx, &api.SystemSettingFind{
			Name: api.SystemSettingOpenAIAPIHost,
		})
		if err != nil && common.ErrorCode(err) != common.NotFound {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find openai api host").SetInternal(err)
		}

		openAIApiKey := ""
		if openAIApiKeySetting != nil {
			err = json.Unmarshal([]byte(openAIApiKeySetting.Value), &openAIApiKey)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to unmarshal system setting value").SetInternal(err)
			}
		}
		if openAIApiKey == "" {
			return echo.NewHTTPError(http.StatusBadRequest, "OpenAI API key not set")
		}

		openAIApiHost := ""
		if openAIApiHostSetting != nil {
			err = json.Unmarshal([]byte(openAIApiHostSetting.Value), &openAIApiHost)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to unmarshal system setting value").SetInternal(err)
			}
		}

		completionRequest := api.OpenAICompletionRequest{}
		if err := json.NewDecoder(c.Request().Body).Decode(&completionRequest); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post chat completion request").SetInternal(err)
		}
		if completionRequest.Prompt == "" {
			return echo.NewHTTPError(http.StatusBadRequest, "Prompt is required")
		}

		result, err := openai.PostChatCompletion(completionRequest.Prompt, openAIApiKey, openAIApiHost)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to post chat completion").SetInternal(err)
		}

		return c.JSON(http.StatusOK, composeResponse(result))
	})

	g.POST("/opanai/text-completion", func(c echo.Context) error {
		ctx := c.Request().Context()
		openAIApiKeySetting, err := s.Store.FindSystemSetting(ctx, &api.SystemSettingFind{
			Name: api.SystemSettingOpenAIAPIKeyName,
		})
		if err != nil && common.ErrorCode(err) != common.NotFound {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find openai api key").SetInternal(err)
		}

		openAIApiHostSetting, err := s.Store.FindSystemSetting(ctx, &api.SystemSettingFind{
			Name: api.SystemSettingOpenAIAPIHost,
		})
		if err != nil && common.ErrorCode(err) != common.NotFound {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find openai api host").SetInternal(err)
		}

		openAIApiKey := ""
		if openAIApiKeySetting != nil {
			err = json.Unmarshal([]byte(openAIApiKeySetting.Value), &openAIApiKey)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to unmarshal system setting value").SetInternal(err)
			}
		}
		if openAIApiKey == "" {
			return echo.NewHTTPError(http.StatusBadRequest, "OpenAI API key not set")
		}

		openAIApiHost := ""
		if openAIApiHostSetting != nil {
			err = json.Unmarshal([]byte(openAIApiHostSetting.Value), &openAIApiHost)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to unmarshal system setting value").SetInternal(err)
			}
		}

		textCompletion := api.OpenAICompletionRequest{}
		if err := json.NewDecoder(c.Request().Body).Decode(&textCompletion); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post text completion request").SetInternal(err)
		}
		if textCompletion.Prompt == "" {
			return echo.NewHTTPError(http.StatusBadRequest, "Prompt is required")
		}

		result, err := openai.PostTextCompletion(textCompletion.Prompt, openAIApiKey, openAIApiHost)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to post text completion").SetInternal(err)
		}

		return c.JSON(http.StatusOK, composeResponse(result))
	})

	g.GET("/opanai/enabled", func(c echo.Context) error {
		ctx := c.Request().Context()
		openAIApiKeySetting, err := s.Store.FindSystemSetting(ctx, &api.SystemSettingFind{
			Name: api.SystemSettingOpenAIAPIKeyName,
		})
		if err != nil && common.ErrorCode(err) != common.NotFound {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find openai api key").SetInternal(err)
		}

		openAIApiKey := ""
		if openAIApiKeySetting != nil {
			err = json.Unmarshal([]byte(openAIApiKeySetting.Value), &openAIApiKey)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to unmarshal system setting value").SetInternal(err)
			}
		}

		return c.JSON(http.StatusOK, composeResponse(openAIApiKey != ""))
	})
}
