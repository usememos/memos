package v1

import "github.com/usememos/memos/server/profile"

// ActivityType is the type for an activity.
type ActivityType string

const (
	// User related.

	// ActivityUserCreate is the type for creating users.
	ActivityUserCreate ActivityType = "user.create"
	// ActivityUserUpdate is the type for updating users.
	ActivityUserUpdate ActivityType = "user.update"
	// ActivityUserDelete is the type for deleting users.
	ActivityUserDelete ActivityType = "user.delete"
	// ActivityUserAuthSignIn is the type for user signin.
	ActivityUserAuthSignIn ActivityType = "user.auth.signin"
	// ActivityUserAuthSignUp is the type for user signup.
	ActivityUserAuthSignUp ActivityType = "user.auth.signup"
	// ActivityUserSettingUpdate is the type for updating user settings.
	ActivityUserSettingUpdate ActivityType = "user.setting.update"

	// Memo related.

	// ActivityMemoCreate is the type for creating memos.
	ActivityMemoCreate ActivityType = "memo.create"
	// ActivityMemoUpdate is the type for updating memos.
	ActivityMemoUpdate ActivityType = "memo.update"
	// ActivityMemoDelete is the type for deleting memos.
	ActivityMemoDelete ActivityType = "memo.delete"

	// Shortcut related.

	// ActivityShortcutCreate is the type for creating shortcuts.
	ActivityShortcutCreate ActivityType = "shortcut.create"
	// ActivityShortcutUpdate is the type for updating shortcuts.
	ActivityShortcutUpdate ActivityType = "shortcut.update"
	// ActivityShortcutDelete is the type for deleting shortcuts.
	ActivityShortcutDelete ActivityType = "shortcut.delete"

	// Resource related.

	// ActivityResourceCreate is the type for creating resources.
	ActivityResourceCreate ActivityType = "resource.create"
	// ActivityResourceDelete is the type for deleting resources.
	ActivityResourceDelete ActivityType = "resource.delete"

	// Tag related.

	// ActivityTagCreate is the type for creating tags.
	ActivityTagCreate ActivityType = "tag.create"
	// ActivityTagDelete is the type for deleting tags.
	ActivityTagDelete ActivityType = "tag.delete"

	// Server related.

	// ActivityServerStart is the type for starting server.
	ActivityServerStart ActivityType = "server.start"
)

func (t ActivityType) String() string {
	return string(t)
}

// ActivityLevel is the level of activities.
type ActivityLevel string

const (
	// ActivityInfo is the INFO level of activities.
	ActivityInfo ActivityLevel = "INFO"
	// ActivityWarn is the WARN level of activities.
	ActivityWarn ActivityLevel = "WARN"
	// ActivityError is the ERROR level of activities.
	ActivityError ActivityLevel = "ERROR"
)

func (l ActivityLevel) String() string {
	return string(l)
}

type ActivityUserCreatePayload struct {
	UserID   int    `json:"userId"`
	Username string `json:"username"`
	Role     Role   `json:"role"`
}

type ActivityUserAuthSignInPayload struct {
	UserID int    `json:"userId"`
	IP     string `json:"ip"`
}

type ActivityUserAuthSignUpPayload struct {
	Username string `json:"username"`
	IP       string `json:"ip"`
}

type ActivityMemoCreatePayload struct {
	Content    string `json:"content"`
	Visibility string `json:"visibility"`
}

type ActivityShortcutCreatePayload struct {
	Title   string `json:"title"`
	Payload string `json:"payload"`
}

type ActivityResourceCreatePayload struct {
	Filename string `json:"filename"`
	Type     string `json:"type"`
	Size     int64  `json:"size"`
}

type ActivityTagCreatePayload struct {
	TagName string `json:"tagName"`
}

type ActivityServerStartPayload struct {
	ServerID string           `json:"serverId"`
	Profile  *profile.Profile `json:"profile"`
}

type Activity struct {
	ID int `json:"id"`

	// Standard fields
	CreatorID int   `json:"creatorId"`
	CreatedTs int64 `json:"createdTs"`

	// Domain specific fields
	Type    ActivityType  `json:"type"`
	Level   ActivityLevel `json:"level"`
	Payload string        `json:"payload"`
}

// ActivityCreate is the API message for creating an activity.
type ActivityCreate struct {
	// Standard fields
	CreatorID int

	// Domain specific fields
	Type    ActivityType `json:"type"`
	Level   ActivityLevel
	Payload string `json:"payload"`
}
