package testserver

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"

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
	user, err := s.postAuthSignUp(signup)
	require.NoError(t, err)
	require.Equal(t, signup.Username, user.Username)
	memo, err := s.postMemoCreate(&apiv1.CreateMemoRequest{
		Content: "test memo",
	})
	require.NoError(t, err)
	require.Equal(t, "test memo", memo.Content)
	memoList, err := s.getMemoList()
	require.NoError(t, err)
	require.Len(t, memoList, 1)
	updatedContent := "updated memo"
	memo, err = s.patchMemo(&apiv1.PatchMemoRequest{
		ID:      memo.ID,
		Content: &updatedContent,
	})
	require.NoError(t, err)
	require.Equal(t, updatedContent, memo.Content)
	require.Equal(t, false, memo.Pinned)
	_, err = s.postMemoOrganizer(memo.ID, &apiv1.UpsertMemoOrganizerRequest{
		Pinned: true,
	})
	require.NoError(t, err)
	memo, err = s.patchMemo(&apiv1.PatchMemoRequest{
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

func (s *TestingServer) getMemo(memoID int32) (*apiv1.Memo, error) {
	body, err := s.get(fmt.Sprintf("/api/v1/memo/%d", memoID), nil)
	if err != nil {
		return nil, err
	}

	buf := &bytes.Buffer{}
	_, err = buf.ReadFrom(body)
	if err != nil {
		return nil, errors.Wrap(err, "fail to read response body")
	}

	memo := &apiv1.Memo{}
	if err = json.Unmarshal(buf.Bytes(), memo); err != nil {
		return nil, errors.Wrap(err, "fail to unmarshal get memo response")
	}
	return memo, nil
}

func (s *TestingServer) getMemoList() ([]*apiv1.Memo, error) {
	body, err := s.get("/api/v1/memo", nil)
	if err != nil {
		return nil, err
	}

	buf := &bytes.Buffer{}
	_, err = buf.ReadFrom(body)
	if err != nil {
		return nil, errors.Wrap(err, "fail to read response body")
	}

	memoList := []*apiv1.Memo{}
	if err = json.Unmarshal(buf.Bytes(), &memoList); err != nil {
		return nil, errors.Wrap(err, "fail to unmarshal get memo list response")
	}
	return memoList, nil
}

func (s *TestingServer) postMemoCreate(memoCreate *apiv1.CreateMemoRequest) (*apiv1.Memo, error) {
	rawData, err := json.Marshal(&memoCreate)
	if err != nil {
		return nil, errors.Wrap(err, "failed to marshal memo create")
	}
	reader := bytes.NewReader(rawData)
	body, err := s.post("/api/v1/memo", reader, nil)
	if err != nil {
		return nil, err
	}

	buf := &bytes.Buffer{}
	_, err = buf.ReadFrom(body)
	if err != nil {
		return nil, errors.Wrap(err, "fail to read response body")
	}

	memo := &apiv1.Memo{}
	if err = json.Unmarshal(buf.Bytes(), memo); err != nil {
		return nil, errors.Wrap(err, "fail to unmarshal post memo create response")
	}
	return memo, nil
}

func (s *TestingServer) patchMemo(memoPatch *apiv1.PatchMemoRequest) (*apiv1.Memo, error) {
	rawData, err := json.Marshal(&memoPatch)
	if err != nil {
		return nil, errors.Wrap(err, "failed to marshal memo patch")
	}
	reader := bytes.NewReader(rawData)
	body, err := s.patch(fmt.Sprintf("/api/v1/memo/%d", memoPatch.ID), reader, nil)
	if err != nil {
		return nil, err
	}

	buf := &bytes.Buffer{}
	_, err = buf.ReadFrom(body)
	if err != nil {
		return nil, errors.Wrap(err, "fail to read response body")
	}

	memo := &apiv1.Memo{}
	if err = json.Unmarshal(buf.Bytes(), memo); err != nil {
		return nil, errors.Wrap(err, "fail to unmarshal patch memo response")
	}
	return memo, nil
}

func (s *TestingServer) deleteMemo(memoID int32) error {
	_, err := s.delete(fmt.Sprintf("/api/v1/memo/%d", memoID), nil)
	return err
}

func (s *TestingServer) postMemoOrganizer(memoID int32, memosOrganizer *apiv1.UpsertMemoOrganizerRequest) (*apiv1.Memo, error) {
	rawData, err := json.Marshal(&memosOrganizer)
	if err != nil {
		return nil, errors.Wrap(err, "failed to marshal memos organizer")
	}
	reader := bytes.NewReader(rawData)
	body, err := s.post(fmt.Sprintf("/api/v1/memo/%d/organizer", memoID), reader, nil)
	if err != nil {
		return nil, err
	}

	buf := &bytes.Buffer{}
	_, err = buf.ReadFrom(body)
	if err != nil {
		return nil, errors.Wrap(err, "fail to read response body")
	}

	memo := &apiv1.Memo{}
	if err = json.Unmarshal(buf.Bytes(), memo); err != nil {
		return nil, errors.Wrap(err, "fail to unmarshal organizer memo create response")
	}
	return memo, err
}
