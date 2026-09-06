package fileserver

import (
	"net/http"

	"github.com/labstack/echo/v5"

	"github.com/usememos/memos/store"
)

func (s *FileServerService) serveMemoCover(c *echo.Context) error {
	ctx := c.Request().Context()
	c.Response().Header().Set(echo.HeaderCacheControl, "private, no-store")
	memoUID, coverUID := c.Param("memoUID"), c.Param("attachmentUID")
	memo, err := s.Store.GetMemo(ctx, &store.FindMemo{UID: &memoUID})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get memo").Wrap(err)
	}
	if memo == nil {
		return echo.NewHTTPError(http.StatusNotFound, "memo not found")
	}
	if _, err := s.checkMemoPermission(ctx, c, memo); err != nil {
		return err
	}
	referenced := false
	for _, link := range memo.Payload.GetLinks() {
		if link.GetCoverAttachmentUid() == coverUID {
			referenced = true
			break
		}
	}
	if !referenced {
		return echo.NewHTTPError(http.StatusNotFound, "cover not found")
	}
	attachment, err := s.Store.GetAttachment(ctx, &store.FindAttachment{
		UID: &coverUID, CreatorID: &memo.CreatorID, GetBlob: true,
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get cover").Wrap(err)
	}
	if attachment == nil {
		return echo.NewHTTPError(http.StatusNotFound, "cover not found")
	}
	return s.serveStaticFile(c, attachment, sanitizeContentType(attachment.Type), c.QueryParam("thumbnail") == "true")
}
