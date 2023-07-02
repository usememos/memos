package testserver

import (
	"bytes"
	"context"
	"encoding/json"
	"testing"

	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"
	apiv1 "github.com/usememos/memos/api/v1"
)

func TestAuthServer(t *testing.T) {
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
}

func (s *TestingServer) postAuthSignup(signup *apiv1.SignUp) (*apiv1.User, error) {
	rawData, err := json.Marshal(&signup)
	if err != nil {
		return nil, errors.Wrap(err, "failed to marshal signup")
	}
	reader := bytes.NewReader(rawData)
	body, err := s.post("/api/v1/auth/signup", reader, nil)
	if err != nil {
		return nil, errors.Wrap(err, "fail to post request")
	}

	buf := &bytes.Buffer{}
	_, err = buf.ReadFrom(body)
	if err != nil {
		return nil, errors.Wrap(err, "fail to read response body")
	}

	user := &apiv1.User{}
	if err = json.Unmarshal(buf.Bytes(), user); err != nil {
		return nil, errors.Wrap(err, "fail to unmarshal post signup response")
	}
	return user, nil
}
