package api

import (
	"memos/common"

	"github.com/gorilla/sessions"
)

var SessionStore = sessions.NewCookieStore([]byte(common.GenUUID()))
