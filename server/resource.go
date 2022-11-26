package server

import (
	"encoding/json"
	"fmt"
	"html"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/usememos/memos/api"
	"github.com/usememos/memos/common"
	metric "github.com/usememos/memos/plugin/metrics"

	"github.com/labstack/echo/v4"
)

const (
	// The max file size is 32MB.
	maxFileSize = (32 * 8) << 20
)

func (s *Server) registerResourceRoutes(g *echo.Group) {
	g.POST("/resource", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}

		if err := c.Request().ParseMultipartForm(maxFileSize); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Upload file overload max size").SetInternal(err)
		}

		file, err := c.FormFile("file")
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get uploading file").SetInternal(err)
		}
		if file == nil {
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

		fileBytes, err := io.ReadAll(src)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to read file").SetInternal(err)
		}

		resourceCreate := &api.ResourceCreate{
			Filename:  filename,
			Type:      filetype,
			Size:      size,
			Blob:      fileBytes,
			CreatorID: userID,
		}

		resource, err := s.Store.CreateResource(ctx, resourceCreate)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create resource").SetInternal(err)
		}
		s.Collector.Collect(ctx, &metric.Metric{
			Name: "resource created",
		})

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(resource)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode resource response").SetInternal(err)
		}
		return nil
	})

	g.GET("/resource", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}
		resourceFind := &api.ResourceFind{
			CreatorID: &userID,
		}
		list, err := s.Store.FindResourceList(ctx, resourceFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch resource list").SetInternal(err)
		}

		for _, resource := range list {
			memoResourceList, err := s.Store.FindMemoResourceList(ctx, &api.MemoResourceFind{
				ResourceID: &resource.ID,
			})
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find memo resource list").SetInternal(err)
			}
			resource.LinkedMemoAmount = len(memoResourceList)
		}

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(list)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode resource list response").SetInternal(err)
		}
		return nil
	})

	g.GET("/resource/:resourceId", func(c echo.Context) error {
		ctx := c.Request().Context()
		resourceID, err := strconv.Atoi(c.Param("resourceId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("resourceId"))).SetInternal(err)
		}

		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}
		resourceFind := &api.ResourceFind{
			ID:        &resourceID,
			CreatorID: &userID,
		}
		resource, err := s.Store.FindResource(ctx, resourceFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch resource").SetInternal(err)
		}

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(resource)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode resource response").SetInternal(err)
		}
		return nil
	})

	g.GET("/resource/:resourceId/blob", func(c echo.Context) error {
		ctx := c.Request().Context()
		resourceID, err := strconv.Atoi(c.Param("resourceId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("resourceId"))).SetInternal(err)
		}

		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}
		resourceFind := &api.ResourceFind{
			ID:        &resourceID,
			CreatorID: &userID,
		}
		resource, err := s.Store.FindResource(ctx, resourceFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch resource").SetInternal(err)
		}

		c.Response().Writer.WriteHeader(http.StatusOK)
		c.Response().Writer.Header().Set("Content-Type", resource.Type)
		if _, err := c.Response().Writer.Write(resource.Blob); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to write resource blob").SetInternal(err)
		}
		return nil
	})

	g.DELETE("/resource/:resourceId", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}

		resourceID, err := strconv.Atoi(c.Param("resourceId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("resourceId"))).SetInternal(err)
		}

		resource, err := s.Store.FindResource(ctx, &api.ResourceFind{
			ID:        &resourceID,
			CreatorID: &userID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find resource").SetInternal(err)
		}
		if resource == nil {
			return echo.NewHTTPError(http.StatusNotFound, "Not find resource").SetInternal(err)
		}

		resourceDelete := &api.ResourceDelete{
			ID: resourceID,
		}
		if err := s.Store.DeleteResource(ctx, resourceDelete); err != nil {
			if common.ErrorCode(err) == common.NotFound {
				return echo.NewHTTPError(http.StatusNotFound, fmt.Sprintf("Resource ID not found: %d", resourceID))
			}
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to delete resource").SetInternal(err)
		}

		return c.JSON(http.StatusOK, true)
	})

	g.PATCH("/resource/:resourceId", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}

		resourceID, err := strconv.Atoi(c.Param("resourceId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("resourceId"))).SetInternal(err)
		}

		resourceFind := &api.ResourceFind{
			ID:        &resourceID,
			CreatorID: &userID,
		}
		if _, err := s.Store.FindResource(ctx, resourceFind); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find resource").SetInternal(err)
		}

		currentTs := time.Now().Unix()
		resourcePatch := &api.ResourcePatch{
			ID:        resourceID,
			UpdatedTs: &currentTs,
		}
		if err := json.NewDecoder(c.Request().Body).Decode(resourcePatch); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted patch resource request").SetInternal(err)
		}

		resource, err := s.Store.PatchResource(ctx, resourcePatch)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to patch resource").SetInternal(err)
		}

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(resource)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode resource response").SetInternal(err)
		}
		return nil
	})
}

func (s *Server) registerResourcePublicRoutes(g *echo.Group) {
	g.GET("/r/:resourceId/:filename", func(c echo.Context) error {
		ctx := c.Request().Context()
		resourceID, err := strconv.Atoi(c.Param("resourceId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("resourceId"))).SetInternal(err)
		}

		filename := html.UnescapeString(c.Param("filename"))
		resourceFind := &api.ResourceFind{
			ID:       &resourceID,
			Filename: &filename,
		}
		resource, err := s.Store.FindResource(ctx, resourceFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Failed to fetch resource ID: %v", resourceID)).SetInternal(err)
		}

		c.Response().Writer.WriteHeader(http.StatusOK)
		c.Response().Writer.Header().Set("Content-Type", resource.Type)
		c.Response().Writer.Header().Set(echo.HeaderCacheControl, "max-age=31536000, immutable")
		if _, err := c.Response().Writer.Write(resource.Blob); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to write response").SetInternal(err)
		}
		return nil
	})
}
