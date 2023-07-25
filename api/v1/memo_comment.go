package v1

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/usememos/memos/store"
)

type CreateMemoCommentRequest struct {
	// Standard fields
	CreatedTs *int64 `json:"createdTs"`

	// Domain specific fields
	Content string `json:"content"`

	// Info fields
	Username string `json:"username"`

	MemoID int `json:"memoId"`
}

type MemoCommentResponse struct {
	ID int `json:"id"`

	CreatedTs int64 `json:"createdTs"`
	UpdatedTs int64 `json:"updatedTs"`

	// Domain specific fields
	DisplayTs int64  `json:"displayTs"`
	Content   string `json:"content"`

	// Info fields
	Username string `json:"username"`

	MemoID int `json:"memoId"`
}

func (s *APIV1Service) registerMemoCommentRoutes(g *echo.Group) {
	g.GET("/memo/:memoId/comment", func(c echo.Context) error {
		ctx := c.Request().Context()
		memoID, err := strconv.Atoi(c.Param("memoId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("memoId"))).SetInternal(err)
		}

		memoCommentsMessage, err := s.Store.GetMemoComments(ctx, &store.FindMemoCommentMessage{
			MemoID: &memoID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusNotFound, fmt.Sprintf("Memo ID not found: %d", memoID)).SetInternal(err)
		}
		if memoCommentsMessage == nil {
			return echo.NewHTTPError(http.StatusInternalServerError,
				fmt.Sprintf("Failed to find memo comment by ID: %v", memoID)).SetInternal(err)
		}

		// the map key is parent id , value is parent's reply, 0 is parent , Retain this logic for a later version！
		// mapComments := make(map[int][]*MemoCommentResponse)
		// for _, message := range memoCommentsMessage {
		//	 memoCommentResponse, err := s.composeMemoCommentMessageToMemoCommentResponse(ctx, message)
		//	 if err == nil {
		//		 if mapComments[memoCommentResponse.ParentID] == nil {
		//			 mapComments[memoCommentResponse.ParentID] = []*MemoCommentResponse{
		//				 0: memoCommentResponse,
		//			 }
		//		 } else {
		//			 mapComments[memoCommentResponse.ParentID] = append(mapComments[memoCommentResponse.ParentID],
		//				 memoCommentResponse)
		//		 }
		//	 }
		// }
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to compose memo comment response").
				SetInternal(err)
		}
		return c.JSON(http.StatusOK, memoCommentsMessage)
	})

	g.POST("/memo/:memoId/comment", func(c echo.Context) error {
		ctx := c.Request().Context()
		memoID, err := strconv.Atoi(c.Param("memoId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "memo id is required").SetInternal(err)
		}
		createMemoCommentRequest := &CreateMemoCommentRequest{}
		if err = json.NewDecoder(c.Request().Body).Decode(createMemoCommentRequest); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Malformatted post memo comment request").SetInternal(err)
		}
		if len(createMemoCommentRequest.Content) > maxContentLength {
			return echo.NewHTTPError(http.StatusBadRequest, "Content size overflow, up to 1MB")
		}

		memo, err := s.Store.GetMemo(ctx, &store.FindMemo{
			ID: &memoID,
		})
		if err != nil || memo == nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find memo").SetInternal(err)
		}
		createMemoCommentRequest.MemoID = memoID
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
		return c.JSON(http.StatusOK, memoCommentResponse)
	})

	g.DELETE("/memo/:memoId/comment/:commentId", func(c echo.Context) error {
		ctx := c.Request().Context()
		userID, ok := c.Get(getUserIDContextKey()).(int)
		if !ok {
			return echo.NewHTTPError(http.StatusUnauthorized, "Missing user in session")
		}
		memoCommentID, err := strconv.Atoi(c.Param("commentId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("commentId"))).SetInternal(err)
		}
		memoID, err := strconv.Atoi(c.Param("memoId"))
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("ID is not a number: %s", c.Param("memoId"))).SetInternal(err)
		}

		memo, err := s.Store.GetMemo(ctx, &store.FindMemo{
			ID: &memoID,
		})
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to find memo comment").SetInternal(err)
		}
		if memo.CreatorID != userID {
			return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized")
		}

		if err := s.Store.DeleteMemoComment(ctx, &store.DeleteMemoCommentMessage{
			ID:     memoCommentID,
			MemoID: memoID,
		}); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("Failed to delete memo comment ID: %v",
				memoCommentID)).SetInternal(err)
		}
		return c.JSON(http.StatusOK, true)
	})
}

func convertCreateMemoCommentRequestToMemoCommentMessage(memoCreate *CreateMemoCommentRequest) *store.
	MemoCommentMessage {
	createdTs := time.Now().Unix()
	if memoCreate.CreatedTs != nil {
		createdTs = *memoCreate.CreatedTs
	}
	return &store.MemoCommentMessage{
		CreatedTs: createdTs,
		Content:   memoCreate.Content,
		MemoID:    memoCreate.MemoID,
		Username:  memoCreate.Username,
	}
}

func (s *APIV1Service) composeMemoCommentMessageToMemoCommentResponse(ctx context.Context,
	memoCommentMessage *store.MemoCommentMessage) (*MemoCommentResponse, error) {
	memoCommentResponse := &MemoCommentResponse{
		ID:        memoCommentMessage.ID,
		CreatedTs: memoCommentMessage.CreatedTs,
		UpdatedTs: memoCommentMessage.UpdatedTs,
		Content:   memoCommentMessage.Content,
		Username:  memoCommentMessage.Username,
		MemoID:    memoCommentMessage.MemoID,
	}

	memoCommentResponse.Username = memoCommentMessage.Username

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
