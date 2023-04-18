package testserver

import (
	"bytes"
	"context"
	"encoding/json"
	"testing"

	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"
	"github.com/usememos/memos/api"
)

func TestAuthServer(t *testing.T) {
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
}

func (s *TestingServer) postAuthSignup(signup *api.SignUp) (*api.User, error) {
	rawData, err := json.Marshal(&signup)
	if err != nil {
		return nil, errors.Wrap(err, "failed to marshal signup")
	}
	reader := bytes.NewReader(rawData)
	body, err := s.post("/api/auth/signup", reader, nil)
	if err != nil {
		return nil, err
	}

	buf := &bytes.Buffer{}
	_, err = buf.ReadFrom(body)
	if err != nil {
		return nil, errors.Wrap(err, "fail to read response body")
	}

	type AuthSignupResponse struct {
		Data *api.User `json:"data"`
	}
	res := new(AuthSignupResponse)
	if err = json.Unmarshal(buf.Bytes(), res); err != nil {
		return nil, errors.Wrap(err, "fail to unmarshal post signup response")
	}
	return res.Data, nil
}
