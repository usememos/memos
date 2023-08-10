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

func TestUserServer(t *testing.T) {
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
	user, err = s.getCurrentUser()
	require.NoError(t, err)
	require.Equal(t, signup.Username, user.Username)
	user, err = s.getUserByID(user.ID)
	require.NoError(t, err)
	require.Equal(t, signup.Username, user.Username)
	newEmail := "test@usermemos.com"
	userPatch := &apiv1.UpdateUserRequest{
		Email: &newEmail,
	}
	user, err = s.patchUser(user.ID, userPatch)
	require.NoError(t, err)
	require.Equal(t, newEmail, user.Email)
}

func (s *TestingServer) getCurrentUser() (*apiv1.User, error) {
	body, err := s.get("/api/v1/user/me", nil)
	if err != nil {
		return nil, err
	}

	buf := &bytes.Buffer{}
	_, err = buf.ReadFrom(body)
	if err != nil {
		return nil, errors.Wrap(err, "fail to read response body")
	}

	user := &apiv1.User{}
	if err = json.Unmarshal(buf.Bytes(), &user); err != nil {
		return nil, errors.Wrap(err, "fail to unmarshal get user response")
	}
	return user, nil
}

func (s *TestingServer) getUserByID(userID int32) (*apiv1.User, error) {
	body, err := s.get(fmt.Sprintf("/api/v1/user/%d", userID), nil)
	if err != nil {
		return nil, err
	}

	buf := &bytes.Buffer{}
	_, err = buf.ReadFrom(body)
	if err != nil {
		return nil, errors.Wrap(err, "fail to read response body")
	}

	user := &apiv1.User{}
	if err = json.Unmarshal(buf.Bytes(), &user); err != nil {
		return nil, errors.Wrap(err, "fail to unmarshal get user response")
	}
	return user, nil
}

func (s *TestingServer) patchUser(userID int32, request *apiv1.UpdateUserRequest) (*apiv1.User, error) {
	rawData, err := json.Marshal(&request)
	if err != nil {
		return nil, errors.Wrap(err, "failed to marshal request")
	}
	reader := bytes.NewReader(rawData)
	body, err := s.patch(fmt.Sprintf("/api/v1/user/%d", userID), reader, nil)
	if err != nil {
		return nil, err
	}

	buf := &bytes.Buffer{}
	_, err = buf.ReadFrom(body)
	if err != nil {
		return nil, errors.Wrap(err, "fail to read response body")
	}

	user := &apiv1.User{}
	if err = json.Unmarshal(buf.Bytes(), user); err != nil {
		return nil, errors.Wrap(err, "fail to unmarshal patch user response")
	}
	return user, nil
}
