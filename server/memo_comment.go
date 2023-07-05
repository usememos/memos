package server

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/labstack/echo/v4"
	"github.com/usememos/memos/api"
	"github.com/usememos/memos/common"
	"github.com/usememos/memos/store"
	"net/http"
	"strconv"
	"time"
)

func (s *Server) registerMemoCommentRoutes(g *echo.Group) {
	g.GET("/memo/comment/:memoId", func(c echo.Context) error {
		ctx := c.Request().Context()
		memoID, err := strconv.Atoi(c.Param("memoId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("memoId"))).SetInternal(err)
		}

		memoCommentsMessage, err := s.Store.GetMemoComments(ctx, &store.FindMemoCommentMessage{
			MemoId: &memoID,
		})
		if err != nil {
			if common.ErrorCode(err) == common.NotFound {
				return echo.NewHTTPError(http.StatusNotFound, fmt.Sprintf("Memo ID not found: %d", memoID)).SetInternal(err)
			}
			return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Failed to find memo by ID: %v", memoID)).SetInternal(err)
		}

		// userID, ok := c.Get(getUserIDContextKey()).(int)
		// the map key is parent id , value is parent's reply, 0 is parent
		mapComments := make(map[int][]*api.MemoCommentResponse)
		for i, message := range memoCommentsMessage {
			if message.Visibility == store.Private {
				continue
			} else if message.Visibility == store.Protected {
				memoCommentsMessage[i].Content = "Protected"
			}
			memoCommentResponse, err := s.composeMemoCommentMessageToMemoCommentResponse(ctx, message)
			if err == nil {
				if mapComments[memoCommentResponse.ParentID] == nil {
					mapComments[memoCommentResponse.ParentID] = []*api.MemoCommentResponse{
						0: memoCommentResponse,
					}
				} else {
					mapComments[memoCommentResponse.ParentID] = append(mapComments[memoCommentResponse.ParentID],
						memoCommentResponse)
				}
			}
		}

		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to compose memo comment response").
				SetInternal(err)
		}
		return c.JSON(http.StatusOK, composeResponse(mapComments))
	})

	g.POST("/memo/comment", func(c echo.Context) error {
		ctx := c.Request().Context()
		_, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}

		createMemoCommentRequest := &api.CreateMemoCommentRequest{}
		if err := json.NewDecoder(c.Request().Body).Decode(createMemoCommentRequest); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post memo comment request").SetInternal(err)
		}
		if len(createMemoCommentRequest.Content) > maxContentLength {
			return echo.NewHTTPError(http.StatusBadRequest, "Content size overflow, up to 1MB")
		}

		memo, err := s.Store.GetMemo(ctx, &store.FindMemoMessage{
			ID: &createMemoCommentRequest.MemoID,
		})
		if err != nil || memo == nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find memo").SetInternal(err)
		}

		memoCommentMessage, err := s.Store.CreateCommentMemo(ctx, convertCreateMemoCommentRequestToMemoCommentMessage(
			createMemoCommentRequest))
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create memo").SetInternal(err)
		}

		_, err = s.Store.GetMemoComments(ctx, &store.FindMemoCommentMessage{
			ID: memoCommentMessage.ID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to compose memo").SetInternal(err)
		}
		memoCommentResponse, err := s.composeMemoCommentMessageToMemoCommentResponse(ctx, memoCommentMessage)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to compose memo comment response").
				SetInternal(err)
		}
		return c.JSON(http.StatusOK, composeResponse(memoCommentResponse))
	})

	g.DELETE("/memo/comment/:memoId/:commentId", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}
		memoCommentID, err := strconv.Atoi(c.Param("commentId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("commentId"))).SetInternal(err)
		}
		memoId, err := strconv.Atoi(c.Param("memoId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("memoId"))).SetInternal(err)
		}

		memo, err := s.Store.GetMemo(ctx, &store.FindMemoMessage{
			ID: &memoId,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find memo comment").SetInternal(err)
		}
		if memo.CreatorID != userID {
			return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized")
		}

		if err := s.Store.DeleteMemoComment(ctx, &store.DeleteMemoCommentMessage{
			ID:     memoCommentID,
			MemoID: memoId,
		}); err != nil {
			if common.ErrorCode(err) == common.NotFound {
				return echo.NewHTTPError(http.StatusNotFound, fmt.Sprintf("Memo Or Comment ID not found"))
			}
			return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Failed to delete memo comment ID: %v",
				memoCommentID)).SetInternal(err)
		}
		return c.JSON(http.StatusOK, true)
	})

}

func convertCreateMemoCommentRequestToMemoCommentMessage(memoCreate *api.CreateMemoCommentRequest) *store.
	MemoCommentMessage {
	createdTs := time.Now().Unix()
	if memoCreate.CreatedTs != nil {
		createdTs = *memoCreate.CreatedTs
	}
	return &store.MemoCommentMessage{
		CreatedTs: createdTs,
		Content:   memoCreate.Content,
		MemoID:    memoCreate.MemoID,
		ParentID:  memoCreate.ParentID,
		Email:     memoCreate.Email,
		Website:   memoCreate.Website,
		Name:      memoCreate.Name,
	}
}

func (s *Server) composeMemoCommentMessageToMemoCommentResponse(ctx context.Context,
	memoCommentMessage *store.MemoCommentMessage) (*api.MemoCommentResponse, error) {
	memoCommentResponse := &api.MemoCommentResponse{
		ID:         memoCommentMessage.ID,
		CreatedTs:  memoCommentMessage.CreatedTs,
		UpdatedTs:  memoCommentMessage.UpdatedTs,
		Content:    memoCommentMessage.Content,
		Visibility: api.Visibility(memoCommentMessage.Visibility.String()),
		Email:      memoCommentMessage.Email,
		Website:    memoCommentMessage.Website,
		Name:       memoCommentMessage.Name,
		ParentID:   memoCommentMessage.ParentID,
		MemoID:     memoCommentMessage.MemoID,
	}

	memoCommentResponse.CreatorName = memoCommentMessage.Name

	// Compose display ts.
	memoCommentResponse.DisplayTs = memoCommentResponse.CreatedTs
	// Find memo display with updated ts setting.
	memoDisplayWithUpdatedTs, err := s.getMemoDisplayWithUpdatedTsSettingValue(ctx)
	if err != nil {
		return nil, err
	}
	if memoDisplayWithUpdatedTs {
		memoCommentResponse.DisplayTs = memoCommentResponse.UpdatedTs
	}
	return memoCommentResponse, nil
}
