package server

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"memos/api"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
)

func (s *Server) registerResourceRoutes(g *echo.Group) {
	g.POST("/resource", func(c echo.Context) error {
		userId := c.Get(getUserIdContextKey()).(int)

		err := c.Request().ParseMultipartForm(5 << 20)
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Upload file overload max size").SetInternal(err)
		}

		file, err := c.FormFile("file")
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Upload file not found").SetInternal(err)
		}

		filename := file.Filename
		filetype := file.Header.Get("Content-Type")
		size := file.Size
		src, err := file.Open()
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to open file").SetInternal(err)
		}
		defer src.Close()

		fileBytes, err := ioutil.ReadAll(src)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to read file").SetInternal(err)
		}

		resourceCreate := &api.ResourceCreate{
			Filename:  filename,
			Type:      filetype,
			Size:      size,
			Blob:      fileBytes,
			CreatorId: userId,
		}

		resource, err := s.ResourceService.CreateResource(resourceCreate)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create resource").SetInternal(err)
		}

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(resource)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to marshal shortcut response").SetInternal(err)
		}

		return nil
	})
	g.GET("/resource", func(c echo.Context) error {
		userId := c.Get(getUserIdContextKey()).(int)
		resourceFind := &api.ResourceFind{
			CreatorId: &userId,
		}
		list, err := s.ResourceService.FindResourceList(resourceFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch resource list").SetInternal(err)
		}

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(list)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to marshal resource list response").SetInternal(err)
		}

		return nil
	})
	g.DELETE("/resource/:resourceId", func(c echo.Context) error {
		resourceId, err := strconv.Atoi(c.Param("resourceId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("resourceId"))).SetInternal(err)
		}

		resourceDelete := &api.ResourceDelete{
			Id: resourceId,
		}
		if err := s.ResourceService.DeleteResource(resourceDelete); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to delete resource").SetInternal(err)
		}

		return nil
	})
}
