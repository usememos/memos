package v1

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

func TestIsActiveCurrentUserFailsClosed(t *testing.T) {
	tests := []struct {
		name   string
		user   *store.User
		active bool
	}{
		{name: "missing"},
		{name: "normal", user: &store.User{RowStatus: store.Normal}, active: true},
		{name: "archived", user: &store.User{RowStatus: store.Archived}},
		{name: "unknown", user: &store.User{RowStatus: store.RowStatus("UNKNOWN")}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			require.Equal(t, test.active, isActiveCurrentUser(test.user))
		})
	}
}
