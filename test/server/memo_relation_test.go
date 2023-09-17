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

func TestMemoRelationServer(t *testing.T) {
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
	memo2, err := s.postMemoCreate(&apiv1.CreateMemoRequest{
		Content: "test memo2",
		RelationList: []*apiv1.UpsertMemoRelationRequest{
			{
				RelatedMemoID: memo.ID,
				Type:          apiv1.MemoRelationReference,
			},
		},
	})
	require.NoError(t, err)
	require.Equal(t, "test memo2", memo2.Content)
	memoList, err := s.getMemoList()
	require.NoError(t, err)
	require.Len(t, memoList, 2)
	require.Len(t, memo2.RelationList, 1)
	err = s.deleteMemoRelation(memo2.ID, memo.ID, apiv1.MemoRelationReference)
	require.NoError(t, err)
	memo2, err = s.getMemo(memo2.ID)
	require.NoError(t, err)
	require.Len(t, memo2.RelationList, 0)
	memoRelation, err := s.postMemoRelationUpsert(memo2.ID, &apiv1.UpsertMemoRelationRequest{
		RelatedMemoID: memo.ID,
		Type:          apiv1.MemoRelationReference,
	})
	require.NoError(t, err)
	require.Equal(t, memo.ID, memoRelation.RelatedMemoID)
	memo2, err = s.getMemo(memo2.ID)
	require.NoError(t, err)
	require.Len(t, memo2.RelationList, 1)
}

func (s *TestingServer) postMemoRelationUpsert(memoID int32, memoRelationUpsert *apiv1.UpsertMemoRelationRequest) (*apiv1.MemoRelation, error) {
	rawData, err := json.Marshal(&memoRelationUpsert)
	if err != nil {
		return nil, errors.Wrap(err, "failed to marshal memo relation upsert")
	}
	reader := bytes.NewReader(rawData)
	body, err := s.post(fmt.Sprintf("/api/v1/memo/%d/relation", memoID), reader, nil)
	if err != nil {
		return nil, err
	}

	buf := &bytes.Buffer{}
	_, err = buf.ReadFrom(body)
	if err != nil {
		return nil, errors.Wrap(err, "fail to read response body")
	}

	memoRelation := &apiv1.MemoRelation{}
	if err = json.Unmarshal(buf.Bytes(), memoRelation); err != nil {
		return nil, errors.Wrap(err, "fail to unmarshal post memo relation upsert response")
	}
	return memoRelation, nil
}

func (s *TestingServer) deleteMemoRelation(memoID int32, relatedMemoID int32, relationType apiv1.MemoRelationType) error {
	_, err := s.delete(fmt.Sprintf("/api/v1/memo/%d/relation/%d/type/%s", memoID, relatedMemoID, relationType), nil)
	return err
}
