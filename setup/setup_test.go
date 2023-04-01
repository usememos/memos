package setup

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/usememos/memos/api"
)

func TestSetupServiceMakeSureHostUserNotExists(t *testing.T) {
	cc := map[string]struct {
		setupStore  func(*storeMock)
		expectedErr string
	}{
		"failed to get list": {
			setupStore: func(m *storeMock) {
				hostUserType := api.Host
				m.
					On("FindUserList", mock.Anything, &api.UserFind{
						Role: &hostUserType,
					}).
					Return(nil, errors.New("fake error"))
			},
			expectedErr: "find user list: fake error",
		},
		"success, not empty": {
			setupStore: func(m *storeMock) {
				hostUserType := api.Host
				m.
					On("FindUserList", mock.Anything, &api.UserFind{
						Role: &hostUserType,
					}).
					Return([]*api.User{
						{},
					}, nil)
			},
			expectedErr: "host user already exists",
		},
		"success, empty": {
			setupStore: func(m *storeMock) {
				hostUserType := api.Host
				m.
					On("FindUserList", mock.Anything, &api.UserFind{
						Role: &hostUserType,
					}).
					Return(nil, nil)
			},
		},
	}

	for n, c := range cc {
		c := c
		t.Run(n, func(t *testing.T) {
			sm := newStoreMock(t)
			if c.setupStore != nil {
				c.setupStore(sm)
			}

			srv := setupService{store: sm}
			err := srv.makeSureHostUserNotExists(context.Background())
			if c.expectedErr == "" {
				assert.NoError(t, err)
			} else {
				assert.EqualError(t, err, c.expectedErr)
			}
		})
	}
}

func TestSetupServiceCreateUser(t *testing.T) {
	expectedCreated := &api.UserCreate{
		Username: "demohero",
		Role:     api.Host,
		Nickname: "demohero",
		Password: "123456",
	}

	userCreateMatcher := mock.MatchedBy(func(arg *api.UserCreate) bool {
		return arg.Username == expectedCreated.Username &&
			arg.Role == expectedCreated.Role &&
			arg.Nickname == expectedCreated.Nickname &&
			arg.Password == expectedCreated.Password &&
			arg.PasswordHash != ""
	})

	cc := map[string]struct {
		setupStore                 func(*storeMock)
		hostUsername, hostPassword string
		expectedErr                string
	}{
		`username == "", password == ""`: {
			expectedErr: "validate: username is too short, minimum length is 3",
		},
		`username == "", password != ""`: {
			hostPassword: expectedCreated.Password,
			expectedErr:  "validate: username is too short, minimum length is 3",
		},
		`username != "", password == ""`: {
			hostUsername: expectedCreated.Username,
			expectedErr:  "validate: password is too short, minimum length is 6",
		},
		"failed to create": {
			setupStore: func(m *storeMock) {
				m.
					On("CreateUser", mock.Anything, userCreateMatcher).
					Return(nil, errors.New("fake error"))
			},
			hostUsername: expectedCreated.Username,
			hostPassword: expectedCreated.Password,
			expectedErr:  "create user: fake error",
		},
		"success": {
			setupStore: func(m *storeMock) {
				m.
					On("CreateUser", mock.Anything, userCreateMatcher).
					Return(nil, nil)
			},
			hostUsername: expectedCreated.Username,
			hostPassword: expectedCreated.Password,
		},
	}

	for n, c := range cc {
		c := c
		t.Run(n, func(t *testing.T) {
			sm := newStoreMock(t)
			if c.setupStore != nil {
				c.setupStore(sm)
			}

			srv := setupService{store: sm}
			err := srv.createUser(context.Background(), c.hostUsername, c.hostPassword)
			if c.expectedErr == "" {
				assert.NoError(t, err)
			} else {
				assert.EqualError(t, err, c.expectedErr)
			}
		})
	}
}

type storeMock struct {
	mock.Mock
}

func (m *storeMock) FindUserList(ctx context.Context, find *api.UserFind) ([]*api.User, error) {
	ret := m.Called(ctx, find)

	var u []*api.User
	ret1 := ret.Get(0)
	if ret1 != nil {
		u = ret1.([]*api.User)
	}

	return u, ret.Error(1)
}

func (m *storeMock) CreateUser(ctx context.Context, create *api.UserCreate) (*api.User, error) {
	ret := m.Called(ctx, create)

	var u *api.User
	ret1 := ret.Get(0)
	if ret1 != nil {
		u = ret1.(*api.User)
	}

	return u, ret.Error(1)
}

func newStoreMock(t *testing.T) *storeMock {
	m := &storeMock{}
	m.Mock.Test(t)

	t.Cleanup(func() { m.AssertExpectations(t) })

	return m
}
