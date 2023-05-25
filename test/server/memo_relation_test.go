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
)

func TestMemoRelationServer(t *testing.T) {
	ctx := context.Background()
	s, err := NewTestingServer(ctx, t)
	require.NoError(t, err)
	defer s.Shutdown(ctx)

	signup := &api.SignUp{
		Username: "testuser",
		Password: "testpassword",
	}
	user, err := s.postAuthSignup(signup)
	require.NoError(t, err)
	require.Equal(t, signup.Username, user.Username)
	memoList, err := s.getMemoList()
	require.NoError(t, err)
	require.Len(t, memoList, 1)
	memo, err := s.postMemoCreate(&api.CreateMemoRequest{
		Content: "test memo",
	})
	require.NoError(t, err)
	require.Equal(t, "test memo", memo.Content)
	memo2, err := s.postMemoCreate(&api.CreateMemoRequest{
		Content: "test memo2",
		RelationList: []*api.MemoRelationUpsert{
			{
				RelatedMemoID: memo.ID,
				Type:          api.MemoRelationReference,
			},
		},
	})
	require.NoError(t, err)
	require.Equal(t, "test memo2", memo2.Content)
	memoList, err = s.getMemoList()
	require.NoError(t, err)
	require.Len(t, memoList, 3)
	require.Len(t, memo2.RelationList, 1)
	err = s.deleteMemoRelation(memo2.ID, memo.ID, api.MemoRelationReference)
	require.NoError(t, err)
	memo2, err = s.getMemo(memo2.ID)
	require.NoError(t, err)
	require.Len(t, memo2.RelationList, 0)
	memoRelation, err := s.postMemoRelationUpsert(memo2.ID, &api.MemoRelationUpsert{
		RelatedMemoID: memo.ID,
		Type:          api.MemoRelationReference,
	})
	require.NoError(t, err)
	require.Equal(t, memo.ID, memoRelation.RelatedMemoID)
	memo2, err = s.getMemo(memo2.ID)
	require.NoError(t, err)
	require.Len(t, memo2.RelationList, 1)
}

func (s *TestingServer) postMemoRelationUpsert(memoID int, memoRelationUpsert *api.MemoRelationUpsert) (*api.MemoRelation, error) {
	rawData, err := json.Marshal(&memoRelationUpsert)
	if err != nil {
		return nil, errors.Wrap(err, "failed to marshal memo relation upsert")
	}
	reader := bytes.NewReader(rawData)
	body, err := s.post(fmt.Sprintf("/api/memo/%d/relation", memoID), reader, nil)
	if err != nil {
		return nil, err
	}

	buf := &bytes.Buffer{}
	_, err = buf.ReadFrom(body)
	if err != nil {
		return nil, errors.Wrap(err, "fail to read response body")
	}

	type MemoCreateResponse struct {
		Data *api.MemoRelation `json:"data"`
	}
	res := new(MemoCreateResponse)
	if err = json.Unmarshal(buf.Bytes(), res); err != nil {
		return nil, errors.Wrap(err, "fail to unmarshal post memo relation upsert response")
	}
	return res.Data, nil
}

func (s *TestingServer) deleteMemoRelation(memoID int, relatedMemoID int, relationType api.MemoRelationType) error {
	_, err := s.delete(fmt.Sprintf("/api/memo/%d/relation/%d/type/%s", memoID, relatedMemoID, relationType), nil)
	return err
}
