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

func (s *Server) registerWebhookRoutes(g *echo.Group) {
	g.GET("/test", func(c echo.Context) error {
		return c.HTML(http.StatusOK, "<strong>Hello, World!</strong>")
	})

	g.POST("/:openId/memo", func(c echo.Context) error {
		openID := c.Param("openId")
		userFind := &api.UserFind{
			OpenID: &openID,
		}
		user, err := s.Store.FindUser(userFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user by open_id").SetInternal(err)
		}
		if user == nil {
			return echo.NewHTTPError(http.StatusNotFound, fmt.Sprintf("User openId not found: %s", openID))
		}

		memoCreate := &api.MemoCreate{
			CreatorID: user.ID,
		}
		if err := json.NewDecoder(c.Request().Body).Decode(memoCreate); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post memo request by open api").SetInternal(err)
		}

		memo, err := s.Store.CreateMemo(memoCreate)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create memo").SetInternal(err)
		}

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(memo)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode memo response").SetInternal(err)
		}
		return nil
	})

	g.PATCH("/:openId/memo/:memoId", func(c echo.Context) error {
		openID := c.Param("openId")
		userFind := &api.UserFind{
			OpenID: &openID,
		}
		user, err := s.Store.FindUser(userFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user by open_id").SetInternal(err)
		}
		if user == nil {
			return echo.NewHTTPError(http.StatusNotFound, fmt.Sprintf("User openId not found: %s", openID))
		}

		memoID, err := strconv.Atoi(c.Param("memoId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("memoId is not a number: %s", c.Param("memoId"))).SetInternal(err)
		}

		memoPatch := &api.MemoPatch{
			ID: memoID,
		}
		if err := json.NewDecoder(c.Request().Body).Decode(memoPatch); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted patch memo request by open api").SetInternal(err)
		}

		memo, err := s.Store.PatchMemo(memoPatch)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to patch memo").SetInternal(err)
		}

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(memo)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode memo response").SetInternal(err)
		}
		return nil
	})

	g.GET("/:openId/memo", func(c echo.Context) error {
		openID := c.Param("openId")
		userFind := &api.UserFind{
			OpenID: &openID,
		}
		user, err := s.Store.FindUser(userFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user by open_id").SetInternal(err)
		}
		if user == nil {
			return echo.NewHTTPError(http.StatusNotFound, fmt.Sprintf("Not found user with openid: %s", openID))
		}

		memoFind := &api.MemoFind{
			CreatorID: &user.ID,
		}
		rowStatus := api.RowStatus(c.QueryParam("rowStatus"))
		if rowStatus != "" {
			memoFind.RowStatus = &rowStatus
		}
		pinnedStr := c.QueryParam("pinned")
		if pinnedStr != "" {
			pinned := pinnedStr == "true"
			memoFind.Pinned = &pinned
		}
		tag := c.QueryParam("tag")
		if tag != "" {
			contentSearch := tag + " "
			memoFind.ContentSearch = &contentSearch
		}
		if limit, err := strconv.Atoi(c.QueryParam("limit")); err == nil {
			memoFind.Limit = limit
		}
		if offset, err := strconv.Atoi(c.QueryParam("offset")); err == nil {
			memoFind.Offset = offset
		}

		list, err := s.Store.FindMemoList(memoFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch memo list").SetInternal(err)
		}

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(list)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode memo list response").SetInternal(err)
		}
		return nil
	})

	g.POST("/:openId/resource", func(c echo.Context) error {
		openID := c.Param("openId")
		userFind := &api.UserFind{
			OpenID: &openID,
		}
		user, err := s.Store.FindUser(userFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find user by open_id").SetInternal(err)
		}
		if user == nil {
			return echo.NewHTTPError(http.StatusNotFound, fmt.Sprintf("User openId not found: %s", openID))
		}

		if err := c.Request().ParseMultipartForm(64 << 20); err != nil {
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
			CreatorID: user.ID,
		}

		resource, err := s.Store.CreateResource(resourceCreate)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create resource").SetInternal(err)
		}

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
		if err := json.NewEncoder(c.Response().Writer).Encode(composeResponse(resource)); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to encode resource response").SetInternal(err)
		}
		return nil
	})

	g.GET("/r/:resourceId/:filename", func(c echo.Context) error {
		resourceID, err := strconv.Atoi(c.Param("resourceId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("resourceId"))).SetInternal(err)
		}

		filename := c.Param("filename")
		resourceFind := &api.ResourceFind{
			ID:       &resourceID,
			Filename: &filename,
		}
		resource, err := s.Store.FindResource(resourceFind)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Failed to fetch resource ID: %v", resourceID)).SetInternal(err)
		}

		c.Response().Writer.WriteHeader(http.StatusOK)
		c.Response().Writer.Header().Set("Content-Type", resource.Type)
		c.Response().Writer.Write(resource.Blob)
		return nil
	})
}
