package testserver

import (
	"bytes"
	"context"
	"encoding/json"
	"testing"

	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"
	"github.com/usememos/memos/api"
	apiv1 "github.com/usememos/memos/api/v1"
)

func TestSystemServer(t *testing.T) {
	ctx := context.Background()
	s, err := NewTestingServer(ctx, t)
	require.NoError(t, err)
	defer s.Shutdown(ctx)

	status, err := s.getSystemStatus()
	require.NoError(t, err)
	require.Equal(t, (*api.User)(nil), status.Host)

	signup := &apiv1.SignUp{
		Username: "testuser",
		Password: "testpassword",
	}
	user, err := s.postAuthSignup(signup)
	require.NoError(t, err)
	require.Equal(t, signup.Username, user.Username)

	status, err = s.getSystemStatus()
	require.NoError(t, err)
	require.Equal(t, user.ID, status.Host.ID)
	require.Equal(t, user.Username, status.Host.Username)
}

func (s *TestingServer) getSystemStatus() (*api.SystemStatus, error) {
	body, err := s.get("/api/status", nil)
	if err != nil {
		return nil, err
	}

	buf := &bytes.Buffer{}
	_, err = buf.ReadFrom(body)
	if err != nil {
		return nil, errors.Wrap(err, "fail to read response body")
	}

	type SystemStatusResponse struct {
		Data *api.SystemStatus `json:"data"`
	}
	res := new(SystemStatusResponse)
	if err = json.Unmarshal(buf.Bytes(), res); err != nil {
		return nil, errors.Wrap(err, "fail to unmarshal get system status response")
	}
	return res.Data, nil
}
