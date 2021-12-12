package api

import (
	"memos/utils"

	"github.com/gorilla/sessions"
)

var SessionStore = sessions.NewCookieStore([]byte(utils.GenUUID()))
