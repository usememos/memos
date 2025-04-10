package mail

import (
	"context"
	"github.com/stretchr/testify/require"
	"github.com/usememos/memos/store"
	"testing"
	"time"
)

func TestSendEamil(t *testing.T) {
	memo := &store.Memo{
		ID:         1,
		UID:        "USER1111111",
		RowStatus:  store.Normal,
		CreatorID:  4,
		CreatedTs:  time.Now().AddDate(0, 0, -2).Unix(),
		UpdatedTs:  time.Now().Unix(),
		Content:    "xxx content",
		Visibility: store.Public,
		Pinned:     false,
		Payload:    nil,
		ParentID:   nil,
	}
	user := &store.User{
		ID:       1,
		Username: "test11111",
		Email:    "873444264@qq.com",
	}
	ctx := context.Background()
	err := SendEmail(ctx, memo, user)
	require.NoError(t, err)
}
