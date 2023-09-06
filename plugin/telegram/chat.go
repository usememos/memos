package telegram

type ChatType string

const (
	Private    = "private"
	Group      = "group"
	SuperGroup = "supergroup"
	Channel    = "channel"
)

type Chat struct {
	ID        int64    `json:"id"`
	Title     string   `json:"title"`      // Title for supergroups, channels and group chats
	Type      ChatType `json:"type"`       // Type of chat, can be either “private”, “group”, “supergroup” or “channel”
	FirstName string   `json:"first_name"` // FirstName of the other party in a private chat
	LastName  string   `json:"last_name"`  // LastName of the other party in a private chat
	UserName  string   `json:"username"`   // UserName for private chats, supergroups and channels if available
}
