package server

import (
	"encoding/json"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/usememos/memos/api"
)

func (s *Server) registerManifestRoutes(g *echo.Group) {
	g.GET("/manifest.json", func(c echo.Context) error {
		ctx := c.Request().Context()

		manifest := api.Manifest{
			StartUrl:        "/",
			Scope:           "/",
			Display:         "standalone",
			ThemeColor:      "#f4f4f5",
			BackgroundColor: "#f4f4f5",
		}

		systemSettingList, err := s.Store.FindSystemSettingList(ctx, &api.SystemSettingFind{})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find system setting list").SetInternal(err)
		}
		for _, systemSetting := range systemSettingList {
			if systemSetting.Name == api.SystemSettingServerID || systemSetting.Name == api.SystemSettingSecretSessionName {
				continue
			}

			var value interface{}
			err := json.Unmarshal([]byte(systemSetting.Value), &value)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to unmarshal system setting").SetInternal(err)
			}

			if systemSetting.Name == api.SystemSettingCustomizedProfileName {
				valueMap := value.(map[string]interface{})
				if v := valueMap["name"]; v != nil {
					manifest.Name = v.(string)
					manifest.ShortName = v.(string)
				}
				if v := valueMap["logoUrl"]; v != nil {
					manifest.Icons = []api.Icon{{Src: v.(string), Type: "image/png", Sizes: "520x520"}}
				}
				if v := valueMap["description"]; v != nil {
					manifest.Description = v.(string)
				}
			}
		}

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(manifest); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode manifest response").SetInternal(err)
		}
		return nil
	})
}
