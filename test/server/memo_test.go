package testserver

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"
	"github.com/usememos/memos/api"
	apiv1 "github.com/usememos/memos/api/v1"
)

func TestMemoServer(t *testing.T) {
	ctx := context.Background()
	s, err := NewTestingServer(ctx, t)
	require.NoError(t, err)
	defer s.Shutdown(ctx)

	signup := &apiv1.SignUp{
		Username: "testuser",
		Password: "testpassword",
	}
	user, err := s.postAuthSignup(signup)
	require.NoError(t, err)
	require.Equal(t, signup.Username, user.Username)
	memo, err := s.postMemoCreate(&api.CreateMemoRequest{
		Content: "test memo",
	})
	require.NoError(t, err)
	require.Equal(t, "test memo", memo.Content)
	memoList, err := s.getMemoList()
	require.NoError(t, err)
	require.Len(t, memoList, 1)
	updatedContent := "updated memo"
	memo, err = s.patchMemo(&api.PatchMemoRequest{
		ID:      memo.ID,
		Content: &updatedContent,
	})
	require.NoError(t, err)
	require.Equal(t, updatedContent, memo.Content)
	require.Equal(t, false, memo.Pinned)
	memo, err = s.postMemosOrganizer(&api.MemoOrganizerUpsert{
		MemoID: memo.ID,
		UserID: user.ID,
		Pinned: true,
	})
	require.NoError(t, err)
	memo, err = s.patchMemo(&api.PatchMemoRequest{
		ID:      memo.ID,
		Content: &updatedContent,
	})
	require.NoError(t, err)
	require.Equal(t, updatedContent, memo.Content)
	require.Equal(t, true, memo.Pinned)
	err = s.deleteMemo(memo.ID)
	require.NoError(t, err)
	memoList, err = s.getMemoList()
	require.NoError(t, err)
	require.Len(t, memoList, 0)
}

func (s *TestingServer) getMemo(memoID int) (*api.MemoResponse, error) {
	body, err := s.get(fmt.Sprintf("/api/memo/%d", memoID), nil)
	if err != nil {
		return nil, err
	}

	buf := &bytes.Buffer{}
	_, err = buf.ReadFrom(body)
	if err != nil {
		return nil, errors.Wrap(err, "fail to read response body")
	}

	type MemoCreateResponse struct {
		Data *api.MemoResponse `json:"data"`
	}
	res := new(MemoCreateResponse)
	if err = json.Unmarshal(buf.Bytes(), res); err != nil {
		return nil, errors.Wrap(err, "fail to unmarshal get memo response")
	}
	return res.Data, nil
}

func (s *TestingServer) getMemoList() ([]*api.MemoResponse, error) {
	body, err := s.get("/api/memo", nil)
	if err != nil {
		return nil, err
	}

	buf := &bytes.Buffer{}
	_, err = buf.ReadFrom(body)
	if err != nil {
		return nil, errors.Wrap(err, "fail to read response body")
	}

	type MemoCreateResponse struct {
		Data []*api.MemoResponse `json:"data"`
	}
	res := new(MemoCreateResponse)
	if err = json.Unmarshal(buf.Bytes(), res); err != nil {
		return nil, errors.Wrap(err, "fail to unmarshal get memo list response")
	}
	return res.Data, nil
}

func (s *TestingServer) postMemoCreate(memoCreate *api.CreateMemoRequest) (*api.MemoResponse, error) {
	rawData, err := json.Marshal(&memoCreate)
	if err != nil {
		return nil, errors.Wrap(err, "failed to marshal memo create")
	}
	reader := bytes.NewReader(rawData)
	body, err := s.post("/api/memo", reader, nil)
	if err != nil {
		return nil, err
	}

	buf := &bytes.Buffer{}
	_, err = buf.ReadFrom(body)
	if err != nil {
		return nil, errors.Wrap(err, "fail to read response body")
	}

	type MemoCreateResponse struct {
		Data *api.MemoResponse `json:"data"`
	}
	res := new(MemoCreateResponse)
	if err = json.Unmarshal(buf.Bytes(), res); err != nil {
		return nil, errors.Wrap(err, "fail to unmarshal post memo create response")
	}
	return res.Data, nil
}

func (s *TestingServer) patchMemo(memoPatch *api.PatchMemoRequest) (*api.MemoResponse, error) {
	rawData, err := json.Marshal(&memoPatch)
	if err != nil {
		return nil, errors.Wrap(err, "failed to marshal memo patch")
	}
	reader := bytes.NewReader(rawData)
	body, err := s.patch(fmt.Sprintf("/api/memo/%d", memoPatch.ID), reader, nil)
	if err != nil {
		return nil, err
	}

	buf := &bytes.Buffer{}
	_, err = buf.ReadFrom(body)
	if err != nil {
		return nil, errors.Wrap(err, "fail to read response body")
	}

	type MemoPatchResponse struct {
		Data *api.MemoResponse `json:"data"`
	}
	res := new(MemoPatchResponse)
	if err = json.Unmarshal(buf.Bytes(), res); err != nil {
		return nil, errors.Wrap(err, "fail to unmarshal patch memo response")
	}
	return res.Data, nil
}

func (s *TestingServer) deleteMemo(memoID int) error {
	_, err := s.delete(fmt.Sprintf("/api/memo/%d", memoID), nil)
	return err
}

func (s *TestingServer) postMemosOrganizer(memosOrganizer *api.MemoOrganizerUpsert) (*api.MemoResponse, error) {
	rawData, err := json.Marshal(&memosOrganizer)
	if err != nil {
		return nil, errors.Wrap(err, "failed to marshal memos organizer")
	}
	reader := bytes.NewReader(rawData)
	body, err := s.post(fmt.Sprintf("/api/memo/%d/organizer", memosOrganizer.MemoID), reader, nil)
	if err != nil {
		return nil, err
	}

	buf := &bytes.Buffer{}
	_, err = buf.ReadFrom(body)
	if err != nil {
		return nil, errors.Wrap(err, "fail to read response body")
	}

	type MemoOrganizerResponse struct {
		Data *api.MemoResponse `json:"data"`
	}
	res := new(MemoOrganizerResponse)
	if err = json.Unmarshal(buf.Bytes(), res); err != nil {
		return nil, errors.Wrap(err, "fail to unmarshal organizer memo create response")
	}
	return res.Data, err
}
